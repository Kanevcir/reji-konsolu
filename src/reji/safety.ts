/**
 * V6.0 — Acil Durum / Blackout güvenlik yardımcıları.
 */

import { getSyncedUnixSeconds } from './clockSync';
import { mapTribunToZone } from './payload';
import { DEFAULT_ZONE_MASK } from './zoneManager';
import type { OutgoingPayload, TribunId } from './types';

/** Blackout anında ağ katmanına yayınlanan acil durum paketi. */
export function buildBlackoutPayload(input: {
  bpm: number;
  tribun: TribunId;
  zoneMask?: number;
}): OutgoingPayload {
  return {
    timestamp: getSyncedUnixSeconds(),
    action: 'EMERGENCY_BLACKOUT',
    targetZone: mapTribunToZone(input.tribun),
    bpm: input.bpm,
    status: 'SAFE_MODE',
    zoneMask: (input.zoneMask ?? DEFAULT_ZONE_MASK) & 0b1111,
    swarmProtocol: false,
    matrix: null,
  };
}
