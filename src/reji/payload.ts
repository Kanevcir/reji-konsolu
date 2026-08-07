/**
 * V2.0 Ağ Katmanı — Outgoing Payload üreticileri.
 * Konsol aksiyonlarını ağ sözleşmesine dönüştürür.
 * V26.0 — her yayına PTP targetTimestamp eklenir.
 */

import { getSyncedUnixSeconds } from './clockSync';
import {
  computeEmergencyTargetTimestamp,
  computeTargetTimestamp,
  DEFAULT_PTP_NETWORK_BUFFER_MS,
} from './ptpBroadcast';
import { DEFAULT_ZONE_MASK } from './zoneManager';
import type { MatrixCommand } from './pixelMapper';
import type {
  OutgoingAction,
  OutgoingPayload,
  OutgoingStatus,
  OutgoingTargetZone,
  TribunId,
} from './types';

/** UI tribün id → ağ hedef bölgesi. */
export function mapTribunToZone(tribun: TribunId): OutgoingTargetZone {
  if (tribun === 'ns') return 'NORTH_SOUTH';
  if (tribun === 'ew') return 'EAST_WEST';
  return 'ALL';
}

/** Timer / pause / blackout durumundan yayın status üretir. */
export function mapOutgoingStatus(opts: {
  timerHasTime: boolean;
  isPaused: boolean;
  isBlackout?: boolean;
}): OutgoingStatus {
  if (opts.isBlackout) return 'SAFE_MODE';
  return opts.timerHasTime && !opts.isPaused ? 'ACTIVE' : 'IDLE';
}

/** Yayınlanmaya hazır OutgoingPayload oluşturur. */
export function buildOutgoingPayload(input: {
  action: OutgoingAction;
  tribun: TribunId;
  bpm: number;
  timerHasTime: boolean;
  isPaused: boolean;
  isBlackout?: boolean;
  /** V6.0 — status’u zorla (ör. SAFE_MODE). */
  statusOverride?: OutgoingStatus;
  /** V16.0 — uzamsal bitmask (varsayılan ALL=15). */
  zoneMask?: number;
  /** V17.0 — BLE swarm mesh bayrağı. */
  swarmProtocol?: boolean;
  /** V20.0 — matrix koreografi komutu. */
  matrix?: MatrixCommand | null;
  /** V26 — özel PTP buffer; emergency için kısa. */
  ptpBufferMs?: number;
  /** V26 — acil blackout kısa buffer. */
  emergencyPtp?: boolean;
}): OutgoingPayload {
  const ptp = input.emergencyPtp
    ? computeEmergencyTargetTimestamp()
    : computeTargetTimestamp(undefined, input.ptpBufferMs);

  return {
    timestamp: getSyncedUnixSeconds(),
    action: input.action,
    targetZone: mapTribunToZone(input.tribun),
    bpm: input.bpm,
    status:
      input.statusOverride ??
      mapOutgoingStatus({
        timerHasTime: input.timerHasTime,
        isPaused: input.isPaused,
        isBlackout: input.isBlackout,
      }),
    zoneMask: (input.zoneMask ?? DEFAULT_ZONE_MASK) & 0b1111,
    swarmProtocol: Boolean(input.swarmProtocol),
    matrix: input.matrix ?? null,
    issuedAt: ptp.issuedAt,
    targetTimestamp: ptp.targetTimestamp,
    ptpBufferMs: ptp.ptpBufferMs,
  };
}

/** Monitörde gösterilecek varsayılan (boşta) paket. */
export function createIdlePayload(
  bpm: number = 120,
  zoneMask: number = DEFAULT_ZONE_MASK,
  swarmProtocol: boolean = false,
  matrix: MatrixCommand | null = null,
): OutgoingPayload {
  const ptp = computeTargetTimestamp(
    undefined,
    DEFAULT_PTP_NETWORK_BUFFER_MS,
  );
  return {
    timestamp: getSyncedUnixSeconds(),
    action: 'RESET',
    targetZone: 'ALL',
    bpm,
    status: 'IDLE',
    zoneMask: zoneMask & 0b1111,
    swarmProtocol,
    matrix,
    issuedAt: ptp.issuedAt,
    targetTimestamp: ptp.targetTimestamp,
    ptpBufferMs: ptp.ptpBufferMs,
  };
}
