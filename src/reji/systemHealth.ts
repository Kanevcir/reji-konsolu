/**
 * V30.0 — System Telemetry & Health (güvenli ölçek metrikleri).
 */

import type { ClockSyncStats } from './clockSync';
import type { WorkerStats } from './roomSharding';

export type WorkerLoadMetric = {
  workerId: string;
  clients: number;
  /** 0–100, cluster içi göreli yük. */
  loadPct: number;
  messagesOut: number;
};

export type SystemHealthSnapshot = {
  updatedAt: number;
  /** Anlık eşzamanlı bağlantı. */
  concurrentConnections: number;
  /** Kayıtlı oturum (auth geçmiş). */
  sessionCount: number;
  /** Admin oturum sayısı. */
  adminSessions: number;
  /** Read-only istemci. */
  clientSessions: number;
  /** Worker yükleri. */
  workerLoads: WorkerLoadMetric[];
  /** PTP offset (ms). */
  ptpOffsetMs: number;
  /** PTP RTT / ping (ms). */
  ptpRttMs: number;
  /** Yaklaşık jitter (RTT türevi). */
  ptpJitterMs: number;
  ptpStatus: ClockSyncStats['status'];
  /** Zombie purge toplamı. */
  zombiesPurged: number;
  /** Anlık stale / disconnect oranı 0–1. */
  disconnectedRate: number;
  /** Auth red sayacı. */
  authDenied: number;
  /** Başarılı admin yayın. */
  adminPublishes: number;
};

export const DEFAULT_SYSTEM_HEALTH: SystemHealthSnapshot = {
  updatedAt: 0,
  concurrentConnections: 0,
  sessionCount: 0,
  adminSessions: 0,
  clientSessions: 0,
  workerLoads: [],
  ptpOffsetMs: 0,
  ptpRttMs: 0,
  ptpJitterMs: 0,
  ptpStatus: 'UNSYNCED',
  zombiesPurged: 0,
  disconnectedRate: 0,
  authDenied: 0,
  adminPublishes: 0,
};

export function buildWorkerLoads(
  perWorker: WorkerStats[],
): WorkerLoadMetric[] {
  const total = perWorker.reduce((s, w) => s + w.clients, 0) || 1;
  return perWorker.map((w) => ({
    workerId: w.workerId,
    clients: w.clients,
    loadPct: Math.round((w.clients / total) * 1000) / 10,
    messagesOut: w.messagesOut,
  }));
}

/** RTT geçmişinden basit jitter (std benzeri abs fark). */
export function estimateJitterMs(
  rttMs: number,
  prevRttMs: number | null,
): number {
  if (prevRttMs == null) return 0;
  return Math.abs(rttMs - prevRttMs);
}

export function formatDisconnectedRate(rate: number): string {
  return `${(Math.max(0, Math.min(1, rate)) * 100).toFixed(1)}%`;
}

export function formatHealthLine(s: SystemHealthSnapshot): string {
  return `CONN ${s.concurrentConnections} · PTP ${s.ptpOffsetMs.toFixed(1)}ms · DROP ${formatDisconnectedRate(s.disconnectedRate)}`;
}
