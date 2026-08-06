/**
 * V20.0 — CHOREOGRAPHY & PIXEL MATRIX paneli.
 * Web: HTML5 Canvas 60FPS. Native: 32² setNativeProps (~30FPS).
 */

import { memo, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { getSyncedTimestamp } from '../clockSync';
import {
  fillPreviewBuffer,
  formatMatrixEffectLabel,
  MATRIX_EFFECTS,
  PREVIEW_GRID,
  type MatrixCommand,
} from '../pixelMapper';
import { rejiStyles as styles } from '../styles';

type Props = {
  matrix: MatrixCommand;
  disabled?: boolean;
  onChangeDraft: (next: MatrixCommand) => void;
  onEngage: () => void;
  onDisengage: () => void;
};

function WebCanvasPreview({
  cmd,
  width,
  height,
}: {
  cmd: MatrixCommand;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cmdRef = useRef(cmd);
  cmdRef.current = cmd;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const pw = PREVIEW_GRID;
    const ph = PREVIEW_GRID;
    const buffer = new Uint8ClampedArray(pw * ph * 4);
    const off = document.createElement('canvas');
    off.width = pw;
    off.height = ph;
    const octx = off.getContext('2d');
    if (!octx) return;

    let raf = 0;
    let alive = true;

    const draw = () => {
      if (!alive) return;
      try {
        fillPreviewBuffer(buffer, pw, ph, getSyncedTimestamp(), cmdRef.current);
        const imageData = octx.createImageData(pw, ph);
        imageData.data.set(buffer);
        octx.putImageData(imageData, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(off, 0, 0, width, height);
      } catch {
        // frame skip
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [width, height]);

  return (
    // eslint-disable-next-line react/forbid-elements -- V20 HTML5 canvas (web)
    <canvas
      ref={canvasRef as never}
      width={Math.max(1, Math.floor(width))}
      height={Math.max(1, Math.floor(height))}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 10,
        display: 'block',
      }}
    />
  );
}

function NativeGridPreview({ cmd }: { cmd: MatrixCommand }) {
  const size = 32;
  const cellRefs = useRef<Array<View | null>>([]);
  const cmdRef = useRef(cmd);
  cmdRef.current = cmd;

  useEffect(() => {
    const buffer = new Uint8Array(size * size * 4);
    let raf = 0;
    let alive = true;
    let last = 0;

    const draw = (ts: number) => {
      if (!alive) return;
      if (ts - last >= 33) {
        last = ts;
        try {
          fillPreviewBuffer(
            buffer,
            size,
            size,
            getSyncedTimestamp(),
            cmdRef.current,
          );
          for (let i = 0; i < size * size; i++) {
            const ref = cellRefs.current[i];
            if (!ref) continue;
            const o = i * 4;
            ref.setNativeProps({
              style: {
                backgroundColor: `rgb(${buffer[o]},${buffer[o + 1]},${buffer[o + 2]})`,
              },
            });
          }
        } catch {
          // skip
        }
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  const cells = [];
  for (let i = 0; i < size * size; i++) {
    cells.push(
      <View
        key={i}
        ref={(el) => {
          cellRefs.current[i] = el;
        }}
        style={styles.choreoNativeCell}
        pointerEvents="none"
      />,
    );
  }

  return <View style={styles.choreoNativeGrid}>{cells}</View>;
}

function ChoreographyPanelComponent({
  matrix,
  disabled = false,
  onChangeDraft,
  onEngage,
  onDisengage,
}: Props) {
  const [box, setBox] = useState({ w: 320, h: 200 });
  const draft = matrix;

  const patch = (partial: Partial<MatrixCommand>) => {
    onChangeDraft({ ...draft, ...partial });
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) setBox({ w: width, h: Math.round(width * 0.55) });
  };

  return (
    <View style={styles.choreoCard}>
      <Text style={styles.sectionLabel}>CHOREOGRAPHY & PIXEL MATRIX</Text>
      <Text style={styles.choreoHint}>
        200×200 grid · {formatMatrixEffectLabel(draft.effect)} ·{' '}
        {draft.engaged ? 'LIVE ENGAGED' : 'PREVIEW'} · PTP t0 vector
      </Text>

      <View style={styles.choreoEffectRow}>
        {MATRIX_EFFECTS.map((effect) => (
          <TouchableOpacity
            key={effect}
            accessibilityRole="button"
            disabled={disabled}
            activeOpacity={0.75}
            onPress={() => patch({ effect })}
            style={[
              styles.choreoEffectBtn,
              draft.effect === effect && styles.choreoEffectBtnActive,
              disabled && styles.controlDisabled,
            ]}>
            <Text style={styles.choreoEffectText}>
              {formatMatrixEffectLabel(effect)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.choreoParamRow}>
        <TouchableOpacity
          disabled={disabled}
          onPress={() =>
            patch({ speed: Math.max(0.25, Number((draft.speed - 0.25).toFixed(2))) })
          }
          style={styles.choreoParamBtn}>
          <Text style={styles.choreoParamText}>SPD −</Text>
        </TouchableOpacity>
        <Text style={styles.choreoParamValue}>SPD {draft.speed.toFixed(2)}</Text>
        <TouchableOpacity
          disabled={disabled}
          onPress={() =>
            patch({ speed: Math.min(3, Number((draft.speed + 0.25).toFixed(2))) })
          }
          style={styles.choreoParamBtn}>
          <Text style={styles.choreoParamText}>SPD +</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={disabled}
          onPress={() => patch({ hue: (draft.hue + 30) % 360 })}
          style={styles.choreoParamBtn}>
          <Text style={styles.choreoParamText}>HUE {Math.round(draft.hue)}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.choreoParamRow}>
        <TouchableOpacity
          disabled={disabled}
          onPress={() =>
            patch({
              intensity: Math.max(0.1, Number((draft.intensity - 0.1).toFixed(2))),
            })
          }
          style={styles.choreoParamBtn}>
          <Text style={styles.choreoParamText}>INT −</Text>
        </TouchableOpacity>
        <Text style={styles.choreoParamValue}>
          INT {Math.round(draft.intensity * 100)}%
        </Text>
        <TouchableOpacity
          disabled={disabled}
          onPress={() =>
            patch({
              intensity: Math.min(1, Number((draft.intensity + 0.1).toFixed(2))),
            })
          }
          style={styles.choreoParamBtn}>
          <Text style={styles.choreoParamText}>INT +</Text>
        </TouchableOpacity>
        {draft.effect === 'LINEAR_SWEEP' ? (
          <TouchableOpacity
            disabled={disabled}
            onPress={() => patch({ angle: (draft.angle + 45) % 360 })}
            style={styles.choreoParamBtn}>
            <Text style={styles.choreoParamText}>ANG {draft.angle}°</Text>
          </TouchableOpacity>
        ) : null}
        {draft.effect === 'MATRIX_IMAGE' ? (
          <TouchableOpacity
            disabled={disabled}
            onPress={() => patch({ patternId: (draft.patternId + 1) % 4 })}
            style={styles.choreoParamBtn}>
            <Text style={styles.choreoParamText}>PAT {draft.patternId}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View
        style={[styles.choreoCanvasWrap, { height: box.h }]}
        onLayout={onLayout}>
        {Platform.OS === 'web' ? (
          <WebCanvasPreview cmd={draft} width={box.w} height={box.h} />
        ) : (
          <NativeGridPreview cmd={draft} />
        )}
      </View>

      <View style={styles.choreoActionRow}>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={disabled}
          activeOpacity={0.75}
          onPress={onEngage}
          style={[
            styles.choreoEngageBtn,
            draft.engaged && styles.choreoEngageBtnActive,
            disabled && styles.controlDisabled,
          ]}>
          <Text style={styles.choreoEngageText}>
            {draft.engaged ? 'RE-ENGAGE MATRIX' : 'ENGAGE MATRIX'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={disabled || !draft.engaged}
          activeOpacity={0.75}
          onPress={onDisengage}
          style={[
            styles.choreoStopBtn,
            (!draft.engaged || disabled) && styles.controlDisabled,
          ]}>
          <Text style={styles.choreoEngageText}>STOP</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const ChoreographyPanel = memo(ChoreographyPanelComponent);
