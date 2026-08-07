/**
 * V28.0 — Scalability & Thundering Herd oto-simülasyon (50.000 istemci).
 *
 * Çalıştır: npm run test:scale
 */

import { InMemoryEventBus } from '../eventBus';
import {
  analyzeReconnectSpread,
  computeReconnectDelayMs,
} from '../reconnectBackoff';
import { ScaleCluster, TRIBUNE_ROOMS, tribuneToRoom } from '../roomSharding';
import {
  applyNaiveReconnect,
  applyThunderingHerdReconnect,
  buildClientStubs,
  buildGolPayload,
  runScaleFanoutSimulation,
  SCALE_DEFAULT_WORKERS,
  SCALE_TARGET_CLIENTS,
} from '../scaleCluster';

type SimResult = { name: string; ok: boolean; detail: string };

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testBackoffJitterBounds(): SimResult {
  const delays: number[] = [];
  for (let i = 0; i < 1000; i++) {
    delays.push(
      computeReconnectDelayMs(3, {
        baseMs: 250,
        capMs: 30_000,
        random: () => i / 1000,
      }),
    );
  }
  const min = Math.min(...delays);
  const max = Math.max(...delays);
  assert(min >= 0, 'min >= 0');
  assert(max <= 2000, `max ${max} > 2000`);
  assert(max - min >= 1500, `spread too small ${max - min}`);
  return {
    name: 'Full jitter backoff bounds (attempt=3)',
    ok: true,
    detail: `delay∈[${min},${max}] ceiling=2000`,
  };
}

function testThunderingHerdSpread(): SimResult {
  const N = SCALE_TARGET_CLIENTS;
  const recoveredAt = 1_000_000;

  const naive = applyNaiveReconnect(buildClientStubs(N), recoveredAt);
  const naiveSpread = analyzeReconnectSpread(naive, 100);
  assert(naiveSpread.spanMs === 0, 'naive should collapse to 0 span');
  assert(naiveSpread.maxSameMs === N, 'naive all same ms');

  const stubs = buildClientStubs(N);
  const times = applyThunderingHerdReconnect(stubs, recoveredAt, 4, 42);
  // attempt=4 → ceiling = min(30000, 250*16) = 4000ms
  const spread = analyzeReconnectSpread(times, 100);

  assert(spread.spanMs > 1000, `jitter span too narrow: ${spread.spanMs}ms`);
  assert(
    spread.maxSameMs < N * 0.01,
    `too many same-ms reconnects: ${spread.maxSameMs}`,
  );
  assert(
    spread.maxPerBucket < N * 0.12,
    `100ms bucket overload: ${spread.maxPerBucket}`,
  );
  assert(spread.bucketCount > 10, `not enough buckets: ${spread.bucketCount}`);

  return {
    name: 'Thundering Herd mitigated (50k jitter spread)',
    ok: true,
    detail: `span=${spread.spanMs}ms buckets=${spread.bucketCount} max/bucket=${spread.maxPerBucket} maxSameMs=${spread.maxSameMs} (naiveSameMs=${naiveSpread.maxSameMs})`,
  };
}

function testRoomShardingBalance(): SimResult {
  const stubs = buildClientStubs(SCALE_TARGET_CLIENTS);
  const counts: Record<string, number> = {};
  for (const r of TRIBUNE_ROOMS) counts[r] = 0;
  for (const s of stubs) {
    counts[s.room] = (counts[s.room] ?? 0) + 1;
  }
  for (const r of TRIBUNE_ROOMS) {
    assert(counts[r] === 12_500, `${r} count ${counts[r]} != 12500`);
  }
  assert(tribuneToRoom('EAST') === 'EAST_TRIBUNE', 'EAST room name');
  return {
    name: 'Room sharding balance (4×12500)',
    ok: true,
    detail: TRIBUNE_ROOMS.map((r) => `${r}=${counts[r]}`).join(' '),
  };
}

function test50kGolFanout(): SimResult {
  const t0 = Date.now();
  const result = runScaleFanoutSimulation({
    clients: SCALE_TARGET_CLIENTS,
    workers: SCALE_DEFAULT_WORKERS,
  });
  const elapsed = Date.now() - t0;

  assert(
    result.uniqueReceivers === SCALE_TARGET_CLIENTS,
    `unique receivers ${result.uniqueReceivers}`,
  );
  assert(
    result.clientDeliveries === SCALE_TARGET_CLIENTS,
    `deliveries ${result.clientDeliveries}`,
  );
  assert(result.golOk === SCALE_TARGET_CLIENTS, `GOL ok ${result.golOk}`);

  const stats = result.cluster.getStats();
  assert(stats.workers === SCALE_DEFAULT_WORKERS, 'worker count');
  assert(stats.clients === SCALE_TARGET_CLIENTS, 'client count');
  for (const w of stats.perWorker) {
    assert(w.clients > 0, `empty worker ${w.workerId}`);
  }

  result.cluster.stop();

  return {
    name: '50k GOL Pub/Sub fanout via room shards',
    ok: true,
    detail: `deliveries=${result.clientDeliveries} golOk=${result.golOk} workers=${stats.workers} ${elapsed}ms busPub=${stats.bus.published}`,
  };
}

function testWorkerRoomIsolation(): SimResult {
  const bus = new InMemoryEventBus();
  const cluster = new ScaleCluster(bus, 2);
  cluster.start();
  cluster.connectClient('east-1', 'EAST_TRIBUNE');
  cluster.connectClient('west-1', 'WEST_TRIBUNE');
  cluster.publishToRoom('EAST_TRIBUNE', buildGolPayload(Date.now()));

  assert(cluster.receiveCounts.get('east-1') === 1, 'east got msg');
  assert(
    (cluster.receiveCounts.get('west-1') ?? 0) === 0,
    'west must not get EAST-only publish',
  );
  cluster.stop();
  return {
    name: 'Worker room isolation (EAST-only publish)',
    ok: true,
    detail: 'east-1=1 west-1=0',
  };
}

function main() {
  const tests = [
    testBackoffJitterBounds,
    testThunderingHerdSpread,
    testRoomShardingBalance,
    test50kGolFanout,
    testWorkerRoomIsolation,
  ];

  console.log('\n=== V28 Scalability & Load Balancing Simulation ===\n');
  console.log(`Target concurrent clients: ${SCALE_TARGET_CLIENTS}\n`);

  let failed = 0;
  for (const t of tests) {
    try {
      const r = t();
      console.log(`✔ ${r.name}`);
      console.log(`  ${r.detail}`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✘ ${t.name}`);
      console.log(`  ${msg}`);
    }
  }

  console.log(
    `\n--- ${tests.length - failed}/${tests.length} passed ---\n`,
  );
  if (failed > 0) process.exitCode = 1;
}

main();
