/**
 * V8.0 Final — Saha Telemetri ve Performans İzleyici (Production Telemetry).
 * Simüle FPS / RAM / aktif düğüm / ağ kararlılığı metrikleri.
 */

/** Canlı saha telemetri özeti. */
export type TelemetryStats = {
  /** Anlık kare hızı (58–60). */
  fps: number;
  /** Tahmini bellek kullanımı (MB, 24–32). */
  memoryMb: number;
  /** Bağlı stadyum cihaz / düğüm sayısı. */
  activeNodes: number;
  /** Ağ kararlılığı yüzdesi (99.8–100). */
  networkStability: number;
};

export const DEFAULT_TELEMETRY_STATS: TelemetryStats = {
  fps: 60,
  memoryMb: 28,
  activeNodes: 4250,
  networkStability: 99.9,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function jitter(prev: number, min: number, max: number, step: number) {
  const delta = (Math.random() * 2 - 1) * step;
  return clamp(Number((prev + delta).toFixed(1)), min, max);
}

/**
 * Bir önceki örneklemden yumuşak sapmalı yeni telemetri üretir.
 * Blackout dışında ~1s interval ile çağrılır.
 */
export function nextTelemetryStats(prev: TelemetryStats): TelemetryStats {
  try {
    const fps = Math.round(jitter(prev.fps, 58, 60, 0.8));
    const memoryMb = Math.round(jitter(prev.memoryMb, 24, 32, 1.2));
    const activeNodes = Math.round(jitter(prev.activeNodes, 4100, 4400, 40));
    const networkStability = Number(jitter(prev.networkStability, 99.8, 100, 0.05).toFixed(2));

    return { fps, memoryMb, activeNodes, networkStability };
  } catch {
    return { ...DEFAULT_TELEMETRY_STATS };
  }
}

/** ACTIVE NODES etiket formatı — örn. "4,250". */
export function formatActiveNodes(count: number) {
  try {
    return count.toLocaleString('en-US');
  } catch {
    return String(count);
  }
}

/** Ağ kararlılığı — örn. "99.85%". */
export function formatNetworkStability(value: number) {
  return `${value.toFixed(2)}%`;
}
