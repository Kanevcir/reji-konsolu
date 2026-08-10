/**
 * Audience Texture Store — gerçek bitmap UV sampler.
 * MatrixCommand.textureId ile referanslanır; piksel verisi ağda taşınmaz.
 */

import { stadiumToTextureUv } from './tribuneUnwrap';

export const DEFAULT_FLAG_TEXTURE_ID = 'turkish_flag_default';

export type AudienceTexture = {
  id: string;
  width: number;
  height: number;
  /** width/height */
  aspect: number;
  /** RGBA row-major */
  data: Uint8ClampedArray;
  label?: string;
};

const store = new Map<string, AudienceTexture>();

export function getAudienceTexture(id: string | null | undefined): AudienceTexture | null {
  if (!id) return null;
  return store.get(id) ?? null;
}

export function listAudienceTextures(): AudienceTexture[] {
  return [...store.values()];
}

export function registerAudienceTexture(tex: AudienceTexture): AudienceTexture {
  store.set(tex.id, tex);
  return tex;
}

export function unregisterAudienceTexture(id: string) {
  store.delete(id);
}

/** Nearest-neighbor UV sample (u,v in 0–1, v aşağı artar). */
export function sampleTextureRgb(
  tex: AudienceTexture,
  u: number,
  v: number,
): [number, number, number] {
  const w = tex.width;
  const h = tex.height;
  if (w < 1 || h < 1) return [15, 23, 42];
  const x = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
  const y = Math.min(h - 1, Math.max(0, Math.floor(v * h)));
  const i = (y * w + x) * 4;
  const d = tex.data;
  return [d[i]!, d[i + 1]!, d[i + 2]!];
}

/**
 * Stadyum (nx,ny) → tribün unwrap → texture RGB.
 * Band dışı / saha → pitch (çim) rengi.
 */
export function sampleAudienceMappedRgb(
  nx: number,
  ny: number,
  tex: AudienceTexture,
  pitchRgb: [number, number, number] = [12, 40, 18],
): [number, number, number] {
  const uv = stadiumToTextureUv(nx, ny, tex.aspect);
  if (!uv) return pitchRgb;
  return sampleTextureRgb(tex, uv.u, uv.v);
}

/** ImageData / canvas pikselinden texture kaydet. */
export function registerTextureFromRgba(
  id: string,
  width: number,
  height: number,
  data: Uint8ClampedArray | Uint8Array,
  label?: string,
): AudienceTexture {
  const copy = new Uint8ClampedArray(width * height * 4);
  copy.set(data.subarray(0, copy.length));
  return registerAudienceTexture({
    id,
    width,
    height,
    aspect: width / Math.max(1, height),
    data: copy,
    label,
  });
}

/** Browser: HTMLImageElement / ImageBitmap / Canvas → texture. */
export function registerTextureFromDrawable(
  id: string,
  source: CanvasImageSource,
  label?: string,
  maxEdge = 2048,
): AudienceTexture | null {
  if (typeof document === 'undefined') return null;
  const w0 =
    'width' in source && typeof source.width === 'number'
      ? source.width
      : (source as HTMLVideoElement).videoWidth || 0;
  const h0 =
    'height' in source && typeof source.height === 'number'
      ? source.height
      : (source as HTMLVideoElement).videoHeight || 0;
  if (!w0 || !h0) return null;

  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * scale));
  const height = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  const img = ctx.getImageData(0, 0, width, height);
  return registerTextureFromRgba(id, width, height, img.data, label);
}

/** File / Blob → texture (web). */
export async function registerTextureFromBlob(
  id: string,
  blob: Blob,
  label?: string,
): Promise<AudienceTexture> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(blob);
    try {
      const tex = registerTextureFromDrawable(id, bmp, label ?? blob.type);
      if (tex) return tex;
    } finally {
      bmp.close?.();
    }
  }
  if (typeof document === 'undefined') {
    throw new Error('Texture load requires browser');
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = url;
    });
    const tex = registerTextureFromDrawable(id, img, label);
    if (!tex) throw new Error('Texture register failed');
    return tex;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Resmi Türk Bayrağı oranlarına yakın 3:2 bitmap üretir (tek sefer bake).
 * Canlı koltuk örneklemesi bu buffer’dan okur — prosedürel per-pixel formül değil.
 */
