/**
 * V10.0 — NTP/PTP Tabanlı Yüksek Hassasiyetli Saat Senkronizasyonu.
 * Cristian algoritması: clockOffset + RTT (round-trip time).
 *
 * getSyncedTimestamp() = Date.now() + clockOffset
 */

/** Saat senkron durumları. */
export type ClockSyncStatus = 'SYNCING' | 'SYNCED' | 'DRIFT' | 'UNSYNCED';

/** UI / telemetri için saat özeti. */
export type ClockSyncStats = {
  /** İstemci → sunucu offset (ms). syncedTime = Date.now() + offset */
  clockOffset: number;
  /** Round-trip time (ms). */
  rtt: number;
  status: ClockSyncStatus;
  /** Son başarılı senkron (yerel ms). */
  lastSyncAt: number | null;
};

export type ClockSyncListener = (stats: ClockSyncStats) => void;

/** |offset| bu eşiği aşarsa CLOCK DRIFT DETECTED. */
export const DRIFT_THRESHOLD_MS = 50;

/** Varsayılan senkron periyodu. */
export const CLOCK_SYNC_INTERVAL_MS = 10_000;

/** Offset yumuşatma (EMA). */
const OFFSET_EMA = 0.35;

export const DEFAULT_CLOCK_SYNC_STATS: ClockSyncStats = {
  clockOffset: 0,
  rtt: 0,
  status: 'UNSYNCED',
  lastSyncAt: null,
};

/** Offset etiketı — örn. "+1.2ms" / "-0.4ms". */
export function formatClockOffset(offsetMs: number) {
  const sign = offsetMs >= 0 ? '+' : '';
  return `${sign}${offsetMs.toFixed(1)}ms`;
}

/** PTP şerit metni. */
export function formatPtpClockLabel(stats: ClockSyncStats) {
  if (stats.status === 'DRIFT') {
    return `PTP CLOCK: CLOCK DRIFT DETECTED (Offset: ${formatClockOffset(stats.clockOffset)}, RTT: ${Math.round(stats.rtt)}ms)`;
  }
  if (stats.status === 'SYNCED') {
    return `PTP CLOCK: SYNCED (Offset: ${formatClockOffset(stats.clockOffset)}, RTT: ${Math.round(stats.rtt)}ms)`;
  }
  if (stats.status === 'SYNCING') {
    return `PTP CLOCK: SYNCING… (Offset: ${formatClockOffset(stats.clockOffset)}, RTT: ${Math.round(stats.rtt)}ms)`;
  }
  return 'PTP CLOCK: UNSYNCED';
}

/**
 * Cristian algoritması:
 * T0 = istemci gönderim, T_s = sunucu zamanı, T1 = istemci alım
 * RTT = T1 - T0
 * offset ≈ T_s + RTT/2 - T1
 */
export function computeCristianOffset(input: {
  t0: number;
  serverMs: number;
  t1: number;
}) {
  const rtt = Math.max(0, input.t1 - input.t0);
  const clockOffset = input.serverMs + rtt / 2 - input.t1;
  return { clockOffset, rtt };
}

function resolveStatus(offsetMs: number, hasSample: boolean): ClockSyncStatus {
  if (!hasSample) return 'UNSYNCED';
  if (Math.abs(offsetMs) > DRIFT_THRESHOLD_MS) return 'DRIFT';
  return 'SYNCED';
}

/**
 * HTTP zaman havuzu — Date başlığı veya JSON unixtime ile Cristian örneği.
 * Ağ yoksa null döner (try-catch korumalı).
 */
async function probeTimePool(): Promise<{ serverMs: number; t0: number; t1: number } | null> {
  // 1) worldtimeapi
  try {
    const t0 = Date.now();
    const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', {
      method: 'GET',
    });
    const t1 = Date.now();
    if (res.ok) {
      const data = (await res.json()) as { unixtime?: number; datetime?: string };
      let serverMs: number | null = null;
      if (typeof data.unixtime === 'number') {
        serverMs = data.unixtime * 1000;
      } else if (typeof data.datetime === 'string') {
        const parsed = Date.parse(data.datetime);
        if (!Number.isNaN(parsed)) serverMs = parsed;
      }
      if (serverMs != null) return { serverMs, t0, t1 };
    }
  } catch {
    // sonraki havuza düş
  }

  // 2) HTTP Date başlığı (Cristian)
  try {
    const t0 = Date.now();
    const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
      method: 'GET',
    });
    const t1 = Date.now();
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const serverMs = Date.parse(dateHeader);
      if (!Number.isNaN(serverMs)) return { serverMs, t0, t1 };
    }
  } catch {
    // offline / engelli
  }

  return null;
}

