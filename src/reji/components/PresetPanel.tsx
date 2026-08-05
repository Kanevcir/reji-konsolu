/**
 * V7.0 — Senaryo Profil Yönetimi UI (3 slot + Export/Import).
 */

import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  PRESET_SLOT_ORDER,
  type PresetSlotId,
  type RejiPreset,
} from '../preset';
import { rejiStyles as styles } from '../styles';

type Props = {
  currentPreset: RejiPreset;
  activeSlotId: PresetSlotId;
  slots: Record<PresetSlotId, RejiPreset>;
  disabled?: boolean;
  onLoadSlot: (id: PresetSlotId) => void;
  onSaveSlot: (id: PresetSlotId) => void;
  onExport: () => void;
  onImport: () => void;
};

function PresetPanelComponent({
  currentPreset,
  activeSlotId,
  slots,
  disabled = false,
  onLoadSlot,
  onSaveSlot,
  onExport,
  onImport,
}: Props) {
  return (
    <View style={styles.presetCard}>
      <Text style={styles.sectionLabel}>SENARYO PROFİL YÖNETİMİ (V7)</Text>
      <Text style={styles.presetHint}>
        Aktif: {currentPreset.name} · {currentPreset.bpm} BPM ·{' '}
        {currentPreset.isListeningAudio ? 'AUTO SYNC' : 'MANUEL'}
      </Text>

      <View style={styles.presetSlotRow}>
        {PRESET_SLOT_ORDER.map((id) => {
          const slot = slots[id];
          const active = activeSlotId === id;
          return (
            <TouchableOpacity
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              accessibilityHint="Uzun basarak mevcut konfigürasyonu bu slota kaydet"
              activeOpacity={0.75}
              disabled={disabled}
              onPress={() => onLoadSlot(id)}
              onLongPress={() => onSaveSlot(id)}
              style={[styles.presetSlotBtn, active && styles.presetSlotBtnActive]}>
              <Text
                style={[styles.presetSlotText, active && styles.presetSlotTextActive]}
                numberOfLines={2}>
                {slot.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.presetActionRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          activeOpacity={0.75}
          disabled={disabled}
          onPress={onExport}
          style={styles.presetExportBtn}>
          <Text style={styles.presetExportBtnText}>PROFİLİ DIŞA AKTAR (EXPORT JSON)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          activeOpacity={0.75}
          disabled={disabled}
          onPress={onImport}
          style={styles.presetImportBtn}>
          <Text style={styles.presetImportBtnText}>PROFİL YÜKLE (IMPORT)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const PresetPanel = memo(PresetPanelComponent);
