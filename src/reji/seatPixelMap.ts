/**
 * V27.0 — Dynamic Seat-to-Pixel Engine (Koltuk / Koordinat Çevirici).
 * Bilet (Tribün / Blok / Sıra / Koltuk) → stadyum grid X,Y.
 * Çakışmasız, enjekte edici haritalama (injective within capacity).
 */

import { PIXEL_GRID_H, PIXEL_GRID_W } from './pixelMapper';
import { ZONE_BIT, type SpatialZoneId } from './zoneManager';

export type StadiumTribuneId = SpatialZoneId; // NORTH | SOUTH | EAST | WEST

/** İstemci onboarding bilet bilgisi. */
export type SeatTicket = {
  tribune: StadiumTribuneId;
  /** Blok no — örn. 102 veya "A12". */
  block: string | number;
  /** Sıra (1-based). */
  row: number;
  /** Koltuk (1-based). */
  seat: number;
};

export type PixelCoord = {
  /** Grid sütunu 0..gridW-1 */
  x: number;
  /** Grid satırı 0..gridH-1 */
  y: number;
  /** Normalize 0–1 (matrix evaluate). */
  nx: number;
  ny: number;
  gridW: number;
  gridH: number;
};

export type SeatMapping = {
  deviceId: string;
  ticket: SeatTicket;
  coord: PixelCoord;
  zoneBit: number;
  /** Kanonik koltuk anahtarı — çakışma denetimi. */
  seatKey: string;
  /** Pixel anahtarı "x,y". */
  pixelKey: string;
};

export type SeatAuthResult =
  | { ok: true; mapping: SeatMapping }
  | { ok: false; error: string };

/** Tribün bandı — piksel dikdörtgeni + koltuk kapasitesi. */
export type TribuneBandLayout = {
  tribune: StadiumTribuneId;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  blocks: number;
  rows: number;
  seatsPerRow: number;
};

/**
 * 200×200 grid üzerinde 4 tribün bandı.
 * Her bandın koltuk kapasitesi ≤ piksel kapasitesi (injective, sarmasız).
 * Toplam koltuk = 10.000 (load-test hedefi).
 */
export const TRIBUNE_BANDS: Record<StadiumTribuneId, TribuneBandLayout> = {
  NORTH: {
    tribune: 'NORTH',
    x0: 40,
    x1: 159,
    y0: 0,
    y1: 49,
    blocks: 10,
    rows: 25,
    seatsPerRow: 10, // 2500 ≤ 120×50=6000
  },
  SOUTH: {
    tribune: 'SOUTH',
    x0: 40,
    x1: 159,
    y0: 150,
    y1: 199,
    blocks: 10,
    rows: 25,
    seatsPerRow: 10, // 2500
  },
  EAST: {
    tribune: 'EAST',
    x0: 160,
    x1: 199,
    y0: 50,
    y1: 149,
    blocks: 5,
    rows: 25,
    seatsPerRow: 20, // 2500 ≤ 40×100=4000
  },
  WEST: {
    tribune: 'WEST',
    x0: 0,
    x1: 39,
    y0: 50,
    y1: 149,
    blocks: 5,
    rows: 25,
    seatsPerRow: 20, // 2500
  },
};

export const TRIBUNE_LABEL_TR: Record<StadiumTribuneId, string> = {
  NORTH: 'Kuzey',
  SOUTH: 'Güney',
  EAST: 'Doğu',
  WEST: 'Batı',
};

const TR_TO_TRIBUNE: Record<string, StadiumTribuneId> = {
  kuzey: 'NORTH',
  north: 'NORTH',
  n: 'NORTH',
  guney: 'SOUTH',
  güney: 'SOUTH',
  south: 'SOUTH',
  s: 'SOUTH',
  dogu: 'EAST',
  doğu: 'EAST',
  east: 'EAST',
  e: 'EAST',
  bati: 'WEST',
  batı: 'WEST',
  west: 'WEST',
  w: 'WEST',
};

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** "Doğu" / "EAST" / "E" → tribune id. */
export function parseTribuneLabel(raw: string): StadiumTribuneId | null {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
  return TR_TO_TRIBUNE[key] ?? null;
}

