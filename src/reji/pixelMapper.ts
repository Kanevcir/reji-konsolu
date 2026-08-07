/**
 * V20.0 — Stadyum Piksel Haritalama ve Koreografi Motoru
 * (Stadium Pixel Mapper & Matrix Engine).
 *
 * 200×200 mantıksal grid; cihazlar MatrixCommand formülünü
 * kendi (x,y) koordinatında PTP t0’a göre hesaplar — bitmap gönderilmez.
 *
 * V24.0 — themeMix / strobe alanları (görsel tema + audio reactive flaş).
 * V25.0 — waveAmplitude / audioDrive + puzzle overlay (bayrak/kupa/emoji).
 */

import { getSyncedTimestamp } from './clockSync';
import {
  colorForOverlayEmoji,
  sampleClubCup,
  sampleOverlayGlyph,
  sampleTurkishFlag,
  type PuzzlePresetId,
} from './puzzleChoreography';
import {
  DEFAULT_STROBE_SENSITIVITY,
  DEFAULT_THEME_MIX,
  interpolateTheme,
} from './visualThemes';

export const PIXEL_GRID_W = 200;
export const PIXEL_GRID_H = 200;
/** Önizleme çözünürlüğü (UI thread dostu). */
export const PREVIEW_GRID = 64;

export type MatrixEffect =
  | 'RADIAL_WAVE'
  | 'LINEAR_SWEEP'
  | 'PULSE'
  | 'MATRIX_IMAGE';

/** Sıkıştırılmış koreografi vektörü — OutgoingPayload.matrix */
export type MatrixCommand = {
  v: 1;
  effect: MatrixEffect;
  gridW: number;
  gridH: number;
  /** PTP başlangıç zamanı (ms). */
  t0: number;
  /** Canlı animasyon hız çarpanı (0.25–3) — audio ile anlık değişebilir. */
  speed: number;
  /**
   * Operatör/MIDI taban hızı — audio sync speed’i bundan üretir.
   */
  baseSpeed: number;
  /** Ana renk tonu 0–360 (tema ile senkron tutulur). */
  hue: number;
  /** 0–1 */
  intensity: number;
  /** LINEAR_SWEEP açı (derece). */
  angle: number;
  /** MATRIX_IMAGE prosedürel desen kimliği. */
  patternId: number;
  engaged: boolean;
  /**
   * V24 — Alev→Neon→Şampiyon crossfade (0–1).
   */
  themeMix: number;
  /** V24 — anlık audio-reactive strobe flaş. */
  strobe: boolean;
  /** V24 — peak hassasiyeti 0–1 (↑ = daha kolay flaş). */
  strobeSensitivity: number;
  /**
   * V25 — dalga boyu / genişlik esnemesi (0.35–3).
   * Mic bas vuruşu ile büyüyüp küçülür.
   */
  waveAmplitude: number;
  /** V25 — normalize mic enerji 0–1 (audio sync). */
  audioDrive: number;
  /** V25 — puzzle koreografi preset. */
  puzzlePreset: PuzzlePresetId;
  /**
   * V25 — OVERLAY_EMOJI: tüm telefonlar bu glyph/metne dönüşür.
   * null = overlay kapalı.
   */
  overlayEmoji: string | null;
};

export const MATRIX_EFFECTS: readonly MatrixEffect[] = [
  'RADIAL_WAVE',
  'LINEAR_SWEEP',
  'PULSE',
  'MATRIX_IMAGE',
] as const;

export function formatMatrixEffectLabel(effect: MatrixEffect): string {
  switch (effect) {
    case 'RADIAL_WAVE':
      return 'Wave';
    case 'LINEAR_SWEEP':
      return 'Sweep';
    case 'PULSE':
      return 'Pulse';
    case 'MATRIX_IMAGE':
      return 'Matrix Image';
    default:
      return effect;
  }
}

export function buildMatrixEngagedMessage(effect: MatrixEffect): string {
  return `MATRIX_ENGAGED: ${formatMatrixEffectLabel(effect)}`;
}

