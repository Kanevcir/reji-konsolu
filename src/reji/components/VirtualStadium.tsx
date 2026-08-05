/**
 * Sanal Stadyum görsel simülatörü + V5.0 Multi-View anahtarı.
 *
 * - timerRunning: BPM ritmine göre sarı/kırmızı/beyaz flaş
 * - isPaused: son beat fazında sabit kalır
 * - selectedTribun: hangi LED / kamera grubunun yanacağını filtreler
 * - isMultiView: 4 kamera karesi matrisi
 */

import { memo, useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { GS_LIGHTS, LEDS } from '../constants';
import { triggerSelection } from '../haptics';
import { rejiStyles as styles } from '../styles';
import type { TribunId } from '../types';
import { isLedInScope } from '../utils';
import { MultiViewMatrix } from './MultiViewMatrix';

type VirtualStadiumProps = {
  beat: number;
  timerRunning: boolean;
  isPaused: boolean;
  selectedTribun: TribunId;
  effectiveBpm: number;
  /** V6.0 — blackout: tüm LED / kamera siyah. */
  isBlackout?: boolean;
};

function VirtualStadiumComponent({
  beat,
  timerRunning,
  isPaused,
  selectedTribun,
  effectiveBpm,
  isBlackout = false,
}: VirtualStadiumProps) {
  /** V5.0 — Çoklu açı modu (lokal UI state; hook’u şişirmez). */
  const [isMultiView, setIsMultiView] = useState(false);

  const positionStyle = {
    top: styles.ledTop,
    bottom: styles.ledBottom,
    left: styles.ledLeft,
    right: styles.ledRight,
  } as const;

  const toggleMultiView = useCallback(() => {
    void triggerSelection();
    setIsMultiView((prev) => !prev);
  }, []);

  return (
    <View style={styles.stadiumCard}>
      <View style={styles.stadiumHeaderRow}>
        <Text style={styles.sectionLabel}>SANAL STADYUM</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: isMultiView }}
          activeOpacity={0.75}
          onPress={toggleMultiView}
          style={[styles.multiViewToggle, isMultiView && styles.multiViewToggleActive]}>
          <Text
            style={[
              styles.multiViewToggleText,
              isMultiView && styles.multiViewToggleTextActive,
            ]}>
            {isMultiView ? 'ÇOKLU AÇI MODU: ON' : 'ÇOKLU AÇI MODU (MULTI-VIEW)'}
          </Text>
        </TouchableOpacity>
      </View>

      {isMultiView ? (
        <MultiViewMatrix
          beat={beat}
          timerRunning={timerRunning}
          isPaused={isPaused}
          selectedTribun={selectedTribun}
          effectiveBpm={effectiveBpm}
          isBlackout={isBlackout}
        />
      ) : (
        <View style={[styles.stadiumFrame, isBlackout && styles.stadiumFrameBlackout]}>
          {LEDS.map((led, index) => {
            if (isBlackout) {
              return (
                <View
                  key={led.id}
                  style={[
                    styles.ledBlock,
                    positionStyle[led.position],
                    styles.ledBlackout,
                  ]}>
                  <Text style={styles.ledLabel}>OFF</Text>
                </View>
              );
            }

            const inScope = isLedInScope(led.group, selectedTribun);
            const lit = (timerRunning || isPaused) && inScope;
            const color = lit ? GS_LIGHTS[(beat + index) % GS_LIGHTS.length] : '#1E293B';
            const opacity =
              !timerRunning && !isPaused
                ? 0.28
                : lit
                  ? timerRunning
                    ? 0.45 + (beat % 2) * 0.55
                    : 0.85
                  : 0.18;

            return (
              <View
                key={led.id}
                style={[
                  styles.ledBlock,
                  positionStyle[led.position],
                  { backgroundColor: color, opacity },
                ]}>
                <Text style={[styles.ledLabel, lit && styles.ledLabelLit]}>{led.label}</Text>
              </View>
            );
          })}
          <View style={styles.pitch}>
            <Text style={styles.pitchText}>{isBlackout ? 'SAFE' : 'PITCH'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export const VirtualStadium = memo(VirtualStadiumComponent);
