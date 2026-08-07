/**
 * V31.0 — Redis Pub/Sub EventBus adapter (yatay ölçek).
 * Worker’lar arası Reji fanout için Redis PUBLISH / SUBSCRIBE.
 */

import Redis from 'ioredis';

import type { EventBus, EventBusHandler, EventBusMessage, EventBusStats } from '../../src/reji/eventBus';
import { getRedisUrl, getWorkerId } from '../../src/reji/runtimeConfig';

const CHANNEL_PREFIX = 'reji:';

export class RedisEventBus implements EventBus {
  private pub: Redis;
  private sub: Redis;
  private handlers = new Map<string, Set<EventBusHandler>>();
  private published = 0;
  private delivered = 0;
  private ready = false;
  readonly workerId: string;

  constructor(redisUrl: string = getRedisUrl(), workerId: string = getWorkerId()) {
    this.workerId = workerId;
    this.pub = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    this.sub = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    this.pub.on('error', () => {
      // fallback / disconnect sırasında unhandled error spam’ini engelle
    });
    this.sub.on('error', () => {
      // ignore
    });
    this.sub.on('message', (channel, payload) => {
      const logical = channel.startsWith(CHANNEL_PREFIX)
        ? channel.slice(CHANNEL_PREFIX.length)
        : channel;
      const set = this.handlers.get(logical);
      if (!set || set.size === 0) return;
      const msg: EventBusMessage = {
        channel: logical,
        payload,
        publishedAt: Date.now(),
      };
      for (const handler of set) {
        try {
          handler(msg);
          this.delivered += 1;
        } catch {
          // tek abone hatası bus’ı bozmaz
        }
      }
    });
  }

  async connect(): Promise<void> {
    if (this.ready) return;
    await Promise.all([this.pub.connect(), this.sub.connect()]);
    this.ready = true;
  }

  async disconnect(): Promise<void> {
    this.handlers.clear();
    try {
      this.sub.removeAllListeners('message');
      this.sub.disconnect(false);
    } catch {
      // ignore
    }
    try {
      this.pub.disconnect(false);
    } catch {
      // ignore
    }
    this.ready = false;
  }

  private redisChannel(channel: string) {
    return `${CHANNEL_PREFIX}${channel}`;
  }

  subscribe(channel: string, handler: EventBusHandler): () => void {
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
      void this.sub.subscribe(this.redisChannel(channel));
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) {
        this.handlers.delete(channel);
        void this.sub.unsubscribe(this.redisChannel(channel));
      }
    };
  }

  publish(channel: string, payload: string, _publishedAt = Date.now()): number {
    this.published += 1;
    void this.pub.publish(this.redisChannel(channel), payload);
    // Redis async — abone sayısı bilinmez; 1 = publish kabul
    return 1;
  }

  publishFanout(channels: string[], payload: string, publishedAt = Date.now()): number {
    let total = 0;
    for (const ch of channels) {
      total += this.publish(ch, payload, publishedAt);
    }
    return total;
  }

  getStats(): EventBusStats {
    let subscribers = 0;
    for (const set of this.handlers.values()) subscribers += set.size;
    return {
      channels: this.handlers.size,
      subscribers,
      published: this.published,
      delivered: this.delivered,
    };
  }

  clear() {
    this.handlers.clear();
    this.published = 0;
    this.delivered = 0;
  }
}
