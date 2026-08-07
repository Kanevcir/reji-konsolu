/**
 * V30.0 — Security / Telemetry / Zombie Purge simülasyonu (mock clients).
 *
 * Çalıştır: npm run test:security
 */

import {
  authorizeAdminCommand,
  authorizeClientConnect,
  issueAccessToken,
  verifyAccessToken,
  DEFAULT_AUTH_SECRET,
} from '../connectionAuth';
import { createIdlePayload } from '../payload';
import { SecureScaleGateway } from '../secureGateway';
import { TRIBUNE_ROOMS } from '../roomSharding';
import type { OutgoingPayload } from '../types';
import { DEFAULT_PONG_TIMEOUT_MS } from '../zombiePurge';
import { DEFAULT_CLOCK_SYNC_STATS } from '../clockSync';

type SimResult = { name: string; ok: boolean; detail: string };

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function buildGol(issuedAt: number): OutgoingPayload {
  return {
    ...createIdlePayload(120),
    action: 'START_SHOW',
    issuedAt,
    targetTimestamp: issuedAt + 80,
    ptpBufferMs: 80,
  };
}

function testIssueAndVerifyAdmin(): SimResult {
  const token = issueAccessToken({ sub: 'admin-1', role: 'ADMIN' });
  const v = verifyAccessToken(token);
  assert(v.ok, 'admin verify failed');
  assert(v.claims.role === 'ADMIN', 'role ADMIN');
  assert(v.claims.sub === 'admin-1', 'sub');
  return { name: 'Issue/verify ADMIN token', ok: true, detail: `exp=${v.claims.exp}` };
}

function testClientReadonlyForbiddenPublish(): SimResult {
  const clientTok = issueAccessToken({
    sub: 'phone-42',
    role: 'CLIENT_READONLY',
  });
  const gate = authorizeAdminCommand(clientTok, 'START_SHOW');
  assert(!gate.ok, 'should deny client');
  assert(gate.code === 'FORBIDDEN', `code=${(gate as { code: string }).code}`);
  return {
    name: 'CLIENT_READONLY cannot publish Theme/GOL/Strobe',
    ok: true,
    detail: gate.error,
  };
}

function testInvalidSignatureRejected(): SimResult {
  const token = issueAccessToken({ sub: 'x', role: 'ADMIN' });
  const tampered = token.slice(0, -2) + 'xx';
  const v = verifyAccessToken(tampered);
  assert(!v.ok, 'tampered should fail');
  const gate = authorizeClientConnect(tampered);
  assert(!gate.ok, 'connect with bad sig denied');
  return { name: 'Tampered JWT signature rejected', ok: true, detail: v.error };
}

function testExpiredToken(): SimResult {
  const now = 1_000_000;
  const token = issueAccessToken(
    { sub: 'old', role: 'ADMIN', ttlMs: 1000, nowMs: now },
    DEFAULT_AUTH_SECRET,
  );
  const v = verifyAccessToken(token, DEFAULT_AUTH_SECRET, now + 5000);
  assert(!v.ok, 'expired');
  return { name: 'Expired token rejected', ok: true, detail: v.error };
}

