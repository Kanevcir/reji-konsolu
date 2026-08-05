/**
 * V7.0 — Senaryo Profil Yönetimi (Preset Export/Import & Reji Hafızası).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BpmOption, ScenarioId, TribunId } from './types';

/** AsyncStorage anahtarı — son aktif profil + 3 slot. */
export const PRESET_STORAGE_KEY = '@pulse/reji-presets-v1';

export type PresetSlotId = 'opening' | 'wall' | 'celebration';

/**
 * Tek bir reji profili (dışa aktarılabilir JSON şeması).
 * Senaryo, BPM, tribün ve audio sync durumunu taşır.
 */
export type RejiPreset = {
  version: 1;
  name: string;
  selectedScenario: ScenarioId | null;
  bpm: BpmOption;
  selectedTribun: TribunId;
  isListeningAudio: boolean;
};

export type PresetStore = {
  activeSlotId: PresetSlotId;
  slots: Record<PresetSlotId, RejiPreset>;
};

export const PRESET_SLOT_ORDER: PresetSlotId[] = ['opening', 'wall', 'celebration'];

/** Fabrika varsayılanları — 3 hızlı hafıza slotu. */
export const DEFAULT_PRESET_SLOTS: Record<PresetSlotId, RejiPreset> = {
  opening: {
    version: 1,
    name: 'PROFIL 1: AÇILIŞ',
    selectedScenario: 'opening',
    bpm: 120,
    selectedTribun: 'all',
    isListeningAudio: false,
  },
  wall: {
    version: 1,
    name: 'PROFIL 2: DUVAR',
    selectedScenario: 'goal',
    bpm: 140,
    selectedTribun: 'ns',
    isListeningAudio: false,
  },
  celebration: {
    version: 1,
    name: 'PROFIL 3: KUTLAMA',
    selectedScenario: 'victory',
    bpm: 100,
    selectedTribun: 'ew',
    isListeningAudio: true,
  },
};

export function createDefaultPresetStore(): PresetStore {
  return {
    activeSlotId: 'opening',
    slots: {
      opening: { ...DEFAULT_PRESET_SLOTS.opening },
      wall: { ...DEFAULT_PRESET_SLOTS.wall },
      celebration: { ...DEFAULT_PRESET_SLOTS.celebration },
    },
  };
}

/** Geçerli BPM seçeneği mi? */
function isBpmOption(value: unknown): value is BpmOption {
  return value === 100 || value === 120 || value === 140;
}

function isTribunId(value: unknown): value is TribunId {
  return value === 'all' || value === 'ns' || value === 'ew';
}

function isScenarioId(value: unknown): value is ScenarioId | null {
  return (
    value === null ||
    value === 'opening' ||
    value === 'goal' ||
    value === 'victory'
  );
}

/**
 * Bilinmeyen JSON’u güvenli şekilde RejiPreset’e çevirir.
 * Hatalı alanlar varsayılana düşer; tamamen bozuksa null.
 */
export function parseRejiPreset(raw: unknown): RejiPreset | null {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    const base = DEFAULT_PRESET_SLOTS.opening;

    const bpm = isBpmOption(obj.bpm) ? obj.bpm : base.bpm;
    const selectedTribun = isTribunId(obj.selectedTribun) ? obj.selectedTribun : base.selectedTribun;
    const selectedScenario = isScenarioId(obj.selectedScenario)
      ? obj.selectedScenario
      : base.selectedScenario;
    const isListeningAudio =
      typeof obj.isListeningAudio === 'boolean' ? obj.isListeningAudio : false;
    const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name : 'İçe Aktarılan Profil';

    return {
      version: 1,
      name,
      selectedScenario,
      bpm,
      selectedTribun,
      isListeningAudio,
    };
  } catch {
    return null;
  }
}

/** Preset → pretty JSON string. */
export function serializePreset(preset: RejiPreset) {
  return JSON.stringify(preset, null, 2);
}

/** JSON string → preset (try-catch). */
export function deserializePreset(json: string): RejiPreset | null {
  try {
    return parseRejiPreset(JSON.parse(json));
  } catch {
    return null;
  }
}

/** Kalıcı hafızadan oku; yoksa / hata varsa varsayılan store. */
export async function loadPresetStore(): Promise<PresetStore> {
  try {
    const raw = await AsyncStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return createDefaultPresetStore();

    const parsed = JSON.parse(raw) as Partial<PresetStore>;
    const defaults = createDefaultPresetStore();
    const slots = { ...defaults.slots };

    for (const id of PRESET_SLOT_ORDER) {
      const slot = parseRejiPreset(parsed.slots?.[id]);
      if (slot) slots[id] = { ...slot, name: DEFAULT_PRESET_SLOTS[id].name };
    }

    const activeSlotId =
      parsed.activeSlotId && PRESET_SLOT_ORDER.includes(parsed.activeSlotId)
        ? parsed.activeSlotId
        : defaults.activeSlotId;

    return { activeSlotId, slots };
  } catch {
    return createDefaultPresetStore();
  }
}

/** Kalıcı hafızaya yaz (try-catch; hata yutulur). */
export async function savePresetStore(store: PresetStore): Promise<boolean> {
  try {
    await AsyncStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/** Anlık konsol state’inden currentPreset üretir. */
export function buildCurrentPreset(input: {
  name: string;
  selectedScenario: ScenarioId | null;
  bpm: BpmOption;
  selectedTribun: TribunId;
  isListeningAudio: boolean;
}): RejiPreset {
  return {
    version: 1,
    name: input.name,
    selectedScenario: input.selectedScenario,
    bpm: input.bpm,
    selectedTribun: input.selectedTribun,
    isListeningAudio: input.isListeningAudio,
  };
}
