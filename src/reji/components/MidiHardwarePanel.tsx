/**
 * V21.0 — EXTERNAL HARDWARE & MIDI paneli (MIDI LEARN + cihaz durumu).
 * V23.1 — Traktor Z1 auto profil göstergesi.
 */

import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  formatMidiBinding,
  formatMidiHardwareProfile,
  formatMidiTargetLabel,
  MIDI_LEARN_TARGETS,
  type MidiBinding,
  type MidiControllerStatus,
  type MidiTarget,
} from '../midiController';
import { rejiStyles as styles } from '../styles';

type Props = {
  status: MidiControllerStatus;
  onConnect: () => void;
  onBeginLearn: (target: MidiTarget) => void;
  onCancelLearn: () => void;
  onClearBinding: (target: MidiTarget) => void;
  onResetBindings: () => void;
};

function bindingFor(
  bindings: MidiBinding[],
  target: MidiTarget,
): MidiBinding | undefined {
  return bindings.find((b) => b.target === target);
}

function MidiHardwarePanelComponent({
  status,
  onConnect,
  onBeginLearn,
  onCancelLearn,
  onClearBinding,
  onResetBindings,
}: Props) {
  const learning = status.learningTarget;
  const autoProfile = status.hardwareProfile === 'traktor_z1';
  const connectedLabel = status.deviceName
    ? `Connected: ${status.deviceName}`
    : status.accessState === 'granted'
      ? 'Connected: (no input ports)'
      : status.accessState === 'denied'
        ? 'MIDI access denied'
        : status.accessState === 'unavailable'
          ? 'Web MIDI unavailable (use web build)'
          : 'Not connected';

  return (
    <View style={styles.midiCard}>
      <Text style={styles.sectionLabel}>EXTERNAL HARDWARE & MIDI</Text>
      <Text style={styles.midiHint}>{connectedLabel}</Text>
      <Text style={styles.midiSubHint}>
        PROFILE: {formatMidiHardwareProfile(status.hardwareProfile)}
        {autoProfile
          ? ' · XF→Theme · Fader→Speed/Strobe · Note→BLACKOUT'
          : learning
            ? ` · MIDI LEARN · ${formatMidiTargetLabel(learning)} — fiziksel tuşa/fader’a bas`
            : ' · Pad → Zone/Macro/Blackout · CC fader → Matrix/Theme/Strobe'}
      </Text>

      <View style={styles.midiBtnRow}>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.75}
          onPress={onConnect}
          style={[styles.midiBtn, styles.midiBtnConnect]}>
          <Text style={styles.midiBtnText}>
            {status.accessState === 'granted' ? 'REFRESH MIDI' : 'CONNECT MIDI'}
          </Text>
        </TouchableOpacity>
        {learning && !autoProfile ? (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.75}
            onPress={onCancelLearn}
            style={[styles.midiBtn, styles.midiBtnCancel]}>
            <Text style={styles.midiBtnText}>CANCEL LEARN</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.75}
            onPress={onResetBindings}
            style={[styles.midiBtn, styles.midiBtnReset]}>
            <Text style={styles.midiBtnText}>RESET MAPS</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.midiSectionTitle}>
        {autoProfile ? 'TRAKTOR AUTO MAP (LEARN BYPASSED)' : 'MIDI LEARN TARGETS'}
      </Text>
      <View style={styles.midiTargetGrid}>
        {MIDI_LEARN_TARGETS.map((target) => {
          const bind = bindingFor(status.bindings, target);
          const active = !autoProfile && learning === target;
          return (
            <View key={target} style={styles.midiTargetRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: autoProfile }}
                activeOpacity={0.75}
                disabled={autoProfile}
                onPress={() => onBeginLearn(target)}
                style={[
                  styles.midiTargetBtn,
                  active && styles.midiTargetBtnLearn,
                  autoProfile && styles.controlDisabled,
                ]}>
                <Text style={styles.midiTargetName}>
                  {formatMidiTargetLabel(target)}
                </Text>
                <Text style={styles.midiTargetBind}>
                  {autoProfile && target === 'BLACKOUT'
                    ? 'AUTO · any Note On'
                    : autoProfile && target === 'THEME_MIX'
                      ? 'AUTO · 1st CC (XF)'
                      : autoProfile && target === 'MATRIX_SPEED'
                        ? 'AUTO · 2nd CC (fader)'
                        : autoProfile && target === 'STROBE_SENSITIVITY'
                          ? 'AUTO · 3rd CC (fader)'
                          : bind
                            ? formatMidiBinding(bind)
                            : '— unbound —'}
                </Text>
              </TouchableOpacity>
              {bind && !autoProfile ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => onClearBinding(target)}
                  style={styles.midiClearBtn}>
                  <Text style={styles.midiClearText}>×</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export const MidiHardwarePanel = memo(MidiHardwarePanelComponent);
