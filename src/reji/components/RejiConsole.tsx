/**
 * Reji Kontrol Konsolu V1.0 — ana UI kompozisyonu.
 * State/efekt yok; tüm mantık `useRejiConsole` hook’undan gelir.
 */

import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';

import { normalizeMicLevel } from '../audioBeat';
import {
  ACTIONS,
  BPM_OPTIONS,
  DEFAULT_BPM,
  SCENARIOS,
  TRIBUNES,
} from '../constants';
import { useRejiConsole } from '../hooks/useRejiConsole';
import { formatSocketLabel, normalizeLinkStatus } from '../socket';
import { rejiStyles as styles } from '../styles';
import { formatOperatorRoleLabel } from '../securityLock';
import { formatSure } from '../utils';
import { ArtNetBridgePanel } from './ArtNetBridgePanel';
import { MacroTimelinePanel } from './MacroTimelinePanel';
import { DiagnosticsTerminal } from './DiagnosticsTerminal';
import { ConsoleLockOverlay } from './ConsoleLockOverlay';
import { BlackoutBanner } from './BlackoutBanner';
import { NetworkConfigPanel } from './NetworkConfigPanel';
import { PresetPanel } from './PresetPanel';
import { RejiButton } from './RejiButton';
import { OutgoingPayloadMonitor } from './OutgoingPayloadMonitor';
import { StatusPanel } from './StatusPanel';
import { TelemetryStrip } from './TelemetryStrip';
import { VirtualStadium } from './VirtualStadium';

