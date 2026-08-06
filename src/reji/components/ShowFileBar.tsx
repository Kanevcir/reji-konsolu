/**
 * V22.0 — FILE menüsü: Save Show (.pulse) / Load Show.
 */

import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { rejiStyles as styles } from '../styles';

type Props = {
  onSaveShow: () => void;
  onLoadShow: () => void;
  macroSyncMode: 'wall' | 'smpte';
  onToggleMacroSyncMode: () => void;
};

function ShowFileBarComponent({
  onSaveShow,
  onLoadShow,
  macroSyncMode,
  onToggleMacroSyncMode,
}: Props) {
  return (
    <View style={styles.showFileBar}>
      <Text style={styles.showFileLabel}>FILE</Text>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.75}
        onPress={onSaveShow}
        style={styles.showFileBtn}>
        <Text style={styles.showFileBtnText}>Save Show (.pulse)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.75}
        onPress={onLoadShow}
        style={styles.showFileBtn}>
        <Text style={styles.showFileBtnText}>Load Show</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: macroSyncMode === 'smpte' }}
        activeOpacity={0.75}
        onPress={onToggleMacroSyncMode}
        style={[
          styles.showFileBtn,
          styles.showFileBtnSync,
          macroSyncMode === 'smpte' && styles.showFileBtnSyncOn,
        ]}>
        <Text style={styles.showFileBtnText}>
          MACRO SYNC: {macroSyncMode === 'smpte' ? 'SMPTE' : 'PTP'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const ShowFileBar = memo(ShowFileBarComponent);
