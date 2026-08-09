/**
 * V32.0 — Reji Quick Macro Engine (hızlı eylem kombinasyonları).
 * SUPER_GOL / DROP_THE_BASS / BLACKOUT_RESET → matrix + PTP yayın.
 */

import {
  buildMatrixCommand,
  createIdleMatrixCommand,
  type MatrixCommand,
} from './pixelMapper';
import { themeIdToMix } from './visualThemes';

export type QuickMacroId =
  | 'SUPER_GOL'
  | 'DROP_THE_BASS'
  | 'BLACKOUT_RESET';

export type QuickMacroDef = {
  id: QuickMacroId;
  label: string;
  labelTr: string;
  hint: string;
  /** Strobe süresi (ms); 0 = yok. */
  strobeMs: number;
  /** Blackout tetikle. */
  blackout: boolean;
};

export const SUPER_GOL_STROBE_MS = 5_000;
/** %100 matris hızı (pixelMapper max). */
export const MACRO_SPEED_FULL = 3;
/** %50 base hız. */
export const MACRO_SPEED_BASE_50 = 1.5;
export const MACRO_WAVE_PEAK = 3;
export const MACRO_AUDIO_DRIVE_MAX = 1;

export const QUICK_MACROS: readonly QuickMacroDef[] = [
  {
    id: 'SUPER_GOL',
    label: 'SUPER GOL',
    labelTr: 'SÜPER GOL',
    hint: 'Şampiyon · hız %100 · strobe 5s · GOL',
    strobeMs: SUPER_GOL_STROBE_MS,
    blackout: false,
  },
  {
    id: 'DROP_THE_BASS',
    label: 'DROP THE BASS',
    labelTr: 'DROP THE BASS',
    hint: 'Neon · audio drive max · wave peak',
    strobeMs: 0,
    blackout: false,
  },
  {
    id: 'BLACKOUT_RESET',
    label: 'BLACKOUT RESET',
    labelTr: 'BLACKOUT RESET',
    hint: 'Karart · emoji temiz · hız %50',
    strobeMs: 0,
    blackout: true,
  },
] as const;

export function getQuickMacro(id: QuickMacroId): QuickMacroDef {
  const found = QUICK_MACROS.find((m) => m.id === id);
  if (!found) throw new Error(`unknown macro ${id}`);
  return found;
}

export function formatQuickMacroLabel(id: QuickMacroId): string {
  return getQuickMacro(id).labelTr;
}

/**
 * Makro → matrix komutu (engage).
 * BLACKOUT_RESET: emoji temiz + base hız; blackout ayrı handler.
 */
export function buildQuickMacroMatrix(
  id: QuickMacroId,
  prev?: MatrixCommand | null,
): MatrixCommand {
  const base = prev ?? createIdleMatrixCommand({ engaged: true });

  if (id === 'SUPER_GOL') {
    return buildMatrixCommand({
      ...base,
      engaged: true,
      themeMix: themeIdToMix('champion'),
      hue: 0,
      baseSpeed: MACRO_SPEED_FULL,
      speed: MACRO_SPEED_FULL,
      strobe: true,
      strobeSensitivity: 1,
      overlayEmoji: 'GOL',
      puzzlePreset: 'live_emoji',
      waveAmplitude: Math.max(base.waveAmplitude ?? 1, 1.4),
      audioDrive: base.audioDrive ?? 0,
    });
  }

  if (id === 'DROP_THE_BASS') {
    return buildMatrixCommand({
      ...base,
      engaged: true,
      themeMix: themeIdToMix('neon'),
      baseSpeed: base.baseSpeed ?? base.speed,
      speed: Math.min(
        3,
        Math.max(0.25, (base.baseSpeed ?? base.speed) * 1.35),
      ),
      strobe: false,
      strobeSensitivity: Math.max(base.strobeSensitivity ?? 0.55, 0.85),
      audioDrive: MACRO_AUDIO_DRIVE_MAX,
      waveAmplitude: MACRO_WAVE_PEAK,
      overlayEmoji: base.overlayEmoji ?? null,
    });
  }

  // BLACKOUT_RESET
  return buildMatrixCommand({
    ...base,
    engaged: false,
    strobe: false,
    overlayEmoji: null,
    puzzlePreset: 'none',
    audioDrive: 0,
    waveAmplitude: 1,
    baseSpeed: MACRO_SPEED_BASE_50,
    speed: MACRO_SPEED_BASE_50,
  });
}

/** OutgoingAction for admin middleware / logs. */
export function quickMacroOutgoingAction(
  id: QuickMacroId,
): 'START_SHOW' | 'EMERGENCY_BLACKOUT' | 'RESET' {
  if (id === 'BLACKOUT_RESET') return 'EMERGENCY_BLACKOUT';
  if (id === 'SUPER_GOL') return 'START_SHOW';
  return 'START_SHOW';
}
