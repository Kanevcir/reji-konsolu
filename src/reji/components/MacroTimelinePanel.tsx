/**
 * V14.0 — MACRO & TIMELINE paneli (REC / STOP / PLAY + progress).
 */

import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { rejiStyles as styles } from '../styles';

type Props = {
  isRecording: boolean;
  isPlaying: boolean;
  eventCount: number;
  progress: number;
  disabledRecord?: boolean;
  disabledPlay?: boolean;
  onRecord: () => void;
  onStop: () => void;
  onPlay: () => void;
};

function MacroTimelinePanelComponent({
  isRecording,
  isPlaying,
  eventCount,
  progress,
  disabledRecord = false,
  disabledPlay = false,
  onRecord,
  onStop,
  onPlay,
}: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <View style={styles.macroCard}>
      <Text style={styles.sectionLabel}>MACRO & TIMELINE</Text>
      <Text style={styles.macroHint}>
        {isRecording
          ? `KAYIT · ${eventCount} olay`
          : isPlaying
            ? `OYNATILIYOR · %${pct}`
            : eventCount > 0
              ? `HAZIR · ${eventCount} olay`
              : 'Boş makro — REC ile kaydet'}
      </Text>

      <View style={styles.macroBtnRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: isRecording, disabled: disabledRecord }}
          disabled={disabledRecord || isPlaying}
          activeOpacity={0.75}
          onPress={onRecord}
          style={[
            styles.macroBtn,
            styles.macroBtnRec,
            isRecording && styles.macroBtnRecActive,
            (disabledRecord || isPlaying) && styles.controlDisabled,
          ]}>
          <Text style={styles.macroBtnText}>⏺ REC</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.75}
          onPress={onStop}
          style={[styles.macroBtn, styles.macroBtnStop]}>
          <Text style={styles.macroBtnText}>⏹ STOP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: isPlaying, disabled: disabledPlay }}
          disabled={disabledPlay || isRecording || eventCount === 0}
          activeOpacity={0.75}
          onPress={onPlay}
          style={[
            styles.macroBtn,
            styles.macroBtnPlay,
            isPlaying && styles.macroBtnPlayActive,
            (disabledPlay || isRecording || eventCount === 0) && styles.controlDisabled,
          ]}>
          <Text style={styles.macroBtnText}>▶ PLAY</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.macroProgressLabel}>TIMELINE PROGRESS</Text>
      <View style={styles.macroProgressTrack}>
        <View
          style={[
            styles.macroProgressFill,
            { width: `${pct}%` },
            isPlaying && styles.macroProgressFillActive,
            isRecording && styles.macroProgressFillRec,
          ]}
        />
      </View>
      <Text style={styles.macroProgressValue}>{pct}%</Text>
    </View>
  );
}

export const MacroTimelinePanel = memo(MacroTimelinePanelComponent);
