/**
 * V16.0 — Uzamsal Grid ve Bölge Maskeleme Yöneticisi
 * (Spatial Grid & Zone Bitmasking).
 *
 * Bitmask: NORTH=0001, SOUTH=0010, EAST=0100, WEST=1000, ALL=1111.
 * Offline cihazlar GPS/QR bölge kodunu maske ile AND edip yanıp yanmayacağına karar verir.
 */

/** Dört ana stadyum bölgesi. */
export type SpatialZoneId = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

/** Bitmask sabitleri (4-bit). */
export const ZONE_BIT = {
  NORTH: 0b0001, // 1
  SOUTH: 0b0010, // 2
  EAST: 0b0100, // 4
  WEST: 0b1000, // 8
  ALL: 0b1111, // 15
} as const;

export type ZoneBitKey = keyof typeof ZONE_BIT;

export const SPATIAL_ZONES: readonly SpatialZoneId[] = [
  'NORTH',
  'SOUTH',
  'EAST',
  'WEST',
] as const;

export const DEFAULT_ACTIVE_ZONES: SpatialZoneId[] = [
  'NORTH',
  'SOUTH',
  'EAST',
  'WEST',
];

export const DEFAULT_ZONE_MASK = ZONE_BIT.ALL;

/** Bölge listesi → bitmask. */
export function computeZoneMask(zones: readonly SpatialZoneId[]): number {
  try {
    let mask = 0;
    for (const z of zones) {
      mask |= ZONE_BIT[z];
    }
    return mask & ZONE_BIT.ALL;
  } catch {
    return DEFAULT_ZONE_MASK;
  }
}

/** Bitmask → aktif bölge listesi. */
export function zonesFromMask(mask: number): SpatialZoneId[] {
  try {
    const m = mask & ZONE_BIT.ALL;
    return SPATIAL_ZONES.filter((z) => (m & ZONE_BIT[z]) !== 0);
  } catch {
    return [...DEFAULT_ACTIVE_ZONES];
  }
}

/** Bölge aktif mi? */
export function isZoneActive(
  activeZones: readonly SpatialZoneId[],
  zone: SpatialZoneId,
): boolean {
  return activeZones.includes(zone);
}

/** Tek bölgeyi aç/kapa (çoklu seçim). */
export function toggleActiveZone(
  activeZones: readonly SpatialZoneId[],
  zone: SpatialZoneId,
): SpatialZoneId[] {
  try {
    if (activeZones.includes(zone)) {
      return activeZones.filter((z) => z !== zone);
    }
    return [...activeZones, zone];
  } catch {
    return [...activeZones];
  }
}

/** Maskeyi 4-bit ikili string (ör. "1101"). */
export function formatZoneMaskBinary(mask: number): string {
  return (mask & ZONE_BIT.ALL).toString(2).padStart(4, '0');
}

/** İnsan okunur etiket: NORTH+EAST veya ALL / NONE. */
export function formatZoneLabel(activeZones: readonly SpatialZoneId[]): string {
  try {
    if (activeZones.length === 0) return 'NONE';
    if (activeZones.length === SPATIAL_ZONES.length) return 'ALL';
    const order: SpatialZoneId[] = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
    return order.filter((z) => activeZones.includes(z)).join('+');
  } catch {
    return 'ALL';
  }
}

/**
 * Cihaz bölge kodu (GPS/QR) maske ile eşleşiyor mu?
 * deviceBit: tek bölge biti veya birleşik kod.
 */
export function deviceMatchesZoneMask(zoneMask: number, deviceBit: number): boolean {
  try {
    return ((zoneMask & ZONE_BIT.ALL) & (deviceBit & ZONE_BIT.ALL)) !== 0;
  } catch {
    return false;
  }
}

/** ZONE_CHANGED log satırı. */
export function buildZoneChangedMessage(activeZones: readonly SpatialZoneId[]): string {
  return `ZONE_CHANGED: ${formatZoneLabel(activeZones)}`;
}

/** Kilitliyken harita salt-okunur. */
export function canEditZones(isConsoleLocked: boolean, isBlackout: boolean): boolean {
  return !isConsoleLocked && !isBlackout;
}
