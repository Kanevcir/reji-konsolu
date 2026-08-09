/**
 * V32.0 — MAKROLAR (HIZLI EYLEMLER) paneli.
 */

import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  QUICK_MACROS,
  type QuickMacroId,
} from '../quickMacros';
import { rejiStyles as styles } from '../styles';

type Props = {
  activeMacroId: QuickMacroId | null;
  disabled?: boolean;
  /** Traktor Z1 note etiketleri (UI ipucu). */
  midiHints?: Partial<Record<QuickMacroId, string>>;
  onFire: (id: QuickMacroId) => void;
};

function QuickMacrosPanelComponent({
  activeMacroId,
  disabled = false,
  midiHints,
  onFire,
}: Props) {
  return (
    <View style={styles.quickMacroCard}>
      <Text style={styles.sectionLabel}>MAKROLAR (HIZLI EYLEMLER)</Text>
      <Text style={styles.quickMacroHint}>
        PTP + Admin JWT · Z1 Note 1/2/3 · acil Note 0 = BLACKOUT
      </Text>

      <View style={styles.quickMacroList}>
        {QUICK_MACROS.map((m) => {
          const active = activeMacroId === m.id;
          const midi = midiHints?.[m.id];
          return (
            <TouchableOpacity
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={m.labelTr}
              disabled={disabled && m.id !== 'BLACKOUT_RESET'}
              activeOpacity={0.8}
              onPress={() => onFire(m.id)}
              style={[
                styles.quickMacroBtn,
                m.id === 'SUPER_GOL' && styles.quickMacroBtnGol,
                m.id === 'DROP_THE_BASS' && styles.quickMacroBtnDrop,
                m.id === 'BLACKOUT_RESET' && styles.quickMacroBtnReset,
                active && styles.quickMacroBtnActive,
                disabled && m.id !== 'BLACKOUT_RESET' && styles.controlDisabled,
              ]}>
              <Text style={styles.quickMacroBtnTitle}>{m.labelTr}</Text>
              <Text style={styles.quickMacroBtnHint}>{m.hint}</Text>
              {midi ? (
                <Text style={styles.quickMacroMidi}>{midi}</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export const QuickMacrosPanel = memo(QuickMacrosPanelComponent);
