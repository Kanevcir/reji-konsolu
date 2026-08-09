/**
 * V23.0 â€” Mission Control Cockpit layout ÅŸemsiyesi.
 * V1â€“V22 panellerini 3 kolonlu endÃ¼striyel gridâ€™de birleÅŸtirir;
 * motor/stateâ€™e dokunmaz â€” yalnÄ±zca gÃ¶rsel wrapper.
 */

import { memo, type ReactNode } from 'react';
import {
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';

import { rejiStyles as styles } from '../styles';

const WIDE_BREAKPOINT = 1080;

type Props = {
  /** LOCKED: kolonlar + header read-only; emergency + lockControl her zaman aktif. */
  locked?: boolean;
  /** Kilit aÃ§/kapa â€” her zaman tÄ±klanabilir. */
  lockControl?: ReactNode;
  header: ReactNode;
  /** Devasa BLACKOUT â€” kilitliyken bile aktif kalÄ±r. */
  emergency: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  footer?: ReactNode;
};

function ColumnShell({
  title,
  accent,
  children,
  locked,
}: {
  title: string;
  accent: 'infra' | 'show' | 'trigger';
  children: ReactNode;
  locked?: boolean;
}) {
  return (
    <View
      style={[
        styles.cockpitColumn,
        accent === 'infra' && styles.cockpitColumnInfra,
        accent === 'show' && styles.cockpitColumnShow,
        accent === 'trigger' && styles.cockpitColumnTrigger,
      ]}>
      <View style={styles.cockpitColumnHeader}>
        <View
          style={[
            styles.cockpitColumnDot,
            accent === 'infra' && styles.cockpitDotYellow,
            accent === 'show' && styles.cockpitDotGreen,
            accent === 'trigger' && styles.cockpitDotRed,
          ]}
        />
        <Text style={styles.cockpitColumnTitle}>{title}</Text>
        {locked ? (
          <Text style={styles.cockpitColumnLockBadge}>LOCKED</Text>
        ) : null}
      </View>
      <View
        pointerEvents={locked ? 'none' : 'auto'}
        style={[styles.cockpitColumnBody, locked && styles.cockpitColumnLocked]}>
        {children}
      </View>
    </View>
  );
}

const MemoColumnShell = memo(ColumnShell);

function MissionControlDashboardComponent({
  locked = false,
  lockControl,
  header,
  emergency,
  left,
  center,
  right,
  footer,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  return (
    <View style={styles.cockpitRoot}>
      <ScrollView
        style={styles.cockpitScroll}
        contentContainerStyle={[
          styles.cockpitContent,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + BottomTabInset + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled>
        <View style={styles.cockpitTopBar}>
          <Text style={styles.cockpitBrand}>MISSION CONTROL</Text>
          <Text style={styles.cockpitBrandSub}>REJÄ° COCKPIT V23</Text>
          {locked ? (
            <View style={styles.cockpitLockRibbon}>
              <Text style={styles.cockpitLockRibbonText}>
                SYSTEM LOCKED â€” BLACKOUT ARMED
              </Text>
            </View>
          ) : (
            <View style={styles.cockpitLiveRibbon}>
              <Text style={styles.cockpitLiveRibbonText}>LIVE / STANDBY</Text>
            </View>
          )}
          {lockControl ? (
            <View style={styles.cockpitLockControl} pointerEvents="auto">
              {lockControl}
            </View>
          ) : null}
        </View>

        <View
          pointerEvents={locked ? 'none' : 'auto'}
          style={[
            styles.cockpitHeaderSlot,
            locked && styles.cockpitColumnLocked,
          ]}>
          {header}
        </View>

        {/* Panic bar â€” asla kolon kilidine girmez */}
        <View style={styles.cockpitEmergencySlot} pointerEvents="auto">
          {emergency}
        </View>

        <View
          style={[
            styles.cockpitGrid,
            wide ? styles.cockpitGridWide : styles.cockpitGridStack,
          ]}>
          <MemoColumnShell
            title="ALTYAPI Â· NETWORK / PTP / FAILOVER"
            accent="infra"
            locked={locked}>
            {left}
          </MemoColumnShell>

          <MemoColumnShell
            title="ÅOV YÃ–NETÄ°MÄ° Â· ZONE / MATRIX / CROWD / SWARM"
            accent="show"
            locked={locked}>
            {center}
          </MemoColumnShell>

          <MemoColumnShell
            title="TETÄ°KLEYÄ°CÄ° & LOG Â· MACRO / MIDI / BLACKBOX"
            accent="trigger"
            locked={locked}>
            {right}
          </MemoColumnShell>
        </View>

        {footer ? (
          <View
            pointerEvents={locked ? 'none' : 'auto'}
            style={[styles.cockpitFooter, locked && styles.cockpitColumnLocked]}>
            {footer}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

export const MissionControlDashboard = memo(MissionControlDashboardComponent);

