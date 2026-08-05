/**
 * V15.0 — SYSTEM DIAGNOSTICS & LOGS (gizlenebilir terminal + export).
 */

import { memo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  formatBlackboxTerminalLine,
  type BlackboxEntry,
} from '../blackbox';
import { rejiStyles as styles } from '../styles';

type Props = {
  logs: BlackboxEntry[];
  eventCount: number;
  onExport: () => void;
};

function DiagnosticsTerminalComponent({ logs, eventCount, onExport }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.diagCard}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        activeOpacity={0.8}
        onPress={() => setExpanded((v) => !v)}
        style={styles.diagHeader}>
        <Text style={styles.sectionLabel}>SYSTEM DIAGNOSTICS & LOGS</Text>
        <Text style={styles.diagToggle}>{expanded ? '▼ GİZLE' : '▶ AÇ'}</Text>
      </TouchableOpacity>

      <Text style={styles.diagMeta}>
        BLACKBOX · {eventCount} olay (rolling 1000) · son {logs.length} satır
      </Text>

      {expanded ? (
        <>
          <View style={styles.diagTerminal}>
            {logs.length === 0 ? (
              <Text style={styles.diagLine}>
                {'> '}awaiting critical events…
              </Text>
            ) : (
              logs.map((entry) => (
                <Text key={entry.id} style={styles.diagLine} numberOfLines={2}>
                  {formatBlackboxTerminalLine(entry)}
                </Text>
              ))
            )}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Export match report"
            activeOpacity={0.75}
            onPress={onExport}
            style={styles.diagExportBtn}>
            <Text style={styles.diagExportText}>EXPORT MATCH REPORT</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

export const DiagnosticsTerminal = memo(DiagnosticsTerminalComponent);
