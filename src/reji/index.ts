/**
 * Reji Kontrol Konsolu — genel dışa aktarım yüzeyi.
 */

export { RejiConsole } from './components/RejiConsole';
export { MissionControlDashboard } from './components/MissionControlDashboard';
export { useRejiConsole } from './hooks/useRejiConsole';
export { buildBlackoutPayload } from './safety';
export {
  buildOutgoingPayload,
  createIdlePayload,
  mapTribunToZone,
} from './payload';
export {
  DEFAULT_PTP_NETWORK_BUFFER_MS,
  PTP_EMERGENCY_BUFFER_MS,
  computeTargetTimestamp,
  computeEmergencyTargetTimestamp,
  resolveNetworkBufferMs,
  formatPtpTargetLabel,
} from './ptpBroadcast';
export type { PtpBroadcastMeta } from './ptpBroadcast';
export {
  scheduleAtPtp,
  scheduleCueList,
  measureScheduleError,
} from './clientScheduler';
export type { ScheduledHandle, ScheduleAtOptions } from './clientScheduler';
export {
  OfflineResilienceEngine,
  createMemoryStorageAdapter,
  serializeOfflineTimeline,
  parseOfflineTimeline,
  OFFLINE_TIMELINE_STORAGE_KEY,
} from './offlineResilience';
export type {
  OfflineTimelineCue,
  OfflineShowTimeline,
  OfflineResilienceStatus,
  OfflineStorageAdapter,
} from './offlineResilience';
export {
  InMemoryEventBus,
} from './eventBus';
export type { EventBus, EventBusMessage, EventBusHandler, EventBusStats } from './eventBus';
export {
  ScaleWorker,
  ScaleCluster,
  tribuneToRoom,
  roomToTribune,
  roomsForOutgoingTarget,
  TRIBUNE_ROOMS,
  ROOM_ALL,
} from './roomSharding';
export type { ShardRoomId, WorkerStats, ScaleClusterStats } from './roomSharding';
export {
  computeReconnectDelayMs,
  computeEqualJitterDelayMs,
  scheduleReconnectAt,
  analyzeReconnectSpread,
  ReconnectBackoffController,
  DEFAULT_BACKOFF_BASE_MS,
  DEFAULT_BACKOFF_CAP_MS,
} from './reconnectBackoff';
export type { BackoffOptions } from './reconnectBackoff';
export {
  buildClientStubs,
  applyThunderingHerdReconnect,
  runScaleFanoutSimulation,
  buildGolPayload,
  SCALE_TARGET_CLIENTS,
  SCALE_DEFAULT_WORKERS,
} from './scaleCluster';
export type { ScaleClientStub } from './scaleCluster';
export { StadiumClientRuntime } from './stadiumClientRuntime';
export type {
  AppliedClientCommand,
  StadiumClientHandlers,
} from './stadiumClientRuntime';
export { StadiumVisualizerScreen } from './components/StadiumVisualizer';
export {
  publishStadiumLive,
  subscribeStadiumLive,
  getLastStadiumLiveFrame,
  STADIUM_LIVE_CHANNEL,
} from './stadiumLiveBus';
export type { StadiumLiveFrame } from './stadiumLiveBus';
export {
  StadiumVisualizerEngine,
  buildVisualizerPhones,
  drawVisualizerFrame,
  VISUALIZER_PHONE_COUNT,
} from './stadiumVisualizerEngine';
export type { VisualizerPhone } from './stadiumVisualizerEngine';
export {
  getRuntimeEnv,
  getJwtSecret,
  getJwtTtlMs,
  getRedisUrl,
  getHttpPort,
  getWsPath,
  getPublicWsHost,
  getPublicWsPort,
  getPublicWsSecure,
  getPtpNetworkBufferMs,
  getPtpEmergencyBufferMs,
  getPtpBufferMinMs,
  getPtpBufferMaxMs,
  getPingIntervalMs,
  getPongTimeoutMs,
  getWorkerId,
  getAdminBootstrapKey,
  getUdpMulticastGroup,
  getUdpMulticastPort,
  getPublicConfigSnapshot,
} from './runtimeConfig';
export {
  issueAccessToken,
  verifyAccessToken,
  authorizeAdminCommand,
  authorizeClientConnect,
  isAdminOnlyAction,
  formatRoleLabel,
  ADMIN_ONLY_ACTIONS,
  DEFAULT_AUTH_SECRET,
  DEFAULT_TOKEN_TTL_MS,
  resolveAuthSecret,
} from './connectionAuth';
export type {
  ConnectionRole,
  AuthClaims,
  TokenVerifyResult,
  AuthGateResult,
} from './connectionAuth';
export {
  ZombiePurgeRegistry,
  DEFAULT_PING_INTERVAL_MS,
  DEFAULT_PONG_TIMEOUT_MS,
} from './zombiePurge';
export type { ConnectionHeartbeat, PurgeResult } from './zombiePurge';
export {
  DEFAULT_SYSTEM_HEALTH,
  buildWorkerLoads,
  estimateJitterMs,
  formatDisconnectedRate,
  formatHealthLine,
} from './systemHealth';
export type { SystemHealthSnapshot, WorkerLoadMetric } from './systemHealth';
export { SecureScaleGateway } from './secureGateway';
export type {
  GatewaySession,
  SecureConnectResult,
  SecurePublishResult,
} from './secureGateway';
export { SystemMetricsPanel } from './components/SystemMetricsPanel';
export {
  QUICK_MACROS,
  SUPER_GOL_STROBE_MS,
  MACRO_SPEED_FULL,
  MACRO_SPEED_BASE_50,
  buildQuickMacroMatrix,
  formatQuickMacroLabel,
  getQuickMacro,
  quickMacroOutgoingAction,
} from './quickMacros';
export type { QuickMacroId, QuickMacroDef } from './quickMacros';
export { QuickMacrosPanel } from './components/QuickMacrosPanel';
export {
  SeatOnboardingAuth,
  seatToPixel,
  seatKeyOf,
  pixelKeyOf,
  parseTribuneLabel,
  ticketFromLabels,
  enumerateUniqueTickets,
  stadiumSeatCapacity,
  validateSeatTicket,
  TRIBUNE_BANDS,
  TRIBUNE_LABEL_TR,
} from './seatPixelMap';
export type {
  SeatTicket,
  SeatMapping,
  PixelCoord,
  SeatAuthResult,
  StadiumTribuneId,
  TribuneBandLayout,
} from './seatPixelMap';
export {
  sliceVisualForDevice,
  samplePuzzlePixelAt,
  rgbEquals,
} from './visualSlicer';
export type { SlicedPixelFrame, VisualSlicerInput } from './visualSlicer';

