/**
 * Tribün halkası UV unwrap.
 * Stadyum (nx,ny) → texture (u,v): saha deliği sıkıştırılır;
 * görsel merkezi (ay/yıldız) tribün koltuklarına düşer.
 *
 * Not: seatPixelMap / pixelMapper ile döngü olmaması için band
 * dikdörtgenleri burada kopyalanır (TRIBUNE_BANDS ile senkron tut).
 *
 * Faz 3 / T-058: 400×400 grid, 70k kapasite (4×17.500),
 * polarite tPolar=1-t, ay-yıldız odağı FLAG_EMBLEM_FOCUS.
 */

/** pixelMapper ile döngüyü önlemek için yerel varsayılan (400×400). */
const DEFAULT_GRID_W = 400;
const DEFAULT_GRID_H = 400;

/** Toplam stadyum telefon kapasitesi (4 tribün × 17.500). */
export const STADIUM_PHONE_CAPACITY = 70_000;
export const TRIBUNE_BAND_CAPACITY = 17_500;

/**
 * Türk bayrağı ay-yıldız odak noktası (normalize 0–1, texture UV).
 * Sola kaydırıldı — ay/yıldızın sahaya düşmesini engeller.
 */
export const FLAG_EMBLEM_FOCUS = { x: 0.389, y: 0.5 } as const;

type BandRect = { x0: number; x1: number; y0: number; y1: number };

/**
 * seatPixelMap.TRIBUNE_BANDS ile aynı geometri (400×400).
 * E/W bantları ≥17.500 piksel olacak şekilde genişletildi.
 */
const BAND_RECTS: BandRect[] = [
  { x0: 75, x1: 324, y0: 0, y1: 99 }, // NORTH — 250×100=25.000
  { x0: 75, x1: 324, y0: 300, y1: 399 }, // SOUTH
  { x0: 325, x1: 399, y0: 75, y1: 324 }, // EAST — 75×250=18.750
  { x0: 0, x1: 74, y0: 75, y1: 324 }, // WEST
];

export type TextureUv = { u: number; v: number };

/** Pitch deliği — band iç kenarlarından (normalize 0–1). */
export function pitchHoleNorm(gridW = DEFAULT_GRID_W, gridH = DEFAULT_GRID_H) {
  const n = BAND_RECTS[0]!;
  const s = BAND_RECTS[1]!;
  const e = BAND_RECTS[2]!;
  const w = BAND_RECTS[3]!;
  return {
    x0: (w.x1 + 0.5) / gridW,
    x1: (e.x0 - 0.5) / gridW,
    y0: (n.y1 + 0.5) / gridH,
    y1: (s.y0 - 0.5) / gridH,
  };
}

export function isInTribuneBandCell(x: number, y: number): boolean {
  for (const b of BAND_RECTS) {
    if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return true;
  }
  return false;
}

export function isInTribuneBandUv(
  nx: number,
  ny: number,
  gridW = DEFAULT_GRID_W,
  gridH = DEFAULT_GRID_H,
): boolean {
  const x = Math.floor(nx * gridW);
  const y = Math.floor(ny * gridH);
  return isInTribuneBandCell(x, y);
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/**
 * Merkezden θ açısında pitch / dış çember yarıçapı (kare stadyum).
 */
export function ringRadiiAtAngle(
  angle: number,
  gridW = DEFAULT_GRID_W,
  gridH = DEFAULT_GRID_H,
) {
  const hole = pitchHoleNorm(gridW, gridH);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const eps = 1e-9;

  let rOut = Infinity;
  if (Math.abs(cos) > eps) {
    const tx = cos > 0 ? (1 - 0.5) / cos : (0 - 0.5) / cos;
    if (tx > 0) rOut = Math.min(rOut, tx);
  }
  if (Math.abs(sin) > eps) {
    const ty = sin > 0 ? (1 - 0.5) / sin : (0 - 0.5) / sin;
    if (ty > 0) rOut = Math.min(rOut, ty);
  }
  if (!Number.isFinite(rOut) || rOut <= 0) rOut = 0.5;

  let rIn = Infinity;
  if (Math.abs(cos) > eps) {
    const tx = cos > 0 ? (hole.x1 - 0.5) / cos : (hole.x0 - 0.5) / cos;
    if (tx > 0) rIn = Math.min(rIn, tx);
  }
  if (Math.abs(sin) > eps) {
    const ty = sin > 0 ? (hole.y1 - 0.5) / sin : (hole.y0 - 0.5) / sin;
    if (ty > 0) rIn = Math.min(rIn, ty);
  }
  if (!Number.isFinite(rIn) || rIn <= 0) {
    rIn = Math.min(
      hole.x1 - 0.5,
      0.5 - hole.x0,
      hole.y1 - 0.5,
      0.5 - hole.y0,
    );
  }

  if (rIn >= rOut) rIn = rOut * 0.55;
  return { rIn, rOut };
}

/**
 * Cover: birim kare stadyum noktası → texture UV (aspect = width/height).
 */
export function coverSquareToTextureUv(
  sx: number,
  sy: number,
  texAspect: number,
): TextureUv {
  const boxAspect = 1;
  const A = Math.max(0.05, texAspect);
  let u: number;
  let v: number;
  if (A >= boxAspect) {
    u = 0.5 + (sx - 0.5) * (A / boxAspect);
    v = sy;
  } else {
    u = sx;
    v = 0.5 + (sy - 0.5) * (boxAspect / A);
  }
  return { u: clamp01(u), v: clamp01(v) };
}

/**
 * Stadyum UV → texture UV (tribün halkası squash + cover).
 * Polarite: tPolar = 1 - t (iç kenar → ay/yıldız odağı civarı).
 * Odak: FLAG_EMBLEM_FOCUS (x=0.389) — sahaya kaymayı önler.
 */
export function stadiumToTextureUv(
  nx: number,
  ny: number,
  texAspect: number,
  gridW = DEFAULT_GRID_W,
  gridH = DEFAULT_GRID_H,
): TextureUv | null {
  if (!isInTribuneBandUv(nx, ny, gridW, gridH)) return null;

  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const r = Math.hypot(dx, dy);
  if (r < 1e-9) {
    return coverSquareToTextureUv(FLAG_EMBLEM_FOCUS.x, FLAG_EMBLEM_FOCUS.y, texAspect);
  }

  const angle = Math.atan2(dy, dx);
  const { rIn, rOut } = ringRadiiAtAngle(angle, gridW, gridH);
  if (r < rIn - 1e-6) return null;

  const t = clamp01((r - rIn) / Math.max(1e-9, rOut - rIn));
  const tPolar = 1 - t;
  const ux = dx / r;
  const uy = dy / r;

  const sx = FLAG_EMBLEM_FOCUS.x + ux * tPolar * 0.5;
  const sy = FLAG_EMBLEM_FOCUS.y + uy * tPolar * 0.5;
  return coverSquareToTextureUv(sx, sy, texAspect);
}
