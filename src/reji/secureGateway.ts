/**
 * V30.0 — Secure Scale Gateway.
 * Auth middleware + room cluster + zombie purge + health snapshot.
 */

import type { ClockSyncStats } from './clockSync';
import {
  authorizeAdminCommand,
  authorizeClientConnect,
  issueAccessToken,
  type AuthClaims,
  type ConnectionRole,
  DEFAULT_AUTH_SECRET,
} from './connectionAuth';
import { InMemoryEventBus, type EventBus } from './eventBus';
import {
  ScaleCluster,
  TRIBUNE_ROOMS,
  type ShardRoomId,
} from './roomSharding';
import {
  buildWorkerLoads,
  estimateJitterMs,
  type SystemHealthSnapshot,
} from './systemHealth';
import type { OutgoingPayload } from './types';
import {
  DEFAULT_PONG_TIMEOUT_MS,
  ZombiePurgeRegistry,
} from './zombiePurge';

export type GatewaySession = {
  clientId: string;
  role: ConnectionRole;
  room: ShardRoomId | null;
  claims: AuthClaims;
};

export type SecureConnectResult =
  | { ok: true; session: GatewaySession }
  | { ok: false; error: string };

export type SecurePublishResult =
  | { ok: true; deliveries: number }
  | { ok: false; error: string; code: string };

/**
 * Endüstriyel güvenlikli yayın kapısı.
 */
export class SecureScaleGateway {
  readonly cluster: ScaleCluster;
  readonly zombies: ZombiePurgeRegistry;
  private secret: string;
  private sessions = new Map<string, GatewaySession>();
  private authDenied = 0;
  private adminPublishes = 0;
  private totalDisconnects = 0;
  private prevRtt: number | null = null;
  private lastJitter = 0;
  private adminToken: string | null = null;

  constructor(
    bus: EventBus = new InMemoryEventBus(),
    workerCount = 4,
    secret: string = DEFAULT_AUTH_SECRET,
  ) {
    this.cluster = new ScaleCluster(bus, workerCount);
    this.zombies = new ZombiePurgeRegistry();
    this.secret = secret;
  }

  start() {
    this.cluster.start();
  }

  stop() {
    this.cluster.stop();
  }

  /** Reji konsolu için ADMIN token üret / yenile. */
  issueAdminToken(adminId = 'reji-admin'): string {
    this.adminToken = issueAccessToken(
      { sub: adminId, role: 'ADMIN' },
      this.secret,
    );
    return this.adminToken;
  }

  getAdminToken() {
    if (!this.adminToken) return this.issueAdminToken();
    return this.adminToken;
  }

  /** Read-only istemci token. */
  issueClientToken(clientId: string): string {
    return issueAccessToken(
      { sub: clientId, role: 'CLIENT_READONLY' },
      this.secret,
    );
  }

  /**
   * Bağlantı — token zorunlu.
   * CLIENT_READONLY odaya join; ADMIN room opsiyonel (yayıncı).
   */
  connect(
    clientId: string,
    token: string,
    room: ShardRoomId | null = null,
    nowMs: number = Date.now(),
  ): SecureConnectResult {
    const gate = authorizeClientConnect(token, this.secret, nowMs);
    if (!gate.ok) {
      this.authDenied += 1;
      return { ok: false, error: gate.error };
    }
    if (gate.claims.sub !== clientId && gate.claims.role !== 'ADMIN') {
      // Token sub eşleşmesi (ADMIN broadcast kimliği serbest)
      this.authDenied += 1;
      return { ok: false, error: 'token sub mismatch' };
    }

    if (gate.claims.role === 'CLIENT_READONLY') {
      if (!room) {
        return { ok: false, error: 'room required for client' };
      }
      this.cluster.connectClient(clientId, room);
      this.zombies.register(clientId, nowMs);
    }

    const session: GatewaySession = {
      clientId,
      role: gate.claims.role,
      room,
      claims: gate.claims,
    };
    this.sessions.set(clientId, session);
    return { ok: true, session };
  }