export function createIdleMatrixCommand(
  partial?: Partial<MatrixCommand>,
): MatrixCommand {
  const themeMix = clamp(partial?.themeMix ?? DEFAULT_THEME_MIX, 0, 1);
  const theme = interpolateTheme(themeMix);
  const baseSpeed = clamp(partial?.baseSpeed ?? partial?.speed ?? 1, 0.25, 3);
  const base: MatrixCommand = {
    v: 1,
    effect: 'RADIAL_WAVE',
    gridW: PIXEL_GRID_W,
    gridH: PIXEL_GRID_H,
    t0: getSyncedTimestamp(),
    speed: baseSpeed,
    baseSpeed,
    hue: theme.hue,
    intensity: 0.85,
    angle: 0,
    patternId: 1,
    engaged: false,
    themeMix,
    strobe: false,
    strobeSensitivity: DEFAULT_STROBE_SENSITIVITY,
    waveAmplitude: 1,
    audioDrive: 0,
    puzzlePreset: 'none',
    overlayEmoji: null,
  };
  if (!partial) return base;
  const nextBase = clamp(
    partial.baseSpeed ?? partial.speed ?? baseSpeed,
    0.25,
    3,
  );
  return {
    ...base,
    ...partial,
    themeMix,
    hue: partial.hue ?? theme.hue,
    strobe: partial.strobe ?? false,
    strobeSensitivity: clamp(
      partial.strobeSensitivity ?? DEFAULT_STROBE_SENSITIVITY,
      0,
      1,
    ),
    baseSpeed: nextBase,
    speed: clamp(partial.speed ?? nextBase, 0.25, 3),
    waveAmplitude: clamp(partial.waveAmplitude ?? 1, 0.35, 3),
    audioDrive: clamp(partial.audioDrive ?? 0, 0, 1),
    puzzlePreset: partial.puzzlePreset ?? 'none',
    overlayEmoji:
      partial.overlayEmoji === undefined ? null : partial.overlayEmoji,
  };
}

export function buildMatrixCommand(input: {
  effect: MatrixEffect;
  speed?: number;
  baseSpeed?: number;
  hue?: number;
  intensity?: number;
  angle?: number;
  patternId?: number;
  engaged?: boolean;
  t0?: number;
  themeMix?: number;
  strobe?: boolean;
  strobeSensitivity?: number;
  waveAmplitude?: number;
  audioDrive?: number;
  puzzlePreset?: PuzzlePresetId;
  overlayEmoji?: string | null;
}): MatrixCommand {
  const themeMix = clamp(input.themeMix ?? DEFAULT_THEME_MIX, 0, 1);
  const theme = interpolateTheme(themeMix);
  const baseSpeed = clamp(input.baseSpeed ?? input.speed ?? 1, 0.25, 3);
  return createIdleMatrixCommand({
    effect: input.effect,
    speed: clamp(input.speed ?? baseSpeed, 0.25, 3),
    baseSpeed,
    hue: input.hue ?? theme.hue,
    intensity: clamp(input.intensity ?? 0.85, 0, 1),
    angle: input.angle ?? 0,
    patternId: Math.max(0, Math.floor(input.patternId ?? 1)),
    engaged: input.engaged ?? true,
    t0: input.t0 ?? getSyncedTimestamp(),
    themeMix,
    strobe: input.strobe ?? false,
    strobeSensitivity: clamp(
      input.strobeSensitivity ?? DEFAULT_STROBE_SENSITIVITY,
      0,
      1,
    ),
    waveAmplitude: clamp(input.waveAmplitude ?? 1, 0.35, 3),
    audioDrive: clamp(input.audioDrive ?? 0, 0, 1),
    puzzlePreset: input.puzzlePreset ?? 'none',
    overlayEmoji: input.overlayEmoji ?? null,
  });
}

