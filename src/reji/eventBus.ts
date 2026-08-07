/**
 * V28.0 — Redis-benzeri Pub/Sub Event Bus.
 * Gerçek Redis’e bağlanmadan aynı sözleşmeyi sunar (simülasyon / tek süreç).
 * Production’da RedisAdapter ile değiştirilebilir.
 */

export type EventBusMessage = {
  channel: string;
  payload: string;
  /** Yayın anı (ms). */
  publishedAt: number;
};

export type EventBusHandler = (msg: EventBusMessage) => void;

export type EventBusStats = {
  channels: number;
  subscribers: number;
  published: number;
  delivered: number;
};

/**
 * In-process Pub/Sub — Redis PUBLISH / SUBSCRIBE sözleşmesi.
 */
export class InMemoryEventBus {
  private subs = new Map<string, Set<EventBusHandler>>();
  private published = 0;
  private delivered = 0;

  subscribe(channel: string, handler: EventBusHandler): () => void {
    let set = this.subs.get(channel);
    if (!set) {
      set = new Set();
      this.subs.set(channel, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) this.subs.delete(channel);
    };
  }

  /** Redis PUBLISH — abone sayısını döner. */
  publish(channel: string, payload: string, publishedAt = Date.now()): number {
    this.published += 1;
    const set = this.subs.get(channel);
    if (!set || set.size === 0) return 0;
    const msg: EventBusMessage = { channel, payload, publishedAt };
    let n = 0;
    for (const handler of set) {
      try {
        handler(msg);
        n += 1;
        this.delivered += 1;
      } catch {
        // tek abone hatası bus’ı bozmaz
      }
    }
    return n;
  }

  /** Pattern: room:* — test / debug. */
  publishFanout(channels: string[], payload: string, publishedAt = Date.now()): number {
    let total = 0;
    for (const ch of channels) {
      total += this.publish(ch, payload, publishedAt);
    }
    return total;
  }

  getStats(): EventBusStats {
    let subscribers = 0;
    for (const set of this.subs.values()) subscribers += set.size;
    return {
      channels: this.subs.size,
      subscribers,
      published: this.published,
      delivered: this.delivered,
    };
  }

  clear() {
    this.subs.clear();
    this.published = 0;
    this.delivered = 0;
  }
}

/** İleride ioredis bağlamak için arayüz. */
export type EventBus = Pick<
  InMemoryEventBus,
  'subscribe' | 'publish' | 'publishFanout' | 'getStats' | 'clear'
>;
