/**
 * V18.0 — VIRTUAL STADIUM STRESS TEST paneli.
 * 1000 node: SIM ON iken tek mount; güncellemeler setNativeProps (re-render yok).
 * isSimulationMode ile tamamen kapatılır / gizlenir.
 */

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';

import type { OutgoingPayload } from '../types';
import {
  formatCrowdLatency,
  rgbToCss,
  VIRTUAL_CROWD_COLS,
  VIRTUAL_CROWD_ROWS,
  VIRTUAL_CROWD_SIZE,
  VirtualCrowdEngine,
  type CrowdSimMetrics,
} from '../virtualCrowd';
import { rejiStyles as styles } from '../styles';

type Props = {
  payload: OutgoingPayload;
};

const IDLE_METRICS: CrowdSimMetrics = {
  simulatedNodes: VIRTUAL_CROWD_SIZE,
  activeNodes: 0,
  avgLatencyMs: 0,
  lastAppliedAt: 0,
  frame: 0,
};

type CellRef = View | null;

function paintMatrix(engine: VirtualCrowdEngine, cellRefs: CellRef[]) {
  const { rgb, lit } = engine.snapshot();
  for (let i = 0; i < VIRTUAL_CROWD_SIZE; i++) {
    const ref = cellRefs[i];
    if (!ref) continue;
    const o = i * 3;
    const on = lit[i] === 1;
    try {
      ref.setNativeProps({
        style: {
          backgroundColor: on
            ? rgbToCss(rgb[o]!, rgb[o + 1]!, rgb[o + 2]!)
            : '#0F172A',
          opacity: on ? 1 : 0.35,
        },
      });
    } catch {
      // tek hücre hatası matrisi bozmaz
    }
  }
}

function ParticleMatrix({
  engine,
  frame,
}: {
  engine: VirtualCrowdEngine;
  frame: number;
}) {
  const cellRefs = useRef<CellRef[]>([]);

  const matrix = useMemo(() => {
    const rows: ReactNode[] = [];
    for (let r = 0; r < VIRTUAL_CROWD_ROWS; r++) {
      const cells: ReactNode[] = [];
      for (let c = 0; c < VIRTUAL_CROWD_COLS; c++) {
        const i = r * VIRTUAL_CROWD_COLS + c;
        cells.push(
          <View
            key={i}
            ref={(el) => {
              cellRefs.current[i] = el;
            }}
            pointerEvents="none"
            style={styles.crowdParticle}
          />,
        );
      }
      rows.push(
        <View key={`row-${r}`} style={styles.crowdParticleRow}>
          {cells}
        </View>,
      );
    }
    return rows;
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      paintMatrix(engine, cellRefs.current);
    });
    return () => cancelAnimationFrame(id);
  }, [engine, frame]);

  return (
    <View
      style={styles.crowdMatrix}
      collapsable={false}
      removeClippedSubviews={Platform.OS === 'android'}>
      {matrix}
    </View>
  );
}

function VirtualCrowdPanelComponent({ payload }: Props) {
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [metrics, setMetrics] = useState<CrowdSimMetrics>(IDLE_METRICS);
  const engineRef = useRef<VirtualCrowdEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new VirtualCrowdEngine();
  }

  useEffect(() => {
    if (!isSimulationMode) {
      try {
        engineRef.current?.clear();
      } catch {
        // ignore
      }
      setMetrics(IDLE_METRICS);
      return;
    }

    const matrixOn = Boolean(payload.matrix?.engaged);
    if (!matrixOn) {
      try {
        const snap = engineRef.current!.applyPayload(payload);
        setMetrics(snap.metrics);
      } catch {
        // ignore
      }
      return;
    }

    // V20 — matrix engaged: RAF ile dalga/görsel (UI block etmeden ~30fps)
    let raf = 0;
    let alive = true;
    let last = 0;
    const payloadRef = { current: payload };
    payloadRef.current = payload;

    const tick = (ts: number) => {
      if (!alive) return;
      if (ts - last >= 33) {
        last = ts;
        try {
          const snap = engineRef.current!.applyPayload(payloadRef.current);
          setMetrics(snap.metrics);
        } catch {
          // skip
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [
    isSimulationMode,
    payload,
    payload.timestamp,
    payload.action,
    payload.status,
    payload.zoneMask,
    payload.bpm,
    payload.swarmProtocol,
    payload.matrix?.engaged,
    payload.matrix?.effect,
    payload.matrix?.speed,
    payload.matrix?.hue,
    payload.matrix?.t0,
  ]);

  return (
    <View style={styles.crowdCard}>
      <View style={styles.crowdHeader}>
        <Text style={styles.sectionLabel}>VIRTUAL STADIUM STRESS TEST</Text>
        <TouchableOpacity
          accessibilityRole="switch"
          accessibilityState={{ checked: isSimulationMode }}
          activeOpacity={0.75}
          onPress={() => setIsSimulationMode((v) => !v)}
          style={[styles.crowdToggle, isSimulationMode && styles.crowdToggleOn]}>
          <Text style={styles.crowdToggleText}>
            {isSimulationMode ? 'SIM ON' : 'SIM OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.crowdHint}>
        {isSimulationMode
          ? '1000 sanal cihaz · zoneMask / matrix / PTP dinleniyor'
          : 'Simülasyon kapalı — UI yükü yok'}
      </Text>

      {isSimulationMode ? (
        <>
          <View style={styles.crowdMetricsRow}>
            <View style={styles.crowdMetric}>
              <Text style={styles.crowdMetricLabel}>SIMULATED NODES</Text>
              <Text style={styles.crowdMetricValue}>{metrics.simulatedNodes}</Text>
            </View>
            <View style={styles.crowdMetric}>
              <Text style={styles.crowdMetricLabel}>ACTIVE NODES</Text>
              <Text style={[styles.crowdMetricValue, styles.crowdMetricAccent]}>
                {metrics.activeNodes}
              </Text>
            </View>
            <View style={styles.crowdMetric}>
              <Text style={styles.crowdMetricLabel}>AVG LATENCY</Text>
              <Text style={styles.crowdMetricValue}>
                {formatCrowdLatency(metrics.avgLatencyMs)}
              </Text>
            </View>
          </View>

          <ParticleMatrix engine={engineRef.current} frame={metrics.frame} />
        </>
      ) : null}
    </View>
  );
}

export const VirtualCrowdPanel = memo(VirtualCrowdPanelComponent);
