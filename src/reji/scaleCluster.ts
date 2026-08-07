/**
 * V28.0 — Scalability cluster simülasyon yardımcıları.
 * 50k hafif istemci stub + thundering herd + GOL fanout.
 */

import { InMemoryEventBus } from './eventBus';
import {
  computeReconnectDelayMs,
  scheduleReconnectAt,
  analyzeReconnectSpread,
  DEFAULT_BACKOFF_BASE_MS,
  DEFAULT_BACKOFF_CAP_MS,
} from './reconnectBackoff';
import {
  ScaleCluster,
  TRIBUNE_ROOMS,
  tribuneToRoom,
  type ShardRoomId,
} from './roomSharding';
import type { StadiumTribuneId } from './seatPixelMap';
import type { OutgoingPayload } from './types';
import { createIdleMatrixCommand } from './pixelMapper';

export const SCALE_TARGET_CLIENTS = 50_000;
export const SCALE_DEFAULT_WORKERS = 8;

const TRIBUNES: StadiumTribuneId[] = ['NORTH', 'SOUTH', 'EAST', 'WEST'];

export type ScaleClientStub = {
  id: string;
  tribune: StadiumTribuneId;
  room: ShardRoomId;
  reconnectAt: number;
};

/**
 * Deterministik PRNG (mulberry32) — tekrarlanabilir test.
 */
export function createSeededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** N stub üret — tribünlere dengeli dağıt. */
export function buildClientStubs(count: number): ScaleClientStub[] {
  const stubs: ScaleClientStub[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const tribune = TRIBUNES[i % TRIBUNES.length]!;
    stubs[i] = {
      id: `c-${i}`,
      tribune,
      room: tribuneToRoom(tribune),
      reconnectAt: 0,
    };
  }
  return stubs;
}

/**
 * Outage sonrası thundering herd: her stub için jitter’lı reconnectAt.
 * attempt=3 → geniş yayılım (base*8).
 */
export function applyThunderingHerdReconnect(
  stubs: ScaleClientStub[],
  recoveredAtMs: number,
  attempt = 3,
  seed = 42,
): number[] {
  const random = createSeededRandom(seed);
  const times: number[] = new Array(stubs.length);
  for (let i = 0; i < stubs.length; i++) {
    const stub = stubs[i]!;
    // Her istemciye biraz farklı seed kayması
    const delay = computeReconnectDelayMs(attempt, {
      baseMs: DEFAULT_BACKOFF_BASE_MS,
      capMs: DEFAULT_BACKOFF_CAP_MS,
      random: () => {
        const u = random();
        return (u + (i % 997) / 9970) % 1;
      },
    });
    stub.reconnectAt = recoveredAtMs + delay;
    times[i] = stub.reconnectAt;
  }
  return times;
}

/** Karşılaştırma: jitter YOK — hepsi aynı ms (thundering). */
export function applyNaiveReconnect(
  stubs: ScaleClientStub[],
  recoveredAtMs: number,
): number[] {
  for (const s of stubs) s.reconnectAt = recoveredAtMs;
  return stubs.map((s) => s.reconnectAt);
}

export function buildGolPayload(issuedAt: number): OutgoingPayload {
  const buffer = 80;
  return {
    timestamp: Math.floor(issuedAt / 1000),
    action: 'START_SHOW',
    targetZone: 'ALL',
    bpm: 140,
    status: 'ACTIVE',
    zoneMask: 15,
    swarmProtocol: true,
    matrix: createIdleMatrixCommand({
      engaged: true,
      puzzlePreset: 'live_emoji',
      overlayEmoji: 'GOL',
    }),
    issuedAt,
    targetTimestamp: issuedAt + buffer,
    ptpBufferMs: buffer,
  };
}

/**
 * 50k cluster kur, bağla, GOL yayınla.
 */
export function runScaleFanoutSimulation(opts?: {
  clients?: number;
  workers?: number;
}): {
  cluster: ScaleCluster;
  stubs: ScaleClientStub[];
  busDeliveries: number;
  clientDeliveries: number;
  uniqueReceivers: number;
  golOk: number;
} {
  const clients = opts?.clients ?? SCALE_TARGET_CLIENTS;
  const workers = opts?.workers ?? SCALE_DEFAULT_WORKERS;
  const bus = new InMemoryEventBus();
  const cluster = new ScaleCluster(bus, workers);
  cluster.start();

  const stubs = buildClientStubs(clients);
  for (const s of stubs) {
    cluster.connectClient(s.id, s.room);
  }

  const payload = buildGolPayload(Date.now());
  const busDeliveries = cluster.publishRejiPayload(payload);

  let golOk = 0;
  for (const s of stubs) {
    const raw = cluster.lastPayloadByClient.get(s.id);
    if (raw && raw.includes('"GOL"')) golOk += 1;
  }

  return {
    cluster,
    stubs,
    busDeliveries,
    clientDeliveries: cluster.getStats().deliveries,
    uniqueReceivers: cluster.receiveCounts.size,
    golOk,
  };
}

export {
  analyzeReconnectSpread,
  scheduleReconnectAt,
  TRIBUNE_ROOMS,
};
