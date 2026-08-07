/**
 * V28.0 — Thundering Herd koruması.
 * Exponential Backoff with Full Jitter — 50k cihaz aynı ms’de çarpmaz.
 *
 * delay = random_between(0, min(cap, base * 2^attempt))
 * (AWS "full jitter" önerisi)
 */

export type BackoffOptions = {
  /** İlk deneme tabanı (ms). Varsayılan 250. */
  baseMs?: number;
  /** Üst sınır (ms). Varsayılan 30_000. */
  capMs?: number;
  /** 0–1 rastgele; testte deterministik seed. */
  random?: () => number;
};

export const DEFAULT_BACKOFF_BASE_MS = 250;
export const DEFAULT_BACKOFF_CAP_MS = 30_000;

/**
 * attempt 0-based → gecikme ms.
 * Full jitter: [0, min(cap, base*2^attempt)].
 */
export function computeReconnectDelayMs(
  attempt: number,
  opts: BackoffOptions = {},
): number {
  const base = opts.baseMs ?? DEFAULT_BACKOFF_BASE_MS;
  const cap = opts.capMs ?? DEFAULT_BACKOFF_CAP_MS;
  const rnd = opts.random ?? Math.random;
  const exp = Math.max(0, Math.floor(attempt));
  const ceiling = Math.min(cap, base * Math.pow(2, exp));
  const u = Math.min(1, Math.max(0, rnd()));
  return Math.floor(u * ceiling);
}

/** Equal jitter varyantı (opsiyonel): half + random(half). */
export function computeEqualJitterDelayMs(
  attempt: number,
  opts: BackoffOptions = {},
): number {
  const base = opts.baseMs ?? DEFAULT_BACKOFF_BASE_MS;
  const cap = opts.capMs ?? DEFAULT_BACKOFF_CAP_MS;
  const rnd = opts.random ?? Math.random;
  const exp = Math.max(0, Math.floor(attempt));
  const ceiling = Math.min(cap, base * Math.pow(2, exp));
  const half = ceiling / 2;
  return Math.floor(half + rnd() * half);
}

/**
 * Outage bittiği andan itibaren mutlak yeniden bağlanma zamanı.
 */
export function scheduleReconnectAt(
  recoveredAtMs: number,
  attempt: number,
  opts: BackoffOptions = {},
): number {
  return recoveredAtMs + computeReconnectDelayMs(attempt, opts);
}

/**
 * İstemci reconnect state makinesi.
 * Her başarısızlıkta attempt↑; başarıda sıfırlanır.
 */
export class ReconnectBackoffController {
  private attempt = 0;
  private opts: BackoffOptions;

  constructor(opts: BackoffOptions = {}) {
    this.opts = opts;
  }

  getAttempt() {
    return this.attempt;
  }

  /** Bağlantı koptu → sonraki gecikme. */
  nextDelayMs(): number {
    const delay = computeReconnectDelayMs(this.attempt, this.opts);
    this.attempt += 1;
    return delay;
  }

  nextReconnectAt(nowMs: number): number {
    return nowMs + this.nextDelayMs();
  }

  /** Başarılı bağlantı. */
  reset() {
    this.attempt = 0;
  }
}

/**
 * Thundering herd analizi — reconnect zamanlarının yayılımı.
 */
export function analyzeReconnectSpread(
  reconnectAtList: number[],
  bucketMs = 100,
): {
  minAt: number;
  maxAt: number;
  spanMs: number;
  bucketCount: number;
  maxPerBucket: number;
  /** Aynı ms’de bağlanan (thundering risk). */
  maxSameMs: number;
} {
  if (reconnectAtList.length === 0) {
    return {
      minAt: 0,
      maxAt: 0,
      spanMs: 0,
      bucketCount: 0,
      maxPerBucket: 0,
      maxSameMs: 0,
    };
  }
  let minAt = reconnectAtList[0]!;
  let maxAt = reconnectAtList[0]!;
  const sameMs = new Map<number, number>();
  const buckets = new Map<number, number>();

  for (const t of reconnectAtList) {
    if (t < minAt) minAt = t;
    if (t > maxAt) maxAt = t;
    sameMs.set(t, (sameMs.get(t) ?? 0) + 1);
    const b = Math.floor(t / bucketMs);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }

  let maxPerBucket = 0;
  for (const n of buckets.values()) {
    if (n > maxPerBucket) maxPerBucket = n;
  }
  let maxSameMs = 0;
  for (const n of sameMs.values()) {
    if (n > maxSameMs) maxSameMs = n;
  }

  return {
    minAt,
    maxAt,
    spanMs: maxAt - minAt,
    bucketCount: buckets.size,
    maxPerBucket,
    maxSameMs,
  };
}
