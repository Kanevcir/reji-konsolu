/**
 * V24.0 — Görsel Temalar + Audio Reactive Strobe.
 * Alev / Neon / Şampiyon paletleri; crossfader ile yumuşak geçiş;
 * mic peak → matris flaş.
 */

export type VisualThemeId = 'fire' | 'neon' | 'champion';

export type ThemePalette = {
  id: VisualThemeId;
  label: string;
  labelTr: string;
  /** Ana / ikincil / vurgu hue (0–360). */
  hues: [number, number, number];
  /** UI swatch hex. */
  colors: [string, string, string];
  /** Saturation bias 0–1 (Şampiyon beyaz için düşük). */
  saturation: number;
};

export const THEME_ORDER: readonly VisualThemeId[] = [
  'fire',
  'neon',
  'champion',
] as const;

export const VISUAL_THEMES: Record<VisualThemeId, ThemePalette> = {
  fire: {
    id: 'fire',
    label: 'Fire',
    labelTr: 'Alev',
    hues: [8, 28, 42],
    colors: ['#EF4444', '#F97316', '#FACC15'],
    saturation: 0.92,
  },
  neon: {
    id: 'neon',
    label: 'Neon',
    labelTr: 'Neon',
    hues: [285, 320, 175],
    colors: ['#A855F7', '#EC4899', '#2DD4BF'],
    saturation: 0.88,
  },
  champion: {
    id: 'champion',
    label: 'Champion',
    labelTr: 'Şampiyon',
    hues: [0, 0, 0],
    colors: ['#DC2626', '#F8FAFC', '#FEE2E2'],
    saturation: 0.55,
  },
};

/** Strobe: sensitivity 1 → daha düşük dB eşiği (daha kolay tetik). */
export const STROBE_DB_FLOOR = -48;
export const STROBE_DB_CEIL = -14;
/** Flaş süresi (ms). */
export const STROBE_FLASH_MS = 90;
/** Peak spam önleme. */
export const STROBE_COOLDOWN_MS = 140;
export const DEFAULT_STROBE_SENSITIVITY = 0.55;
export const DEFAULT_THEME_MIX = 0;

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function formatThemeLabel(id: VisualThemeId): string {
  return VISUAL_THEMES[id]?.labelTr ?? id;
}

/** Crossfader / CC 0–127 → themeMix 0–1. */
export function ccToThemeMix(value: number): number {
  return Number((clamp01(Math.max(0, Math.min(127, value)) / 127)).toFixed(3));
}

/** CC 0–127 → strobeSensitivity 0–1. */
export function ccToStrobeSensitivity(value: number): number {
  return Number((clamp01(Math.max(0, Math.min(127, value)) / 127)).toFixed(3));
}

/**
 * themeMix 0–1 → en yakın tema kimliği
 * (0≈Alev, 0.5≈Neon, 1≈Şampiyon).
 */
export function resolveCurrentTheme(themeMix: number): VisualThemeId {
  const t = clamp01(themeMix);
  if (t < 1 / 3) return 'fire';
  if (t < 2 / 3) return 'neon';
  return 'champion';
}

/** theme id → mix merkez değeri. */
export function themeIdToMix(id: VisualThemeId): number {
  const i = THEME_ORDER.indexOf(id);
  if (i <= 0) return 0;
  if (i >= THEME_ORDER.length - 1) return 1;
  return i / (THEME_ORDER.length - 1);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpHue(a: number, b: number, t: number) {
  const diff = ((b - a + 540) % 360) - 180;
  return ((a + diff * t) % 360 + 360) % 360;
}

export type InterpolatedTheme = {
  themeId: VisualThemeId;
  themeMix: number;
  /** Ana hue (matris). */
  hue: number;
  saturation: number;
  primary: string;
  secondary: string;
  accent: string;
};

/** Crossfader pozisyonunda yumuşak Alev→Neon→Şampiyon geçişi. */
export function interpolateTheme(themeMix: number): InterpolatedTheme {
  const mix = clamp01(themeMix);
  const span = THEME_ORDER.length - 1;
  const scaled = mix * span;
  const i0 = Math.floor(scaled);
  const i1 = Math.min(span, i0 + 1);
  const f = scaled - i0;
  const a = VISUAL_THEMES[THEME_ORDER[i0]!];
  const b = VISUAL_THEMES[THEME_ORDER[i1]!];

  const hue = lerpHue(a.hues[0], b.hues[0], f);
  const saturation = lerp(a.saturation, b.saturation, f);
  // Şampiyon tarafında beyaza yaklaşırken sat düşer, hue kırmızı kalır
  const champBias = mix > 0.66 ? (mix - 0.66) / 0.34 : 0;
  const sat = Math.max(0.12, saturation * (1 - champBias * 0.65));

  return {
    themeId: resolveCurrentTheme(mix),
    themeMix: mix,
    hue: Number(hue.toFixed(1)),
    saturation: Number(sat.toFixed(3)),
    primary: f < 0.5 ? a.colors[0] : b.colors[0],
    secondary: f < 0.5 ? a.colors[1] : b.colors[1],
    accent: f < 0.5 ? a.colors[2] : b.colors[2],
  };
}

/** Mic dB eşiği — sensitivity ↑ → eşik ↓. */
export function strobeThresholdDb(sensitivity: number): number {
  const s = clamp01(sensitivity);
  return STROBE_DB_CEIL - s * (STROBE_DB_CEIL - STROBE_DB_FLOOR);
}

export function shouldTriggerStrobe(
  micLevelDb: number,
  sensitivity: number,
): boolean {
  try {
    return micLevelDb >= strobeThresholdDb(sensitivity);
  } catch {
    return false;
  }
}
