/**
 * V26.0 — Offline / PWA Fallback (Stadyum İnternet Çökme Koruması).
 * Canlı yayınlar timeline’a yazılır; bağlantı kopunca istemci
 * önceden önbelleğe alınan cue’ları yerel PTP saatine göre oynatır.
 */

import type { OutgoingPayload } from './types';

export type OfflineTimelineCue = {
  id: string;
  /** Mutlak PTP hedef (canlı yayında). */
  targetTimestamp: number;
  /** Show başlangıcına göre ofset (offline replay). */
  offsetFromShowStartMs: number;
  payload: OutgoingPayload;
};

export type OfflineShowTimeline = {
  version: 1;
  showId: string;
  /** İlk ACTIVE / koreografi cue’nun issuedAt’i. */
  showAnchorPtp: number;
  cues: OfflineTimelineCue[];
  updatedAt: number;
};

export type OfflineResilienceStatus = {
  online: boolean;
  cueCount: number;
  showAnchorPtp: number | null;
  playingOffline: boolean;
  lastAppliedCueId: string | null;
};

export type OfflineStorageAdapter = {
  save(timeline: OfflineShowTimeline): Promise<void> | void;
  load(): Promise<OfflineShowTimeline | null> | OfflineShowTimeline | null;
};

export const OFFLINE_TIMELINE_STORAGE_KEY = '@pulse/reji-offline-timeline-v1';

function clonePayload(payload: OutgoingPayload): OutgoingPayload {
  return {
    ...payload,
    matrix: payload.matrix ? { ...payload.matrix } : null,
  };
}

/** Bellek adaptörü — test / PWA hydrate. */
export function createMemoryStorageAdapter(): OfflineStorageAdapter {
  let stored: OfflineShowTimeline | null = null;
  return {
    save(timeline) {
      stored = {
        ...timeline,
        cues: timeline.cues.map((c) => ({
          ...c,
          payload: clonePayload(c.payload),
        })),
      };
    },
    load() {
      return stored
        ? {
            ...stored,
            cues: stored.cues.map((c) => ({
              ...c,
              payload: clonePayload(c.payload),
            })),
          }
        : null;
    },
  };
}

/**
 * İstemci offline dayanıklılık motoru.
 * React’e bağlı değil — telefon / PWA / simülasyon ortak.
 */
export class OfflineResilienceEngine {
  private online = true;
  private playingOffline = false;
  private showAnchorPtp: number | null = null;
  private cues: OfflineTimelineCue[] = [];
  private lastAppliedCueId: string | null = null;
  private seq = 0;
  private storage: OfflineStorageAdapter;
  private showId: string;

  constructor(
    storage: OfflineStorageAdapter = createMemoryStorageAdapter(),
    showId = 'live-show',
  ) {
    this.storage = storage;
    this.showId = showId;
  }

  getStatus(): OfflineResilienceStatus {
    return {
      online: this.online,
      cueCount: this.cues.length,
      showAnchorPtp: this.showAnchorPtp,
      playingOffline: this.playingOffline,
      lastAppliedCueId: this.lastAppliedCueId,
    };
  }

  getTimeline(): OfflineShowTimeline | null {
    if (this.showAnchorPtp == null) return null;
    return {
      version: 1,
      showId: this.showId,
      showAnchorPtp: this.showAnchorPtp,
      cues: this.cues.map((c) => ({
        ...c,
        payload: clonePayload(c.payload),
      })),
      updatedAt: Date.now(),
    };
  }

  /** Canlı paket — timeline’a ekle / güncelle. */
  ingestLivePayload(payload: OutgoingPayload): OfflineTimelineCue {
    const target =
      typeof payload.targetTimestamp === 'number'
        ? payload.targetTimestamp
        : (payload.issuedAt ?? Date.now()) + (payload.ptpBufferMs ?? 80);
    const issued = payload.issuedAt ?? target - (payload.ptpBufferMs ?? 80);

    if (this.showAnchorPtp == null) {
      this.showAnchorPtp = issued;
    }

    const cue: OfflineTimelineCue = {
      id: `cue-${++this.seq}-${target}`,
      targetTimestamp: target,
      offsetFromShowStartMs: Math.max(0, target - this.showAnchorPtp),
      payload: clonePayload(payload),
    };
    this.cues.push(cue);
    // Sıralı tut
    this.cues.sort((a, b) => a.targetTimestamp - b.targetTimestamp);
    void this.persist();
    return cue;
  }

  setOnline(online: boolean) {
    this.online = online;
    if (online) {
      this.playingOffline = false;
    }
  }

  markApplied(cueId: string) {
    this.lastAppliedCueId = cueId;
  }

  /**
   * Offline replay için kalan cue’lar.
   * nowPtp’den sonraki ofsetler, yeni anchor = nowPtp ile yeniden zamanlanır.
   */
  buildOfflineReplaySchedule(nowPtp: number): Array<{
    id: string;
    targetTimestamp: number;
    payload: OutgoingPayload;
  }> {
    this.playingOffline = true;
    const applied = this.lastAppliedCueId;
    let startIdx = 0;
    if (applied) {
      const i = this.cues.findIndex((c) => c.id === applied);
      if (i >= 0) startIdx = i + 1;
    } else {
      // Henüz uygulanmamış, geçmiş cue’ları atla
      startIdx = this.cues.findIndex((c) => c.targetTimestamp > nowPtp);
      if (startIdx < 0) startIdx = this.cues.length;
    }

    const remaining = this.cues.slice(startIdx);
    if (remaining.length === 0) return [];

    const firstOffset = remaining[0]!.offsetFromShowStartMs;
    return remaining.map((cue) => {
      const rel = cue.offsetFromShowStartMs - firstOffset;
      return {
        id: cue.id,
        targetTimestamp: nowPtp + Math.max(0, rel),
        payload: clonePayload(cue.payload),
      };
    });
  }

  async hydrateFromStorage() {
    try {
      const loaded = await this.storage.load();
      if (!loaded || !Array.isArray(loaded.cues)) return false;
      this.showId = loaded.showId || this.showId;
      this.showAnchorPtp = loaded.showAnchorPtp;
      this.cues = loaded.cues.map((c) => ({
        ...c,
        payload: clonePayload(c.payload),
      }));
      return this.cues.length > 0;
    } catch {
      return false;
    }
  }

  clear() {
    this.cues = [];
    this.showAnchorPtp = null;
    this.lastAppliedCueId = null;
    this.playingOffline = false;
    void this.persist();
  }

  private async persist() {
    try {
      const timeline = this.getTimeline();
      if (timeline) await this.storage.save(timeline);
    } catch {
      // PWA storage dolu olsa bile canlı yolu bozma
    }
  }
}

export function serializeOfflineTimeline(timeline: OfflineShowTimeline): string {
  return JSON.stringify(timeline);
}

export function parseOfflineTimeline(raw: string): OfflineShowTimeline | null {
  try {
    const parsed = JSON.parse(raw) as OfflineShowTimeline;
    if (parsed?.version !== 1 || !Array.isArray(parsed.cues)) return null;
    return parsed;
  } catch {
    return null;
  }
}