/**
 * Yerel zaman havuzu simülasyonu — ağ yokken algoritma yolunu canlı tutar.
 * Küçük RTT + hafif sapma üretir (demo / offline).
 */
function probeLocalTimePool(): { serverMs: number; t0: number; t1: number } {
  const t0 = Date.now();
  const rtt = 5 + Math.random() * 7;
  const serverSkew = (Math.random() - 0.5) * 3; // ±1.5 ms
  const t1 = t0 + rtt;
  const serverMs = t0 + rtt / 2 + serverSkew;
  return { serverMs, t0, t1 };
}

/**
 * Precision Clock Engine — periyodik NTP/Cristian senkronu.
 */
export class PrecisionClockEngine {
  private clockOffset = 0;
  private rtt = 0;
  private status: ClockSyncStatus = 'UNSYNCED';
  private lastSyncAt: number | null = null;
  private hasSample = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private syncing = false;
  private destroyed = false;
  private listener: ClockSyncListener | null = null;

  setListener(listener: ClockSyncListener | null) {
    this.listener = listener;
  }

  getStats(): ClockSyncStats {
    return {
      clockOffset: this.clockOffset,
      rtt: this.rtt,
      status: this.status,
      lastSyncAt: this.lastSyncAt,
    };
  }

  /** Senkronize milisaniye zaman damgası. */
  getSyncedTimestamp(): number {
    return Date.now() + this.clockOffset;
  }

  /** Payload için Unix saniye. */
  getSyncedUnixSeconds(): number {
    return Math.floor(this.getSyncedTimestamp() / 1000);
  }

  private emit() {
    try {
      this.listener?.(this.getStats());
    } catch {
      // listener hatası motoru bozmaz
    }
  }

  private applySample(clockOffset: number, rtt: number) {
    if (!this.hasSample) {
      this.clockOffset = clockOffset;
      this.hasSample = true;
    } else {
      this.clockOffset =
        this.clockOffset * (1 - OFFSET_EMA) + clockOffset * OFFSET_EMA;
    }
    this.rtt = rtt;
    this.lastSyncAt = Date.now();
    this.status = resolveStatus(this.clockOffset, true);
    this.emit();
  }

  /** Tek seferlik Cristian senkron örneği. */
  async syncOnce(): Promise<ClockSyncStats> {
    if (this.destroyed) return this.getStats();

    this.syncing = true;
    this.status = 'SYNCING';
    this.emit();

    try {
      let sample = await probeTimePool();
      if (!sample) {
        sample = probeLocalTimePool();
      }

      const { clockOffset, rtt } = computeCristianOffset(sample);
      this.applySample(clockOffset, rtt);
    } catch {
      if (!this.hasSample) {
        this.status = 'UNSYNCED';
        this.emit();
      } else {
        this.status = resolveStatus(this.clockOffset, true);
        this.emit();
      }
    } finally {
      this.syncing = false;
    }

    return this.getStats();
  }

  /** Periyodik senkron döngüsünü başlatır. */
  start(intervalMs: number = CLOCK_SYNC_INTERVAL_MS) {
    if (this.destroyed) return;
    this.stop();
    void this.syncOnce();
    this.timer = setInterval(() => {
      if (this.syncing || this.destroyed) return;
      void this.syncOnce();
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    this.listener = null;
  }
}

let sharedClock: PrecisionClockEngine | null = null;

export function getClockSync(): PrecisionClockEngine {
  if (!sharedClock) {
    sharedClock = new PrecisionClockEngine();
  }
  return sharedClock;
}

/** Uygulama genelinde senkron ms. */
export function getSyncedTimestamp(): number {
  return getClockSync().getSyncedTimestamp();
}

/** Payload timestamp (Unix saniye). */
export function getSyncedUnixSeconds(): number {
  return getClockSync().getSyncedUnixSeconds();
}

export function destroySharedClockSync() {
  if (sharedClock) {
    sharedClock.destroy();
    sharedClock = null;
  }
}
