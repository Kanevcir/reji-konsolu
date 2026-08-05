/**
 * Reji Kontrol Konsolu V1.0 — yardımcı fonksiyonlar.
 */

import { getSyncedTimestamp } from './clockSync';
import type { LedGroup, TribunId } from './types';

/** Kalan süreyi dijital sayaç formatına çevirir (mm:ss). */
export function formatSure(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Canlı sinyal simülasyonu için 8–15 ms arası rastgele gecikme üretir. */
export function randomLatency() {
  return 8 + Math.floor(Math.random() * 8);
}

/**
 * Seçili tribün filtresine göre LED’in yanıp yanmayacağını belirler.
 * - all → tüm LED’ler
 * - ns  → yalnızca Kuzey/Güney
 * - ew  → yalnızca Doğu/Batı
 */
export function isLedInScope(group: LedGroup, tribun: TribunId) {
  if (tribun === 'all') return true;
  return tribun === group;
}

/**
 * Log satırı için HH:MM:SS zaman damgası.
 * Varsayılan: PTP senkronize zaman (getSyncedTimestamp).
 */
export function formatLogTime(ms?: number) {
  const date = new Date(ms ?? getSyncedTimestamp());
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
