/**
 * V19.0 — Hot-Standby / Dual-Console redundancy paneli.
 */

import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  formatConsoleRoleBadge,
  type ConsoleRole,
  type PeerStatus,
} from '../redundancyEngine';
import { rejiStyles as styles } from '../styles';

type Props = {
  consoleRole: ConsoleRole;
  peerStatus: PeerStatus;
  onPromoteToMaster: () => void;
  onSwitchToSlave: () => void;
  onStandalone?: () => void;
};

function RedundancyPanelComponent({
  consoleRole,
  peerStatus,
  onPromoteToMaster,
  onSwitchToSlave,
  onStandalone,
}: Props) {
  const peerOnline = peerStatus === 'CONNECTED';

  return (
    <View style={styles.redundancyCard}>
      <Text style={styles.sectionLabel}>HOT-STANDBY & FAILOVER</Text>
      <Text style={styles.redundancyHint}>
        CONSOLES: {formatConsoleRoleBadge(consoleRole)} · PEER{' '}
        {peerStatus}
      </Text>

      <View style={styles.redundancyBadgeRow}>
        <View
          style={[
            styles.redundancyBadge,
            consoleRole === 'MASTER' && styles.redundancyBadgeMaster,
            consoleRole === 'SLAVE' && styles.redundancyBadgeSlave,
            consoleRole === 'STANDALONE' && styles.redundancyBadgeSolo,
          ]}>
          <Text style={styles.redundancyBadgeText}>
            {formatConsoleRoleBadge(consoleRole)}
          </Text>
        </View>
        <View
          style={[
            styles.redundancyBadge,
            peerOnline
              ? styles.redundancyBadgePeerOn
              : styles.redundancyBadgePeerOff,
          ]}>
          <Text style={styles.redundancyBadgeText}>
            PEER {peerStatus}
          </Text>
        </View>
      </View>

      <View style={styles.redundancyBtnRow}>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.75}
          disabled={consoleRole === 'MASTER'}
          onPress={onPromoteToMaster}
          style={[
            styles.redundancyBtn,
            styles.redundancyBtnPromote,
            consoleRole === 'MASTER' && styles.controlDisabled,
          ]}>
          <Text style={styles.redundancyBtnText}>PROMOTE TO MASTER</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.75}
          disabled={consoleRole === 'SLAVE'}
          onPress={onSwitchToSlave}
          style={[
            styles.redundancyBtn,
            styles.redundancyBtnSlave,
            consoleRole === 'SLAVE' && styles.controlDisabled,
          ]}>
          <Text style={styles.redundancyBtnText}>SWITCH TO SLAVE</Text>
        </TouchableOpacity>
      </View>

      {onStandalone ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.75}
          onPress={onStandalone}
          style={[styles.redundancyBtn, styles.redundancyBtnSolo]}>
          <Text style={styles.redundancyBtnText}>STANDALONE</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export const RedundancyPanel = memo(RedundancyPanelComponent);
