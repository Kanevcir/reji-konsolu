/**
 * V5.0 — Tek kamera karesi (memoize edilmiş).
 * Yalnızca kendi görsel props’ları değişince yeniden render olur.
 */

import { memo } from 'react';
import { Text, View } from 'react-native';

import { GS_LIGHTS } from '../constants';
import { rejiStyles as styles } from '../styles';

export type CameraTileProps = {
  camLabel: string;
  title: string;
  subtitle: string;
  inScope: boolean;
  lit: boolean;
  colorIndex: number;
  pulseBright: boolean;
  effectiveBpm: number;
  isBlackout?: boolean;
};

function CameraTileComponent({
  camLabel,
  title,
  subtitle,
  inScope,
  lit,
  colorIndex,
  pulseBright,
  effectiveBpm,
  isBlackout = false,
}: CameraTileProps) {
  const standby = !inScope && !isBlackout;
  const bg = isBlackout ? '#000000' : lit ? GS_LIGHTS[colorIndex % GS_LIGHTS.length] : '#0F172A';
  const opacity = isBlackout ? 1 : standby ? 0.35 : lit ? (pulseBright ? 1 : 0.72) : 0.55;

  return (
    <View style={[styles.camTile, (standby || isBlackout) && styles.camTileStandby]}>
      <View style={[styles.camFeed, { backgroundColor: bg, opacity }]} />
      <View style={styles.camOverlay}>
        <Text style={styles.camLabel}>{camLabel}</Text>
        <Text style={styles.camTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.camSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        {isBlackout ? (
          <View style={styles.camStandbyBadge}>
            <Text style={styles.camStandbyText}>BLACKOUT / SAFE MODE</Text>
          </View>
        ) : standby ? (
          <View style={styles.camStandbyBadge}>
            <Text style={styles.camStandbyText}>STANDBY / OUT OF SCOPE</Text>
          </View>
        ) : (
          <Text style={styles.camBpm}>{effectiveBpm} BPM</Text>
        )}
      </View>
    </View>
  );
}

function cameraPropsAreEqual(prev: CameraTileProps, next: CameraTileProps) {
  return (
    prev.camLabel === next.camLabel &&
    prev.title === next.title &&
    prev.subtitle === next.subtitle &&
    prev.inScope === next.inScope &&
    prev.lit === next.lit &&
    prev.colorIndex === next.colorIndex &&
    prev.pulseBright === next.pulseBright &&
    prev.effectiveBpm === next.effectiveBpm &&
    prev.isBlackout === next.isBlackout
  );
}

export const CameraTile = memo(CameraTileComponent, cameraPropsAreEqual);
