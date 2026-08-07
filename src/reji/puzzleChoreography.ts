/**
 * V25.0 — Koreografi & Emoji Puzzle Engine.
 * Dev Türk Bayrağı, kulüp kupası ve canlı emoji/metin overlay’leri;
 * stadyum grid’inde telefonlara bölünmüş prosedürel desenler.
 */

export type PuzzlePresetId =
  | 'none'
  | 'turkish_flag'
  | 'club_cup'
  | 'live_emoji';

export type PuzzlePreset = {
  id: PuzzlePresetId;
  label: string;
  hint: string;
};

export const PUZZLE_PRESETS: readonly PuzzlePreset[] = [
  {
    id: 'turkish_flag',
    label: 'Dev Türk Bayrağı',
    hint: 'Kırmızı zemin · hilal & yıldız — grid telefonlara bölünür',
  },
  {
    id: 'club_cup',
    label: 'Kulüp Logosu / Kupa',
    hint: 'Altın kupa silüeti — tribün mozaik',
  },
  {
    id: 'live_emoji',
    label: 'Canlı Metin / Emoji',
    hint: '🔥 ⚽ GOL — OVERLAY_EMOJI ile anlık dönüşüm',
  },
] as const;

/** Hızlı overlay tetikleyicileri. */
export const OVERLAY_EMOJI_QUICK: readonly string[] = [
  '🔥',
  '⚽',
  '🏆',
  '❤️',
  'GOL',
] as const;

