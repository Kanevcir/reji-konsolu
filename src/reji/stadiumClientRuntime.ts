/**
 * V26–V27 — Stadium Client Runtime.
 * WebSocket/UDP → PTP scheduler; offline timeline; Seat→Pixel + Visual Slicer.
 */

import { scheduleAtPtp, type ScheduledHandle } from './clientScheduler';
import { getSyncedTimestamp } from './clockSync';
import {
  OfflineResilienceEngine,
  type OfflineResilienceStatus,
  type OfflineStorageAdapter,
} from './offlineResilience';
import {
  SeatOnboardingAuth,
  type SeatMapping,
  type SeatTicket,
} from './seatPixelMap';
import { sliceVisualForDevice, type SlicedPixelFrame } from './visualSlicer';
import type { OutgoingPayload } from './types';
import type { MatrixCommand } from './pixelMapper';

export type AppliedClientCommand = {
  cueId: string;
  payload: OutgoingPayload;
  firedAt: number;
  targetTimestamp: number;
  errorMs: number;
  source: 'live' | 'offline';
  /** V27 — bu cihazın dilimlenmiş pikseli. */
  sliced?: SlicedPixelFrame | null;
};

export type StadiumClientHandlers = {
  onApply?: (cmd: AppliedClientCommand) => void;
  onStatus?: (status: OfflineResilienceStatus & { pendingLive: number }) => void;
  onSeatBound?: (mapping: SeatMapping) => void;
};

/**
 * Tek saha cihazı / PWA istemci çalışma zamanı.
 */
export class StadiumClientRuntime {
  private engine: OfflineResilienceEngine;
  private handlers: StadiumClientHandlers;
  private pending = new Map<string, ScheduledHandle>();
  private destroyed = false;
  private clock: () => number;
  private seatAuth = new SeatOnboardingAuth();
  private seatMapping: SeatMapping | null = null;
  private lastMatrix: MatrixCommand | null = null;

  constructor(
    handlers: StadiumClientHandlers = {},
    storage?: OfflineStorageAdapter,
    clock: () => number = getSyncedTimestamp,
  ) {
    this.handlers = handlers;
    this.engine = new OfflineResilienceEngine(storage);
    this.clock = clock;
  }

  getStatus() {
    return {
      ...this.engine.getStatus(),
      pendingLive: this.pending.size,
      seat: this.seatMapping,
    };
  }

  getSeatMapping() {
    return this.seatMapping;
  }

  /**
   * V27 — Onboarding: bilet ile koltuk→piksel bağla.
   * Örn. Tribün Doğu, Blok 102, Sıra 5, Koltuk 12.
   */
  bindSeat(ticket: SeatTicket, deviceId?: string) {
    const result = this.seatAuth.authenticate(ticket, deviceId);
    if (!result.ok) return result;
    this.seatMapping = result.mapping;
    try {
      this.handlers.onSeatBound?.(result.mapping);
    } catch {
      // ignore
    }
    return result;
  }

  /** Anlık görsel dilim — bağlı koltuk + son matrix. */
  sliceNow(nowMs?: number): SlicedPixelFrame | null {
    if (!this.seatMapping) return null;
    return sliceVisualForDevice({
      matrix: this.lastMatrix,
      coord: this.seatMapping.coord,
      nowMs: nowMs ?? this.clock(),
    });
  }

  async hydrate() {
    return this.engine.hydrateFromStorage();
  }

  /**
   * Canlı ağ paketi — timeline’a yaz + targetTimestamp’te uygula.
   */
  receiveLivePayload(payload: OutgoingPayload) {
    if (this.destroyed) return;
    this.engine.setOnline(true);
    const cue = this.engine.ingestLivePayload(payload);
    this.scheduleCue(cue.id, cue.targetTimestamp, cue.payload, 'live');
    this.emitStatus();
  }

  /** Bağlantı koptu — kalan timeline’ı yerel PTP ile sürdür. */
  goOffline() {
    if (this.destroyed) return;
    this.engine.setOnline(false);
    // Bekleyen canlı zamanlayıcıları iptal — offline yeniden zamanla
    for (const h of this.pending.values()) h.cancel();
    this.pending.clear();

    const now = this.clock();
    const schedule = this.engine.buildOfflineReplaySchedule(now);
    for (const item of schedule) {
      this.scheduleCue(item.id, item.targetTimestamp, item.payload, 'offline');
    }
    this.emitStatus();
  }

  /** Bağlantı geri geldi. */
  goOnline() {
    if (this.destroyed) return;
    this.engine.setOnline(true);
    this.emitStatus();
  }

  destroy() {
    this.destroyed = true;
    for (const h of this.pending.values()) h.cancel();
    this.pending.clear();
  }

  private scheduleCue(
    cueId: string,
    targetTimestamp: number,
    payload: OutgoingPayload,
    source: 'live' | 'offline',
  ) {
    const existing = this.pending.get(cueId);
    if (existing) existing.cancel();

    const handle = scheduleAtPtp({
      targetTimestamp,
      now: this.clock,
      onFire: () => {
        this.pending.delete(cueId);
        const firedAt = this.clock();
        this.engine.markApplied(cueId);
        if (payload.matrix) {
          this.lastMatrix = payload.matrix;
        } else if (payload.action === 'EMERGENCY_BLACKOUT') {
          this.lastMatrix = null;
        }
        const sliced =
          this.seatMapping != null
            ? sliceVisualForDevice({
                matrix: this.lastMatrix,
                coord: this.seatMapping.coord,
                nowMs: firedAt,
              })
            : null;
        const cmd: AppliedClientCommand = {
          cueId,
          payload,
          firedAt,
          targetTimestamp,
          errorMs: firedAt - targetTimestamp,
          source,
          sliced,
        };
        try {
          this.handlers.onApply?.(cmd);
        } catch {
          // ignore
        }
        this.emitStatus();
      },
    });
    this.pending.set(cueId, handle);
  }

  private emitStatus() {
    try {
      this.handlers.onStatus?.(this.getStatus());
    } catch {
      // ignore
    }
  }
}
