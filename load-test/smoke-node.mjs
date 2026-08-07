/**
 * Node fallback smoke load test (JWT auth + WebSocket ping/pong).
 * Used when k6 binary is unavailable; mirrors load-test.js smoke profile.
 *
 *   node load-test/smoke-node.mjs
 *   LOADTEST_VUS=20 LOADTEST_SESSION_SEC=12 node load-test/smoke-node.mjs
 */

import { performance } from 'node:perf_hooks';

const BASE_URL = process.env.LOADTEST_BASE_URL || 'http://127.0.0.1:8080';
const WS_URL = process.env.LOADTEST_WS_URL || 'ws://127.0.0.1:8080/ws';
const VUS = Number(process.env.LOADTEST_VUS || 20);
const SESSION_SEC = Number(process.env.LOADTEST_SESSION_SEC || 12);
const ROOMS = ['NORTH_TRIBUNE', 'SOUTH_TRIBUNE', 'EAST_TRIBUNE', 'WEST_TRIBUNE'];

const { WebSocket } = await import('ws');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error(`health ${res.status}`);
  return res.json();
}

async function authClient(clientId, room) {
  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}/auth/client`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, room }),
  });
  const latency = performance.now() - t0;
  const body = await res.json();
  if (!res.ok || !body?.ok || !body.token) {
    throw new Error(`auth failed ${res.status} ${JSON.stringify(body)}`);
  }
  return { token: body.token, latency };
}

function holdSocket(token, room, sessionMs) {
  return new Promise((resolve) => {
    const url = `${WS_URL}?token=${encodeURIComponent(token)}&room=${encodeURIComponent(room)}`;
    const ws = new WebSocket(url);
    let pongs = 0;
    let welcome = false;
    let closedClean = false;
    const started = Date.now();

    const finish = (ok, error) => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      resolve({
        ok,
        welcome,
        pongs,
        error: error || null,
        durationMs: Date.now() - started,
      });
    };

    const timer = setTimeout(() => {
      closedClean = true;
      finish(welcome || pongs > 0, null);
    }, sessionMs);

    ws.on('open', () => {
      // keepalive pongs so zombie purge does not drop us
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg?.type === 'welcome') welcome = true;
      if (msg?.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', t: Date.now() }));
        pongs += 1;
      }
    });

    ws.on('ping', () => {
      try {
        ws.pong();
        pongs += 1;
      } catch {
        // ignore
      }
    });

    const pingIv = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'pong', t: Date.now() }));
        pongs += 1;
      }
    }, 4000);

    ws.on('error', (err) => {
      clearTimeout(timer);
      clearInterval(pingIv);
      finish(false, err?.message || 'ws error');
    });

    ws.on('close', () => {
      clearInterval(pingIv);
      if (!closedClean && Date.now() - started < sessionMs - 500) {
        clearTimeout(timer);
        finish(welcome && pongs > 0, 'closed early');
      }
    });
  });
}

async function runVu(i) {
  const clientId = `smoke-${process.pid}-${i}-${Date.now()}`;
  const room = ROOMS[i % ROOMS.length];
  const { token, latency } = await authClient(clientId, room);
  const session = await holdSocket(token, room, SESSION_SEC * 1000);
  return { authLatency: latency, ...session };
}

async function main() {
  console.log(`Smoke load → ${BASE_URL} · VUs=${VUS} · session=${SESSION_SEC}s`);
  const before = await fetchHealth();
  const memBefore = process.memoryUsage();

  const t0 = performance.now();
  // staggered connect (avoid thundering herd on smoke)
  const jobs = [];
  for (let i = 0; i < VUS; i++) {
    jobs.push(
      (async () => {
        await sleep(Math.floor(i * 150));
        return runVu(i);
      })(),
    );
  }
  const results = await Promise.all(jobs);
  const elapsed = performance.now() - t0;

  const after = await fetchHealth();
  const memAfter = process.memoryUsage();

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const authP95 = [...results.map((r) => r.authLatency)].sort((a, b) => a - b)[
    Math.floor(results.length * 0.95)
  ];
  const pongs = results.reduce((s, r) => s + r.pongs, 0);
  const rssDeltaMb = (memAfter.rss - memBefore.rss) / (1024 * 1024);
  const heapDeltaMb = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);

  const report = {
    ok: fail === 0 && after.ok,
    vus: VUS,
    sessionsOk: ok,
    sessionsFail: fail,
    authP95Ms: Math.round(authP95 || 0),
    pongs,
    elapsedMs: Math.round(elapsed),
    serverBefore: {
      connections: before.connections,
      zombiesPurged: before.zombiesPurged,
      authDenied: before.authDenied,
      uptimeMs: before.uptimeMs,
    },
    serverAfter: {
      connections: after.connections,
      zombiesPurged: after.zombiesPurged,
      authDenied: after.authDenied,
      uptimeMs: after.uptimeMs,
    },
    memory: {
      rssDeltaMb: Number(rssDeltaMb.toFixed(2)),
      heapDeltaMb: Number(heapDeltaMb.toFixed(2)),
      note: 'client-side delta; server stayed up (health ok)',
    },
    rateLimitSignal: after.authDenied - before.authDenied > VUS ? 'suspected' : 'none',
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    console.error('SMOKE FAIL');
    process.exit(1);
  }
  // soft leak heuristic: client process heap jump absurd for smoke size
  if (heapDeltaMb > 200) {
    console.error('SMOKE FAIL — client heap delta too large', heapDeltaMb);
    process.exit(1);
  }
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE ERROR', err);
  process.exit(1);
});