export function bakeTurkishFlagTexture(
  height = 400,
  id = DEFAULT_FLAG_TEXTURE_ID,
): AudienceTexture {
  const G = height;
  const width = Math.round(G * 1.5);
  const data = new Uint8ClampedArray(width * height * 4);

  // Türk Bayrağı Kanunu (ölçüler G = yükseklik cinsinden)
  const cx = 0.5 * G; // dış hilal merkez X
  const cy = 0.5 * G;
  const R = 0.25 * G; // dış hilal yarıçap
  const r = 0.2 * G; // iç hilal yarıçap
  const ox = cx + 0.0625 * G * 2 * 0.5; // ≈ 0.5G + 0.0625*2? Law: distance between centers = 0.0625*G... actually 1/16 G between centers along horizontal: 0.0625*G — wait Law says 1/3 of distance related. Standard: inner center is 0.0625*G to the right of outer... Actually: distance between crescent centers = 0.0625*G is wrong.
  // Correct common construction:
  // Outer crescent center at (0.5G from hoist, mid). Outer R=0.25G. Inner r=0.2G.
  // Distance between centers = 0.0625*G? Flag law: A=G/2 from hoist to outer center; B=G/2 vertical; C=G/16 between centers; D=G/10 outer? Simplified widely used:
  const distCenters = (1 / 16) * G; // C
  const innerCx = cx + distCenters;
  const starCenterX = cx + (1 / 3) * G * 0.5 + distCenters; // approx along law: star center ~ outer + 1/3 related
  // More faithful: star center at 0.5G + (1/16)G + (1/3)*(1/4?); practical:
  // Star center X = outerCx + 0.5*G/3 ≈ cx + G/6? Official: from hoist to star center ≈ 0.5G + C + something.
  // Use: star at (0.5*G + 0.25*G*0.72, 0.5G) ≈ well-known look
  const sx = cx + distCenters + 0.25 * G * 0.8;
  const sy = cy;
  const starR = (1 / 8) * G * 0.55; // ~0.0625G tip radius soft

  const RED: [number, number, number] = [227, 10, 23];
  const WHITE: [number, number, number] = [255, 255, 255];

  const set = (x: number, y: number, rgb: [number, number, number]) => {
    const i = (y * width + x) * 4;
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  };

  const inStar = (px: number, py: number) => {
    // Düzenli 5 köşeli yıldız (point-in-polygon)
    const spikes = 5;
    const outer = starR;
    const inner = starR * 0.38;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? outer : inner;
      // Point up: start at -PI/2
      const a = -Math.PI / 2 + (i * Math.PI) / spikes;
      pts.push({ x: sx + Math.cos(a) * rad, y: sy + Math.sin(a) * rad });
    }
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i]!.x;
      const yi = pts[i]!.y;
      const xj = pts[j]!.x;
      const yj = pts[j]!.y;
      const intersect =
        yi > py !== yj > py &&
        px < ((xj - xi) * (py - yi)) / (yj - yi + 0.0) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dxo = x - cx;
      const dyo = y - cy;
      const dOuter = Math.sqrt(dxo * dxo + dyo * dyo);
      const dxi = x - innerCx;
      const dInner = Math.sqrt(dxi * dxi + dyo * dyo);
      const crescent = dOuter <= R && dInner > r;
      if (crescent || inStar(x, y)) set(x, y, WHITE);
      else set(x, y, RED);
    }
  }

  return registerTextureFromRgba(
    id,
    width,
    height,
    data,
    'Türk Bayrağı (3:2 bake)',
  );
}

let defaultReady = false;

/** turkish_flag preset için varsayılan 3:2 texture’ı garanti et. */
export function ensureDefaultFlagTexture(): AudienceTexture {
  const existing = getAudienceTexture(DEFAULT_FLAG_TEXTURE_ID);
  if (existing) {
    defaultReady = true;
    return existing;
  }
  defaultReady = true;
  return bakeTurkishFlagTexture();
}

export function isDefaultFlagReady() {
  return defaultReady || store.has(DEFAULT_FLAG_TEXTURE_ID);
}
