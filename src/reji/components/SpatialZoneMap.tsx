/**
 * V16.0 — SPATIAL ZONE MAP (4 bölgeli üstten görünüm grid).
 */

import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  formatZoneLabel,
  formatZoneMaskBinary,
  isZoneActive,
  type SpatialZoneId,
} from '../zoneManager';
import { rejiStyles as styles } from '../styles';

type Props = {
  activeZones: SpatialZoneId[];
  zoneMask: number;
  readOnly?: boolean;
  onToggleZone: (zone: SpatialZoneId) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
};

function ZoneCell({
  zone,
  label,
  active,
  disabled,
  onPress,
  cellStyle,
}: {
  zone: SpatialZoneId;
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  cellStyle?: object;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={`Zone ${zone}`}
      disabled={disabled}
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.zoneCell,
        cellStyle,
        active && styles.zoneCellActive,
        disabled && styles.controlDisabled,
      ]}>
      <Text style={[styles.zoneCellText, active && styles.zoneCellTextActive]}>
        {label}
      </Text>
      <Text style={[styles.zoneCellBit, active && styles.zoneCellTextActive]}>
        {zone === 'NORTH'
          ? '0001'
          : zone === 'SOUTH'
            ? '0010'
            : zone === 'EAST'
              ? '0100'
              : '1000'}
      </Text>
    </TouchableOpacity>
  );
}

function SpatialZoneMapComponent({
  activeZones,
  zoneMask,
  readOnly = false,
  onToggleZone,
  onSelectAll,
  onClearAll,
}: Props) {
  const disabled = readOnly;

  return (
    <View style={[styles.zoneCard, readOnly && styles.zoneCardLocked]}>
      <Text style={styles.sectionLabel}>SPATIAL ZONE MAP</Text>
      <Text style={styles.zoneHint}>
        Mask {formatZoneMaskBinary(zoneMask)}b · {formatZoneLabel(activeZones)}
        {readOnly ? ' · READ-ONLY (LOCKED)' : ' · çoklu seçim'}
      </Text>

      <View style={styles.zoneGrid}>
        <View style={styles.zoneGridRowCenter}>
          <ZoneCell
            zone="NORTH"
            label="KUZEY"
            active={isZoneActive(activeZones, 'NORTH')}
            disabled={disabled}
            onPress={() => onToggleZone('NORTH')}
            cellStyle={styles.zoneCellNorth}
          />
        </View>

        <View style={styles.zoneGridMid}>
          <ZoneCell
            zone="WEST"
            label="BATI"
            active={isZoneActive(activeZones, 'WEST')}
            disabled={disabled}
            onPress={() => onToggleZone('WEST')}
            cellStyle={styles.zoneCellSide}
          />
          <View style={styles.zonePitch}>
            <Text style={styles.zonePitchText}>SAHA</Text>
            <Text style={styles.zonePitchMask}>{formatZoneMaskBinary(zoneMask)}</Text>
          </View>
          <ZoneCell
            zone="EAST"
            label="DOĞU"
            active={isZoneActive(activeZones, 'EAST')}
            disabled={disabled}
            onPress={() => onToggleZone('EAST')}
            cellStyle={styles.zoneCellSide}
          />
        </View>

        <View style={styles.zoneGridRowCenter}>
          <ZoneCell
            zone="SOUTH"
            label="GÜNEY"
            active={isZoneActive(activeZones, 'SOUTH')}
            disabled={disabled}
            onPress={() => onToggleZone('SOUTH')}
            cellStyle={styles.zoneCellSouth}
          />
        </View>
      </View>

      <View style={styles.zoneBtnRow}>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={disabled}
          activeOpacity={0.75}
          onPress={onSelectAll}
          style={[styles.zoneQuickBtn, disabled && styles.controlDisabled]}>
          <Text style={styles.zoneQuickBtnText}>ALL 1111</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={disabled}
          activeOpacity={0.75}
          onPress={onClearAll}
          style={[styles.zoneQuickBtn, styles.zoneQuickBtnMuted, disabled && styles.controlDisabled]}>
          <Text style={styles.zoneQuickBtnText}>NONE 0000</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const SpatialZoneMap = memo(SpatialZoneMapComponent);
