/**
 * V5.0 — 2×2 Multi-View Reji Monitor matrisi.
 * 4 kamera karesi; tribün filtresi dışı STANDBY, aktifler effectiveBpm ile senkron.
 */

import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { MULTI_VIEW_CAMERAS } from '../constants';
import { rejiStyles as styles } from '../styles';
import type { TribunId } from '../types';
import { isLedInScope } from '../utils';
import { CameraTile } from './CameraTile';

type MultiViewMatrixProps = {
  beat: number;
  timerRunning: boolean;
  isPaused: boolean;
  selectedTribun: TribunId;
  effectiveBpm: number;
  isBlackout?: boolean;
};

function MultiViewMatrixComponent({
  beat,
  timerRunning,
  isPaused,
  selectedTribun,
  effectiveBpm,
  isBlackout = false,
}: MultiViewMatrixProps) {
  const pulseBright = !isBlackout && timerRunning && beat % 2 === 1;
  const sessionActive = !isBlackout && (timerRunning || isPaused);

  const tiles = useMemo(
    () =>
      MULTI_VIEW_CAMERAS.map((cam) => {
        const inScope = isLedInScope(cam.group, selectedTribun);
        const lit = sessionActive && inScope;
        return {
          id: cam.id,
          camLabel: cam.camLabel,
          title: cam.title,
          subtitle: cam.subtitle,
          inScope: isBlackout ? false : inScope,
          lit: isBlackout ? false : lit,
          colorIndex: (beat + cam.colorOffset) % 4,
          blackout: isBlackout,
        };
      }),
    [beat, selectedTribun, sessionActive, isBlackout],
  );

  return (
    <View style={styles.multiViewGrid}>
      {tiles.map((tile) => (
        <CameraTile
          key={tile.id}
          camLabel={tile.camLabel}
          title={tile.title}
          subtitle={tile.subtitle}
          inScope={tile.inScope}
          lit={tile.lit}
          colorIndex={tile.colorIndex}
          pulseBright={pulseBright}
          effectiveBpm={effectiveBpm}
          isBlackout={tile.blackout}
        />
      ))}
    </View>
  );
}

export const MultiViewMatrix = memo(MultiViewMatrixComponent);
