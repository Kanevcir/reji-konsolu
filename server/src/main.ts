/**
 * V31.0 — Reji WebSocket hub + zombie purge + Redis fanout.
 */

import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { URL } from 'node:url';

import {
  authorizeAdminCommand,
  authorizeClientConnect,
  issueAccessToken,
  type ConnectionRole,
} from '../../src/reji/connectionAuth';
import { InMemoryEventBus, type EventBus } from '../../src/reji/eventBus';
import {
  getAdminBootstrapKey,
  getHttpPort,
  getPingIntervalMs,
  getPongTimeoutMs,
  getPublicConfigSnapshot,
  getRedisUrl,
  getWorkerId,
  getWsPath,
} from '../../src/reji/runtimeConfig';
import { TRIBUNE_ROOMS, type ShardRoomId } from '../../src/reji/roomSharding';
import { ZombiePurgeRegistry } from '../../src/reji/zombiePurge';
import { RedisEventBus } from './redisBus';

type ClientMeta = {
  id: string;
  role: ConnectionRole;
  room: ShardRoomId;
  ws: WebSocket;
};

export type HubStats = {
  workerId: string;
  connections: number;
  zombiesPurged: number;
  authDenied: number;
  adminPublishes: number;
  bus: ReturnType<EventBus['getStats']>;
  uptimeMs: number;
};

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return resolve({});
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(
  res: import('node:http').ServerResponse,
  status: number,
  body: unknown,
) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(payload);
}

