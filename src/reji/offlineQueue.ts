/**
 * V13.0 — Çevrimdışı Senkronizasyon ve Yerel Kuyruk (Offline Queue & Event Replay).
 * FIFO komut dizisi; DISCONNECTED / FALLBACK_UDP iken birikir, CONNECTED’da flush.
 */

import { getSyncedTimestamp } from './clockSync';
import type { NetworkLinkStatus } from './networkEngine';
import type { OutgoingPayload, SocketStatus } from './types';

/** Kuyrukta tutulan zaman damgalı olay. */
export type OfflineQueueItem = {
  id: string;
  /** PTP senkronize ms. */
  queuedAt: number;
  payload: OutgoingPayload;
};

export type OfflineQueueStats = {
  pending: number;
  lastEnqueuedAt: number | null;
  lastFlushedAt: number | null;
  lastPurgedAt: number | null;
};

export const DEFAULT_OFFLINE_QUEUE_STATS: OfflineQueueStats = {
  pending: 0,
  lastEnqueuedAt: null,
  lastFlushedAt: null,
  lastPurgedAt: null,
};

/** Bu link durumlarında Outgoing Payload kuyruğa yazılır. */
export function shouldEnqueueOffline(
  status: SocketStatus | NetworkLinkStatus,
): boolean {
  return status === 'DISCONNECTED' || status === 'FALLBACK_UDP';
}

/** UI etiketi — örn. OFFLINE QUEUE: 5 QUEUED */
export function formatOfflineQueueLabel(pending: number) {
  if (pending <= 0) return 'OFFLINE QUEUE: 0 PENDING';
  return `OFFLINE QUEUE: ${pending} QUEUED`;
}

/**
 * FIFO offline event kuyruğu.
 * try-catch korumalı; max kapasite ile bellek şişmesi engellenir.
 */
export class OfflineQueueEngine {
  private queue: OfflineQueueItem[] = [];
  private seq = 0;
  private readonly maxSize: number;
  private lastEnqueuedAt: number | null = null;
  private lastFlushedAt: number | null = null;
  private lastPurgedAt: number | null = null;

  constructor(maxSize = 256) {
    this.maxSize = Math.max(8, maxSize);
  }

  size() {
    return this.queue.length;
  }

  getStats(): OfflineQueueStats {
    return {
      pending: this.queue.length,
      lastEnqueuedAt: this.lastEnqueuedAt,
      lastFlushedAt: this.lastFlushedAt,
      lastPurgedAt: this.lastPurgedAt,
    };
  }

  /** FIFO sonuna ekle; taşmada en eski düşer. */
  enqueue(payload: OutgoingPayload): OfflineQueueItem | null {
    try {
      this.seq += 1;
      const item: OfflineQueueItem = {
        id: `oq-${this.seq}-${getSyncedTimestamp()}`,
        queuedAt: getSyncedTimestamp(),
        payload: { ...payload },
      };
      this.queue.push(item);
      if (this.queue.length > this.maxSize) {
        this.queue.shift();
      }
      this.lastEnqueuedAt = item.queuedAt;
      return item;
    } catch {
      return null;
    }
  }

  /** Tüm öğeleri FIFO sırasıyla al ve kuyruğu boşalt (replay öncesi). */
  drain(): OfflineQueueItem[] {
    try {
      const items = this.queue.slice();
      this.queue = [];
      this.lastFlushedAt = getSyncedTimestamp();
      return items;
    } catch {
      this.queue = [];
      return [];
    }
  }

  /** Peek — kopya, silmeden. */
  peekAll(): OfflineQueueItem[] {
    try {
      return this.queue.map((item) => ({
        ...item,
        payload: { ...item.payload },
      }));
    } catch {
      return [];
    }
  }

  /**
   * Blackout güvenliği — tüm birikmiş komutları yok et.
   * @returns silinen olay sayısı
   */
  purge(): number {
    try {
      const count = this.queue.length;
      this.queue = [];
      this.lastPurgedAt = getSyncedTimestamp();
      return count;
    } catch {
      this.queue = [];
      return 0;
    }
  }
}