export function formatPuzzlePresetLabel(id: PuzzlePresetId): string {
  return PUZZLE_PRESETS.find((p) => p.id === id)?.label ?? id;
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/** Basit 5×7 bitmap harfler (GOL). */
const GLYPH_5X7: Record<string, number[]> = {
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
};

/**
 * Overlay metin/emoji için hücre “yanık” mı?
 * nx,ny 0–1 stadyum; glyph ortalanmış.
 */
export function sampleOverlayGlyph(
  nx: number,
  ny: number,
  overlay: string,
): boolean {
  const text = (overlay || '').trim().toUpperCase();
  if (!text) return false;

  // Emoji / tek sembol — merkezi blob + halka
  if (text.length <= 2 && !/^[A-Z0-9]+$/.test(text)) {
    const dx = nx - 0.5;
    const dy = ny - 0.5;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (text.includes('⚽') || text.includes('🏆')) {
      return d < 0.22 || (d > 0.26 && d < 0.32);
    }
    if (text.includes('🔥')) {
      const flame =
        Math.exp(-((dx * dx) / 0.04 + ((dy + 0.08) * (dy + 0.08)) / 0.09)) >
        0.35;
      return flame;
    }
    return d < 0.2;
  }

  // Metin (GOL vb.) — 5×7 hücre font
  const chars = text.replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (!chars) return false;
  const cols = chars.length * 6 - 1;
  const rows = 7;
  const marginX = 0.12;
  const marginY = 0.28;
  const usableW = 1 - marginX * 2;
  const usableH = 1 - marginY * 2;
  const gx = (nx - marginX) / usableW;
  const gy = (ny - marginY) / usableH;
  if (gx < 0 || gx > 1 || gy < 0 || gy > 1) return false;

  const cx = Math.floor(gx * cols);
  const cy = Math.floor(gy * rows);
  const charIndex = Math.floor(cx / 6);
  const localX = cx % 6;
  if (localX >= 5) return false;
  const ch = chars[charIndex];
  if (!ch) return false;
  const rowsBits = GLYPH_5X7[ch];
  if (!rowsBits) return true; // bilinmeyen harf: dolu blok
  const rowBits = rowsBits[cy];
  if (rowBits == null) return false;
  return ((rowBits >> (4 - localX)) & 1) === 1;
}

/** Dev Türk Bayrağı — kırmızı zemin, beyaz hilal + yıldız. */
export function sampleTurkishFlag(
  nx: number,
  ny: number,
): [number, number, number] {
  const RED: [number, number, number] = [227, 10, 23];
  const WHITE: [number, number, number] = [255, 255, 255];

  // Hilal merkezi (bayrak oranına yakın)
  const cx = 0.38;
  const cy = 0.5;
  const rOuter = 0.22;
  const rInner = 0.17;
  const ox = cx + 0.06;
  const dx = nx - cx;
  const dy = ny - cy;
  const dOuter = Math.sqrt(dx * dx + dy * dy);
  const dInner = Math.sqrt((nx - ox) * (nx - ox) + dy * dy);
  const inCrescent = dOuter <= rOuter && dInner > rInner;

  // 5 köşeli yıldız (yaklaşık)
  const sx = 0.55;
  const sy = 0.5;
  const starR = 0.07;
  const sdx = nx - sx;
  const sdy = ny - sy;
  const ang = Math.atan2(sdy, sdx);
  const dist = Math.sqrt(sdx * sdx + sdy * sdy);
  const starEdge =
    starR *
    (0.55 +
      0.45 *
        Math.max(
          0,
          Math.cos(ang * 5) * 0.5 + 0.5,
        ));
  const inStar = dist <= starEdge;

  if (inCrescent || inStar) return WHITE;
  return RED;
}

/** Kulüp kupası / logo — altın kupa + kaide. */
export function sampleClubCup(
  nx: number,
  ny: number,
): [number, number, number] {
  const BG: [number, number, number] = [15, 23, 42];
  const GOLD: [number, number, number] = [251, 191, 36];
  const DARK: [number, number, number] = [146, 64, 14];

  const cx = 0.5;
  // Gövde
  const cupTop = ny > 0.22 && ny < 0.55;
  const cupBody =
    cupTop && Math.abs(nx - cx) < 0.12 + (0.55 - ny) * 0.15;
  // Kulplar
  const leftHandle =
    ny > 0.28 &&
    ny < 0.48 &&
    nx > cx - 0.28 &&
    nx < cx - 0.14 &&
    Math.abs(ny - 0.38) < 0.1;
  const rightHandle =
    ny > 0.28 &&
    ny < 0.48 &&
    nx > cx + 0.14 &&
    nx < cx + 0.28 &&
    Math.abs(ny - 0.38) < 0.1;
  // Sap + kaide
  const stem =
    ny >= 0.55 && ny < 0.68 && Math.abs(nx - cx) < 0.04;
  const base =
    ny >= 0.68 && ny < 0.78 && Math.abs(nx - cx) < 0.16;

  if (cupBody || leftHandle || rightHandle) return GOLD;
  if (stem || base) return DARK;
  // Hafif zemin ışıması
  const glow = Math.exp(-((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 8);
  if (glow > 0.55) {
    return [
      Math.round(15 + glow * 40),
      Math.round(23 + glow * 30),
      Math.round(42 + glow * 20),
    ];
  }
  return BG;
}

/** Overlay rengi — emoji/metin lit pikselleri. */
export function colorForOverlayEmoji(
  overlay: string,
  lit: boolean,
): [number, number, number] {
  if (!lit) return [15, 23, 42];
  const t = overlay.trim();
  if (t.includes('🔥')) return [255, 120, 20];
  if (t.includes('⚽')) return [240, 240, 240];
  if (t.includes('🏆')) return [251, 191, 36];
  if (t.includes('❤') || t.includes('❤️')) return [239, 68, 68];
  if (/GOL/i.test(t)) return [34, 197, 94];
  return [255, 255, 255];
}

/**
 * Mic enerji (0–1) → speed çarpanı + waveAmplitude.
 * Bas vuruşu yükseldikçe dalga boyu/genişliği esner.
 */
export function micEnergyToWaveSync(energy: number): {
  speedScale: number;
  waveAmplitude: number;
  audioDrive: number;
} {
  const e = clamp01(energy);
  // Yumuşak eğri — düşük seviyede küçük hareket, peak’te agresif esneme
  const drive = Number((e * e * 0.35 + e * 0.65).toFixed(3));
  return {
    audioDrive: drive,
    speedScale: Number((0.55 + drive * 1.45).toFixed(3)),
    waveAmplitude: Number((0.45 + drive * 2.1).toFixed(3)),
  };
}
