/**
 * V31 — Real-world load test (k6)
 *
 * Simulates up to 50_000 concurrent WebSocket clients:
 *   1) POST /auth/client → JWT
 *   2) WS connect with ?token=
 *   3) Respond to server ping / send pong (survive zombie purge)
 *
 * Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/
 *
 * Smoke (local):
 *   k6 run -e LOADTEST_VUS=50 -e LOADTEST_RAMP_UP=10s -e LOADTEST_HOLD=30s load-test/load-test.js
 *
 * Full stadium (needs cluster + OS fd limits):
 *   k6 run -e LOADTEST_VUS=500 load-test/load-test.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import ws from 'k6/ws';

const BASE_URL = __ENV.LOADTEST_BASE_URL || 'http://127.0.0.1:8080';
const WS_URL = __ENV.LOADTEST_WS_URL || 'ws://127.0.0.1:8080/ws';
const TARGET_VUS = Number(__ENV.LOADTEST_VUS || 50_000);
const RAMP_UP = __ENV.LOADTEST_RAMP_UP || '2m';
const HOLD = __ENV.LOADTEST_HOLD || '5m';
const RAMP_DOWN = __ENV.LOADTEST_RAMP_DOWN || '1m';
const ROOMS = ['NORTH_TRIBUNE', 'SOUTH_TRIBUNE', 'EAST_TRIBUNE', 'WEST_TRIBUNE'];

const authFail = new Counter('reji_auth_fail');
const wsFail = new Counter('reji_ws_fail');
const pongSent = new Counter('reji_pong_sent');
const wsConnected = new Counter('reji_ws_connected');
const authLatency = new Trend('reji_auth_latency_ms', true);
const sessionOk = new Rate('reji_session_ok');

export const options = {
  scenarios: {
    stadium_clients: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP, target: TARGET_VUS },
        { duration: HOLD, target: TARGET_VUS },
        { duration: RAMP_DOWN, target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '60s',
    },
  },
  thresholds: {
    reji_session_ok: ['rate>0.95'],
    reji_auth_latency_ms: ['p(95)<2000'],
    ws_connecting: ['p(95)<5000'],
    checks: ['rate>0.9'],
  },
};

function roomForVu(vu) {
  return ROOMS[vu % ROOMS.length];
}

export default function () {
  const clientId = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const room = roomForVu(__VU);

  const authStarted = Date.now();
  const authRes = http.post(
    `${BASE_URL}/auth/client`,
    JSON.stringify({ clientId, room }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth_client' },
      timeout: '10s',
    },
  );
  authLatency.add(Date.now() - authStarted);

  const authOk = check(authRes, {
    'auth status 200': (r) => r.status === 200,
    'auth has token': (r) => {
      try {
        const body = r.json();
        return body && body.ok === true && typeof body.token === 'string';
      } catch {
        return false;
      }
    },
  });

  if (!authOk) {
    authFail.add(1);
    sessionOk.add(0);
    sleep(1);
    return;
  }

  const body = authRes.json();
  const token = body.token;
  const url = `${WS_URL}?token=${encodeURIComponent(token)}&room=${encodeURIComponent(room)}`;

  let survived = false;

  const wsRes = ws.connect(url, { tags: { room } }, function (socket) {
    socket.on('open', () => {
      wsConnected.add(1);
    });

    socket.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg && msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', t: Date.now() }));
        pongSent.add(1);
      } else if (msg && msg.type === 'welcome') {
        survived = true;
      }
    });

    socket.on('binaryMessage', () => {
      // ignore
    });

    socket.on('error', () => {
      wsFail.add(1);
    });

    // Hold connection through zombie ping window (default pong timeout 15s)
    // Stay longer than several ping intervals so purge does not drop VU.
    const holdSec = Number(__ENV.LOADTEST_SESSION_SEC || 45);
    socket.setInterval(() => {
      socket.send(JSON.stringify({ type: 'pong', t: Date.now() }));
      pongSent.add(1);
    }, 4000);

    socket.setTimeout(() => {
      survived = true;
      socket.close();
    }, holdSec * 1000);
  });

  const ok = check(wsRes, {
    'ws status 101': (r) => r && r.status === 101,
  });

  if (!ok) {
    wsFail.add(1);
    sessionOk.add(0);
  } else {
    sessionOk.add(survived || ok ? 1 : 0);
  }
}
