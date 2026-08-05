/**
 * V11.0 — Gizlenebilir ART-NET / DMX LIGHTING BRIDGE paneli.
 */

import { memo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  ARTNET_UNIVERSE_LABELS,
  ARTNET_UNIVERSES,
  formatArtNetStatusLabel,
  type ArtNetBridgeStats,
  type ArtNetConfig,
  type ArtNetUniverseId,
} from '../artnetEngine';
import { rejiStyles as styles } from '../styles';

type Props = {
  config: ArtNetConfig;
  stats: ArtNetBridgeStats;
  disabled?: boolean;
  onSelectUniverse: (id: ArtNetUniverseId) => void;
  onCycleNet: () => void;
  onCycleSubnet: () => void;
};

function ArtNetBridgePanelComponent({
  config,
  stats,
  disabled = false,
  onSelectUniverse,
  onCycleNet,
  onCycleSubnet,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const status = formatArtNetStatusLabel(stats);

  return (
    <View style={styles.artnetCard}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        activeOpacity={0.75}
        onPress={() => setExpanded((v) => !v)}
        style={styles.netHeaderBtn}>
        <Text style={styles.sectionLabel}>ART-NET / DMX LIGHTING BRIDGE</Text>
        <Text style={styles.netChevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      <View style={styles.artnetSummaryRow}>
        <View
          style={[
            styles.netStatusPill,
            stats.broadcasting ? styles.netStatusOk : styles.netStatusDown,
          ]}>
          <Text style={styles.netStatusPillText}>
            {stats.broadcasting ? 'TX' : 'IDLE'}
          </Text>
        </View>
        <Text style={styles.artnetSummaryText} numberOfLines={2}>
          {status}
        </Text>
      </View>

      {expanded ? (
        <View style={styles.artnetBody}>
          <Text style={styles.netFieldLabel}>DMX UNIVERSE</Text>
          <View style={styles.artnetUniverseRow}>
            {ARTNET_UNIVERSES.map((id) => {
              const active = config.selectedUniverse === id;
              return (
                <TouchableOpacity
                  key={id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled }}
                  disabled={disabled}
                  activeOpacity={0.75}
                  onPress={() => onSelectUniverse(id)}
                  style={[
                    styles.artnetUniverseBtn,
                    active && styles.artnetUniverseBtnActive,
                  ]}>
                  <Text
                    style={[
                      styles.artnetUniverseBtnText,
                      active && styles.artnetUniverseBtnTextActive,
                    ]}>
                    U{id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.artnetUniverseHint}>
            {ARTNET_UNIVERSE_LABELS[config.selectedUniverse]}
          </Text>

          <View style={styles.artnetMetaRow}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={disabled}
              activeOpacity={0.75}
              onPress={onCycleNet}
              style={styles.artnetMetaBtn}>
              <Text style={styles.netFieldLabel}>NET</Text>
              <Text style={styles.artnetMetaValue}>{config.net}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={disabled}
              activeOpacity={0.75}
              onPress={onCycleSubnet}
              style={styles.artnetMetaBtn}>
              <Text style={styles.netFieldLabel}>SUBNET</Text>
              <Text style={styles.artnetMetaValue}>{config.subnet}</Text>
            </TouchableOpacity>
            <View style={styles.artnetMetaBtn}>
              <Text style={styles.netFieldLabel}>SEQ</Text>
              <Text style={styles.artnetMetaValue}>{stats.sequence}</Text>
            </View>
          </View>

          {stats.lastHexPreview ? (
            <View style={styles.artnetHexBox}>
              <Text style={styles.netFieldLabel}>PACKET HEX (PREVIEW)</Text>
              <Text style={styles.artnetHexText} numberOfLines={3}>
                {stats.lastHexPreview}
              </Text>
            </View>
          ) : null}

          <Text style={styles.netHint}>
            Outgoing payload ile eşzamanlı Art-Net OpDmx (512 CH / UNIVERSE 1-4)
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const ArtNetBridgePanel = memo(ArtNetBridgePanelComponent);