  disconnect(clientId: string) {
    this.cluster.disconnectClient(clientId);
    this.zombies.unregister(clientId);
    if (this.sessions.delete(clientId)) {
      this.totalDisconnects += 1;
    }
  }

  /** İstemci pong — zombie sayacını sıfırla. */
  handlePong(clientId: string, nowMs: number = Date.now()) {
    return this.zombies.markPong(clientId, nowMs);
  }

  /** Ping turu (tüm istemciler). */
  sendPingRound(nowMs: number = Date.now()) {
    this.zombies.markPingAll(nowMs);
  }

  /**
   * Admin komut yayını — middleware zorunlu.
   * CLIENT token ile çağrı → red.
   */
  publishAdmin(
    payload: OutgoingPayload,
    adminToken: string | null = this.adminToken,
    nowMs: number = Date.now(),
  ): SecurePublishResult {
    const gate = authorizeAdminCommand(
      adminToken,
      payload.action,
      this.secret,
      nowMs,
    );
    if (!gate.ok) {
      this.authDenied += 1;
      return { ok: false, error: gate.error, code: gate.code };
    }
    const deliveries = this.cluster.publishRejiPayload(payload);
    this.adminPublishes += 1;
    return { ok: true, deliveries };
  }

  /** Zombie purge tick. */
  purgeZombies(
    nowMs: number = Date.now(),
    timeoutMs: number = DEFAULT_PONG_TIMEOUT_MS,
  ) {
    const result = this.zombies.purgeZombies(nowMs, timeoutMs);
    for (const id of result.purgedIds) {
      this.cluster.disconnectClient(id);
      if (this.sessions.delete(id)) {
        this.totalDisconnects += 1;
      }
    }
    return result;
  }

  /**
   * Telemetri paneli için mock filoyu seed et (read-only istemciler).
   */
  seedDemoFleet(count: number, nowMs: number = Date.now()) {
    const n = Math.max(0, Math.floor(count));
    for (let i = 0; i < n; i++) {
      const id = `demo-client-${i}`;
      if (this.sessions.has(id)) continue;
      const token = this.issueClientToken(id);
      const room = TRIBUNE_ROOMS[i % TRIBUNE_ROOMS.length]!;
      this.connect(id, token, room, nowMs);
    }
  }

  /** Canlı istemcilere pong (zombie simülasyonu hariç). */
  pongAllAlive(nowMs: number = Date.now(), skipEvery = 0) {
    let i = 0;
    for (const id of this.zombies.listIds()) {
      i += 1;
      if (skipEvery > 0 && i % skipEvery === 0) continue;
      this.zombies.markPong(id, nowMs);
    }
  }

  getHealth(clock: ClockSyncStats, nowMs: number = Date.now()): SystemHealthSnapshot {
    const stats = this.cluster.getStats();
    this.lastJitter = estimateJitterMs(clock.rtt, this.prevRtt);
    this.prevRtt = clock.rtt;

    let adminSessions = 0;
    let clientSessions = 0;
    for (const s of this.sessions.values()) {
      if (s.role === 'ADMIN') adminSessions += 1;
      else clientSessions += 1;
    }

    const concurrent = stats.clients;
    const disconnectedRate =
      concurrent + this.totalDisconnects > 0
        ? this.zombies.staleRatio(nowMs) * 0.5 +
          (this.totalDisconnects /
            Math.max(1, concurrent + this.totalDisconnects)) *
            0.5
        : this.zombies.staleRatio(nowMs);

    return {
      updatedAt: nowMs,
      concurrentConnections: concurrent,
      sessionCount: this.sessions.size,
      adminSessions,
      clientSessions,
      workerLoads: buildWorkerLoads(stats.perWorker),
      ptpOffsetMs: clock.clockOffset,
      ptpRttMs: clock.rtt,
      ptpJitterMs: this.lastJitter,
      ptpStatus: clock.status,
      zombiesPurged: this.zombies.getPurgedTotal(),
      disconnectedRate: Math.min(1, disconnectedRate),
      authDenied: this.authDenied,
      adminPublishes: this.adminPublishes,
    };
  }
}
