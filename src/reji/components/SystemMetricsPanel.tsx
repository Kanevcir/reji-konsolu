/**
 * V30.0 — SİSTEM METRİKLERİ paneli (güvenlik + ölçek telemetrisi).
 */

import { memo } from 'react';
import { Text, View } from 'react-native';

import {
  formatDisconnectedRate,
  type SystemHealthSnapshot,
} from '../systemHealth';
import { formatClockOffset } from '../clockSync';
import { rejiStyles as styles } from '../styles';

type Props = {
  health: SystemHealthSnapshot;
  isolated?: boolean;
};

function SystemMetricsPanelComponent({ health, isolated = false }: Props) {
  const workers = health.workerLoads.slice(0, 4);

  return (
    <View style={[styles.sysMetricsCard, isolated && styles.sysMetricsIsolated]}>
      <Text style={styles.sectionLabel}>SİSTEM METRİKLERİ</Text>
      <Text style={styles.sysMetricsHint}>
        {isolated
          ? 'SYSTEM ISOLATED · live feed paused'
          : `AUTH OK · admin TX ${health.adminPublishes} · denied ${health.authDenied}`}
      </Text>

      <View style={styles.sysMetricsGrid}>
        <View style={styles.sysMetricCell}>
          <Text style={styles.sysMetricValue}>{health.concurrentConnections}</Text>
          <Text style={styles.sysMetricLabel}>CONCURRENT</Text>
        </View>
        <View style={styles.sysMetricCell}>
          <Text style={styles.sysMetricValue}>
            {formatClockOffset(health.ptpOffsetMs)}
          </Text>
          <Text style={styles.sysMetricLabel}>PTP OFFSET</Text>
        </View>
        <View style={styles.sysMetricCell}>
          <Text style={styles.sysMetricValue}>
            {Math.round(health.ptpRttMs)}/{health.ptpJitterMs.toFixed(1)}
          </Text>
          <Text style={styles.sysMetricLabel}>PING / JITTER ms</Text>
        </View>
        <View style={styles.sysMetricCell}>
          <Text
            style={[
              styles.sysMetricValue,
              health.disconnectedRate > 0.08 && styles.sysMetricWarn,
            ]}>
            {formatDisconnectedRate(health.disconnectedRate)}
          </Text>
          <Text style={styles.sysMetricLabel}>DISCONNECTED</Text>
        </View>
      </View>

      <Text style={styles.sysMetricsSubLabel}>WORKER LOAD</Text>
      <View style={styles.sysWorkerRow}>
        {workers.length === 0 ? (
          <Text style={styles.sysMetricsHint}>no workers</Text>
        ) : (
          workers.map((w) => (
            <View key={w.workerId} style={styles.sysWorkerChip}>
              <Text style={styles.sysWorkerId}>{w.workerId.replace('worker-', 'W')}</Text>
              <View style={styles.sysWorkerBarTrack}>
                <View
                  style={[
                    styles.sysWorkerBarFill,
                    { width: `${Math.min(100, Math.max(0, w.loadPct))}%` },
                  ]}
                />
              </View>
              <Text style={styles.sysWorkerPct}>{w.loadPct.toFixed(0)}%</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sysMetricsFooter}>
        sessions {health.sessionCount} (A{health.adminSessions}/C
        {health.clientSessions}) · zombies purged {health.zombiesPurged} · PTP{' '}
        {health.ptpStatus}
      </Text>
    </View>
  );
}

export const SystemMetricsPanel = memo(SystemMetricsPanelComponent);
