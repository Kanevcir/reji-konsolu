/**
 * Reji Kontrol Konsolu — genel dışa aktarım yüzeyi.
 */

export { RejiConsole } from './components/RejiConsole';
export { useRejiConsole } from './hooks/useRejiConsole';
export { buildBlackoutPayload } from './safety';
export { buildOutgoingPayload, createIdlePayload, mapTribunToZone } from './payload';
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
  PIXEL_GRID_W,
  PIXEL_GRID_H,
  PREVIEW_GRID,
  MATRIX_EFFECTS,
  buildMatrixCommand,
  buildMatrixEngagedMessage,
  createIdleMatrixCommand,
  evaluatePixel,
  fillPreviewBuffer,
  formatMatrixEffectLabel,
} from './pixelMapper';
export type { MatrixCommand, MatrixEffect } from './pixelMapper';
export {
  MIDI_LEARN_TARGETS,
  DEFAULT_MIDI_BINDINGS,
  MidiControllerEngine,
  buildMidiTriggeredMessage,
  ccToMatrixSpeed,
  ccToMatrixIntensity,
  formatMidiTargetLabel,
  formatMidiBinding,
  isMidiAllowedWhenLocked,
  isMidiSupported,
} from './midiController';
export type {
  MidiTarget,
  MidiBinding,
  MidiControllerStatus,
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
