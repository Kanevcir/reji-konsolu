/**
 * Sayfa altı Reji Log + Modül Rozet + V9–V12 durum paneli.
 */

import { memo } from 'react';
import { Text, View } from 'react-native';

import { normalizeMicLevel } from '../audioBeat';
import {
  formatArtNetStatusLabel,
  type ArtNetBridgeStats,
  DEFAULT_ARTNET_STATS,
} from '../artnetEngine';
import {
  formatPtpClockLabel,
  type ClockSyncStats,
  DEFAULT_CLOCK_SYNC_STATS,
} from '../clockSync';
import { MODULE_BADGES } from '../constants';
import { isHapticMotorActive } from '../haptics';
import type { NetworkLinkStatus, NetworkTransport } from '../networkEngine';
import {
  formatOfflineQueueLabel,
} from '../offlineQueue';
import {
  formatAuthStatusLabel,
  type SecurityLockState,
  DEFAULT_SECURITY_LOCK,
} from '../securityLock';
import { formatTransportLabel } from '../socket';
import { rejiStyles as styles } from '../styles';
import type { RejiLogEntry } from '../types';

type StatusPanelProps = {
  logs: RejiLogEntry[];
  hapticPulseActive?: boolean;
  isListeningAudio?: boolean;
  micLevelDb?: number;
  networkStatus?: NetworkLinkStatus;
  networkEndpoint?: string;
  networkTransport?: NetworkTransport;
  networkError?: string | null;
  clockSyncStats?: ClockSyncStats;
  artNetStats?: ArtNetBridgeStats;
  securityLock?: SecurityLockState;
  /** V13.0 offline queue pending count. */
  offlineQueuePending?: number;
};

function StatusPanelComponent({
  logs,
  hapticPulseActive = false,
  isListeningAudio = false,
  micLevelDb = -30,
  networkStatus = 'DISCONNECTED',
  networkEndpoint = '—',
  networkTransport = 'offline',
  networkError = null,
  clockSyncStats = DEFAULT_CLOCK_SYNC_STATS,
  artNetStats = DEFAULT_ARTNET_STATS,
  securityLock = DEFAULT_SECURITY_LOCK,
  offlineQueuePending = 0,
}: StatusPanelProps) {
  const hapticActive = isHapticMotorActive();
  const hapticLabel = hapticActive ? 'HAPTIC MOTOR: ACTIVE' : 'HAPTIC MOTOR: UNAVAILABLE';
  const micFill = normalizeMicLevel(micLevelDb);
  const clockDrift = clockSyncStats.status === 'DRIFT';

  return (
    <View style={styles.statusPanel}>
      <Text style={styles.sectionLabel}>REJİ LOG VE SİSTEM DURUMU</Text>

      <View style={styles.logBox}>
        <Text style={styles.logBoxTitle}>Reji Logları</Text>
        {logs.length === 0 ? (
          <Text style={styles.logEmpty}>Henüz log yok — bir aksiyon tetikleyin.</Text>
        ) : (
          logs
            .slice()
            .reverse()
            .map((entry) => (
              <Text key={entry.id} style={styles.logLine}>
                {entry.time} - {entry.message}
              </Text>
            ))
        )}
      </View>

      <View style={[styles.clockSyncRow, clockDrift && styles.clockSyncRowDrift]}>
        <Text style={[styles.clockSyncText, clockDrift && styles.clockSyncTextDrift]}>
          {formatPtpClockLabel(clockSyncStats)}
        </Text>
      </View>

      <View style={styles.artnetStatusRow}>
        <Text style={styles.artnetStatusText}>{formatArtNetStatusLabel(artNetStats)}</Text>
      </View>

      <View
        style={[
          styles.authStatusRow,
          securityLock.isConsoleLocked && styles.authStatusRowLocked,
        ]}>
        <Text
          style={[
            styles.authStatusText,
            securityLock.isConsoleLocked && styles.authStatusTextLocked,
          ]}>
          {formatAuthStatusLabel(securityLock)}
        </Text>
      </View>

      <View
        style={[
          styles.offlineQueueRow,
          offlineQueuePending > 0 && styles.offlineQueueRowActive,
        ]}>
        <Text
          style={[
            styles.offlineQueueText,
            offlineQueuePending > 0 && styles.offlineQueueTextActive,
          ]}>
          {formatOfflineQueueLabel(offlineQueuePending)}
        </Text>
      </View>

      <View style={styles.netLinkRow}>
        <Text style={styles.netLinkLabel}>NETWORK LINK</Text>
        <Text style={styles.netLinkValue}>
          {networkStatus} · {formatTransportLabel(networkTransport)}
        </Text>
        <Text style={styles.netEndpointText} numberOfLines={1}>
          {networkEndpoint}
        </Text>
        {networkError ? (
          <Text style={styles.netErrorText} numberOfLines={2}>
            {networkError}
          </Text>
        ) : null}
      </View>

      <View style={styles.hardwareRow}>
        <View
          style={[
            styles.hardwareBadge,
            hapticActive ? styles.hardwareBadgeOk : styles.hardwareBadgeWarn,
            hapticPulseActive && hapticActive && styles.hardwareBadgePulse,
          ]}>
          <View
            style={[
              styles.hardwareDot,
              hapticActive ? styles.hardwareDotOk : styles.hardwareDotWarn,
            ]}
          />
          <Text style={styles.hardwareText}>{hapticLabel}</Text>
        </View>
        <View style={[styles.hardwareBadge, styles.hardwareBadgeOk]}>
          <View style={[styles.hardwareDot, styles.hardwareDotOk]} />
          <Text style={styles.hardwareText}>AUDIO CORE: READY</Text>
        </View>
      </View>

      <View style={[styles.audioSyncCard, isListeningAudio && styles.audioSyncCardActive]}>
        <Text style={[styles.audioSyncLabel, isListeningAudio && styles.audioSyncLabelOn]}>
          {isListeningAudio ? 'AUTO AUDIO SYNC: ON' : 'AUTO AUDIO SYNC: OFF'}
        </Text>
        <Text style={styles.micLevelLabel}>
          MIC INPUT LEVEL (dB): {micLevelDb.toFixed(1)}
        </Text>
        <View style={styles.micBarTrack}>
          <View
            style={[
              styles.micBarFill,
              {
                width: `${Math.round(micFill * 100)}%`,
                opacity: isListeningAudio ? 1 : 0.35,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.badgeRow}>
        {MODULE_BADGES.map((badge) => (
          <View key={badge.id} style={styles.moduleBadge}>
            <Text style={styles.moduleBadgeLabel}>{badge.label}</Text>
            <Text style={styles.moduleBadgeOk}>OK</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export const StatusPanel = memo(StatusPanelComponent);
