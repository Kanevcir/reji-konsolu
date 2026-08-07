/**
 * V30.0 — Zombie Client Purge (Ping/Pong Timeout).
 * Yanıt vermeyen soketleri bellekten düşürür.
 */

import {
  getPingIntervalMs,
  getPongTimeoutMs,
} from './runtimeConfig';

export const DEFAULT_PING_INTERVAL_MS = getPingIntervalMs();
export const DEFAULT_PONG_TIMEOUT_MS = getPongTimeoutMs();

export type ConnectionHeartbeat = {
  clientId: string;
  connectedAt: number;
  lastPingAt: number;
  lastPongAt: number;
  missedPongs: number;
};

export type PurgeResult = {
  purgedIds: string[];
  remaining: number;
  checked: number;
};

/**
 * Heartbeat defteri — her bağlantı için son pong.
 */
export class ZombiePurgeRegistry {
  private heartbeats = new Map<string, ConnectionHeartbeat>();
  private purgedTotal = 0;
  private pingSeq = 0;

  get size() {
    return this.heartbeats.size;
  }

  getPurgedTotal() {
    return this.purgedTotal;
  }

  register(clientId: string, nowMs: number = Date.now()) {
    this.heartbeats.set(clientId, {
      clientId,
      connectedAt: nowMs,
      lastPingAt: nowMs,
      lastPongAt: nowMs,
      missedPongs: 0,
    });
  }

  unregister(clientId: string) {
    this.heartbeats.delete(clientId);
  }

  /** Sunucu ping gönderdi — zaman damgası. */
  markPing(clientId: string, nowMs: number = Date.now()) {
    const hb = this.heartbeats.get(clientId);
    if (!hb) return;
    hb.lastPingAt = nowMs;
    this.pingSeq += 1;
  }

  markPingAll(nowMs: number = Date.now()) {
    for (const hb of this.heartbeats.values()) {
      hb.lastPingAt = nowMs;
    }
    this.pingSeq += 1;
  }

  /** İstemci pong — canlı. */
  markPong(clientId: string, nowMs: number = Date.now()) {
    const hb = this.heartbeats.get(clientId);
    if (!hb) return false;
    hb.lastPongAt = nowMs;
    hb.missedPongs = 0;
    return true;
  }

  get(clientId: string) {
    return this.heartbeats.get(clientId) ?? null;
  }

  listIds() {
    return Array.from(this.heartbeats.keys());
  }

  /**
   * lastPongAt + timeout < now → zombie.
   * Dönen id’ler registry’den silinir.
   */
  purgeZombies(
    nowMs: number = Date.now(),
    timeoutMs: number = DEFAULT_PONG_TIMEOUT_MS,
  ): PurgeResult {
    const purgedIds: string[] = [];
    for (const [id, hb] of this.heartbeats) {
      if (nowMs - hb.lastPongAt > timeoutMs) {
        purgedIds.push(id);
      }
    }
    for (const id of purgedIds) {
      this.heartbeats.delete(id);
      this.purgedTotal += 1;
    }
    return {
      purgedIds,
      remaining: this.heartbeats.size,
      checked: purgedIds.length + this.heartbeats.size,
    };
  }

  /** Stale oranı: son pong’u timeout/2’den eski olanlar / toplam. */
  staleRatio(
    nowMs: number = Date.now(),
    timeoutMs: number = DEFAULT_PONG_TIMEOUT_MS,
  ): number {
    const total = this.heartbeats.size;
    if (total === 0) return 0;
    const soft = timeoutMs * 0.5;
    let stale = 0;
    for (const hb of this.heartbeats.values()) {
      if (nowMs - hb.lastPongAt > soft) stale += 1;
    }
    return stale / total;
  }
}
