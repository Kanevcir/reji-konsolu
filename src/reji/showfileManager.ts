/**
 * V22.0 — Master Showfile (.pulse) dışa/içe aktarma.
 * Makro + MIDI map + Matrix + Zone + BPM tek JSON paket.
 */

import type { MidiBinding } from './midiController';
import type { MatrixCommand } from './pixelMapper';
import type { MacroSequence } from './timelineSequencer';
import type { SpatialZoneId } from './zoneManager';
import { getSyncedTimestamp } from './clockSync';

export const PULSE_SHOW_VERSION = 1 as const;
export const PULSE_SHOW_EXT = '.pulse';

export type PulseShowfile = {
  version: typeof PULSE_SHOW_VERSION;
  format: 'pulse';
  name: string;
  exportedAt: number;
  /** Aktif makro (V14). */
  macro: MacroSequence;
  /** V21 MIDI bağları. */
  midiBindings: MidiBinding[];
  /** V20 matrix ayarları (engaged false olarak saklanır). */
  matrix: MatrixCommand;
  /** V16 zone seçimi. */
  activeZones: SpatialZoneId[];
  bpm: number;
};

export type ShowfileParseResult =
  | { ok: true; show: PulseShowfile; fileName: string }
  | { ok: false; error: string };

export function buildPulseShowfile(input: {
  name?: string;
  macro: MacroSequence;
  midiBindings: MidiBinding[];
  matrix: MatrixCommand;
  activeZones: SpatialZoneId[];
  bpm: number;
}): PulseShowfile {
  const name = (input.name ?? 'Reji Show').trim() || 'Reji Show';
  return {
    version: PULSE_SHOW_VERSION,
    format: 'pulse',
    name,
    exportedAt: getSyncedTimestamp(),
    macro: {
      ...input.macro,
      events: input.macro.events.map((e) => ({
        ...e,
        payload: { ...e.payload },
      })),
    },
    midiBindings: input.midiBindings.map((b) => ({ ...b })),
    matrix: { ...input.matrix, engaged: false },
    activeZones: [...input.activeZones],
    bpm: input.bpm,
  };
}

export function serializePulseShowfile(show: PulseShowfile): string {
  return JSON.stringify(show, null, 2);
}

export function suggestPulseFileName(show: PulseShowfile): string {
  const safe = show.name.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'reji_show';
  return `${safe}${PULSE_SHOW_EXT}`;
}

export function parsePulseShowfile(
  raw: string,
  fileName = `imported${PULSE_SHOW_EXT}`,
): ShowfileParseResult {
  try {
    const trimmed = raw.trim();
    if (!trimmed) return { ok: false, error: 'Boş showfile' };
    const parsed = JSON.parse(trimmed) as Partial<PulseShowfile>;
    if (parsed.format !== 'pulse' && parsed.version !== 1) {
      // version 1 pulse kabul
      if (parsed.version !== 1) {
        return { ok: false, error: 'Geçersiz .pulse formatı' };
      }
    }
    if (!parsed.macro || !Array.isArray(parsed.macro.events)) {
      return { ok: false, error: 'Makro verisi eksik' };
    }
    if (!Array.isArray(parsed.activeZones)) {
      return { ok: false, error: 'Zone verisi eksik' };
    }
    if (!parsed.matrix || typeof parsed.matrix !== 'object') {
      return { ok: false, error: 'Matrix verisi eksik' };
    }

    const show: PulseShowfile = {
      version: 1,
      format: 'pulse',
      name: typeof parsed.name === 'string' ? parsed.name : 'Imported Show',
      exportedAt:
        typeof parsed.exportedAt === 'number'
          ? parsed.exportedAt
          : getSyncedTimestamp(),
      macro: {
        version: 1,
        name: parsed.macro.name ?? 'Macro',
        recordedAt: parsed.macro.recordedAt ?? 0,
        durationMs: parsed.macro.durationMs ?? 0,
        events: parsed.macro.events,
      },
      midiBindings: Array.isArray(parsed.midiBindings)
        ? parsed.midiBindings
        : [],
      matrix: { ...parsed.matrix, engaged: false } as MatrixCommand,
      activeZones: parsed.activeZones as SpatialZoneId[],
      bpm:
        typeof parsed.bpm === 'number' && parsed.bpm > 0 ? parsed.bpm : 120,
    };

    return { ok: true, show, fileName };
  } catch {
    return { ok: false, error: 'Showfile JSON parse hatası' };
  }
}

export function buildShowfileLoadedMessage(fileName: string): string {
  return `SHOWFILE_LOADED: ${fileName}`;
}