/** Eski showfile / kısmi matrix nesnelerini V25 alanlarıyla tamamla. */
export function normalizeMatrixCommand(
  raw: Partial<MatrixCommand> | null | undefined,
): MatrixCommand {
  return createIdleMatrixCommand({
    ...(raw ?? {}),
    engaged: false,
    strobe: false,
    overlayEmoji: raw?.overlayEmoji ?? null,
    audioDrive: 0,
    waveAmplitude: raw?.waveAmplitude ?? 1,
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** HSL → RGB 0–255 */
export function hslToRgb(
  h: number,
  s: number,
  l: number,
): [number, number, number] {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 1);
  const ll = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/**
 * Düşük çözünürlüklü prosedürel “image/pattern” örnekleyici.
 * patternId ile farklı mozaik/flag desenleri.
 */
export function samplePattern(
  nx: number,
  ny: number,
  patternId: number,
): number {
  const px = Math.floor(nx * 16);
  const py = Math.floor(ny * 16);
  switch (patternId % 4) {
    case 0:
      return (px + py) % 2 === 0 ? 1 : 0.15;
    case 1:
      return Math.abs(Math.sin(px * 0.8) * Math.cos(py * 0.8));
    case 2:
      return nx < 0.5 ? (ny < 0.5 ? 1 : 0.35) : ny < 0.5 ? 0.55 : 0.2;
    default:
      return ((px ^ py) & 1) === 0 ? 0.9 : 0.25;
  }
}

/**
 * Normalize (0–1) koordinatta renk hesapla.
 * Cihazlar GPS/QR grid konumunu nx,ny’ye map eder.
 */
export function evaluatePixel(
  nx: number,
  ny: number,
  nowMs: number,
  cmd: MatrixCommand,
): [number, number, number] {
  try {
    if (!cmd.engaged) return [15, 23, 42];

    // V24 — audio reactive strobe
    if (cmd.strobe) {
      const theme = interpolateTheme(cmd.themeMix ?? DEFAULT_THEME_MIX);
      if (theme.themeId === 'champion' || (cmd.themeMix ?? 0) > 0.75) {
        return [255, 255, 255];
      }
      return hslToRgb(theme.hue, 0.35, 0.92);
    }

    // V25 — OVERLAY_EMOJI: tüm matris glyph’e dönüşür
    const overlay = cmd.overlayEmoji;
    if (overlay) {
      const lit = sampleOverlayGlyph(nx, ny, overlay);
      return colorForOverlayEmoji(overlay, lit);
    }

    // V25 — puzzle preset (bayrak / kupa)
    const preset = cmd.puzzlePreset ?? 'none';
    if (preset === 'turkish_flag') {
      return sampleTurkishFlag(nx, ny);
    }
    if (preset === 'club_cup') {
      return sampleClubCup(nx, ny);
    }

    const theme = interpolateTheme(cmd.themeMix ?? DEFAULT_THEME_MIX);
    const hue = Number.isFinite(cmd.hue) ? cmd.hue : theme.hue;
    const sat = theme.saturation;
    const amp = clamp(cmd.waveAmplitude ?? 1, 0.35, 3);
    const drive = clamp(cmd.audioDrive ?? 0, 0, 1);

    const t = Math.max(0, (nowMs - cmd.t0) / 1000) * cmd.speed;
    const intensity = cmd.intensity;
    let brightness = 0;

    switch (cmd.effect) {
      case 'RADIAL_WAVE': {
        const dx = nx - 0.5;
        const dy = ny - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // amp ↑ → dalga frekansı (boy) ve genlik esner
        const spatial = 10 + amp * 14;
        const wave = Math.sin(dist * spatial - t * (5 + amp * 2));
        brightness = 0.5 + 0.5 * wave * Math.min(1.35, 0.55 + amp * 0.45);
        break;
      }
      case 'LINEAR_SWEEP': {
        const rad = (cmd.angle * Math.PI) / 180;
        const proj = nx * Math.cos(rad) + ny * Math.sin(rad);
        const spatial = 8 + amp * 12;
        const wave = Math.sin(proj * spatial - t * (4 + amp * 2));
        brightness = 0.5 + 0.5 * wave * Math.min(1.35, 0.55 + amp * 0.45);
        break;
      }
      case 'PULSE': {
        const pulse = 0.5 + 0.5 * Math.sin(t * (6 + amp * 4));
        const dx = nx - 0.5;
        const dy = ny - 0.5;
        const falloff = Math.exp(-(dx * dx + dy * dy) * (4 + amp * 4));
        brightness = pulse * falloff * (0.7 + drive * 0.5);
        break;
      }
      case 'MATRIX_IMAGE': {
        const base = samplePattern(nx, ny, cmd.patternId);
        const shimmer = 0.85 + 0.15 * Math.sin(t * (3 + amp * 2) + nx * 3);
        brightness = base * shimmer * (0.75 + amp * 0.25);
        break;
      }
      default:
        brightness = 0.3;
    }

    const accentHue =
      ((hue + (nx + ny) * (theme.themeId === 'neon' ? 40 : 18)) % 360 + 360) %
      360;

    const lit = clamp(brightness * intensity, 0, 1);
    if (lit < 0.08) return [15, 23, 42];
    // Audio drive ile hafif lightness boost — “esneme” hissi
    const lightBoost = 0.22 + lit * 0.5 + drive * 0.08;
    return hslToRgb(accentHue, sat, clamp(lightBoost, 0, 0.92));
  } catch {
    return [15, 23, 42];
  }
}

/**
 * Önizleme buffer’ını doldur (RGBA Uint8ClampedArray).
 * previewW×previewH — UI’da 64² önerilir.
 */
export function fillPreviewBuffer(
  out: Uint8ClampedArray | Uint8Array,
  previewW: number,
  previewH: number,
  nowMs: number,
  cmd: MatrixCommand,
) {
  try {
    for (let y = 0; y < previewH; y++) {
      const ny = (y + 0.5) / previewH;
      for (let x = 0; x < previewW; x++) {
        const nx = (x + 0.5) / previewW;
        const [r, g, b] = evaluatePixel(nx, ny, nowMs, cmd);
        const i = (y * previewW + x) * 4;
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
        out[i + 3] = 255;
      }
    }
  } catch {
    // ignore
  }
}

/** Grid hücre merkezi → normalize. */
export function cellToNormalized(
  col: number,
  row: number,
  cols: number,
  rows: number,
): [number, number] {
  return [(col + 0.5) / cols, (row + 0.5) / rows];
}