function testGatewayAdminPublishAndClientFanout(): SimResult {
  const gw = new SecureScaleGateway(undefined, 4);
  gw.start();
  const adminTok = gw.issueAdminToken('reji');
  const N = 200;
  for (let i = 0; i < N; i++) {
    const id = `c-${i}`;
    const tok = gw.issueClientToken(id);
    const room = TRIBUNE_ROOMS[i % TRIBUNE_ROOMS.length]!;
    const r = gw.connect(id, tok, room);
    assert(r.ok, `connect ${id}`);
  }

  const rogue = gw.issueClientToken('rogue');
  const denied = gw.publishAdmin(buildGol(Date.now()), rogue);
  assert(!denied.ok, 'rogue publish must fail');
  assert(denied.code === 'FORBIDDEN', 'FORBIDDEN');

  const ok = gw.publishAdmin(buildGol(Date.now()), adminTok);
  assert(ok.ok, 'admin publish');
  assert(ok.deliveries > 0, `bus deliveries ${ok.deliveries}`);
  const clientRx = Array.from(gw.cluster.receiveCounts.values()).reduce(
    (a, b) => a + b,
    0,
  );
  assert(clientRx === N, `client deliveries ${clientRx} !== ${N}`);

  const health = gw.getHealth({
    ...DEFAULT_CLOCK_SYNC_STATS,
    clockOffset: 1.2,
    rtt: 18,
    status: 'SYNCED',
  });
  assert(health.concurrentConnections === N, `conn ${health.concurrentConnections}`);
  assert(health.workerLoads.length === 4, '4 workers');
  assert(health.adminPublishes === 1, '1 admin publish');
  assert(health.authDenied >= 1, 'auth denied counted');

  gw.stop();
  return {
    name: 'Gateway admin publish + 200 mock clients',
    ok: true,
    detail: `clientRx=${clientRx} bus=${ok.deliveries} workers=${health.workerLoads.map((w) => w.loadPct).join('/')}%`,
  };
}

function testZombiePurge(): SimResult {
  const gw = new SecureScaleGateway(undefined, 2);
  gw.start();
  const t0 = 10_000_000;
  const alive = 50;
  const zombies = 30;

  for (let i = 0; i < alive + zombies; i++) {
    const id = `z-${i}`;
    const tok = gw.issueClientToken(id);
    const room = TRIBUNE_ROOMS[i % TRIBUNE_ROOMS.length]!;
    assert(gw.connect(id, tok, room, t0).ok, 'connect');
  }

  // Canlılar pong verir; zombiler vermez (lastPong = t0)
  gw.sendPingRound(t0 + 1_000);
  for (let i = 0; i < alive; i++) {
    gw.handlePong(`z-${i}`, t0 + 5_000);
  }

  // timeout=15s: zombie (pong@t0) düşer; alive (pong@t0+5s) kalır
  const purgeAt = t0 + DEFAULT_PONG_TIMEOUT_MS + 1_000;
  const purged = gw.purgeZombies(purgeAt);
  assert(
    purged.purgedIds.length === zombies,
    `expected ${zombies} purged, got ${purged.purgedIds.length}`,
  );
  assert(purged.remaining === alive, `remaining ${purged.remaining}`);
  assert(gw.cluster.getStats().clients === alive, 'cluster clients');

  const health = gw.getHealth(DEFAULT_CLOCK_SYNC_STATS, purgeAt);
  assert(health.zombiesPurged === zombies, 'zombiesPurged total');
  assert(health.concurrentConnections === alive, 'concurrent after purge');

  gw.stop();
  return {
    name: 'Zombie purge (ping/pong timeout)',
    ok: true,
    detail: `purged=${purged.purgedIds.length} remaining=${purged.remaining}`,
  };
}

function testNoTokenConnectDenied(): SimResult {
  const gw = new SecureScaleGateway();
  gw.start();
  const r = gw.connect('anon', '', 'NORTH_TRIBUNE');
  assert(!r.ok, 'empty token denied');
  gw.stop();
  return { name: 'Connect without token denied', ok: true, detail: r.error };
}

function main() {
  const tests = [
    testIssueAndVerifyAdmin,
    testClientReadonlyForbiddenPublish,
    testInvalidSignatureRejected,
    testExpiredToken,
    testNoTokenConnectDenied,
    testGatewayAdminPublishAndClientFanout,
    testZombiePurge,
  ];

  const results: SimResult[] = [];
  let failed = 0;
  for (const t of tests) {
    try {
      const r = t();
      results.push(r);
      if (!r.ok) failed += 1;
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAIL  ${t.name} — ${msg}`);
      results.push({ name: t.name, ok: false, detail: msg });
    }
  }

  console.log('');
  console.log(`Security suite: ${results.length - failed}/${results.length} passed`);
  if (failed > 0) process.exit(1);
}

main();
