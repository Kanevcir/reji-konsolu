/**
 * V6.0 — Acil Durum / Blackout güvenlik yardımcıları.
 */

import { getSyncedUnixSeconds } from './clockSync';
import { mapTribunToZone } from './payload';
import type { OutgoingPayload, TribunId } from './types';

/** Blackout anında ağ katmanına yayınlanan acil durum paketi. */
export function buildBlackoutPayload(input: {
  bpm: number;
  tribun: TribunId;
}): OutgoingPayload {
  return {
    timestamp: getSyncedUnixSeconds(),
    action: 'EMERGENCY_BLACKOUT',
    targetZone: mapTribunToZone(input.tribun),
    bpm: input.bpm,
    status: 'SAFE_MODE',
  };
}
