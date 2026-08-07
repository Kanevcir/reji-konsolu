/**
 * V25.0 — Koreografi & Emoji Puzzle kontrol paneli.
 */

import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  formatPuzzlePresetLabel,
  OVERLAY_EMOJI_QUICK,
  PUZZLE_PRESETS,
  type PuzzlePresetId,
} from '../puzzleChoreography';
import { rejiStyles as styles } from '../styles';

type Props = {
  puzzlePreset: PuzzlePresetId;
  overlayEmoji: string | null;
  waveAmplitude: number;
  audioDrive: number;
  audioListening: boolean;
  disabled?: boolean;
  onSelectPreset: (id: PuzzlePresetId) => void;
  onOverlayEmoji: (glyph: string | null) => void;
};

function EmojiPuzzlePanelComponent({
  puzzlePreset,
  overlayEmoji,
  waveAmplitude,
  audioDrive,
  audioListening,
  disabled = false,
  onSelectPreset,
  onOverlayEmoji,
}: Props) {
  return (
    <View style={styles.puzzleCard}>
      <Text style={styles.sectionLabel}>KOREOGRAFİ & EMOJI MODU</Text>
      <Text style={styles.puzzleHint}>
        {puzzlePreset === 'none'
          ? 'Preset seç · OVERLAY_EMOJI ile anlık dönüşüm'
          : formatPuzzlePresetLabel(puzzlePreset)}
        {overlayEmoji ? ` · OVERLAY ${overlayEmoji}` : ''}
      </Text>

      <View style={styles.puzzlePresetCol}>
        {PUZZLE_PRESETS.map((preset) => {
          const active = puzzlePreset === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              disabled={disabled}
              activeOpacity={0.75}
              onPress={() =>
                onSelectPreset(active && !overlayEmoji ? 'none' : preset.id)
              }
              style={[
                styles.puzzlePresetBtn,
                active && styles.puzzlePresetBtnActive,
                disabled && styles.controlDisabled,
              ]}>
              <Text
                style={[
                  styles.puzzlePresetTitle,
                  active && styles.puzzlePresetTitleActive,
                ]}>
                {preset.label}
              </Text>
              <Text style={styles.puzzlePresetHint}>{preset.hint}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.puzzleSectionTitle}>OVERLAY EMOJI / METİN</Text>
      <View style={styles.puzzleEmojiRow}>
        {OVERLAY_EMOJI_QUICK.map((glyph) => {
          const active = overlayEmoji === glyph;
          return (
            <TouchableOpacity
              key={glyph}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              disabled={disabled}
              activeOpacity={0.75}
              onPress={() => onOverlayEmoji(active ? null : glyph)}
              style={[
                styles.puzzleEmojiBtn,
                active && styles.puzzleEmojiBtnActive,
                glyph === 'GOL' && styles.puzzleGolBtn,
                disabled && styles.controlDisabled,
              ]}>
              <Text
                style={[
                  styles.puzzleEmojiText,
                  glyph === 'GOL' && styles.puzzleGolText,
                ]}>
                {glyph}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {overlayEmoji ? (
        <TouchableOpacity
          disabled={disabled}
          activeOpacity={0.75}
          onPress={() => onOverlayEmoji(null)}
          style={styles.puzzleClearBtn}>
          <Text style={styles.puzzleClearText}>OVERLAY TEMİZLE</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.puzzleSubHint}>
        WAVE AMP {waveAmplitude.toFixed(2)}
        {audioListening
          ? ` · AUDIO DRIVE ${(audioDrive * 100).toFixed(0)}%`
          : ' · ses dinleme kapalı'}
      </Text>
    </View>
  );
}

export const EmojiPuzzlePanel = memo(EmojiPuzzlePanelComponent);
