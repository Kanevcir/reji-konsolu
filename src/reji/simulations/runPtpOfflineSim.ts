/**
 * V26.0 — PTP Sync + Offline Resilience oto-simülasyon.
 * Mock istemciler: farklı jitter ile paket alır, targetTimestamp’te yürütür;
 * ağ kopunca timeline bağımsız devam eder.
 *
 * Çalıştır: npx --yes tsx src/reji/simulations/runPtpOfflineSim.ts
 */

import { scheduleAtPtp, measureScheduleError } from '../clientScheduler';
import {
  createMemoryStorageAdapter,
  OfflineResilienceEngine,
} from '../offlineResilience';
import {
  computeTargetTimestamp,
  DEFAULT_PTP_NETWORK_BUFFER_MS,
  PTP_EMERGENCY_BUFFER_MS,
} from '../ptpBroadcast';
import { StadiumClientRuntime } from '../stadiumClientRuntime';
import type { OutgoingPayload } from '../types';
import { createIdleMatrixCommand } from '../pixelMapper';

type SimResult = {
  name: string;
  ok: boolean;
  detail: string;
};

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function makePayload(
  action: OutgoingPayload['action'],
  issuedAt: number,
  bufferMs: number,
  extra?: Partial<OutgoingPayload>,
): OutgoingPayload {
  return {
    timestamp: Math.floor(issuedAt / 1000),
    action,
    targetZone: 'ALL',
    bpm: 120,
    status: action === 'EMERGENCY_BLACKOUT' ? 'SAFE_MODE' : 'ACTIVE',
    zoneMask: 15,
    swarmProtocol: false,
    matrix:
      action === 'EMERGENCY_BLACKOUT'
        ? null
        : createIdleMatrixCommand({
            engaged: true,
            overlayEmoji: action === 'START_SHOW' ? 'GOL' : null,
          }),
    issuedAt,
    targetTimestamp: issuedAt + bufferMs,
    ptpBufferMs: bufferMs,
    ...extra,
  };
}