function extractToken(req: IncomingMessage, url: URL): string | null {
  const q = url.searchParams.get('token');
  if (q) return q;
  const auth = req.headers.authorization;
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

function parseRoom(raw: string | null): ShardRoomId {
  if (raw && (TRIBUNE_ROOMS as readonly string[]).includes(raw)) {
    return raw as ShardRoomId;
  }
  if (raw === 'ALL_STADIUM') return 'ALL_STADIUM';
  return TRIBUNE_ROOMS[0]!;
}

export class RejiServer {
  private http: HttpServer;
  private wss: WebSocketServer;
  private bus: EventBus;
  private redisBus: RedisEventBus | null = null;
  private clients = new Map<string, ClientMeta>();
  private zombies = new ZombiePurgeRegistry();
  private unsubs: Array<() => void> = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private authDenied = 0;
  private adminPublishes = 0;
  private startedAt = Date.now();
  readonly workerId: string;

  constructor() {
    this.workerId = getWorkerId();
    this.http = createServer((req, res) => {
      void this.handleHttp(req, res);
    });
    this.wss = new WebSocketServer({
      server: this.http,
      path: getWsPath(),
      perMessageDeflate: false,
      maxPayload: 256 * 1024,
    });
    this.wss.on('connection', (ws, req) => {
      void this.handleWs(ws, req);
    });
    this.bus = new InMemoryEventBus();
  }

  async start(port: number = getHttpPort()) {
    const redisUrl = getRedisUrl();
    try {
      const redis = new RedisEventBus(redisUrl, this.workerId);
      await Promise.race([
        redis.connect(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('redis connect timeout')), 2_500);
        }),
      ]);
      this.redisBus = redis;
      this.bus = redis;
      console.log(`[reji] Redis connected · ${redisUrl} · worker=${this.workerId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[reji] Redis unavailable (${msg}) — in-memory bus`);
      try {
        await this.redisBus?.disconnect();
      } catch {
        // ignore
      }
      this.redisBus = null;
      this.bus = new InMemoryEventBus();
    }

    for (const room of [...TRIBUNE_ROOMS, 'ALL_STADIUM' as ShardRoomId]) {
      const unsub = this.bus.subscribe(room, (msg) => {
        this.fanoutLocal(msg.channel as ShardRoomId, msg.payload);
      });
      this.unsubs.push(unsub);
    }

    const pingMs = getPingIntervalMs();
    const pongMs = getPongTimeoutMs();
    this.pingTimer = setInterval(() => {
      const now = Date.now();
      this.zombies.markPingAll(now);
      for (const [id, meta] of this.clients) {
        if (meta.ws.readyState === WebSocket.OPEN) {
          try {
            meta.ws.ping();
            meta.ws.send(JSON.stringify({ type: 'ping', t: now }));
          } catch {
            // drop on next purge
          }
        } else {
          this.dropClient(id, 'not-open');
        }
      }
      const purged = this.zombies.purgeZombies(now, pongMs);
      for (const id of purged.purgedIds) {
        this.dropClient(id, 'zombie');
      }
      if (purged.purgedIds.length > 0) {
        console.log(
          `[reji] zombie purge · ${purged.purgedIds.length} · remaining=${this.clients.size}`,
        );
      }
    }, pingMs);

    await new Promise<void>((resolve) => {
      this.http.listen(port, '0.0.0.0', () => resolve());
    });
    console.log(
      `[reji] listening :${port}${getWsPath()} · ${JSON.stringify(getPublicConfigSnapshot())}`,
    );
  }

  async stop() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    for (const u of this.unsubs) u();
    this.unsubs = [];
    for (const id of [...this.clients.keys()]) this.dropClient(id, 'shutdown');
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    await new Promise<void>((resolve, reject) => {
      this.http.close((err) => (err ? reject(err) : resolve()));
    });
    if (this.redisBus) await this.redisBus.disconnect();
  }

  getStats(): HubStats {
    return {
      workerId: this.workerId,
      connections: this.clients.size,
      zombiesPurged: this.zombies.getPurgedTotal(),
      authDenied: this.authDenied,
      adminPublishes: this.adminPublishes,
      bus: this.bus.getStats(),
      uptimeMs: Date.now() - this.startedAt,
    };
  }

  private fanoutLocal(room: ShardRoomId, payload: string) {
    for (const meta of this.clients.values()) {
      if (meta.role === 'ADMIN') continue;
      if (meta.room !== room && room !== 'ALL_STADIUM' && meta.room !== 'ALL_STADIUM') {
        continue;
      }
      if (meta.ws.readyState === WebSocket.OPEN) {
        try {
          meta.ws.send(payload);
        } catch {
          // ignore
        }
      }
    }
  }

  private dropClient(id: string, reason: string) {
    const meta = this.clients.get(id);
    if (!meta) {
      this.zombies.unregister(id);
      return;
    }
    this.clients.delete(id);
    this.zombies.unregister(id);
    try {
      meta.ws.close(4000, reason);
    } catch {
      // ignore
    }
  }

  private async handleHttp(
    req: IncomingMessage,
    res: import('node:http').ServerResponse,
  ) {
    const host = req.headers.host ?? 'localhost';
    const url = new URL(req.url ?? '/', `http://${host}`);

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        ...this.getStats(),
        config: getPublicConfigSnapshot(),
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/metrics') {
      const s = this.getStats();
      const lines = [
        `# HELP reji_connections Concurrent WebSocket clients`,
        `# TYPE reji_connections gauge`,
        `reji_connections{worker="${s.workerId}"} ${s.connections}`,
        `# HELP reji_zombies_purged_total Zombie sockets purged`,
        `# TYPE reji_zombies_purged_total counter`,
        `reji_zombies_purged_total{worker="${s.workerId}"} ${s.zombiesPurged}`,
        `# HELP reji_auth_denied_total Auth denials`,
        `# TYPE reji_auth_denied_total counter`,
        `reji_auth_denied_total{worker="${s.workerId}"} ${s.authDenied}`,
      ];
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(lines.join('\n') + '\n');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/auth/token') {
      try {
        const body = (await readJsonBody(req)) as {
          sub?: string;
          role?: ConnectionRole;
          bootstrapKey?: string;
        };
        const role: ConnectionRole =
          body.role === 'ADMIN' ? 'ADMIN' : 'CLIENT_READONLY';
        if (role === 'ADMIN') {
          if (body.bootstrapKey !== getAdminBootstrapKey()) {
            this.authDenied += 1;
            sendJson(res, 403, { ok: false, error: 'invalid bootstrap key' });
            return;
          }
        }
        const sub =
          typeof body.sub === 'string' && body.sub.length > 0
            ? body.sub
            : role === 'ADMIN'
              ? `admin-${this.workerId}`
              : `client-${Date.now()}`;
        const token = issueAccessToken({ sub, role });
        sendJson(res, 200, { ok: true, token, role, sub, expiresInMs: undefined });
      } catch {
        sendJson(res, 400, { ok: false, error: 'invalid json' });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/auth/client') {
      try {
        const body = (await readJsonBody(req)) as { clientId?: string; room?: string };
        const sub =
          typeof body.clientId === 'string' && body.clientId.length > 0
            ? body.clientId
            : `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const token = issueAccessToken({ sub, role: 'CLIENT_READONLY' });
        sendJson(res, 200, {
          ok: true,
          token,
          role: 'CLIENT_READONLY' as const,
          sub,
          room: parseRoom(body.room ?? null),
          wsPath: getWsPath(),
        });
      } catch {
        sendJson(res, 400, { ok: false, error: 'invalid json' });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/auth/admin') {
      try {
        const body = (await readJsonBody(req)) as {
          bootstrapKey?: string;
          adminId?: string;
        };
        if (body.bootstrapKey !== getAdminBootstrapKey()) {
          this.authDenied += 1;
          sendJson(res, 403, { ok: false, error: 'invalid bootstrap key' });
          return;
        }
        const sub =
          typeof body.adminId === 'string' && body.adminId.length > 0
            ? body.adminId
            : `admin-${this.workerId}`;
        const token = issueAccessToken({ sub, role: 'ADMIN' });
        sendJson(res, 200, { ok: true, token, role: 'ADMIN' as const, sub });
      } catch {
        sendJson(res, 400, { ok: false, error: 'invalid json' });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/publish') {
      try {
        const token = extractToken(req, url);
        const body = (await readJsonBody(req)) as {
          action?: string;
          payload?: string;
          rooms?: string[];
        };
        const action = body.action ?? 'START_SHOW';
        const gate = authorizeAdminCommand(token, action);
        if (!gate.ok) {
          this.authDenied += 1;
          sendJson(res, 403, { ok: false, error: gate.error, code: gate.code });
          return;
        }
        const raw =
          typeof body.payload === 'string'
            ? body.payload
            : JSON.stringify({
                action,
                issuedAt: Date.now(),
                targetTimestamp: Date.now() + 80,
              });
        const rooms = (body.rooms?.length ? body.rooms : [...TRIBUNE_ROOMS]) as ShardRoomId[];
        const n = this.bus.publishFanout(rooms, raw);
        this.adminPublishes += 1;
        sendJson(res, 200, { ok: true, deliveries: n, rooms });
      } catch {
        sendJson(res, 400, { ok: false, error: 'invalid json' });
      }
      return;
    }

    sendJson(res, 404, { ok: false, error: 'not found' });
  }

  private handleWs(ws: WebSocket, req: IncomingMessage) {
    const host = req.headers.host ?? 'localhost';
    const url = new URL(req.url ?? '/', `http://${host}`);
    const token = extractToken(req, url);
    const gate = authorizeClientConnect(token);
    if (!gate.ok) {
      this.authDenied += 1;
      ws.close(4401, gate.error);
      return;
    }

    const id = gate.claims.sub;
    const room = parseRoom(url.searchParams.get('room'));
    const prev = this.clients.get(id);
    if (prev) this.dropClient(id, 'replaced');

    const meta: ClientMeta = {
      id,
      role: gate.claims.role,
      room,
      ws,
    };
    this.clients.set(id, meta);
    this.zombies.register(id, Date.now());

    ws.send(
      JSON.stringify({
        type: 'welcome',
        clientId: id,
        role: gate.claims.role,
        room,
        workerId: this.workerId,
        pingIntervalMs: getPingIntervalMs(),
      }),
    );

    ws.on('pong', () => {
      this.zombies.markPong(id, Date.now());
    });

    ws.on('message', (data: RawData) => {
      const now = Date.now();
      this.zombies.markPong(id, now);
      let text: string;
      try {
        text = typeof data === 'string' ? data : Buffer.from(data as Buffer).toString('utf8');
      } catch {
        return;
      }

      let msg: { type?: string; action?: string; payload?: unknown };
      try {
        msg = JSON.parse(text) as { type?: string; action?: string; payload?: unknown };
      } catch {
        return;
      }

      if (msg.type === 'pong' || msg.type === 'ping') {
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', t: now }));
        }
        return;
      }

      if (msg.type === 'publish' || msg.action) {
        const action = msg.action ?? 'START_SHOW';
        const adminGate = authorizeAdminCommand(token, action);
        if (!adminGate.ok) {
          this.authDenied += 1;
          ws.send(JSON.stringify({ type: 'error', code: adminGate.code, error: adminGate.error }));
          return;
        }
        const raw =
          typeof msg.payload === 'string'
            ? msg.payload
            : JSON.stringify(msg.payload ?? { action, issuedAt: now });
        this.bus.publishFanout([...TRIBUNE_ROOMS], raw);
        this.adminPublishes += 1;
        ws.send(JSON.stringify({ type: 'ack', action }));
      }
    });

    ws.on('close', () => {
      this.dropClient(id, 'close');
    });

    ws.on('error', () => {
      this.dropClient(id, 'error');
    });
  }
}

export async function bootMain() {
  const server = new RejiServer();
  await server.start();

  const shutdown = async (sig: string) => {
    console.log(`[reji] ${sig} — shutting down`);
    try {
      await server.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
