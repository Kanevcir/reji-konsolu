/**
 * V26.0 — PTP Broadcast Sync (Precision Time Protocol Server Sync Engine).
 * Reji yayınlarına targetTimestamp ekler:
 *   targetTimestamp = getSyncedTimestamp() + networkBuffer
 * İstemciler jitter’dan bağımsız olarak bu anda yürütür.
 */

import { getClockSync, getSyncedTimestamp } from './clockSync';
import {
  getPtpBufferMaxMs,
  getPtpBufferMinMs,
  getPtpEmergencyBufferMs,
  getPtpNetworkBufferMs,
} from './runtimeConfig';

/** Varsayılan ağ tamponu (ms) — PTP_NETWORK_BUFFER_MS. */
export const DEFAULT_PTP_NETWORK_BUFFER_MS = getPtpNetworkBufferMs();

/** Acil blackout için daha kısa tampon. */
export const PTP_EMERGENCY_BUFFER_MS = getPtpEmergencyBufferMs();

/** RTT’ye göre dinamik tampon tavanı. */
export const PTP_BUFFER_MIN_MS = getPtpBufferMinMs();
export const PTP_BUFFER_MAX_MS = getPtpBufferMaxMs();

export type PtpBroadcastMeta = {
  /** Komutun PTP milisaniyesinde yürütüleceği an. */
  targetTimestamp: number;
  /** Yayın anı (PTP ms). */
  issuedAt: number;
  /** Kullanılan ağ tamponu (ms). */
  ptpBufferMs: number;
};

/**
 * RTT biliniyorsa tampon = clamp(base, rtt*1.5 + base/2).
 * Aksi halde sabit DEFAULT.
 */
export function resolveNetworkBufferMs(
  baseBufferMs: number = getPtpNetworkBufferMs(),
  rttMs?: number,
): number {
  const rtt =
    typeof rttMs === 'number' && Number.isFinite(rttMs)
      ? rttMs
      : getClockSync().getStats().rtt;
  const dynamic = Math.max(baseBufferMs, Math.round(rtt * 1.5 + baseBufferMs * 0.5));
  return Math.min(getPtpBufferMaxMs(), Math.max(getPtpBufferMinMs(), dynamic));
}

/** targetTimestamp = issuedAt + buffer. */
export function computeTargetTimestamp(
  issuedAtMs?: number,
  bufferMs?: number,
): PtpBroadcastMeta {
  const issuedAt = issuedAtMs ?? getSyncedTimestamp();
  const ptpBufferMs = resolveNetworkBufferMs(
    bufferMs ?? getPtpNetworkBufferMs(),
  );
  return {
    issuedAt,
    ptpBufferMs,
    targetTimestamp: issuedAt + ptpBufferMs,
  };
}

/** Acil durum PTP meta (kısa buffer). */
export function computeEmergencyTargetTimestamp(
  issuedAtMs?: number,
): PtpBroadcastMeta {
  return computeTargetTimestamp(
    issuedAtMs ?? getSyncedTimestamp(),
    PTP_EMERGENCY_BUFFER_MS,
  );
}

export function formatPtpTargetLabel(meta: PtpBroadcastMeta): string {
  const eta = meta.targetTimestamp - getSyncedTimestamp();
  return `PTP T+${meta.ptpBufferMs}ms · ETA ${eta.toFixed(0)}ms · target ${meta.targetTimestamp}`;
}
