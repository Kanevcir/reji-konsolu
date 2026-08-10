/**
 * V30.0 — Visual Slicer (Görsel Parçalayıcı).
 * Bitmap ağda taşınmaz; cihaz (x,y) → texture UV / formül ile tek piksel çözer.
 */

import {
  DEFAULT_FLAG_TEXTURE_ID,
  ensureDefaultFlagTexture,
  getAudienceTexture,
  sampleAudienceMappedRgb,
} from './audienceTexture';
import {
  evaluatePixel,
  type MatrixCommand,
} from './pixelMapper';
import {
  colorForOverlayEmoji,
  sampleClubCup,
  sampleOverlayGlyph,
  type PuzzlePresetId,
} from './puzzleChoreography';
import type { PixelCoord } from './seatPixelMap';

/** İstemcinin yalnızca kendi göstermesi gereken veri. */
export type SlicedPixelFrame = {
  x: number;
  y: number;
  nx: number;
  ny: number;
  r: number;
  g: number;
  b: number;
  /** Overlay lit ise gösterilecek glyph; aksi null (renk satılır). */
  overlayGlyph: string | null;
  lit: boolean;
  puzzlePreset: PuzzlePresetId;
  /** Strobe anı — tam flaş. */
  strobe: boolean;
};

export type VisualSlicerInput = {
  matrix: MatrixCommand | null;
  coord: PixelCoord;
  /** PTP senkron now (ms). */
  nowMs: number;
};

/**
 * Reji MatrixCommand + koltuk koordinatı → cihaz lokal frame.
 */
export function sliceVisualForDevice(input: VisualSlicerInput): SlicedPixelFrame {
  const { matrix, coord, nowMs } = input;
  const base: SlicedPixelFrame = {
    x: coord.x,
    y: coord.y,
    nx: coord.nx,
    ny: coord.ny,
    r: 15,
    g: 23,
    b: 42,
    overlayGlyph: null,
    lit: false,
    puzzlePreset: 'none',
    strobe: false,
  };

  try {
    if (!matrix || !matrix.engaged) {
      return base;
    }

    const [r, g, b] = evaluatePixel(coord.nx, coord.ny, nowMs, matrix);
    const lit = !(r <= 20 && g <= 28 && b <= 48);
    const overlay = matrix.overlayEmoji;
    const glyphLit =
      overlay != null && sampleOverlayGlyph(coord.nx, coord.ny, overlay);

    return {
      x: coord.x,
      y: coord.y,
      nx: coord.nx,
      ny: coord.ny,
      r,
      g,
      b,
      overlayGlyph: glyphLit ? overlay : null,
      lit: lit || glyphLit,
      puzzlePreset: matrix.puzzlePreset ?? 'none',
      strobe: Boolean(matrix.strobe),
    };
  } catch {
    return base;
  }
}

/**
 * Birim test / debug — puzzle preset’i doğrudan örnekle (matrix bypass).
 */
export function samplePuzzlePixelAt(
  preset: PuzzlePresetId,
  x: number,
  y: number,
  gridW: number,
  gridH: number,
  overlayEmoji: string | null = null,
  textureId: string | null = null,
): { r: number; g: number; b: number; overlayGlyph: string | null } {
  const nx = (x + 0.5) / gridW;
  const ny = (y + 0.5) / gridH;

  if (overlayEmoji) {
    const lit = sampleOverlayGlyph(nx, ny, overlayEmoji);
    const [r, g, b] = colorForOverlayEmoji(overlayEmoji, lit);
    return { r, g, b, overlayGlyph: lit ? overlayEmoji : null };
  }

  if (preset === 'turkish_flag') {
    const tex =
      getAudienceTexture(textureId ?? DEFAULT_FLAG_TEXTURE_ID) ??
      ensureDefaultFlagTexture();
    const [r, g, b] = sampleAudienceMappedRgb(nx, ny, tex);
    return { r, g, b, overlayGlyph: null };
  }
  if (preset === 'club_cup') {
    const [r, g, b] = sampleClubCup(nx, ny);
    return { r, g, b, overlayGlyph: null };
  }
  return { r: 15, g: 23, b: 42, overlayGlyph: null };
}

/** RGB eşitliği (birim test). */
export function rgbEquals(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}
