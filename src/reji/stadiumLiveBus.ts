/**
 * V29.0 — Reji ↔ Stadium Visualizer canlı yayın bus’ı.
 * Aynı sekme: abone listesi. Yeni sekme: BroadcastChannel / localStorage.
 */

import type { MatrixCommand } from './pixelMapper';
import type { OutgoingPayload } from './types';

export const STADIUM_LIVE_CHANNEL = 'reji-stadium-live-v1';

export type StadiumLiveFrame = {
  v: 1;
  /** PTP yayın paketi (targetTimestamp dahil). */
  payload: OutgoingPayload | null;
  /** Hızlı erişim — payload.matrix ile aynı. */
  matrix: MatrixCommand | null;
  publishedAt: number;
};

export type StadiumLiveHandler = (frame: StadiumLiveFrame) => void;

type BusGlobal = {
  handlers: Set<StadiumLiveHandler>;
  last: StadiumLiveFrame | null;
  bc: BroadcastChannel | null;
};

function getBus(): BusGlobal {
  const g = globalThis as typeof globalThis & { __rejiStadiumLive?: BusGlobal };
  if (!g.__rejiStadiumLive) {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel(STADIUM_LIVE_CHANNEL);
      }
    } catch {
      bc = null;
    }
    g.__rejiStadiumLive = {
      handlers: new Set(),
      last: null,
      bc,
    };
    if (bc) {
      bc.onmessage = (ev) => {
        try {
          const frame = ev.data as StadiumLiveFrame;
          if (!frame || frame.v !== 1) return;
          g.__rejiStadiumLive!.last = frame;
          for (const h of g.__rejiStadiumLive!.handlers) {
            try {
              h(frame);
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }
      };
    }
  }
  return g.__rejiStadiumLive;
}

export function publishStadiumLive(input: {
  payload: OutgoingPayload | null;
  matrix?: MatrixCommand | null;
}): StadiumLiveFrame {
  const frame: StadiumLiveFrame = {
    v: 1,
    payload: input.payload,
    matrix:
      input.matrix !== undefined
        ? input.matrix
        : (input.payload?.matrix ?? null),
    publishedAt: Date.now(),
  };
  const bus = getBus();
  bus.last = frame;
  for (const h of bus.handlers) {
    try {
      h(frame);
    } catch {
      // ignore
    }
  }
  try {
    bus.bc?.postMessage(frame);
  } catch {
    // ignore
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        STADIUM_LIVE_CHANNEL,
        JSON.stringify({ t: frame.publishedAt }),
      );
    }
  } catch {
    // ignore
  }
  return frame;
}

export function getLastStadiumLiveFrame(): StadiumLiveFrame | null {
  return getBus().last;
}

export function subscribeStadiumLive(handler: StadiumLiveHandler): () => void {
  const bus = getBus();
  bus.handlers.add(handler);
  if (bus.last) {
    try {
      handler(bus.last);
    } catch {
      // ignore
    }
  }
  return () => {
    bus.handlers.delete(handler);
  };
}
