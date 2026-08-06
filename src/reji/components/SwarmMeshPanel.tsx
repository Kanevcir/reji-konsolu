/**
 * V17.0 — SWARM INTELLIGENCE (BLE MESH) paneli + pulsing nodes.
 */

import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';

import { formatMeshStatusLabel } from '../swarmCommander';
import { rejiStyles as styles } from '../styles';

type Props = {
  isSwarmMeshActive: boolean;
  estimatedMeshNodes: number;
  disabled?: boolean;
  onToggle: () => void;
};

function PulsingNodes({ active }: { active: boolean }) {
  const pulseA = useRef(new Animated.Value(0.35)).current;
  const pulseB = useRef(new Animated.Value(0.35)).current;
  const pulseC = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!active) {
      pulseA.setValue(0.25);
      pulseB.setValue(0.25);
      pulseC.setValue(0.25);
      return;
    }

    const loop = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.3,
            duration: 900,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );

    const a = loop(pulseA, 0);
    const b = loop(pulseB, 220);
    const c = loop(pulseC, 440);
    a.start();
    b.start();
    c.start();
    return () => {
      a.stop();
      b.stop();
      c.stop();
    };
  }, [active, pulseA, pulseB, pulseC]);

  const nodeStyle = (opacity: Animated.Value, scaleBoost = 1) => ({
    opacity,
    transform: [
      {
        scale: opacity.interpolate({
          inputRange: [0.3, 1],
          outputRange: [0.85 * scaleBoost, 1.15 * scaleBoost],
        }),
      },
    ],
  });

  return (
    <View style={styles.swarmRadar}>
      <View style={[styles.swarmRing, styles.swarmRingOuter]} />
      <View style={[styles.swarmRing, styles.swarmRingMid]} />
      <View style={[styles.swarmRing, styles.swarmRingInner]} />

      <View style={styles.swarmLinkH} />
      <View style={styles.swarmLinkV} />
      <View style={[styles.swarmLinkDiag, styles.swarmLinkDiagA]} />
      <View style={[styles.swarmLinkDiag, styles.swarmLinkDiagB]} />

      <Animated.View
        style={[styles.swarmNode, styles.swarmNodeCenter, nodeStyle(pulseA, 1.1)]}
      />
      <Animated.View
        style={[styles.swarmNode, styles.swarmNodeN, nodeStyle(pulseB)]}
      />
      <Animated.View
        style={[styles.swarmNode, styles.swarmNodeS, nodeStyle(pulseC)]}
      />
      <Animated.View
        style={[styles.swarmNode, styles.swarmNodeE, nodeStyle(pulseB)]}
      />
      <Animated.View
        style={[styles.swarmNode, styles.swarmNodeW, nodeStyle(pulseC)]}
      />
      <Animated.View
        style={[styles.swarmNode, styles.swarmNodeNE, nodeStyle(pulseA, 0.9)]}
      />
      <Animated.View
        style={[styles.swarmNode, styles.swarmNodeSW, nodeStyle(pulseA, 0.9)]}
      />
    </View>
  );
}

function SwarmMeshPanelComponent({
  isSwarmMeshActive,
  estimatedMeshNodes,
  disabled = false,
  onToggle,
}: Props) {
  const status = formatMeshStatusLabel(isSwarmMeshActive);

  return (
    <View style={[styles.swarmCard, isSwarmMeshActive && styles.swarmCardActive]}>
      <Text style={styles.sectionLabel}>SWARM INTELLIGENCE (BLE MESH)</Text>
      <Text style={styles.swarmHint}>
        {isSwarmMeshActive
          ? `MESH ${status} · ~${estimatedMeshNodes.toLocaleString('en-US')} nodes · hop≈100`
          : `MESH ${status} · BLE sıçrama kapalı`}
        {disabled ? ' · LOCKED/SAFE' : ''}
      </Text>

      <PulsingNodes active={isSwarmMeshActive} />

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: isSwarmMeshActive, disabled }}
        disabled={disabled && !isSwarmMeshActive}
        activeOpacity={0.75}
        onPress={onToggle}
        style={[
          styles.swarmEngageBtn,
          isSwarmMeshActive && styles.swarmEngageBtnActive,
          disabled && !isSwarmMeshActive && styles.controlDisabled,
        ]}>
        <Text style={styles.swarmEngageText}>
          {isSwarmMeshActive ? 'DISENGAGE SWARM MESH' : 'ENGAGE SWARM MESH'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const SwarmMeshPanel = memo(SwarmMeshPanelComponent);
