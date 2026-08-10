/**
 * Reji Kontrol Konsolu â€” V23 Mission Control Cockpit giriÅŸi.
 * State/efekt yok; tÃ¼m mantÄ±k `useRejiConsole` hookâ€™undan gelir.
 * Layout: MissionControlDashboard (sol / orta / saÄŸ).
 */

import { Alert, Platform, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

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
import { SpatialZoneMap } from './SpatialZoneMap';
import { SwarmMeshPanel } from './SwarmMeshPanel';
import { VirtualCrowdPanel } from './VirtualCrowdPanel';
import { RedundancyPanel } from './RedundancyPanel';
import { ChoreographyPanel } from './ChoreographyPanel';
import { MidiHardwarePanel } from './MidiHardwarePanel';
import { ThemeStrobePanel } from './ThemeStrobePanel';
import { EmojiPuzzlePanel } from './EmojiPuzzlePanel';
import { ShowFileBar } from './ShowFileBar';
import { ConsoleLockOverlay } from './ConsoleLockOverlay';
import { BlackoutBanner } from './BlackoutBanner';
import { NetworkConfigPanel } from './NetworkConfigPanel';
import { PresetPanel } from './PresetPanel';
import { RejiButton } from './RejiButton';
import { OutgoingPayloadMonitor } from './OutgoingPayloadMonitor';
import { StatusPanel } from './StatusPanel';
import { TelemetryStrip } from './TelemetryStrip';
import { SystemMetricsPanel } from './SystemMetricsPanel';
import { QuickMacrosPanel } from './QuickMacrosPanel';
import { VirtualStadium } from './VirtualStadium';
import { MissionControlDashboard } from './MissionControlDashboard';

export function RejiConsole() {
  const router = useRouter();
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
    systemHealth,
    activeQuickMacro,
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
    handleZoneToggle,
    handleZoneSelectAll,
    handleZoneClearAll,
    activeZones,
    zoneMask,
    zoneEditEnabled,
    isSwarmMeshActive,
    estimatedMeshNodes,
    swarmEngageEnabled,
    handleSwarmToggle,
    consoleRole,
    peerStatus,
    handlePromoteToMaster,
    handleSwitchToSlave,
    handleStandaloneConsole,
    matrixCommand,
    currentTheme,
    handleMatrixDraftChange,
    handleMatrixEngage,
    handleMatrixDisengage,
    handleSelectTheme,
    handleQuickMacro,
    handleThemeMixDelta,
    handleStrobeSensitivityDelta,
    handlePuzzlePreset,
    handleUploadAudienceTexture,
    handleOverlayEmoji,
    midiStatus,
    handleMidiConnect,
    handleMidiBeginLearn,
    handleMidiCancelLearn,
    handleMidiClearBinding,
    handleMidiResetBindings,
    timecodeStatus,
    macroSyncMode,
    handleSaveShowfile,
    handleLoadShowfile,
    handleToggleMacroSyncMode,
  } = consoleState;

  const linkStatus = normalizeLinkStatus(socketStatus);
  const socketOnline = linkStatus === 'CONNECTED';
  const socketLabel = formatSocketLabel(socketStatus, networkEndpoint);

  /** V23 â€” kilitliyken bile BLACKOUT ateÅŸlenebilir. */
  const canTriggerBlackout = criticalEnabled || isConsoleLocked || isBlackout;
  const opsEnabled = criticalEnabled && !isConsoleLocked;

  const requestBlackoutExit = () => {
    Alert.alert(
      'GÃ¼venli Moddan Ã‡Ä±kÄ±ÅŸ',
      'Sistem IDLE moda dÃ¶necek. OnaylÄ±yor musunuz?',
      [
        { text: 'Ä°ptal', style: 'cancel' },
        {
          text: 'Onayla',
          style: 'destructive',
          onPress: handleBlackoutClear,
        },
      ],
    );
  };

  const header = (
    <>
      <View style={styles.headerSecurityRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="OperatÃ¶r rolÃ¼"
          activeOpacity={0.75}
          disabled={isConsoleLocked}
          onPress={handleCycleOperatorRole}
          style={[styles.roleBadge, isConsoleLocked && styles.controlDisabled]}>
          <Text style={styles.roleBadgeText}>
            ROLE: {formatOperatorRoleLabel(securityLock.operatorRole)}
          </Text>
        </TouchableOpacity>
      </View>

      <BlackoutBanner visible={isBlackout} onRequestExit={requestBlackoutExit} />

      <View style={[styles.signalBox, { borderColor: signalBorder }]}>
        <View style={[styles.signalDot, { backgroundColor: signalAccent }]} />
        <Text style={styles.signalText}>{sistemDurumu}</Text>
        <Text style={styles.bpmDetail}>
          {effectiveBpm} BPM{isListeningAudio ? ' Â· AUTO' : ''}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={socketLabel}
          activeOpacity={0.75}
          disabled={isConsoleLocked}
          onPress={handleSocketReconnect}
          style={[
            styles.socketBadge,
            socketOnline && styles.socketBadgeOnline,
            linkStatus === 'CONNECTING' && styles.socketBadgeReconnect,
            linkStatus === 'FALLBACK_UDP' && styles.socketBadgeFallback,
            linkStatus === 'DISCONNECTED' && styles.socketBadgeOffline,
            isConsoleLocked && styles.controlDisabled,
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
        <Text style={[styles.feedbackText, { color: signalAccent }]}>
          {bildirim}
        </Text>
      </View>
    </>
  );

  const openStadiumSimulator = () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open('/simulator', '_blank', 'noopener,noreferrer');
        return;
      }
      router.push('/simulator');
    } catch {
      router.push('/simulator');
    }
  };

  const lockControl = (
    <View style={styles.cockpitLockStack}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Stadyum simÃ¼latÃ¶rÃ¼nÃ¼ aÃ§"
        activeOpacity={0.75}
        onPress={openStadiumSimulator}
        style={styles.simOpenBtn}>
        <Text style={styles.simOpenBtnText}>STADYUM SÄ°MÃœLATÃ–RÃœNÃœ AÃ‡</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={isConsoleLocked ? 'Kilit aÃ§' : 'Konsolu kilitle'}
        activeOpacity={0.75}
        onPress={handleRequestLockToggle}
        style={[
          styles.lockToggleBtn,
          isConsoleLocked && styles.lockToggleBtnLocked,
          { width: '100%' },
        ]}>
        <Text style={styles.lockToggleBtnText}>
          {isConsoleLocked ? 'KÄ°LÄ°T AÃ‡ (PIN)' : 'KONSOLU KÄ°LÄ°TLE'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const emergency = (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Emergency blackout"
      accessibilityState={{ selected: isBlackout, disabled: !canTriggerBlackout }}
      activeOpacity={0.8}
      disabled={!canTriggerBlackout}
      onPress={() => {
        if (!canTriggerBlackout) return;
        if (isBlackout) {
          requestBlackoutExit();
          return;
        }
        handleBlackoutActivate();
      }}
      style={[
        styles.cockpitEmergencyBtn,
        isBlackout && styles.cockpitEmergencyBtnActive,
      ]}>
      <Text style={styles.cockpitEmergencyText}>
        {isBlackout
          ? 'EMERGENCY BLACKOUT ACTIVE â€” TAP TO EXIT'
          : 'EMERGENCY BLACKOUT'}
      </Text>
    </TouchableOpacity>
  );

  const left = (
    <View style={styles.cockpitStackGap}>
      <NetworkConfigPanel
        config={networkConfig}
        linkStatus={linkStatus}
        endpoint={networkEndpoint}
        lastError={networkError}
        disabled={isBlackout || isConsoleLocked}
        onChangeHost={handleNetworkHostChange}
        onChangePort={handleNetworkPortChange}
        onToggleSecure={handleNetworkSecureToggle}
        onConnect={handleNetworkConnect}
        onDisconnect={handleNetworkDisconnect}
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
        isSwarmMeshActive={isSwarmMeshActive}
        estimatedMeshNodes={estimatedMeshNodes}
        consoleRole={consoleRole}
        peerStatus={peerStatus}
        timecodeStatus={timecodeStatus}
      />
      <SystemMetricsPanel health={systemHealth} isolated={isBlackout} />
      <QuickMacrosPanel
        activeMacroId={activeQuickMacro}
        disabled={isConsoleLocked}
        midiHints={{
          SUPER_GOL: 'Z1 Note 1 Â· Ch1',
          DROP_THE_BASS: 'Z1 Note 2 Â· Ch1',
          BLACKOUT_RESET: 'Z1 Note 3 Â· Ch1',
        }}
        onFire={handleQuickMacro}
      />
      <RedundancyPanel
        consoleRole={consoleRole}
        peerStatus={peerStatus}
        onPromoteToMaster={handlePromoteToMaster}
        onSwitchToSlave={handleSwitchToSlave}
        onStandalone={handleStandaloneConsole}
      />
      <ShowFileBar
        onSaveShow={handleSaveShowfile}
        onLoadShow={handleLoadShowfile}
        macroSyncMode={macroSyncMode}
        onToggleMacroSyncMode={handleToggleMacroSyncMode}
      />
      <ArtNetBridgePanel
        config={artNetConfig}
        stats={artNetStats}
        disabled={isBlackout || isConsoleLocked}
        onSelectUniverse={handleArtNetUniverseSelect}
        onCycleNet={handleArtNetCycleNet}
        onCycleSubnet={handleArtNetCycleSubnet}
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
    </View>
  );

  const center = (
    <View style={styles.cockpitStackGap}>
      <VirtualStadium
        beat={beat}
        timerRunning={timerRunning}
        isPaused={isPaused && timerHasTime}
        selectedTribun={selectedTribun}
        effectiveBpm={effectiveBpm}
        isBlackout={isBlackout}
      />

      <View style={[styles.timerPanel, timerHasTime && styles.timerPanelActive]}>
        <Text style={styles.timerLabel}>KALAN SÃœRE</Text>
        <Text style={[styles.timerValue, timerHasTime && styles.timerValueActive]}>
          {formatSure(kalanSure)}
        </Text>
      </View>

      {timerHasTime ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isPaused ? 'Devam Et' : 'Duraklat'}
          activeOpacity={0.75}
          disabled={isConsoleLocked}
          onPress={handlePauseToggle}
          style={[
            styles.overrideBtn,
            isPaused && styles.overrideBtnResume,
            isConsoleLocked && styles.controlDisabled,
          ]}>
          <Text style={styles.overrideBtnText}>
            {isPaused ? 'DEVAM ET' : 'DURAKLAT'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <SpatialZoneMap
        activeZones={activeZones}
        zoneMask={zoneMask}
        readOnly={!zoneEditEnabled || isConsoleLocked}
        onToggleZone={handleZoneToggle}
        onSelectAll={handleZoneSelectAll}
        onClearAll={handleZoneClearAll}
      />

      <ChoreographyPanel
        matrix={matrixCommand}
        disabled={isBlackout || isConsoleLocked}
        onChangeDraft={handleMatrixDraftChange}
        onEngage={handleMatrixEngage}
        onDisengage={handleMatrixDisengage}
      />

      <ThemeStrobePanel
        themeMix={matrixCommand.themeMix ?? 0}
        currentTheme={currentTheme}
        strobe={Boolean(matrixCommand.strobe)}
        strobeSensitivity={matrixCommand.strobeSensitivity ?? 0.55}
        micLevelDb={micLevelDb}
        audioListening={isListeningAudio}
        disabled={isBlackout || isConsoleLocked}
        onSelectTheme={handleSelectTheme}
        onThemeMixDelta={handleThemeMixDelta}
        onStrobeSensitivityDelta={handleStrobeSensitivityDelta}
      />

      <EmojiPuzzlePanel
        puzzlePreset={matrixCommand.puzzlePreset ?? 'none'}
        overlayEmoji={matrixCommand.overlayEmoji ?? null}
        waveAmplitude={matrixCommand.waveAmplitude ?? 1}
        audioDrive={matrixCommand.audioDrive ?? 0}
        audioListening={isListeningAudio}
        textureLabel={matrixCommand.textureId ?? null}
        disabled={isBlackout || isConsoleLocked}
        onSelectPreset={handlePuzzlePreset}
        onOverlayEmoji={handleOverlayEmoji}
        onUploadTexture={handleUploadAudienceTexture}
      />

      <VirtualCrowdPanel payload={lastPayload} />

      <SwarmMeshPanel
        isSwarmMeshActive={isSwarmMeshActive}
        estimatedMeshNodes={estimatedMeshNodes}
        disabled={(!swarmEngageEnabled && !isSwarmMeshActive) || isConsoleLocked}
        onToggle={handleSwarmToggle}
      />

      <View style={styles.block}>
        <Text style={styles.sectionLabel}>TRÄ°BÃœN SEÃ‡Ä°MÄ°</Text>
        <View style={styles.segmentRow}>
          {TRIBUNES.map((tribun) => {
            const active = selectedTribun === tribun.id;
            return (
              <TouchableOpacity
                key={tribun.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                activeOpacity={0.75}
                disabled={isConsoleLocked}
                onPress={() => handleTribunSelect(tribun.id)}
                style={[
                  styles.segmentBtn,
                  active && styles.segmentBtnActive,
                  isConsoleLocked && styles.controlDisabled,
                ]}>
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}>
                  {tribun.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionLabel}>HAZIR KOREOGRAFÄ° SENARYOLARI</Text>
        <View style={styles.scenarioList}>
          {SCENARIOS.map((scenario) => {
            const active = selectedScenario === scenario.id;
            return (
              <TouchableOpacity
                key={scenario.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                activeOpacity={0.75}
                disabled={!opsEnabled}
                onPress={() => handleScenarioSelect(scenario)}
                style={[
                  styles.scenarioCard,
                  active && styles.scenarioCardActive,
                  !opsEnabled && styles.controlDisabled,
                ]}>
                <Text
                  style={[
                    styles.scenarioTitle,
                    active && styles.scenarioTitleActive,
                  ]}>
                  {scenario.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <PresetPanel
        currentPreset={currentPreset}
        activeSlotId={activeSlotId}
        slots={presetSlots}
        disabled={isBlackout || isConsoleLocked}
        onLoadSlot={handleLoadPresetSlot}
        onSaveSlot={handleSavePresetSlot}
        onExport={() => {
          void handleExportPreset();
        }}
        onImport={() => {
          void handleImportPreset();
        }}
      />
    </View>
  );

  const right = (
    <View style={styles.cockpitStackGap}>
      <MacroTimelinePanel
        isRecording={isRecordingMacro}
        isPlaying={isPlayingMacro}
        eventCount={macroSequence.events.length}
        progress={macroProgress}
        disabledRecord={!macroRecordEnabled || isConsoleLocked}
        disabledPlay={!macroPlayEnabled || isConsoleLocked}
        onRecord={handleMacroRecord}
        onStop={handleMacroStop}
        onPlay={handleMacroPlay}
      />

      <MidiHardwarePanel
        status={midiStatus}
        onConnect={handleMidiConnect}
        onBeginLearn={handleMidiBeginLearn}
        onCancelLearn={handleMidiCancelLearn}
        onClearBinding={handleMidiClearBinding}
        onResetBindings={handleMidiResetBindings}
      />

      <View style={styles.actionsSection}>
        {ACTIONS.map((action) => (
          <View
            key={action.id}
            pointerEvents={opsEnabled ? 'auto' : 'none'}
            style={!opsEnabled ? styles.controlDisabled : undefined}>
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

      <View style={styles.metricsSection}>
        <View
          style={[
            styles.metricPanel,
            timerRunning && styles.metricPanelLiveRed,
            !timerHasTime && isSync && styles.metricPanelSync,
          ]}>
          <Text style={styles.metricLabel}>Sinyal Gecikmesi</Text>
          <Text
            style={[
              styles.metricValue,
              timerRunning && styles.metricValueLive,
            ]}>
            {sinyalGecikmesi}ms
          </Text>
        </View>
        <View
          style={[
            styles.metricPanel,
            timerRunning && styles.metricPanelLiveGreen,
            !timerHasTime && isSync && styles.metricPanelSync,
          ]}>
          <Text style={styles.metricLabel}>BaÄŸlÄ± TribÃ¼n ModÃ¼lÃ¼</Text>
          <Text
            style={[
              styles.metricValue,
              timerRunning && styles.metricValueLiveGreen,
            ]}>
            {timerHasTime
              ? isPaused
                ? 'DURAKLATILDI'
                : '%100 CANLI'
              : isSync
                ? '%92'
                : '%100'}
          </Text>
        </View>
      </View>

      <View style={styles.bpmCard}>
        <Text style={styles.sectionLabel}>RÄ°TÄ°M HIZI (BPM)</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: isListeningAudio }}
          activeOpacity={0.75}
          disabled={isConsoleLocked}
          onPress={() => {
            void handleAudioListenToggle();
          }}
          style={[
            styles.audioListenBtn,
            isListeningAudio && styles.audioListenBtnActive,
            isConsoleLocked && styles.controlDisabled,
          ]}>
          <Text
            style={[
              styles.audioListenBtnText,
              isListeningAudio && styles.audioListenBtnTextActive,
            ]}>
            {isListeningAudio
              ? `CANLI SESÄ° DÄ°NLE (AUTO BPM) Â· ${detectedBpm}`
              : 'CANLI SESÄ° DÄ°NLE (AUTO BPM)'}
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
                  {
                    width: `${Math.round(normalizeMicLevel(micLevelDb) * 100)}%`,
                  },
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
                disabled={isConsoleLocked}
                onPress={() => handleBpmSelect(value)}
                style={[
                  styles.bpmBtn,
                  active && styles.bpmBtnActive,
                  isConsoleLocked && styles.controlDisabled,
                ]}>
                <Text
                  style={[
                    styles.bpmBtnText,
                    active && styles.bpmBtnTextActive,
                  ]}>
                  {value === DEFAULT_BPM
                    ? `${value} BPM (VarsayÄ±lan)`
                    : `${value} BPM`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <OutgoingPayloadMonitor
        payload={lastPayload}
        deliveryStatus={deliveryStatus}
        transport={lastTxTransport}
      />

      <DiagnosticsTerminal
        logs={blackboxTerminalLogs}
        eventCount={blackboxEventCount}
        onExport={handleExportMatchReport}
      />
    </View>
  );

  return (
    <View style={styles.cockpitRoot}>
      <StatusBar style="light" />
      <MissionControlDashboard
        locked={isConsoleLocked}
        lockControl={lockControl}
        header={header}
        emergency={emergency}
        left={left}
        center={center}
        right={right}
      />

      {/* PIN yalnÄ±zca kilit aÃ§/kapat promptâ€™unda; LOCKED cockpit gri kalÄ±r */}
      <ConsoleLockOverlay
        visible={lockPinPrompt !== null}
        pinError={pinError}
        showCancel={lockPinPrompt === 'lock' && !isConsoleLocked}
        onSubmitPin={handleSubmitLockPin}
        onDismissError={handleDismissPinError}
        onCancel={handleCancelLockPrompt}
      />
    </View>
  );
}

export { MissionControlDashboard } from './MissionControlDashboard';



