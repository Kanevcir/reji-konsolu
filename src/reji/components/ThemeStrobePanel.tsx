/**
 * V24.0 — Görsel Tema + Audio Reactive Strobe kontrol paneli.
 */

import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  formatThemeLabel,
  interpolateTheme,
  strobeThresholdDb,
  THEME_ORDER,
  VISUAL_THEMES,
  type VisualThemeId,
} from '../visualThemes';
import { rejiStyles as styles } from '../styles';

type Props = {
  themeMix: number;
  currentTheme: VisualThemeId;
  strobe: boolean;
  strobeSensitivity: number;
  micLevelDb: number;
  audioListening: boolean;
  disabled?: boolean;
  onSelectTheme: (id: VisualThemeId) => void;
  onThemeMixDelta: (delta: number) => void;
  onStrobeSensitivityDelta: (delta: number) => void;
};

function ThemeStrobePanelComponent({
  themeMix,
  currentTheme,
  strobe,
  strobeSensitivity,
  micLevelDb,
  audioListening,
  disabled = false,
  onSelectTheme,
  onThemeMixDelta,
  onStrobeSensitivityDelta,
}: Props) {
  const interp = interpolateTheme(themeMix);
  const threshold = strobeThresholdDb(strobeSensitivity);
  const peakArmed = audioListening && micLevelDb >= threshold;

  return (
    <View style={styles.themeCard}>
      <Text style={styles.sectionLabel}>VISUAL THEMES & AUDIO STROBE</Text>
      <Text style={styles.themeHint}>
        {formatThemeLabel(currentTheme)} · mix {(themeMix * 100).toFixed(0)}% ·
        {strobe
          ? ' STROBE FLASH'
          : peakArmed
            ? ' PEAK ARMED'
            : audioListening
              ? ' WAVE SYNC'
              : ' standby'}
      </Text>

      <View style={styles.themeSwatchRow}>
        {THEME_ORDER.map((id) => {
          const pal = VISUAL_THEMES[id];
          const active = currentTheme === id;
          return (
            <TouchableOpacity
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              disabled={disabled}
              activeOpacity={0.75}
              onPress={() => onSelectTheme(id)}
              style={[
                styles.themeSwatchBtn,
                active && styles.themeSwatchBtnActive,
                disabled && styles.controlDisabled,
                { borderColor: pal.colors[0] },
              ]}>
              <View style={styles.themeSwatchDots}>
                {pal.colors.map((c) => (
                  <View
                    key={c}
                    style={[styles.themeSwatchDot, { backgroundColor: c }]}
                  />
                ))}
              </View>
              <Text style={styles.themeSwatchLabel}>{pal.labelTr}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View
        style={[
          styles.themeMixBar,
          {
            backgroundColor: interp.primary,
          },
        ]}>
        <View
          style={[
            styles.themeMixFill,
            {
              width: `${Math.round(themeMix * 100)}%`,
              backgroundColor: interp.accent,
            },
          ]}
        />
      </View>

      <View style={styles.themeParamRow}>
        <TouchableOpacity
          disabled={disabled}
          onPress={() => onThemeMixDelta(-0.08)}
          style={styles.themeParamBtn}>
          <Text style={styles.themeParamText}>MIX −</Text>
        </TouchableOpacity>
        <Text style={styles.themeParamValue}>
          XF {(themeMix * 100).toFixed(0)}%
        </Text>
        <TouchableOpacity
          disabled={disabled}
          onPress={() => onThemeMixDelta(0.08)}
          style={styles.themeParamBtn}>
          <Text style={styles.themeParamText}>MIX +</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.themeParamRow}>
        <TouchableOpacity
          disabled={disabled}
          onPress={() => onStrobeSensitivityDelta(-0.08)}
          style={styles.themeParamBtn}>
          <Text style={styles.themeParamText}>STR −</Text>
        </TouchableOpacity>
        <Text style={styles.themeParamValue}>
          STROBE {Math.round(strobeSensitivity * 100)}% · thr{' '}
          {threshold.toFixed(0)}dB
        </Text>
        <TouchableOpacity
          disabled={disabled}
          onPress={() => onStrobeSensitivityDelta(0.08)}
          style={styles.themeParamBtn}>
          <Text style={styles.themeParamText}>STR +</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.themeSubHint}>
        Mic {micLevelDb.toFixed(1)} dB
        {audioListening ? '' : ' · CANLI SESİ DİNLE aç'}
        {strobe ? ' · FLASH' : ''}
      </Text>
    </View>
  );
}

export const ThemeStrobePanel = memo(ThemeStrobePanelComponent);