export { formatDeliveryLabel, formatSocketLabel, formatTransportLabel, randomAckDelayMs } from './socket';
export {
  isHapticMotorActive,
  triggerImpact,
  triggerRhythmPulse,
  triggerErrorHaptic,
  triggerSelection,
} from './haptics';
export {
  nextDetectedBpm,
  nextMicLevelDb,
  normalizeMicLevel,
  requestMicAccessSafe,
} from './audioBeat';
export {
  buildCurrentPreset,
  createDefaultPresetStore,
  deserializePreset,
  loadPresetStore,
  savePresetStore,
  serializePreset,
} from './preset';
export {
  DEFAULT_TELEMETRY_STATS,
  formatActiveNodes,
  formatNetworkStability,
  nextTelemetryStats,
} from './telemetry';
export type { TelemetryStats } from './telemetry';
export {
  CLOCK_SYNC_INTERVAL_MS,
  DEFAULT_CLOCK_SYNC_STATS,
  DRIFT_THRESHOLD_MS,
  formatClockOffset,
  formatPtpClockLabel,
  getClockSync,
  getSyncedTimestamp,
  getSyncedUnixSeconds,
  PrecisionClockEngine,
} from './clockSync';
export type { ClockSyncStats, ClockSyncStatus } from './clockSync';
export {
  ARTNET_BROADCAST_FPS,
  ARTNET_UNIVERSES,
  DEFAULT_ARTNET_CONFIG,
  DEFAULT_ARTNET_STATS,
  formatArtNetStatusLabel,
  generateArtNetBundle,
  getArtNetEngine,
} from './artnetEngine';
export type {
  ArtNetBridgeStats,
  ArtNetConfig,
  ArtNetUniverseId,
} from './artnetEngine';
export {
  canManageLock,
  canOperateCritical,
  DEFAULT_OPERATOR_PIN,
  DEFAULT_SECURITY_LOCK,
  formatAuthStatusLabel,
  formatOperatorRoleLabel,
  verifyOperatorPin,
} from './securityLock';
export type { OperatorRole, SecurityLockState } from './securityLock';
export {
  DEFAULT_OFFLINE_QUEUE_STATS,
  formatOfflineQueueLabel,
  OfflineQueueEngine,
  shouldEnqueueOffline,
} from './offlineQueue';
export type { OfflineQueueItem, OfflineQueueStats } from './offlineQueue';
export {
  canPlayMacro,
  canRecordMacro,
  EMPTY_MACRO,
  TimelineSequencer,
} from './timelineSequencer';
export type {
  MacroEvent,
  MacroSequence,
  MacroActionType,
} from './timelineSequencer';
export {
  BLACKBOX_MAX_ENTRIES,
  BLACKBOX_TERMINAL_LINES,
  BlackboxEngine,
  buildMatchReport,
  classifyBlackboxMessage,
  formatBlackboxTerminalLine,
  serializeMatchReportCsv,
  serializeMatchReportJson,
} from './blackbox';
export type {
  BlackboxCategory,
  BlackboxEntry,
  MatchReport,
  SessionTelemetrySummary,
} from './blackbox';
export {
  ZONE_BIT,
  SPATIAL_ZONES,
  DEFAULT_ACTIVE_ZONES,
  DEFAULT_ZONE_MASK,
  computeZoneMask,
  zonesFromMask,
  toggleActiveZone,
  formatZoneLabel,
  formatZoneMaskBinary,
  deviceMatchesZoneMask,
  buildZoneChangedMessage,
  canEditZones,
} from './zoneManager';
export type { SpatialZoneId } from './zoneManager';
export {
  canEngageSwarm,
  formatMeshStatusLabel,
  buildSwarmEngagedMessage,
  buildSwarmDisengagedMessage,
  nextEstimatedMeshNodes,
  initialEstimatedMeshNodes,
  SWARM_MESH_NODES_IDLE,
} from './swarmCommander';
export type { SwarmMeshStatus } from './swarmCommander';
export {
  VIRTUAL_CROWD_SIZE,
  VIRTUAL_CROWD_COLS,
  VIRTUAL_CROWD_ROWS,
  VirtualCrowdEngine,
  formatCrowdLatency,
} from './virtualCrowd';
export type {
  VirtualNode,
  CrowdSimMetrics,
  CrowdSimSnapshot,
} from './virtualCrowd';
export {
  HEARTBEAT_INTERVAL_MS,
  MASTER_TIMEOUT_MS,
  FAILOVER_BLACKBOX_MSG,
  RedundancyEngine,
  createConsoleId,
  formatConsoleRoleBadge,
  isRedundancyPacket,
} from './redundancyEngine';
export type {
  ConsoleRole,
  PeerStatus,
  RedundancySyncState,
} from './redundancyEngine';
export {
  buildMatrixCommand,
  buildMatrixEngagedMessage,
  createIdleMatrixCommand,
  evaluatePixel,
  fillPreviewBuffer,
  formatMatrixEffectLabel,
  normalizeMatrixCommand,
  MATRIX_EFFECTS,
  PIXEL_GRID_W,
  PIXEL_GRID_H,
  PREVIEW_GRID,
} from './pixelMapper';
export type { MatrixCommand, MatrixEffect } from './pixelMapper';
export {
  VISUAL_THEMES,
  THEME_ORDER,
  interpolateTheme,
  resolveCurrentTheme,
  formatThemeLabel,
  ccToThemeMix,
  ccToStrobeSensitivity,
  shouldTriggerStrobe,
  strobeThresholdDb,
  themeIdToMix,
} from './visualThemes';
export type { VisualThemeId, ThemePalette, InterpolatedTheme } from './visualThemes';
export { ThemeStrobePanel } from './components/ThemeStrobePanel';
export { EmojiPuzzlePanel } from './components/EmojiPuzzlePanel';
export {
  PUZZLE_PRESETS,
  OVERLAY_EMOJI_QUICK,
  formatPuzzlePresetLabel,
  micEnergyToWaveSync,
  sampleTurkishFlag,
  sampleClubCup,
} from './puzzleChoreography';
export type { PuzzlePresetId, PuzzlePreset } from './puzzleChoreography';
export {
  MIDI_LEARN_TARGETS,
  DEFAULT_MIDI_BINDINGS,
  TRAKTOR_Z1_BINDINGS,
  TRAKTOR_Z1_NOTE_TARGETS,
  MidiControllerEngine,
  buildMidiTriggeredMessage,
  ccToMatrixSpeed,
  ccToMatrixIntensity,
  formatMidiTargetLabel,
  formatMidiBinding,
  formatMidiHardwareProfile,
  isMidiAllowedWhenLocked,
  isMidiSupported,
  isTraktorHardware,
} from './midiController';
export type {
  MidiTarget,
  MidiBinding,
  MidiControllerStatus,
  MidiHardwareProfile,
} from './midiController';
export {
  createTimecodeStatus,
  formatSmpte,
  smpteToMs,
  msToSmpte,
  TimecodeEngine,
  DEFAULT_SMPTE_FPS,
} from './timecode';
export type { SmpteTime, TimecodeStatus } from './timecode';
export {
  buildPulseShowfile,
  parsePulseShowfile,
  serializePulseShowfile,
  suggestPulseFileName,
  buildShowfileLoadedMessage,
  PULSE_SHOW_EXT,
} from './showfileManager';
export type { PulseShowfile } from './showfileManager';
export {
  buildWebSocketUrl,
  DEFAULT_NETWORK_CONFIG,
  getNetworkEngine,
  loadNetworkConfig,
  NetworkEngine,
  saveNetworkConfig,
  UDP_MULTICAST_GROUP,
  UDP_MULTICAST_PORT,
} from './networkEngine';
export type {
  NetworkConfig,
  NetworkLinkStatus,
  NetworkSendResult,
  NetworkTransport,
} from './networkEngine';
export * from './types';
export * from './constants';
