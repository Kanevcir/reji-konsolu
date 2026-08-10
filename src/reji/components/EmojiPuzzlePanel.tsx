/**
 * V30.0 — Koreografi & Emoji Puzzle kontrol paneli.
 * Türk Bayrağı: 3:2 texture yükleme + tribün unwrap.
 */

import { memo, useRef } from 'react';
import {
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
  textureLabel?: string | null;
  disabled?: boolean;
  onSelectPreset: (id: PuzzlePresetId) => void;
  onOverlayEmoji: (glyph: string | null) => void;
  onUploadTexture?: (file: File) => void;
};

function EmojiPuzzlePanelComponent({
  puzzlePreset,
  overlayEmoji,
  waveAmplitude,
  audioDrive,
  audioListening,
  textureLabel,
  disabled = false,
  onSelectPreset,
  onOverlayEmoji,
  onUploadTexture,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <View style={styles.puzzleCard}>
      <Text style={styles.sectionLabel}>KOREOGRAFİ & EMOJI MODU</Text>
      <Text style={styles.puzzleHint}>
        {puzzlePreset === 'none'
          ? 'Preset seç · 3:2 görsel yükle · OVERLAY_EMOJI'
          : formatPuzzlePresetLabel(puzzlePreset)}
        {overlayEmoji ? ` · OVERLAY ${overlayEmoji}` : ''}
        {textureLabel ? ` · TEX ${textureLabel}` : ''}
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

      {Platform.OS === 'web' && onUploadTexture ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={disabled}
          activeOpacity={0.75}
          onPress={() => {
            const input = fileRef.current;
            if (input) input.click();
          }}
          style={[
            styles.puzzleClearBtn,
            disabled && styles.controlDisabled,
            { marginBottom: 10 },
          ]}>
          <Text style={styles.puzzleClearText}>
            3:2 GÖRSEL YÜKLE (TEXTURE UV)
          </Text>
          {/* eslint-disable-next-line react/forbid-elements */}
          <input
            ref={fileRef as never}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadTexture(file);
              e.target.value = '';
            }}
          />
        </TouchableOpacity>
      ) : null}

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
