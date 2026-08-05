/**
 * V9.0 — Gizlenebilir AĞ VE SUNUCU AYARLARI paneli.
 */

import { memo, useState } from 'react';
import {
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { NetworkConfig, NetworkLinkStatus } from '../networkEngine';
import { rejiStyles as styles } from '../styles';

type Props = {
  config: NetworkConfig;
  linkStatus: NetworkLinkStatus;
  endpoint: string;
  lastError: string | null;
  disabled?: boolean;
  onChangeHost: (host: string) => void;
  onChangePort: (port: string) => void;
  onToggleSecure: (secure: boolean) => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

function statusStyle(status: NetworkLinkStatus) {
  if (status === 'CONNECTED') return styles.netStatusOk;
  if (status === 'CONNECTING') return styles.netStatusWarn;
  if (status === 'FALLBACK_UDP') return styles.netStatusFallback;
  return styles.netStatusDown;
}

function NetworkConfigPanelComponent({
  config,
  linkStatus,
  endpoint,
  lastError,
  disabled = false,
  onChangeHost,
  onChangePort,
  onToggleSecure,
  onConnect,
  onDisconnect,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.netCard}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        activeOpacity={0.75}
        onPress={() => setExpanded((v) => !v)}
        style={styles.netHeaderBtn}>
        <Text style={styles.sectionLabel}>AĞ VE SUNUCU AYARLARI (NETWORK CONFIG)</Text>
        <Text style={styles.netChevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      <View style={styles.netSummaryRow}>
        <View style={[styles.netStatusPill, statusStyle(linkStatus)]}>
          <Text style={styles.netStatusPillText}>{linkStatus}</Text>
        </View>
        <Text style={styles.netEndpointText} numberOfLines={1}>
          {endpoint}
        </Text>
      </View>

      {expanded ? (
        <View style={styles.netBody}>
          <Text style={styles.netFieldLabel}>TARGET SERVER IP / URL</Text>
          <TextInput
            accessibilityLabel="Target server host"
            editable={!disabled}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ws://192.168.1.100 veya 192.168.1.100"
            placeholderTextColor="#64748B"
            value={config.host}
            onChangeText={onChangeHost}
            style={styles.netInput}
          />

          <Text style={styles.netFieldLabel}>PORT</Text>
          <TextInput
            accessibilityLabel="Server port"
            editable={!disabled}
            keyboardType="number-pad"
            placeholder="8080"
            placeholderTextColor="#64748B"
            value={String(config.port)}
            onChangeText={onChangePort}
            style={styles.netInput}
          />

          <View style={styles.netSecureRow}>
            <Text style={styles.netFieldLabel}>WSS (TLS)</Text>
            <Switch
              accessibilityLabel="Use secure WebSocket"
              disabled={disabled}
              value={config.secure}
              onValueChange={onToggleSecure}
              trackColor={{ false: '#334155', true: '#0369A1' }}
              thumbColor={config.secure ? '#38BDF8' : '#94A3B8'}
            />
          </View>

          <View style={styles.netActionRow}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={disabled}
              activeOpacity={0.75}
              onPress={onConnect}
              style={[styles.netConnectBtn, disabled && styles.netBtnDisabled]}>
              <Text style={styles.netConnectBtnText}>BAĞLAN / YENİDEN DENE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={disabled}
              activeOpacity={0.75}
              onPress={onDisconnect}
              style={[styles.netDisconnectBtn, disabled && styles.netBtnDisabled]}>
              <Text style={styles.netDisconnectBtnText}>KES</Text>
            </TouchableOpacity>
          </View>

          {lastError ? (
            <Text style={styles.netErrorText} numberOfLines={3}>
              {lastError}
            </Text>
          ) : null}

          <Text style={styles.netHint}>
            WS başarısız olursa otomatik UDP_MULTICAST_FALLBACK (239.255.90.1:9090)
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const NetworkConfigPanel = memo(NetworkConfigPanelComponent);