export function seatKeyOf(ticket: SeatTicket): string {
  return `${ticket.tribune}|${String(ticket.block).trim().toUpperCase()}|${ticket.row}|${ticket.seat}`;
}

export function pixelKeyOf(x: number, y: number): string {
  return `${x},${y}`;
}

export function bandCapacity(band: TribuneBandLayout): number {
  return band.blocks * band.rows * band.seatsPerRow;
}

export function bandPixelCapacity(band: TribuneBandLayout): number {
  return (band.x1 - band.x0 + 1) * (band.y1 - band.y0 + 1);
}

export function stadiumSeatCapacity(): number {
  return (Object.keys(TRIBUNE_BANDS) as StadiumTribuneId[]).reduce(
    (sum, t) => sum + bandCapacity(TRIBUNE_BANDS[t]),
    0,
  );
}

/** Blok etiketini 0..blocks-1 indekse çevir. */
export function blockToIndex(block: string | number, blocks: number): number {
  if (typeof block === 'number' && Number.isFinite(block)) {
    // 102 → hash into range, or (block % blocks)
    const n = Math.abs(Math.floor(block));
    // Prefer last digits for numbered blocks (102 → 2 if blocks=8? use modulo)
    return n % blocks;
  }
  const s = String(block).trim().toUpperCase();
  const digits = s.replace(/\D/g, '');
  if (digits) {
    return parseInt(digits, 10) % blocks;
  }
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash % blocks;
}

/**
 * Stadium Map Adapter — koltuk → piksel.
 * Aynı (tribune,block,row,seat) her zaman aynı (x,y).
 */
export function seatToPixel(
  ticket: SeatTicket,
  gridW: number = PIXEL_GRID_W,
  gridH: number = PIXEL_GRID_H,
): PixelCoord {
  const band = TRIBUNE_BANDS[ticket.tribune];
  if (!band) {
    return {
      x: 0,
      y: 0,
      nx: 0.5 / gridW,
      ny: 0.5 / gridH,
      gridW,
      gridH,
    };
  }

  const blockIdx = blockToIndex(ticket.block, band.blocks);
  const rowIdx = clampInt(ticket.row - 1, 0, band.rows - 1);
  const seatIdx = clampInt(ticket.seat - 1, 0, band.seatsPerRow - 1);

  const localIndex =
    blockIdx * band.rows * band.seatsPerRow +
    rowIdx * band.seatsPerRow +
    seatIdx;

  const bandW = band.x1 - band.x0 + 1;
  const bandH = band.y1 - band.y0 + 1;
  const pixelCap = bandW * bandH;
  if (localIndex < 0 || localIndex >= pixelCap) {
    // Kapasite aşımı — güvenli fallback (auth validate ile engellenmeli)
    const idx = ((localIndex % pixelCap) + pixelCap) % pixelCap;
    const lx = idx % bandW;
    const ly = Math.floor(idx / bandW);
    const x = clampInt(band.x0 + lx, 0, gridW - 1);
    const y = clampInt(band.y0 + ly, 0, gridH - 1);
    return {
      x,
      y,
      nx: (x + 0.5) / gridW,
      ny: (y + 0.5) / gridH,
      gridW,
      gridH,
    };
  }

  const lx = localIndex % bandW;
  const ly = Math.floor(localIndex / bandW);
  const x = clampInt(band.x0 + lx, 0, gridW - 1);
  const y = clampInt(band.y0 + ly, 0, gridH - 1);

  return {
    x,
    y,
    nx: (x + 0.5) / gridW,
    ny: (y + 0.5) / gridH,
    gridW,
    gridH,
  };
}

export function validateSeatTicket(ticket: SeatTicket): string | null {
  if (!ticket || !TRIBUNE_BANDS[ticket.tribune]) {
    return 'Geçersiz tribün';
  }
  const band = TRIBUNE_BANDS[ticket.tribune];
  if (ticket.row < 1 || ticket.row > band.rows) {
    return `Sıra 1–${band.rows} aralığında olmalı`;
  }
  if (ticket.seat < 1 || ticket.seat > band.seatsPerRow) {
    return `Koltuk 1–${band.seatsPerRow} aralığında olmalı`;
  }
  if (ticket.block === '' || ticket.block == null) {
    return 'Blok gerekli';
  }
  return null;
}

