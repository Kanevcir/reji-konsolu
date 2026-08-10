/**
 * Tribün halkası UV unwrap.
 * Stadyum (nx,ny) → texture (u,v): saha deliği sıkıştırılır;
 * görsel merkezi (ay/yıldız) tribün koltuklarına düşer.
 *
 * Not: seatPixelMap / pixelMapper ile döngü olmaması için band
 * dikdörtgenleri burada kopyalanır (TRIBUNE_BANDS ile senkron tut).
 */

/** pixelMapper ile döngüyü önlemek için yerel varsayılan (200×200). */
const DEFAULT_GRID_W = 200;
const DEFAULT_GRID_H = 200;

type BandRect = { x0: number; x1: number; y0: number; y1: number };

/** seatPixelMap.TRIBUNE_BANDS ile aynı geometri. */
const BAND_RECTS: BandRect[] = [
  { x0: 40, x1: 159, y0: 0, y1: 49 }, // NORTH
  { x0: 40, x1: 159, y0: 150, y1: 199 }, // SOUTH
  { x0: 160, x1: 199, y0: 50, y1: 149 }, // EAST
  { x0: 0, x1: 39, y0: 50, y1: 149 }, // WEST
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
 * t=0 (saha kenarı) → görsel merkezi; t=1 (dış kenar) → görsel kenarı.
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
    return coverSquareToTextureUv(0.5, 0.5, texAspect);
  }

  const angle = Math.atan2(dy, dx);
  const { rIn, rOut } = ringRadiiAtAngle(angle, gridW, gridH);
  if (r < rIn - 1e-6) return null;

  const t = clamp01((r - rIn) / Math.max(1e-9, rOut - rIn));
  const ux = dx / r;
  const uy = dy / r;

  const sx = 0.5 + ux * t * 0.5;
  const sy = 0.5 + uy * t * 0.5;
  return coverSquareToTextureUv(sx, sy, texAspect);
}
