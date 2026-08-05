/**
 * V8–V12 — TELEMETRY & FIELD METRICS şeridi.
 */

import { memo } from 'react';
import { Text, View } from 'react-native';

import {
  type ArtNetBridgeStats,
  DEFAULT_ARTNET_STATS,
} from '../artnetEngine';
import {
  formatClockOffset,
  type ClockSyncStats,
  DEFAULT_CLOCK_SYNC_STATS,
} from '../clockSync';
import type { NetworkLinkStatus, NetworkTransport } from '../networkEngine';
import {
  formatOperatorRoleLabel,
  type SecurityLockState,
  DEFAULT_SECURITY_LOCK,
} from '../securityLock';
import { formatTransportLabel } from '../socket';
import {
  formatActiveNodes,
  formatNetworkStability,
  type TelemetryStats,
} from '../telemetry';
import { rejiStyles as styles } from '../styles';

type Props = {
  stats: TelemetryStats;
  isolated?: boolean;
  linkStatus?: NetworkLinkStatus;
  transport?: NetworkTransport;
  clockSyncStats?: ClockSyncStats;
  artNetStats?: ArtNetBridgeStats;
  securityLock?: SecurityLockState;
  offlineQueuePending?: number;
};

function TelemetryStripComponent({
  stats,
  isolated = false,
  linkStatus = 'DISCONNECTED',
  transport = 'offline',
  clockSyncStats = DEFAULT_CLOCK_SYNC_STATS,
  artNetStats = DEFAULT_ARTNET_STATS,
  securityLock = DEFAULT_SECURITY_LOCK,
  offlineQueuePending = 0,
}: Props) {
  if (isolated) {
    return (
      <View style={[styles.telemetryStrip, styles.telemetryStripIsolated]}>
        <Text style={styles.telemetryTitle}>TELEMETRY & FIELD METRICS</Text>
        <View style={styles.telemetryIsolatedBox}>
          <Text style={styles.telemetryIsolatedText}>SYSTEM ISOLATED</Text>
          <Text style={styles.telemetryIsolatedHint}>
            Saha telemetrisi güvenli modda donduruldu
          </Text>
        </View>
      </View>
    );
  }

  const linkAccent =
    linkStatus === 'CONNECTED'
      ? styles.telemetryValueAccent
      : linkStatus === 'FALLBACK_UDP'
        ? styles.telemetryValueWarn
        : styles.telemetryValueDanger;

  const clockAccent =
    clockSyncStats.status === 'SYNCED'
      ? styles.telemetryValueAccent
      : clockSyncStats.status === 'DRIFT'
        ? styles.telemetryValueDanger
        : clockSyncStats.status === 'SYNCING'
          ? styles.telemetryValueWarn
          : styles.telemetryValueDanger;

  const clockStatusLabel =
    clockSyncStats.status === 'DRIFT' ? 'DRIFT' : clockSyncStats.status;

  const authAccent = securityLock.isConsoleLocked
    ? styles.telemetryValueDanger
    : styles.telemetryValueAccent;

  return (
    <View style={styles.telemetryStrip}>
      <Text style={styles.telemetryTitle}>TELEMETRY & FIELD METRICS</Text>
      <View style={styles.telemetryGrid}>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>ANLIK FPS</Text>
          <Text style={styles.telemetryValue}>{stats.fps}</Text>
        </View>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>MEMORY (RAM)</Text>
          <Text style={styles.telemetryValue}>{stats.memoryMb} MB</Text>
        </View>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>ACTIVE NODES</Text>
          <Text style={styles.telemetryValue}>
            {formatActiveNodes(stats.activeNodes)}
          </Text>
        </View>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>NETWORK STABILITY</Text>
          <Text style={[styles.telemetryValue, styles.telemetryValueAccent]}>
            {formatNetworkStability(stats.networkStability)}
          </Text>
        </View>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>LINK STATUS</Text>
          <Text style={[styles.telemetryValue, linkAccent]}>{linkStatus}</Text>
        </View>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>TRANSPORT</Text>
          <Text style={[styles.telemetryValue, linkAccent]}>
            {formatTransportLabel(transport)}
          </Text>
        </View>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>PTP CLOCK</Text>
          <Text style={[styles.telemetryValue, clockAccent]}>{clockStatusLabel}</Text>
        </View>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>OFFSET / RTT</Text>
          <Text style={[styles.telemetryValue, clockAccent]}>
            {formatClockOffset(clockSyncStats.clockOffset)} / {Math.round(clockSyncStats.rtt)}ms
          </Text>
        </View>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>ART-NET DMX</Text>
          <Text
            style={[
              styles.telemetryValue,
              artNetStats.broadcasting
                ? styles.telemetryValueAccent
                : styles.telemetryValueDanger,
            ]}>
            {artNetStats.broadcasting ? 'TX' : 'IDLE'}
          </Text>
        </View>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>DMX UNIVERSE</Text>
          <Text
            style={[
              styles.telemetryValue,
              artNetStats.broadcasting
                ? styles.telemetryValueAccent
                : styles.telemetryValueWarn,
            ]}>
            {artNetStats.broadcasting
              ? `${artNetStats.fps} FPS · U1-4`
              : 'U1-4 STBY'}
          </Text>
        </View>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>AUTH ROLE</Text>
          <Text style={[styles.telemetryValue, authAccent]}>
            {formatOperatorRoleLabel(securityLock.operatorRole)}
          </Text>
        </View>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>AUTH LOCK</Text>
          <Text style={[styles.telemetryValue, authAccent]}>
            {securityLock.isConsoleLocked ? 'LOCKED' : 'UNLOCKED'}
          </Text>
        </View>
        <View style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>OFFLINE QUEUE</Text>
          <Text
            style={[
              styles.telemetryValue,
              offlineQueuePending > 0
                ? styles.telemetryValueWarn
                : styles.telemetryValueAccent,
            ]}>
            {offlineQueuePending > 0
              ? offlineQueuePending + ' QUEUED'
              : '0 PENDING'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export const TelemetryStrip = memo(TelemetryStripComponent);