/**
 * Onboarding / Auth — bilet doğrula, cihazı grid’e bağla.
 */
export class SeatOnboardingAuth {
  private byDevice = new Map<string, SeatMapping>();
  private bySeatKey = new Map<string, string>(); // seatKey → deviceId
  private byPixelKey = new Map<string, string>(); // pixelKey → deviceId
  private seq = 0;

  get registeredCount() {
    return this.byDevice.size;
  }

  getMapping(deviceId: string): SeatMapping | null {
    return this.byDevice.get(deviceId) ?? null;
  }

  listMappings(): SeatMapping[] {
    return Array.from(this.byDevice.values());
  }

  /**
   * İstemci bağlandığında bilet ile kayıt.
   * Aynı koltuk ikinci cihaza verilmez (çakışma koruması).
   */
  authenticate(
    ticket: SeatTicket,
    deviceId?: string,
  ): SeatAuthResult {
    try {
      const err = validateSeatTicket(ticket);
      if (err) return { ok: false, error: err };

      const id =
        deviceId?.trim() ||
        `dev-${++this.seq}-${seatKeyOf(ticket)}`;

      const key = seatKeyOf(ticket);
      const existingSeat = this.bySeatKey.get(key);
      if (existingSeat && existingSeat !== id) {
        return {
          ok: false,
          error: `Koltuk dolu: ${key} → ${existingSeat}`,
        };
      }

      const coord = seatToPixel(ticket);
      const pKey = pixelKeyOf(coord.x, coord.y);
      const existingPixel = this.byPixelKey.get(pKey);
      if (existingPixel && existingPixel !== id) {
        return {
          ok: false,
          error: `Piksel çakışması ${pKey}: ${existingPixel}`,
        };
      }

      // Eski kaydı temizle
      const prev = this.byDevice.get(id);
      if (prev) {
        this.bySeatKey.delete(prev.seatKey);
        this.byPixelKey.delete(prev.pixelKey);
      }

      const mapping: SeatMapping = {
        deviceId: id,
        ticket: { ...ticket },
        coord,
        zoneBit: ZONE_BIT[ticket.tribune],
        seatKey: key,
        pixelKey: pKey,
      };
      this.byDevice.set(id, mapping);
      this.bySeatKey.set(key, id);
      this.byPixelKey.set(pKey, id);
      return { ok: true, mapping };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'auth error',
      };
    }
  }

  disconnect(deviceId: string) {
    const m = this.byDevice.get(deviceId);
    if (!m) return;
    this.byDevice.delete(deviceId);
    this.bySeatKey.delete(m.seatKey);
    this.byPixelKey.delete(m.pixelKey);
  }

  clear() {
    this.byDevice.clear();
    this.bySeatKey.clear();
    this.byPixelKey.clear();
  }
}

/**
 * Kapasite içinde çakışmasız N adet bilet üret (simülasyon / load test).
 */
export function enumerateUniqueTickets(count: number): SeatTicket[] {
  const out: SeatTicket[] = [];
  const tribunes: StadiumTribuneId[] = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
  for (const tribune of tribunes) {
    const band = TRIBUNE_BANDS[tribune];
    for (let b = 0; b < band.blocks && out.length < count; b++) {
      for (let r = 1; r <= band.rows && out.length < count; r++) {
        for (let s = 1; s <= band.seatsPerRow && out.length < count; s++) {
          out.push({
            tribune,
            block: tribune === 'EAST' || tribune === 'WEST' ? 100 + b : 200 + b,
            row: r,
            seat: s,
          });
        }
      }
    }
  }
  return out;
}

/** Örnek: Tribün Doğu, Blok 102, Sıra 5, Koltuk 12 */
export function ticketFromLabels(input: {
  tribuneLabel: string;
  block: string | number;
  row: number;
  seat: number;
}): SeatTicket | null {
  const tribune = parseTribuneLabel(input.tribuneLabel);
  if (!tribune) return null;
  return {
    tribune,
    block: input.block,
    row: input.row,
    seat: input.seat,
  };
}