export function RejiConsole() {
  const insets = useSafeAreaInsets();
  const consoleState = useRejiConsole();

  const {
    sistemDurumu,
    bildirim,
    selectedTribun,
    selectedScenario,
    kalanSure,
    sinyalGecikmesi,
    isPaused,
    bpm,
    beat,
    logs,
    lastPayload,
    socketStatus,
    deliveryStatus,
    isListeningAudio,
    detectedBpm,
    micLevelDb,
    isBlackout,
    currentPreset,
    activeSlotId,
    presetSlots,
    telemetryStats,
    clockSyncStats,
    artNetConfig,
    artNetStats,
    securityLock,
    isConsoleLocked,
    pinError,
    lockPinPrompt,
    criticalEnabled,
    offlineQueuePending,
    isRecordingMacro,
    isPlayingMacro,
    macroSequence,
    macroProgress,
    macroRecordEnabled,
    macroPlayEnabled,
    networkConfig,
    networkEndpoint,
    networkTransport,
    networkError,
    lastTxTransport,
    effectiveBpm,
    timerHasTime,
    timerRunning,
    isSync,
    signalAccent,
    signalBorder,
    handlePauseToggle,
    handleAction,
    handleTribunSelect,
    handleScenarioSelect,
    handleBpmSelect,
    handleAudioListenToggle,
    handleBlackoutActivate,
    handleBlackoutClear,
    handleSocketDisconnectSim,
    handleSocketReconnect,
    handleNetworkHostChange,
    handleNetworkPortChange,
    handleNetworkSecureToggle,
    handleNetworkConnect,
    handleNetworkDisconnect,
    handleLoadPresetSlot,
    handleSavePresetSlot,
    handleExportPreset,
    handleImportPreset,
    handleArtNetUniverseSelect,
    handleArtNetCycleNet,
    handleArtNetCycleSubnet,
    handleRequestLockToggle,
    handleSubmitLockPin,
    handleDismissPinError,
    handleCancelLockPrompt,
    handleCycleOperatorRole,
    handleMacroRecord,
    handleMacroStop,
    handleMacroPlay,
    blackboxEventCount,
    blackboxTerminalLogs,
    handleExportMatchReport,
  } = consoleState;

  const linkStatus = normalizeLinkStatus(socketStatus);
  const socketOnline = linkStatus === 'CONNECTED';
  const socketLabel = formatSocketLabel(socketStatus, networkEndpoint);

  const requestBlackoutExit = () => {
    Alert.alert(
      'Güvenli Moddan Çıkış',
      'Sistem IDLE moda dönecek. Onaylıyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Onayla',
          style: 'destructive',
          onPress: handleBlackoutClear,
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + BottomTabInset + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Üst durum + sanal stadyum + sayaç */}
        <View style={styles.statusSection}>
          <Text style={styles.title}>REJİ CANLI SİSTEMİ</Text>

          <View style={styles.headerSecurityRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Operatör rolü"
              activeOpacity={0.75}
              disabled={isConsoleLocked}
              onPress={handleCycleOperatorRole}
              style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                ROLE: {formatOperatorRoleLabel(securityLock.operatorRole)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={isConsoleLocked ? 'Kilit aç' : 'Konsolu kilitle'}
              activeOpacity={0.75}
              onPress={handleRequestLockToggle}
              style={[styles.lockToggleBtn, isConsoleLocked && styles.lockToggleBtnLocked]}>
              <Text style={styles.lockToggleBtnText}>
                {isConsoleLocked ? 'KİLİT AÇ' : 'KONSOLU KİLİTLE'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: isBlackout }}
            activeOpacity={0.75}
            disabled={!criticalEnabled && !isBlackout}
            onPress={() => {
              if (!criticalEnabled && !isBlackout) return;
              if (isBlackout) {
                requestBlackoutExit();
                return;
              }
              handleBlackoutActivate();
            }}
            style={[
              styles.blackoutBtn,
              isBlackout && styles.blackoutBtnActive,
              !criticalEnabled && !isBlackout && styles.controlDisabled,
            ]}>
            <Text style={styles.blackoutBtnText}>
              {isBlackout ? 'BLACKOUT ACTIVE — ÇIKIŞ İÇİN DOKUN' : 'ACİL DURUM / BLACKOUT'}
            </Text>
          </TouchableOpacity>

          <BlackoutBanner visible={isBlackout} onRequestExit={requestBlackoutExit} />

          <VirtualStadium
            beat={beat}
            timerRunning={timerRunning}
            isPaused={isPaused && timerHasTime}
            selectedTribun={selectedTribun}
            effectiveBpm={effectiveBpm}
            isBlackout={isBlackout}
          />

          <View style={[styles.signalBox, { borderColor: signalBorder }]}>
            <View style={[styles.signalDot, { backgroundColor: signalAccent }]} />
            <Text style={styles.signalText}>{sistemDurumu}</Text>
            <Text style={styles.bpmDetail}>
              {effectiveBpm} BPM{isListeningAudio ? ' · AUTO' : ''}
            </Text>

            {/* V2.1 — WebSocket bağlantı göstergesi; dokununca reconnect */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={socketLabel}
              activeOpacity={0.75}
              onPress={handleSocketReconnect}
              style={[
                styles.socketBadge,
                socketOnline && styles.socketBadgeOnline,
                linkStatus === 'CONNECTING' && styles.socketBadgeReconnect,
                linkStatus === 'FALLBACK_UDP' && styles.socketBadgeFallback,
                linkStatus === 'DISCONNECTED' && styles.socketBadgeOffline,
              ]}>
              <View
                style={[
                  styles.socketDot,
                  socketOnline && styles.socketDotOnline,
                  linkStatus === 'CONNECTING' && styles.socketDotReconnect,
                  linkStatus === 'FALLBACK_UDP' && styles.socketDotFallback,
                  linkStatus === 'DISCONNECTED' && styles.socketDotOffline,
                ]}
              />
              <Text
                style={[
                  styles.socketText,
                  socketOnline && styles.socketTextOnline,
                  linkStatus === 'FALLBACK_UDP' && styles.socketTextFallback,
                  linkStatus === 'DISCONNECTED' && styles.socketTextOffline,
                ]}>
                {socketLabel}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.feedbackText, { color: signalAccent }]}>{bildirim}</Text>
          </View>

          <View style={[styles.timerPanel, timerHasTime && styles.timerPanelActive]}>
            <Text style={styles.timerLabel}>KALAN SÜRE</Text>
            <Text style={[styles.timerValue, timerHasTime && styles.timerValueActive]}>
              {formatSure(kalanSure)}
            </Text>
          </View>

          {/* Manuel override yalnızca timer oturumu varken görünür */}
          {timerHasTime ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={isPaused ? 'Devam Et' : 'Duraklat'}
              activeOpacity={0.75}
              onPress={handlePauseToggle}
              style={[styles.overrideBtn, isPaused && styles.overrideBtnResume]}>
              <Text style={styles.overrideBtnText}>
                {isPaused ? 'DEVAM ET' : 'DURAKLAT'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tribün filtresi */}
        <View style={styles.block}>
          <Text style={styles.sectionLabel}>TRİBÜN SEÇİMİ</Text>
          <View style={styles.segmentRow}>
            {TRIBUNES.map((tribun) => {
              const active = selectedTribun === tribun.id;
              return (
                <TouchableOpacity
                  key={tribun.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  activeOpacity={0.75}
                  onPress={() => handleTribunSelect(tribun.id)}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}>
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {tribun.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Hazır senaryolar */}
        <View style={styles.block}>
          <Text style={styles.sectionLabel}>HAZIR KOREOGRAFİ SENARYOLARI</Text>
          <View style={styles.scenarioList}>
            {SCENARIOS.map((scenario) => {
              const active = selectedScenario === scenario.id;
              return (
                <TouchableOpacity
                  key={scenario.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  activeOpacity={0.75}
                  disabled={!criticalEnabled}
                  onPress={() => handleScenarioSelect(scenario)}
                  style={[
                    styles.scenarioCard,
                    active && styles.scenarioCardActive,
                    !criticalEnabled && styles.controlDisabled,
                  ]}>
                  <Text style={[styles.scenarioTitle, active && styles.scenarioTitleActive]}>
                    {scenario.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* V7.0 — Senaryo profil hafızası + JSON export/import */}
        <PresetPanel
          currentPreset={currentPreset}
          activeSlotId={activeSlotId}
          slots={presetSlots}
          disabled={isBlackout}
          onLoadSlot={handleLoadPresetSlot}
          onSaveSlot={handleSavePresetSlot}
          onExport={() => {
            void handleExportPreset();
          }}
          onImport={() => {
            void handleImportPreset();
          }}
        />

        <NetworkConfigPanel
          config={networkConfig}
          linkStatus={linkStatus}
          endpoint={networkEndpoint}
          lastError={networkError}
          disabled={isBlackout}
          onChangeHost={handleNetworkHostChange}
          onChangePort={handleNetworkPortChange}
          onToggleSecure={handleNetworkSecureToggle}
          onConnect={handleNetworkConnect}
          onDisconnect={handleNetworkDisconnect}
        />

        <ArtNetBridgePanel
          config={artNetConfig}
          stats={artNetStats}
          disabled={isBlackout}
          onSelectUniverse={handleArtNetUniverseSelect}
          onCycleNet={handleArtNetCycleNet}
          onCycleSubnet={handleArtNetCycleSubnet}
        />

        <MacroTimelinePanel
          isRecording={isRecordingMacro}
          isPlaying={isPlayingMacro}
          eventCount={macroSequence.events.length}
          progress={macroProgress}
          disabledRecord={!macroRecordEnabled}
          disabledPlay={!macroPlayEnabled}
          onRecord={handleMacroRecord}
          onStop={handleMacroStop}
          onPlay={handleMacroPlay}
        />

        {/* Ana reji aksiyonları */}
        <View style={styles.actionsSection}>
          {ACTIONS.map((action) => (
            <View
              key={action.id}
              pointerEvents={criticalEnabled ? 'auto' : 'none'}
              style={!criticalEnabled ? styles.controlDisabled : undefined}>
              <RejiButton
                label={action.label}
                colors={action.colors}
                onPress={() => handleAction(action.id)}
                onLongPress={
                  action.id === 'reset' ? handleSocketDisconnectSim : undefined
                }
              />
            </View>
          ))}
        </View>

        {/* Anlık metrik panelleri */}
        <View style={styles.metricsSection}>
          <View
            style={[
              styles.metricPanel,
              timerRunning && styles.metricPanelLiveRed,
              !timerHasTime && isSync && styles.metricPanelSync,
            ]}>
            <Text style={styles.metricLabel}>Sinyal Gecikmesi</Text>
            <Text style={[styles.metricValue, timerRunning && styles.metricValueLive]}>
              {sinyalGecikmesi}ms
            </Text>
          </View>
          <View
            style={[
              styles.metricPanel,
              timerRunning && styles.metricPanelLiveGreen,
              !timerHasTime && isSync && styles.metricPanelSync,
            ]}>
            <Text style={styles.metricLabel}>Bağlı Tribün Modülü</Text>
            <Text style={[styles.metricValue, timerRunning && styles.metricValueLiveGreen]}>
              {timerHasTime ? (isPaused ? 'DURAKLATILDI' : '%100 CANLI') : isSync ? '%92' : '%100'}
            </Text>
          </View>
        </View>

        {/* BPM hız seçimi + V4.0 canlı ses dinleyici */}
        <View style={styles.bpmCard}>
          <Text style={styles.sectionLabel}>RİTİM HIZI (BPM)</Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: isListeningAudio }}
            activeOpacity={0.75}
            onPress={() => {
              void handleAudioListenToggle();
            }}
            style={[styles.audioListenBtn, isListeningAudio && styles.audioListenBtnActive]}>
            <Text
              style={[
                styles.audioListenBtnText,
                isListeningAudio && styles.audioListenBtnTextActive,
              ]}>
              {isListeningAudio
                ? `CANLI SESİ DİNLE (AUTO BPM) · ${detectedBpm}`
                : 'CANLI SESİ DİNLE (AUTO BPM)'}
            </Text>
          </TouchableOpacity>

          {isListeningAudio ? (
            <View style={styles.autoBpmHint}>
              <Text style={styles.autoBpmHintText}>AUTO AUDIO SYNC: ON</Text>
              <Text style={styles.micLevelLabel}>
                MIC INPUT LEVEL (dB): {micLevelDb.toFixed(1)}
              </Text>
              <View style={styles.micBarTrack}>
                <View
                  style={[
                    styles.micBarFill,
                    { width: `${Math.round(normalizeMicLevel(micLevelDb) * 100)}%` },
                  ]}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.bpmRow}>
            {BPM_OPTIONS.map((value) => {
              const active = !isListeningAudio && bpm === value;
              return (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  activeOpacity={0.75}
                  onPress={() => handleBpmSelect(value)}
                  style={[styles.bpmBtn, active && styles.bpmBtnActive]}>
                  <Text style={[styles.bpmBtnText, active && styles.bpmBtnTextActive]}>
                    {value === DEFAULT_BPM ? `${value} BPM (Varsayılan)` : `${value} BPM`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* V2.0 canlı outgoing JSON + log/rozet paneli */}
        <OutgoingPayloadMonitor
          payload={lastPayload}
          deliveryStatus={deliveryStatus}
          transport={lastTxTransport}
        />
        <StatusPanel
          logs={logs}
          hapticPulseActive={timerRunning}
          isListeningAudio={isListeningAudio}
          micLevelDb={micLevelDb}
          networkStatus={linkStatus}
          networkEndpoint={networkEndpoint}
          networkTransport={networkTransport}
          networkError={networkError}
          clockSyncStats={clockSyncStats}
          artNetStats={artNetStats}
          securityLock={securityLock}
          offlineQueuePending={offlineQueuePending}
        />
        <TelemetryStrip
          stats={telemetryStats}
          isolated={isBlackout}
          linkStatus={linkStatus}
          transport={networkTransport}
          clockSyncStats={clockSyncStats}
          artNetStats={artNetStats}
          securityLock={securityLock}
          offlineQueuePending={offlineQueuePending}
        />

        <DiagnosticsTerminal
          logs={blackboxTerminalLogs}
          eventCount={blackboxEventCount}
          onExport={handleExportMatchReport}
        />
      </ScrollView>

      <ConsoleLockOverlay
        visible={isConsoleLocked || lockPinPrompt !== null}
        pinError={pinError}
        showCancel={lockPinPrompt === 'lock' && !isConsoleLocked}
        onSubmitPin={handleSubmitLockPin}
        onDismissError={handleDismissPinError}
        onCancel={handleCancelLockPrompt}
      />
    </View>
  );
}