/** Simüle edilmiş sanal saat — gerçek zaman beklemeden hızlandırır. */
class VirtualClock {
  private t: number;
  constructor(start: number) {
    this.t = start;
  }
  now = () => this.t;
  advance(ms: number) {
    this.t += ms;
  }
  set(ms: number) {
    this.t = ms;
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function testComputeTargetTimestamp(): Promise<SimResult> {
  const issued = 1_000_000;
  const meta = computeTargetTimestamp(issued, DEFAULT_PTP_NETWORK_BUFFER_MS);
  assert(meta.issuedAt === issued, 'issuedAt mismatch');
  assert(
    meta.targetTimestamp === issued + meta.ptpBufferMs,
    'target = issued + buffer',
  );
  assert(meta.ptpBufferMs >= 40, 'buffer floor');
  const emergency = computeTargetTimestamp(issued, PTP_EMERGENCY_BUFFER_MS);
  assert(
    emergency.ptpBufferMs <= meta.ptpBufferMs,
    'emergency buffer <= normal',
  );
  return {
    name: 'PTP computeTargetTimestamp',
    ok: true,
    detail: `T+${meta.ptpBufferMs}ms → ${meta.targetTimestamp}`,
  };
}

async function testSchedulerPrecision(): Promise<SimResult> {
  const clock = new VirtualClock(5_000);
  let firedAt = -1;
  const target = 5_040;

  // Virtual setTimeout that respects virtual clock via polling
  const handle = scheduleAtPtp({
    targetTimestamp: target,
    now: clock.now,
    precisionWindowMs: 4,
    scheduleLater: (fn, ms) =>
      setTimeout(() => {
        clock.advance(Math.max(1, ms));
        fn();
      }, 0) as ReturnType<typeof setTimeout>,
    onFire: () => {
      firedAt = clock.now();
    },
  });

  // Drive clock forward until fire
  for (let i = 0; i < 200 && firedAt < 0; i++) {
    await sleep(1);
    if (clock.now() < target) clock.advance(2);
  }

  handle.cancel();
  assert(firedAt >= 0, 'scheduler did not fire');
  const err = measureScheduleError(target, firedAt);
  assert(Math.abs(err) <= 8, `schedule error too high: ${err}ms`);
  return {
    name: 'Client precise scheduler',
    ok: true,
    detail: `firedAt=${firedAt} target=${target} err=${err}ms`,
  };
}

async function testMockClientsSync(): Promise<SimResult> {
  const t0 = Date.now();
  const buffer = 50;
  const payload = makePayload('START_SHOW', t0, buffer);

  const fires: Array<{ client: string; errorMs: number; source: string }> = [];

  const mkClient = (name: string, clockOffset: number) => {
    const clock = () => Date.now() + clockOffset;
    return new StadiumClientRuntime(
      {
        onApply: (cmd) => {
          fires.push({
            client: name,
            errorMs: cmd.errorMs,
            source: cmd.source,
          });
        },
      },
      createMemoryStorageAdapter(),
      clock,
    );
  };

  // Üç istemci — farklı yerel saat sapması (offset), aynı PTP target
  const a = mkClient('A', 0);
  const b = mkClient('B', 12); // +12ms skew but still uses same Date.now+offset as "synced"
  const c = mkClient('C', -8);

  // Not: StadiumClientRuntime clock is getSyncedTimestamp equivalent per device.
  // For true PTP, each device's clock() already includes Cristian offset —
  // so targetTimestamp is absolute on that timeline. We simulate with shared Date.now
  // and receive with artificial network delay.
  a.receiveLivePayload(payload);
  await sleep(15); // jitter
  b.receiveLivePayload(payload);
  await sleep(25);
  c.receiveLivePayload(payload);

  const waitUntil = payload.targetTimestamp + 80;
  while (Date.now() < waitUntil && fires.length < 3) {
    await sleep(5);
  }

  a.destroy();
  b.destroy();
  c.destroy();

  assert(fires.length === 3, `expected 3 fires, got ${fires.length}`);
  const maxErr = Math.max(...fires.map((f) => Math.abs(f.errorMs)));
  assert(maxErr <= 25, `multi-client sync error ${maxErr}ms > 25ms`);
  return {
    name: 'Mock clients PTP sync',
    ok: true,
    detail: `3 clients · max|err|=${maxErr.toFixed(1)}ms · ${fires.map((f) => f.client + ':' + f.errorMs.toFixed(0)).join(' ')}`,
  };
}

async function testOfflineFallback(): Promise<SimResult> {
  const applied: string[] = [];
  const storage = createMemoryStorageAdapter();
  const runtime = new StadiumClientRuntime(
    {
      onApply: (cmd) => {
        applied.push(`${cmd.source}:${cmd.payload.action}`);
      },
    },
    storage,
  );

  const t0 = Date.now();
  // Timeline: 3 cues spaced 60ms apart (relative)
  const cues = [
    makePayload('START_SHOW', t0, 40),
    makePayload('SET_BPM', t0 + 60, 40),
    makePayload('START_SHOW', t0 + 120, 40, {
      matrix: createIdleMatrixCommand({
        engaged: true,
        overlayEmoji: '🔥',
      }),
    }),
  ];

  for (const p of cues) {
    runtime.receiveLivePayload(p);
  }

  // İlk cue uygulansın
  await sleep(55);
  assert(applied.length >= 1, 'first live cue should apply');

  // İnternet koptu — kalanlar offline devam
  runtime.goOffline();
  await sleep(200);

  runtime.destroy();

  const offlineFires = applied.filter((x) => x.startsWith('offline:'));
  assert(
    applied.length >= 2,
    `expected continued playback, got ${applied.join(',')}`,
  );
  // En az bir offline uygulama veya tüm live (timing’e bağlı)
  const ok =
    applied.length >= 2 &&
    (offlineFires.length >= 1 || applied.length === 3);
  assert(ok, `offline resilience weak: ${applied.join(',')}`);

  // Persist / hydrate
  const engine = new OfflineResilienceEngine(storage);
  const hydrated = await engine.hydrateFromStorage();
  assert(hydrated, 'timeline hydrate failed');
  assert(engine.getStatus().cueCount >= 3, 'cueCount < 3 after hydrate');

  return {
    name: 'Offline / PWA timeline fallback',
    ok: true,
    detail: `applied=[${applied.join(', ')}] cues=${engine.getStatus().cueCount}`,
  };
}

async function testStateTransitions(): Promise<SimResult> {
  const storage = createMemoryStorageAdapter();
  const engine = new OfflineResilienceEngine(storage, 'sim-show');
  const t0 = 10_000;
  engine.ingestLivePayload(makePayload('START_SHOW', t0, 80));
  engine.ingestLivePayload(
    makePayload('EMERGENCY_BLACKOUT', t0 + 100, PTP_EMERGENCY_BUFFER_MS),
  );
  engine.setOnline(false);
  const sched = engine.buildOfflineReplaySchedule(t0 + 50);
  assert(sched.length >= 1, 'offline schedule empty');
  engine.setOnline(true);
  assert(engine.getStatus().online === true, 'back online');
  engine.clear();
  assert(engine.getStatus().cueCount === 0, 'clear failed');
  return {
    name: 'Offline engine state transitions',
    ok: true,
    detail: `sched=${sched.length} cleared`,
  };
}

async function main() {
  const tests = [
    testComputeTargetTimestamp,
    testSchedulerPrecision,
    testMockClientsSync,
    testOfflineFallback,
    testStateTransitions,
  ];

  const results: SimResult[] = [];
  let failed = 0;

  console.log('\n=== V26 PTP + Offline Resilience Simulation ===\n');

  for (const t of tests) {
    try {
      const r = await t();
      results.push(r);
      console.log(`✔ ${r.name}`);
      console.log(`  ${r.detail}`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: t.name, ok: false, detail: msg });
      console.log(`✘ ${t.name}`);
      console.log(`  ${msg}`);
    }
  }

  console.log(
    `\n--- ${results.filter((r) => r.ok).length}/${results.length} passed ---\n`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
