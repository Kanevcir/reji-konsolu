/**
 * Reji Kontrol Konsolu V1.0 — merkezi state / efekt hook’u.
 * V2.0 ağ hazırlığı: her aksiyonda OutgoingPayload üretir.
 * V7.0 — Senaryo Profil Yönetimi (preset slot + export/import + AsyncStorage).
 * V8.0 Final — Saha Telemetri ve Performans İzleyici (Production Telemetry).
 * V9.0 — Hibrit Network Engine (WebSocket + UDP Multicast Fallback).
 * V10.0 — NTP/PTP Precision Clock Sync (Cristian / sub-ms offset).
 * V11.0 — Art-Net / DMX512 Lighting Protocol Translator.
 * V12.0 — Operator Auth & Lock Engine.
 * V13.0 — Offline Queue & Event Replay Engine.
 * V14.0 — Timeline Sequencer & Macro Playback.
 * V15.0 — Diagnostic Blackbox & Session Exporter.
 *
 * Bu hook tüm konsol state makinesini, timer interval’lerini ve
 * aksiyon handler’larını tek yerde toplar. UI katmanı yalnızca
 * dönüş değerlerini render eder.
 */

import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  DEFAULT_BPM,
  DEFAULT_LATENCY,
  DEFAULT_STATUS,
  GS_LIGHTS,
  LIVE_STATUS,
  MAX_VISIBLE_LOGS,
  PAUSED_STATUS,
  READY_STATUS,
  SCENARIOS,
  TIMER_SECONDS,
  TRIBUNES,
} from '../constants';
import {
  DEFAULT_DETECTED_BPM,
  nextDetectedBpm,
  nextMicLevelDb,
  requestMicAccessSafe,
} from '../audioBeat';
import { buildOutgoingPayload, createIdlePayload } from '../payload';
import {
  buildCurrentPreset,
  createDefaultPresetStore,
  deserializePreset,
  loadPresetStore,
  savePresetStore,
  serializePreset,
  type PresetSlotId,
  type RejiPreset,
} from '../preset';
import { buildBlackoutPayload } from '../safety';
import { triggerErrorHaptic, triggerImpact, triggerRhythmPulse, triggerSelection } from '../haptics';
import {
  buildWebSocketUrl,
  DEFAULT_NETWORK_CONFIG,
  loadNetworkConfig,
  NetworkEngine,
  saveNetworkConfig,
  type NetworkConfig,
  type NetworkLinkStatus,
  type NetworkTransport,
} from '../networkEngine';
import { normalizeLinkStatus, randomAckDelayMs } from '../socket';
import {
  OfflineQueueEngine,
  shouldEnqueueOffline,
} from '../offlineQueue';
import {
  canPlayMacro,
  canRecordMacro,
  EMPTY_MACRO,
  TimelineSequencer,
  type MacroEvent,
  type MacroSequence,
} from '../timelineSequencer';
import {
  BLACKBOX_TERMINAL_LINES,
  BlackboxEngine,
  serializeMatchReportJson,
  type BlackboxEntry,
} from '../blackbox';
import {
  canManageLock,
  canOperateCritical,
  DEFAULT_SECURITY_LOCK,
  formatOperatorRoleLabel,
  nextOperatorRole,
  verifyOperatorPin,
  type OperatorRole,
} from '../securityLock';
import {
  ARTNET_BROADCAST_FPS,
  ArtNetEngine,
  DEFAULT_ARTNET_CONFIG,
  DEFAULT_ARTNET_STATS,
  type ArtNetBridgeStats,
  type ArtNetConfig,
  type ArtNetUniverseId,
} from '../artnetEngine';
import {
  CLOCK_SYNC_INTERVAL_MS,
  DEFAULT_CLOCK_SYNC_STATS,
  formatClockOffset,
  getClockSync,
  type ClockSyncStats,
} from '../clockSync';
import {
  DEFAULT_TELEMETRY_STATS,
  nextTelemetryStats,
  type TelemetryStats,
} from '../telemetry';
import type {
  BpmOption,
  DeliveryStatus,
  OutgoingAction,
  OutgoingPayload,
  RejiAction,
  RejiLogEntry,
  RejiMode,
  ScenarioOption,
  ScenarioId,
  SocketStatus,
  TribunId,
} from '../types';
import { formatLogTime, randomLatency } from '../utils';

type PayloadOverrides = {
  tribun?: TribunId;
  bpm?: number;
  timerHasTime?: boolean;
  isPaused?: boolean;
};

/**
 * Konsolun tüm durumunu ve yan etkilerini yönetir.
 * Interval’ler yalnızca `timerRunning === true` iken açık kalır;
 * her effect cleanup’ta `clearInterval` çağırır.
 */
export function useRejiConsole() {
  // --- State: sinyal / mod ---
  /** Üst sinyal kutusunda gösterilen ana durum metni. */
  const [sistemDurumu, setSistemDurumu] = useState(DEFAULT_STATUS);
  /** idle | live | sync — hangi ana reji modunun aktif olduğu. */
  const [mode, setMode] = useState<RejiMode>('idle');
  /** Kısa kullanıcı geri bildirimi (aksiyon sonucu). */
  const [bildirim, setBildirim] = useState('Bekleme modunda');

  // --- State: hedefleme ---
  /** Seçili tribün filtresi (LED ve bildirimlerde kullanılır). */
  const [selectedTribun, setSelectedTribun] = useState<TribunId>('all');
  /** Seçili hazır senaryo; yoksa null. */
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId | null>(null);

  // --- State: zamanlayıcı / canlı sinyal ---
  /** Geri sayım saniyesi; 0 = timer kapalı. */
  const [kalanSure, setKalanSure] = useState(0);
  /** Canlı gecikme paneli değeri (ms). */
  const [sinyalGecikmesi, setSinyalGecikmesi] = useState(DEFAULT_LATENCY);
  /** Manuel override: true iken timer ve LED ritmi donar. */
  const [isPaused, setIsPaused] = useState(false);
  /** Ritim hızı; LED beat interval’ini belirler. */
  const [bpm, setBpm] = useState<BpmOption>(DEFAULT_BPM);
  /** Sanal stadyum renk/opacity fazı (0..GS_LIGHTS.length-1). */
  const [beat, setBeat] = useState(0);
  /** Zaman damgalı reji logları; UI’da yalnızca son 3 satır gösterilir. */
  const [logs, setLogs] = useState<RejiLogEntry[]>([]);
  /**
   * V2.0 — son yayınlanan OutgoingPayload (ağ katmanına hazır JSON).
   * State UI’yı günceller; ref senkron okuma için tutulur.
   */
  const [lastPayload, setLastPayload] = useState<OutgoingPayload>(() => createIdlePayload(DEFAULT_BPM));
  /**
   * V2.1 / V9.0 — hibrit ağ bağlantı durumu (WS / UDP fallback).
   */
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('DISCONNECTED');
  /** V2.1 — son payload için ACK / teslim geri bildirimi. */
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('IDLE');
  /** V9.0 — operatör ağ ayarları. */
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig>({
    ...DEFAULT_NETWORK_CONFIG,
  });
  const [networkEndpoint, setNetworkEndpoint] = useState(() =>
    buildWebSocketUrl(DEFAULT_NETWORK_CONFIG),
  );
  const [networkTransport, setNetworkTransport] = useState<NetworkTransport>('offline');
  const [networkError, setNetworkError] = useState<string | null>(null);
  /** Son TX transport’u (ACK satırı etiketi). */
  const [lastTxTransport, setLastTxTransport] = useState<NetworkTransport>('offline');
  /**
   * V4.0 — Canlı mikrofon / stadyum sesi dinleniyor mu (AUTO BPM).
   */
  const [isListeningAudio, setIsListeningAudio] = useState(false);
  /** V4.0 — ses analizinden gelen anlık BPM (110–135). */
  const [detectedBpm, setDetectedBpm] = useState(DEFAULT_DETECTED_BPM);
  /** V4.0 — simüle mikrofon giriş seviyesi (dB). */
  const [micLevelDb, setMicLevelDb] = useState(-30);
  /**
   * V6.0 — Acil durum / Blackout (Safe Mode).
   * Aktifken timer, haptic, audio ve LED durur; çıkış manuel onay ister.
   */
  const [isBlackout, setIsBlackout] = useState(false);
  /**
   * V7.0 — Senaryo profil hafızası (3 slot + aktif slot).
   * AsyncStorage hydrate tamamlanana kadar persist yazılmaz.
   */
  const [activeSlotId, setActiveSlotId] = useState<PresetSlotId>('opening');
  const [presetSlots, setPresetSlots] = useState(() => createDefaultPresetStore().slots);
  const [presetHydrated, setPresetHydrated] = useState(false);
  /**
   * V8.0 — Canlı saha telemetrisi (FPS / RAM / nodes / network).
   * Blackout’ta tick durur; UI SYSTEM ISOLATED gösterir.
   */
  const [telemetryStats, setTelemetryStats] = useState<TelemetryStats>(DEFAULT_TELEMETRY_STATS);
  /** V10.0 — PTP/NTP clock sync (offset + RTT). */
  const [clockSyncStats, setClockSyncStats] = useState<ClockSyncStats>(DEFAULT_CLOCK_SYNC_STATS);
  /** V11.0 — Art-Net / DMX bridge. */
  const [artNetConfig, setArtNetConfig] = useState<ArtNetConfig>({ ...DEFAULT_ARTNET_CONFIG });
  const [artNetStats, setArtNetStats] = useState<ArtNetBridgeStats>({ ...DEFAULT_ARTNET_STATS });
  /** V12.0 — operatör rol + konsol kilidi. */
  const [operatorRole, setOperatorRole] = useState<OperatorRole>(DEFAULT_SECURITY_LOCK.operatorRole);
  const [isConsoleLocked, setIsConsoleLocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [lockPinPrompt, setLockPinPrompt] = useState<'lock' | 'unlock' | null>(null);
  /** V13.0 — çevrimdışı kuyruk bekleyen olay sayısı. */
  const [offlineQueuePending, setOfflineQueuePending] = useState(0);
  /** V14.0 — makro kayıt / oynatma. */
  const [isRecordingMacro, setIsRecordingMacro] = useState(false);
  const [isPlayingMacro, setIsPlayingMacro] = useState(false);
  const [macroSequence, setMacroSequence] = useState<MacroSequence>({
    ...EMPTY_MACRO,
    events: [],
  });
  const [macroProgress, setMacroProgress] = useState(0);
  /** V15.0 — karakutu rolling log (max 1000, PTP ts). */
  const [blackboxLogs, setBlackboxLogs] = useState<BlackboxEntry[]>([]);
  /** Log kimliği için artan sayaç (render’ı tetiklemez). */
  const logSeq = useRef(0);
  /** Son payload’un senkron kopyası (gelecek ağ gönderimi için). */
  const lastPayloadRef = useRef<OutgoingPayload>(createIdlePayload(DEFAULT_BPM));
  /** Soket durumunun senkron kopyası (ACK zamanlayıcısında stale closure önler). */
  const socketStatusRef = useRef<SocketStatus>('DISCONNECTED');
  /** Bekleyen ACK timeout’u; yeni yayın veya unmount’ta temizlenir. */
  const ackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** V9.0 — gerçek hibrit network engine örneği. */
  const engineRef = useRef<NetworkEngine | null>(null);
  /** V11.0 — Art-Net encoder. */
  const artNetRef = useRef<ArtNetEngine | null>(null);
  if (!artNetRef.current) artNetRef.current = new ArtNetEngine();
  /** V13.0 — FIFO offline event queue. */
  const offlineQueueRef = useRef(new OfflineQueueEngine());
  const offlineFlushingRef = useRef(false);
  const flushOfflineQueueRef = useRef<() => Promise<void>>(async () => {});
  /** V14.0 — timeline sequencer + playback dispatch. */
  const timelineRef = useRef(new TimelineSequencer());
  const isPlayingMacroRef = useRef(false);
  const macroDispatchRef = useRef<(event: MacroEvent) => void>(() => {});
  /** V15.0 — industrial blackbox engine. */
  const blackboxRef = useRef(new BlackboxEngine());
  /** V11 — 30 FPS stream'in okuduğu anlık frame girdileri. */
  const artNetFrameRef = useRef({
    beat: 0,
    bpm: DEFAULT_BPM as number,
    tribun: 'all' as TribunId,
    config: { ...DEFAULT_ARTNET_CONFIG },
  });
  /** V4.0 — LED/haptic ritminin okuduğu güncel BPM (auto veya manuel). */
  const effectiveBpmRef = useRef<number>(DEFAULT_BPM);
  /** Beat faz biriktirici (ms) — auto BPM değişince interval’i yeniden kurmadan senkron kalır. */
  const beatPhaseRef = useRef(0);

  // --- Ref’ler (render tetiklemez) ---
  /**
   * Timer’ın daha önce gerçekten çalıştığını işaretler.
   * Mount’ta kalanSure=0 iken “süre doldu” efektinin yanlış tetiklenmesini engeller.
   */
  const timerWasRunning = useRef(false);
  /** Duraklatmadan önceki sistemDurumu; DEVAM ET ile geri yüklenir. */
  const statusBeforePause = useRef(LIVE_STATUS);

  // --- Türetilmiş bayraklar ---
  /** Sayaçta hâlâ süre var mı (pause dahil). */
  const timerHasTime = kalanSure > 0;
  /** Interval’lerin çalışması gereken durum: süre var, pause yok, blackout yok. */
  const timerRunning = timerHasTime && !isPaused && !isBlackout;
  const isLive = mode === 'live' || timerHasTime;
  const isSync = mode === 'sync';
  const tribunLabel = TRIBUNES.find((t) => t.id === selectedTribun)?.label ?? 'Tüm Stadyum';
  /**
   * LED Matris + Haptic Motor’un kullandığı aktif BPM.
   * AUTO AUDIO SYNC açıkken detectedBpm; kapalıyken manuel bpm.
   */
  const effectiveBpm = isListeningAudio ? detectedBpm : bpm;
  effectiveBpmRef.current = effectiveBpm;
  artNetFrameRef.current = {
    beat,
    bpm: effectiveBpm,
    tribun: selectedTribun,
    config: artNetConfig,
  };

  const securityLock = { operatorRole, isConsoleLocked };
  const criticalEnabled = canOperateCritical(operatorRole, isConsoleLocked);
  const macroRecordEnabled = canRecordMacro(isConsoleLocked, isBlackout);
  const macroPlayEnabled = canPlayMacro(operatorRole, isConsoleLocked, isBlackout);

  const recordMacroEvent = (
    type: MacroEvent['type'],
    payload: MacroEvent['payload'] = {},
  ) => {
    try {
      if (!isRecordingMacro || isPlayingMacroRef.current) return;
      if (!macroRecordEnabled) return;
      timelineRef.current.recordEvent(type, payload);
      setMacroSequence(timelineRef.current.getSequence());
    } catch {
      // kayıt hatası UI'yı bozmaz
    }
  };

  /**
   * V7.0 — anlık konsol konfigürasyonu (export / panel özeti).
   * Seçili senaryo, BPM, tribün ve audio sync durumunu taşır.
   */
  const currentPreset: RejiPreset = buildCurrentPreset({
    name: presetSlots[activeSlotId]?.name ?? 'Özel Profil',
    selectedScenario,
    bpm,
    selectedTribun,
    isListeningAudio,
  });

  /** Yeni log satırı ekler; listede en fazla MAX_VISIBLE_LOGS tutulur. */
  const pushLog = (message: string) => {
    logSeq.current += 1;
    const entry: RejiLogEntry = {
      id: `log-${logSeq.current}`,
      time: formatLogTime(),
      message,
    };
    setLogs((prev) => [...prev, entry].slice(-MAX_VISIBLE_LOGS));
    // V15 — kritik olayları PTP ile karakutuya yaz
    try {
      const bb = blackboxRef.current.appendFromMessage(message);
      if (bb) {
        setBlackboxLogs(blackboxRef.current.getLogs());
      }
    } catch {
      // blackbox hatası konsol logunu bozmaz
    }
  };

  /** Bekleyen ACK timer’ını iptal eder. */
  const clearAckTimeout = () => {
    if (ackTimeoutRef.current) {
      clearTimeout(ackTimeoutRef.current);
      ackTimeoutRef.current = null;
    }
  };

  /**
   * V2.1 / V9.0 — teslim geri bildirimi.
   * WS CONNECTED veya FALLBACK_UDP iken soft-ACK; aksi halde FAILED.
   */
  const scheduleAck = (transport: NetworkTransport = 'websocket') => {
    clearAckTimeout();

    const link = normalizeLinkStatus(socketStatusRef.current);
    const canAck =
      (transport === 'websocket' && link === 'CONNECTED') ||
      transport === 'udp_multicast' ||
      link === 'FALLBACK_UDP';

    if (!canAck) {
      setDeliveryStatus('FAILED');
      pushLog('ACK FAILED — link down');
      return;
    }

    setDeliveryStatus('PENDING');
    const delay = randomAckDelayMs();
    ackTimeoutRef.current = setTimeout(() => {
      const stillOk =
        normalizeLinkStatus(socketStatusRef.current) === 'CONNECTED' ||
        normalizeLinkStatus(socketStatusRef.current) === 'FALLBACK_UDP' ||
        transport === 'udp_multicast';
      if (!stillOk) {
        setDeliveryStatus('FAILED');
        return;
      }
      setDeliveryStatus('ACK_RECEIVED');
      pushLog(
        transport === 'udp_multicast'
          ? 'UDP_MULTICAST_FALLBACK DELIVERED'
          : 'ACK_RECEIVED (200 OK)',
      );
      ackTimeoutRef.current = null;
    }, delay);
  };

  /**
   * V2.0 / V9.0 — Outgoing payload üretir ve networkEngine üzerinden iletir.
   */
  const emitArtNet = (opts?: { forceBlackout?: boolean; active?: boolean }) => {
    try {
      const engine = artNetRef.current;
      if (!engine) return;
      engine.applyConfig(artNetConfig);
      const active =
        opts?.active ??
        (opts?.forceBlackout ? false : timerHasTime && !isPaused && !isBlackout);
      const bundle = engine.generate({
        beat,
        bpm: isListeningAudio ? detectedBpm : bpm,
        tribun: selectedTribun,
        isBlackout: opts?.forceBlackout ?? isBlackout,
        active,
      });
      const broadcasting = active && !(opts?.forceBlackout ?? isBlackout);
      const event = broadcasting
        ? 'ART-NET PACKET GENERATED (512 CH / UNIVERSE 1-4)'
        : opts?.forceBlackout || isBlackout
          ? 'ART-NET FULL OFF (BLACKOUT)'
          : 'ART-NET PACKET GENERATED (STANDBY)';
      setArtNetStats({
        broadcasting,
        fps: broadcasting ? ARTNET_BROADCAST_FPS : 0,
        net: artNetConfig.net,
        subnet: artNetConfig.subnet,
        selectedUniverse: artNetConfig.selectedUniverse,
        lastHexPreview: bundle.hexPreview,
        lastGeneratedAt: bundle.generatedAt,
        sequence: bundle.sequence,
        lastEvent: event,
      });
      pushLog(event);
    } catch {
      pushLog('ART-NET ENCODE ERROR');
    }
  };

  /** V13.0 — CONNECTED olunca kuyruğu FIFO replay et. */
  const flushOfflineQueue = async () => {
    if (offlineFlushingRef.current) return;
    const queue = offlineQueueRef.current;
    const count = queue.size();
    if (count === 0) return;

    if (normalizeLinkStatus(socketStatusRef.current) !== 'CONNECTED') return;

    offlineFlushingRef.current = true;
    try {
      const engine = engineRef.current;
      const items = queue.drain();
      setOfflineQueuePending(0);

      if (!engine) {
        for (const item of items) {
          offlineQueueRef.current.enqueue(item.payload);
        }
        setOfflineQueuePending(offlineQueueRef.current.size());
        pushLog('OFFLINE QUEUE FLUSH ABORTED — engine yok');
        return;
      }

      let replayed = 0;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]!;
        try {
          if (normalizeLinkStatus(socketStatusRef.current) !== 'CONNECTED') {
            for (let j = i; j < items.length; j += 1) {
              offlineQueueRef.current.enqueue(items[j]!.payload);
            }
            setOfflineQueuePending(offlineQueueRef.current.size());
            pushLog('OFFLINE QUEUE FLUSH INTERRUPTED');
            return;
          }
          const result = await engine.send(item.payload);
          if (result.ok) {
            replayed += 1;
            lastPayloadRef.current = item.payload;
            setLastPayload(item.payload);
            setNetworkTransport(result.transport);
            setLastTxTransport(result.transport);
          } else {
            for (let j = i; j < items.length; j += 1) {
              offlineQueueRef.current.enqueue(items[j]!.payload);
            }
            setOfflineQueuePending(offlineQueueRef.current.size());
            pushLog('OFFLINE QUEUE REPLAY FAILED — re-queued');
            return;
          }
        } catch {
          for (let j = i; j < items.length; j += 1) {
            offlineQueueRef.current.enqueue(items[j]!.payload);
          }
          setOfflineQueuePending(offlineQueueRef.current.size());
          pushLog('OFFLINE QUEUE REPLAY ERROR');
          return;
        }
      }

      pushLog('OFFLINE QUEUE FLUSHED (' + replayed + ' EVENTS REPLAYED)');
      setBildirim('Offline kuyruk senkronize · ' + replayed + ' olay');
      if (replayed > 0) {
        setDeliveryStatus('ACK_RECEIVED');
      }
    } catch {
      pushLog('OFFLINE QUEUE FLUSH ERROR');
    } finally {
      offlineFlushingRef.current = false;
      setOfflineQueuePending(offlineQueueRef.current.size());
    }
  };
  flushOfflineQueueRef.current = flushOfflineQueue;

  const publishPayload = (action: OutgoingAction, overrides: PayloadOverrides = {}) => {
    const payload = buildOutgoingPayload({
      action,
      tribun: overrides.tribun ?? selectedTribun,
      bpm: overrides.bpm ?? (isListeningAudio ? detectedBpm : bpm),
      timerHasTime: overrides.timerHasTime ?? timerHasTime,
      isPaused: overrides.isPaused ?? isPaused,
    });
    lastPayloadRef.current = payload;
    setLastPayload(payload);
    emitArtNet({
      active: (overrides.timerHasTime ?? timerHasTime) && !(overrides.isPaused ?? isPaused),
    });

    void (async () => {
      try {
        const link = normalizeLinkStatus(socketStatusRef.current);

        // V13 — offline / fallback: kuyruğa yaz, anında TX deneme
        if (shouldEnqueueOffline(link)) {
          offlineQueueRef.current.enqueue(payload);
          const pending = offlineQueueRef.current.size();
          setOfflineQueuePending(pending);
          setDeliveryStatus('PENDING');
          pushLog('OFFLINE QUEUE · ' + action + ' (' + pending + ' QUEUED)');
          setBildirim('Offline kuyruk · ' + pending + ' sinyal');
          return;
        }

        const engine = engineRef.current;
        if (!engine) {
          setDeliveryStatus('FAILED');
          pushLog('TX FAILED — engine yok');
          return;
        }

        const result = await engine.send(payload);
        setNetworkTransport(result.transport);
        setLastTxTransport(result.transport);

        if (!result.ok) {
          // Anlık send hatası — kuyruğa al
          offlineQueueRef.current.enqueue(payload);
          const pending = offlineQueueRef.current.size();
          setOfflineQueuePending(pending);
          setDeliveryStatus('FAILED');
          if (result.error) setNetworkError(result.error);
          pushLog('TX FAILED — queued (' + pending + ')');
          return;
        }

        scheduleAck(result.transport);
        pushLog('TX ' + result.transport.toUpperCase() + ' · ' + action);
      } catch (err) {
        setDeliveryStatus('FAILED');
        const message = err instanceof Error ? err.message : 'tx error';
        setNetworkError(message);
        pushLog('TX ERROR — ' + message);
        try {
          offlineQueueRef.current.enqueue(payload);
          setOfflineQueuePending(offlineQueueRef.current.size());
        } catch {
          // ignore
        }
      }
    })();
  };

  /**
   * V9.0 — NetworkEngine yaşam döngüsü: config yükle, dinle, bağlan, cleanup.
   */
  useEffect(() => {
    const engine = new NetworkEngine();
    engineRef.current = engine;
    let cancelled = false;

    engine.setListener({
      onStatus: (status: NetworkLinkStatus, detail?: string) => {
        if (cancelled) return;
        socketStatusRef.current = status;
        setSocketStatus(status);
        setNetworkEndpoint(engine.getEndpoint());
        setNetworkTransport(engine.getTransport());
        setNetworkError(engine.getLastError());

        if (status === 'CONNECTED') {
          setBildirim(`SOCKET CONNECTED · ${engine.getEndpoint()}`);
          pushLog(`SOCKET CONNECTED · ${engine.getEndpoint()}`);
          void flushOfflineQueueRef.current();
        } else if (status === 'FALLBACK_UDP') {
          setBildirim('UDP_MULTICAST_FALLBACK ACTIVE');
          pushLog(`UDP_MULTICAST_FALLBACK${detail ? ` · ${detail}` : ''}`);
        } else if (status === 'CONNECTING') {
          pushLog(`SOCKET CONNECTING${detail ? ` · ${detail}` : ''}`);
        } else {
          pushLog('SOCKET DISCONNECTED');
        }
      },
      onAck: () => {
        if (cancelled) return;
        clearAckTimeout();
        setDeliveryStatus('ACK_RECEIVED');
        pushLog('ACK_RECEIVED (server)');
      },
      onError: (message) => {
        if (cancelled) return;
        setNetworkError(message);
      },
    });

    void (async () => {
      try {
        const cfg = await loadNetworkConfig();
        if (cancelled) return;
        setNetworkConfig(cfg);
        engine.applyConfig(cfg);
        setNetworkEndpoint(buildWebSocketUrl(cfg));
        engine.connect(cfg, { failoverReset: true });
      } catch {
        if (!cancelled) {
          engine.connect(DEFAULT_NETWORK_CONFIG, { failoverReset: true });
        }
      }
    })();

    return () => {
      cancelled = true;
      clearAckTimeout();
      engine.setListener({});
      engine.destroy();
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
    };
    // pushLog / clearAckTimeout mount kapanışı — bilinçli olarak tek sefer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Unmount yedek temizliği (ACK). */
  useEffect(() => {
    return () => {
      clearAckTimeout();
    };
  }, []);

  /**
   * V10.0 — Precision Clock Engine (Cristian / NTP pool, ~10s).
   * Payload / log timestamp'leri getSyncedTimestamp üzerinden akar.
   */
  useEffect(() => {
    const clock = getClockSync();
    let cancelled = false;
    let lastDriftLog = false;

    clock.setListener((stats) => {
      if (cancelled) return;
      setClockSyncStats(stats);
      if (stats.status === 'DRIFT') {
        setBildirim(
          `CLOCK DRIFT DETECTED — Offset ${formatClockOffset(stats.clockOffset)}`,
        );
        if (!lastDriftLog) {
          pushLog(
            `CLOCK DRIFT DETECTED · ${formatClockOffset(stats.clockOffset)} · RTT ${Math.round(stats.rtt)}ms`,
          );
          lastDriftLog = true;
        }
      } else if (stats.status === 'SYNCED') {
        lastDriftLog = false;
      }
    });

    clock.start(CLOCK_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      clock.stop();
      clock.setListener(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * V7.0 — AsyncStorage’dan son profil hafızasını yükle (try-catch korumalı).
   * Hydrate sonrası aktif slot state’lere uygulanır; show timer başlatılmaz.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const store = await loadPresetStore();
        if (cancelled) return;

        setActiveSlotId(store.activeSlotId);
        setPresetSlots(store.slots);

        const preset = store.slots[store.activeSlotId];
        setSelectedTribun(preset.selectedTribun);
        setSelectedScenario(preset.selectedScenario);
        setBpm(preset.bpm);
        setIsListeningAudio(preset.isListeningAudio);

        if (preset.selectedScenario) {
          const scenario = SCENARIOS.find((s) => s.id === preset.selectedScenario);
          if (scenario) setSistemDurumu(scenario.status);
        }

        setBildirim(`Profil yüklendi: ${preset.name}`);
        setPresetHydrated(true);
      } catch {
        if (!cancelled) {
          setPresetHydrated(true);
          setBildirim('Profil hafızası okunamadı — varsayılan kullanılıyor');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * V7.0 — aktif slot + slot içeriğini kalıcı hafızaya yaz.
   * Hydrate tamamlanmadan yazılmaz (varsayılan override önlenir).
   */
  useEffect(() => {
    if (!presetHydrated) return;

    void (async () => {
      try {
        await savePresetStore({ activeSlotId, slots: presetSlots });
      } catch {
        // Persist hatası UI’yı bozmaz
      }
    })();
  }, [presetHydrated, activeSlotId, presetSlots]);

  /**
   * Effect #V14 — Blackout sırasında makro oynatmayı kes.
   */
  useEffect(() => {
    if (!isBlackout) return;
    try {
      if (timelineRef.current.isPlaying() || isPlayingMacro) {
        timelineRef.current.abortPlayback();
        isPlayingMacroRef.current = false;
        setIsPlayingMacro(false);
        setMacroProgress(0);
        pushLog('MACRO PLAYBACK ABORT BLACKOUT');
      }
    } catch {
      setIsPlayingMacro(false);
    }
  }, [isBlackout]);

  /**
   * Effect #V11 — Art-Net 30 FPS stream (canlı timer iken).
   * Frame girdileri ref üzerinden okunur; interval beat ile yeniden kurulmaz.
   */
  useEffect(() => {
    if (isBlackout || !timerRunning) {
      setArtNetStats((prev) =>
        prev.broadcasting
          ? {
              ...prev,
              broadcasting: false,
              fps: 0,
              lastEvent: isBlackout ? 'ART-NET FULL OFF (BLACKOUT)' : prev.lastEvent,
            }
          : prev,
      );
      return;
    }

    const intervalMs = Math.round(1000 / ARTNET_BROADCAST_FPS);
    const intervalId = setInterval(() => {
      try {
        const engine = artNetRef.current;
        if (!engine) return;
        const frame = artNetFrameRef.current;
        engine.applyConfig(frame.config);
        const bundle = engine.generate({
          beat: frame.beat,
          bpm: frame.bpm,
          tribun: frame.tribun,
          isBlackout: false,
          active: true,
        });
        setArtNetStats({
          broadcasting: true,
          fps: ARTNET_BROADCAST_FPS,
          net: frame.config.net,
          subnet: frame.config.subnet,
          selectedUniverse: frame.config.selectedUniverse,
          lastHexPreview: bundle.hexPreview,
          lastGeneratedAt: bundle.generatedAt,
          sequence: bundle.sequence,
          lastEvent: 'ART-NET PACKET GENERATED (512 CH / UNIVERSE 1-4)',
        });
      } catch {
        // encode hatası stream'i bozmaz
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [isBlackout, timerRunning]);

  /**
   * Effect #V8 — Production telemetry tick.
   * Blackout dışında ~1.1s’de bir yumuşak metrik güncellemesi.
   * V9 — link durumuna göre networkStability yansıtılır.
   */
  useEffect(() => {
    if (isBlackout) return;

    const intervalId = setInterval(() => {
      try {
        setTelemetryStats((prev) => {
          const next = nextTelemetryStats(prev);
          const link = normalizeLinkStatus(socketStatusRef.current);
          if (link === 'CONNECTED') return next;
          if (link === 'FALLBACK_UDP') {
            return {
              ...next,
              networkStability: Math.min(next.networkStability, 99.85),
            };
          }
          if (link === 'CONNECTING') {
            return {
              ...next,
              networkStability: Math.min(next.networkStability, 99.82),
            };
          }
          return {
            ...next,
            networkStability: 99.8,
            activeNodes: Math.max(4000, next.activeNodes - 120),
          };
        });
      } catch {
        // Telemetri hatası konsolu bozmaz
      }
    }, 1100);

    return () => clearInterval(intervalId);
  }, [isBlackout]);

  /**
   * Effect #V15 — oturum telemetrisi (avg FPS / max RAM) karakutu birikimi.
   */
  useEffect(() => {
    if (isBlackout) return;
    try {
      blackboxRef.current.sampleTelemetry(telemetryStats);
    } catch {
      // ignore
    }
  }, [telemetryStats, isBlackout]);

  /**
   * Effect #V4 — Canlı ses dinleme / AUTO BPM simülasyonu.
   * isListeningAudio iken 800ms’de bir BPM (110–135) ve mic dB güncellenir.
   */
  useEffect(() => {
    if (!isListeningAudio || isBlackout) return;

    const intervalId = setInterval(() => {
      try {
        setDetectedBpm((prev) => nextDetectedBpm(prev));
        setMicLevelDb(nextMicLevelDb());
      } catch {
        // Analiz hatası — dinlemeyi bozmadan devam
      }
    }, 800);

    return () => clearInterval(intervalId);
  }, [isListeningAudio, isBlackout]);

  /** 15 sn geri sayımı başlatır; pause’u açar, beat’i sıfırlar. */
  const startCountdown = () => {
    timerWasRunning.current = true;
    setIsPaused(false);
    setKalanSure(TIMER_SECONDS);
    setSinyalGecikmesi(randomLatency());
    setBeat(0);
  };

  /** Timer’ı tamamen durdurur ve canlı göstergeleri varsayılana çeker. */
  const stopCountdown = () => {
    timerWasRunning.current = false;
    setIsPaused(false);
    setKalanSure(0);
    setSinyalGecikmesi(DEFAULT_LATENCY);
    setBeat(0);
  };

  /**
   * Effect #1 — Geri sayım tick’i.
   * Her 1 sn kalanSure’yi azaltır. timerRunning false olunca interval cleanup ile silinir.
   */
  useEffect(() => {
    if (!timerRunning) return;

    const intervalId = setInterval(() => {
      setKalanSure((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    // Cleanup: unmount veya timerRunning değişiminde sızıntıyı önler.
    return () => clearInterval(intervalId);
  }, [timerRunning]);

  /**
   * Effect #2 — Canlı gecikme simülasyonu.
   * Timer aktifken her saniye 8–15 ms arası rastgele değer üretir.
   */
  useEffect(() => {
    if (!timerRunning) return;

    const intervalId = setInterval(() => {
      setSinyalGecikmesi(randomLatency());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timerRunning]);

  /**
   * Effect #3 — LED beat + haptic pulse (manuel veya AUTO AUDIO SYNC BPM).
   * 50ms tick + faz birikimi: detectedBpm değişince interval yeniden kurulmaz.
   */
  useEffect(() => {
    if (!timerRunning) {
      beatPhaseRef.current = 0;
      return;
    }

    const tickMs = 50;
    const intervalId = setInterval(() => {
      try {
        const target = Math.max(1, Math.round(60000 / effectiveBpmRef.current));
        beatPhaseRef.current += tickMs;
        if (beatPhaseRef.current >= target) {
          beatPhaseRef.current = 0;
          setBeat((prev) => (prev + 1) % GS_LIGHTS.length);
          void triggerRhythmPulse();
        }
      } catch {
        // Ritim tick hatası yutulur
      }
    }, tickMs);

    return () => clearInterval(intervalId);
  }, [timerRunning]);

  /**
   * Effect #4 — Süre dolumu.
   * kalanSure 0’a indiğinde ve timer daha önce çalışmışsa sistemi bekleme moduna alır.
   * İlk mount’ta (timerWasRunning=false) hiçbir şey yapmaz.
   */
  useEffect(() => {
    if (kalanSure > 0) {
      timerWasRunning.current = true;
      return;
    }

    if (!timerWasRunning.current) return;

    timerWasRunning.current = false;
    setIsPaused(false);
    setBeat(0);
    setMode('idle');
    setSistemDurumu(READY_STATUS);
    setBildirim('Süre doldu — sistem beklemede');
    setSinyalGecikmesi(DEFAULT_LATENCY);
    // Timer değişimi (bitti) → IDLE / RESET paketi
    publishPayload('RESET', { timerHasTime: false, isPaused: false });
  }, [kalanSure]);

  /** DURAKLAT / DEVAM ET manuel override. */
  const handlePauseToggle = () => {
    if (isBlackout || !timerHasTime) return;
    recordMacroEvent('PAUSE_TOGGLE');
    void triggerImpact('medium');

    if (isPaused) {
      setIsPaused(false);
      setSistemDurumu(statusBeforePause.current);
      setBildirim('Manuel override — devam ediyor');
      pushLog('Koreografi Devam Ettirildi');
      publishPayload('START_SHOW', { timerHasTime: true, isPaused: false });
      return;
    }

    statusBeforePause.current = sistemDurumu;
    setIsPaused(true);
    setSistemDurumu(PAUSED_STATUS);
    setBildirim('Manuel override — duraklatıldı');
    pushLog('Koreografi Duraklatıldı');
    publishPayload('PAUSE', { timerHasTime: true, isPaused: true });
  };

  /** Ana reji butonları: live / sync / reset. */
  const handleAction = (actionId: RejiAction['id']) => {
    if (isBlackout || !criticalEnabled) return;
    recordMacroEvent('ACTION', { actionId });

    if (actionId === 'live') {
      setMode('live');
      setSistemDurumu(LIVE_STATUS);
      setBildirim(`Koreografi başlatıldı — ${tribunLabel}`);
      pushLog('Koreografi Başlatıldı');
      startCountdown();
      publishPayload('START_SHOW', { timerHasTime: true, isPaused: false });
      return;
    }

    if (actionId === 'sync') {
      setMode('sync');
      setSistemDurumu(`RİTİM SENKRONİZE EDİLİYOR... (${bpm} BPM)`);
      setBildirim(`Işık & ritim senkronu — ${tribunLabel}`);
      pushLog(`Işık & Ritim Senkronu (${bpm} BPM)`);
      publishPayload('START_SHOW', { timerHasTime: false, isPaused: false });
      return;
    }

    // reset — tüm state’i V1.0 varsayılanına döndür (loglar korunur)
    stopCountdown();
    setMode('idle');
    setSistemDurumu(DEFAULT_STATUS);
    setBildirim('Sistem sıfırlandı — bekleme modu');
    setSelectedTribun('all');
    setSelectedScenario(null);
    setBpm(DEFAULT_BPM);
    setIsListeningAudio(false);
    setDetectedBpm(DEFAULT_DETECTED_BPM);
    setMicLevelDb(-30);
    pushLog('Sistem Sıfırlandı');
    publishPayload('RESET', {
      tribun: 'all',
      bpm: DEFAULT_BPM,
      timerHasTime: false,
      isPaused: false,
    });
  };

  /** Tribün filtresi seçimi (LED scope + bildirim + payload targetZone). */
  const handleTribunSelect = (id: TribunId) => {
    if (isBlackout) return;
    recordMacroEvent('TRIBUN', { tribunId: id });
    void triggerSelection();
    setSelectedTribun(id);
    const label = TRIBUNES.find((t) => t.id === id)?.label ?? '';
    setBildirim(`Hedef tribün: ${label}`);
    pushLog(`Tribün Seçildi: ${label}`);
    // Tribün değişimi: mevcut oturum durumunu koruyarak targetZone güncellenir
    publishPayload(timerHasTime && !isPaused ? 'START_SHOW' : isPaused ? 'PAUSE' : 'RESET', {
      tribun: id,
    });
  };

  /** Senaryo seçimi: durum metnini günceller ve 15 sn timer başlatır. */
  const handleScenarioSelect = (scenario: ScenarioOption) => {
    if (isBlackout || !criticalEnabled) return;
    recordMacroEvent('SCENARIO', { scenarioId: scenario.id });
    void triggerImpact('heavy');
    setSelectedScenario(scenario.id);
    setSistemDurumu(scenario.status);
    setBildirim(`${scenario.title} seçildi · ${tribunLabel}`);
    pushLog(`${scenario.title.split('(')[0].trim()} Tetiklendi`);
    startCountdown();
    publishPayload('START_SHOW', { timerHasTime: true, isPaused: false });
  };

  /** BPM seçimi; auto dinleme açıksa kapatılır (manuel öncelik). */
  const handleBpmSelect = (value: BpmOption) => {
    if (isBlackout) return;
    recordMacroEvent('BPM', { bpm: value });
    void triggerSelection();
    if (isListeningAudio) {
      setIsListeningAudio(false);
      pushLog('AUTO AUDIO SYNC kapatıldı (manuel BPM)');
    }
    setBpm(value);
    setBildirim(`Ritim hızı ayarlandı — ${value} BPM`);
    pushLog(`BPM Ayarlandı: ${value}`);
    if (mode === 'sync') {
      setSistemDurumu(`RİTİM SENKRONİZE EDİLİYOR... (${value} BPM)`);
    }
    publishPayload('SET_BPM', { bpm: value });
  };

  /**
   * V4.0 — CANLI SESİ DİNLE (AUTO BPM) anahtarı.
   * Mikrofon izni/simülasyonu + dinleme interval’i başlatır/durdurur.
   */
  const handleAudioListenToggle = async () => {
    if (isBlackout) return;
    recordMacroEvent('AUDIO_TOGGLE');
    try {
      void triggerImpact('medium');

      if (isListeningAudio) {
        setIsListeningAudio(false);
        setMicLevelDb(-30);
        setBildirim('AUTO AUDIO SYNC kapalı');
        pushLog('AUTO AUDIO SYNC: OFF');
        return;
      }

      const granted = await requestMicAccessSafe();
      if (!granted) {
        setBildirim('Mikrofon erişimi reddedildi — dinleme başlatılamadı');
        pushLog('MIC ACCESS DENIED');
        return;
      }

      setDetectedBpm(DEFAULT_DETECTED_BPM);
      setMicLevelDb(nextMicLevelDb());
      setIsListeningAudio(true);
      setBildirim('AUTO AUDIO SYNC açık — stadyum ritmi dinleniyor');
      pushLog('AUTO AUDIO SYNC: ON');
      publishPayload('SET_BPM', {
        bpm: DEFAULT_DETECTED_BPM,
        timerHasTime,
        isPaused,
      });
    } catch {
      setIsListeningAudio(false);
      setBildirim('Ses dinleme hatası — güvenli moda dönüldü');
      pushLog('AUDIO LISTEN ERROR');
    }
  };

  /**
   * V9.0 — uzun basış / safety: bilinçli socket disconnect.
   */
  const handleSocketDisconnectSim = () => {
    if (!criticalEnabled) return;
    clearAckTimeout();
    try {
      engineRef.current?.disconnect();
      setDeliveryStatus('FAILED');
      setBildirim('SOCKET DISCONNECTED — operator');
      pushLog('SOCKET DISCONNECTED (manual)');
    } catch {
      socketStatusRef.current = 'DISCONNECTED';
      setSocketStatus('DISCONNECTED');
      setDeliveryStatus('FAILED');
    }
  };

  /**
   * V9.0 — soket rozetine dokunuş: WS yeniden bağlanma / UDP’den çıkış.
   */
  const handleSocketReconnect = () => {
    try {
      const link = normalizeLinkStatus(socketStatusRef.current);
      if (link === 'CONNECTED') return;
      setBildirim('SOCKET CONNECTING...');
      pushLog('SOCKET RETRY');
      engineRef.current?.connect(networkConfig, { failoverReset: true });
    } catch {
      setBildirim('Yeniden bağlanma başarısız');
    }
  };

  /** V9.0 — ağ ayarları alan güncelleyicileri. */
  const handleNetworkHostChange = (host: string) => {
    setNetworkConfig((prev) => ({ ...prev, host }));
  };

  const handleNetworkPortChange = (portText: string) => {
    const digits = portText.replace(/\D/g, '');
    const port = digits ? Number.parseInt(digits, 10) : 0;
    setNetworkConfig((prev) => ({
      ...prev,
      port: port > 0 && port < 65536 ? port : prev.port,
    }));
  };

  const handleNetworkSecureToggle = (secure: boolean) => {
    setNetworkConfig((prev) => ({ ...prev, secure }));
  };

  const handleNetworkConnect = () => {
    void (async () => {
      try {
        await saveNetworkConfig(networkConfig);
        setNetworkEndpoint(buildWebSocketUrl(networkConfig));
        setBildirim('Ağ ayarları kaydedildi — bağlanılıyor');
        pushLog(`NET CONFIG · ${buildWebSocketUrl(networkConfig)}`);
        engineRef.current?.connect(networkConfig, { failoverReset: true });
      } catch {
        setBildirim('Ağ ayarı kaydedilemedi');
      }
    })();
  };

  const handleNetworkDisconnect = () => {
    handleSocketDisconnectSim();
  };

  /**
   * V6.0 — ACİL DURUM / BLACKOUT aktifleştir.
   * Timer, audio, haptic ritim ve LED’ler durur; SAFE_MODE payload yayınlanır.
   */
  const handleBlackoutActivate = () => {
    if (!criticalEnabled) return;
    try {
      void triggerImpact('heavy');
      const bpmSnapshot = isListeningAudio ? detectedBpm : bpm;
      // Effect #4’ün “süre doldu” idle akışını tetiklememesi için bayrağı önce düşür
      timerWasRunning.current = false;
      stopCountdown();
      setIsListeningAudio(false);
      setMicLevelDb(-30);
      setIsPaused(false);
      setMode('idle');
      setBeat(0);
      setIsBlackout(true);
      setSistemDurumu('SİSTEM GÜVENLİ MODDA (BLACKOUT ACTIVE)');
      setBildirim('BLACKOUT — tüm çıkışlar kestirildi');
      pushLog('EMERGENCY BLACKOUT ACTIVE');
      try {
        if (isPlayingMacro || timelineRef.current.isPlaying()) {
          timelineRef.current.abortPlayback();
          isPlayingMacroRef.current = false;
          setIsPlayingMacro(false);
          setMacroProgress(0);
          pushLog('MACRO PLAYBACK ABORT BLACKOUT');
        }
        if (isRecordingMacro) {
          const seq = timelineRef.current.stopRecording();
          setIsRecordingMacro(false);
          setMacroSequence(seq);
          pushLog('MACRO REC ABORT BLACKOUT');
        }
      } catch {
        setIsPlayingMacro(false);
        setIsRecordingMacro(false);
      }
      try {
        const purged = offlineQueueRef.current.purge();
        setOfflineQueuePending(0);
        if (purged > 0) {
          pushLog('OFFLINE QUEUE PURGED (' + purged + ' EVENTS)');
        }
      } catch {
        pushLog('OFFLINE QUEUE PURGE ERROR');
      }
      // DMX FULL OFF — tüm universe kanalları 0x00
      try {
        const engine = artNetRef.current;
        if (engine) {
          engine.applyConfig(artNetConfig);
          const bundle = engine.generate({
            beat: 0,
            bpm: bpmSnapshot,
            tribun: selectedTribun,
            isBlackout: true,
            active: false,
          });
          setArtNetStats({
            broadcasting: false,
            fps: 0,
            net: artNetConfig.net,
            subnet: artNetConfig.subnet,
            selectedUniverse: artNetConfig.selectedUniverse,
            lastHexPreview: bundle.hexPreview,
            lastGeneratedAt: bundle.generatedAt,
            sequence: bundle.sequence,
            lastEvent: 'ART-NET FULL OFF (BLACKOUT)',
          });
          pushLog('ART-NET FULL OFF (BLACKOUT)');
        }
      } catch {
        pushLog('ART-NET BLACKOUT ENCODE ERROR');
      }

      const payload = buildBlackoutPayload({
        bpm: bpmSnapshot,
        tribun: selectedTribun,
      });
      lastPayloadRef.current = payload;
      setLastPayload(payload);

      void (async () => {
        try {
          const result = await engineRef.current?.send(payload);
          if (!result) {
            setDeliveryStatus('FAILED');
            return;
          }
          setNetworkTransport(result.transport);
          setLastTxTransport(result.transport);
          if (result.ok) scheduleAck(result.transport);
          else setDeliveryStatus('FAILED');
        } catch {
          setDeliveryStatus('FAILED');
        }
      })();
    } catch {
      setIsBlackout(true);
      setBildirim('BLACKOUT — güvenli moda zorlandı');
    }
  };

  /**
   * V6.0 — Blackout’tan çıkış (yalnızca manuel onay sonrası çağrılır).
   * Sistem IDLE’a döner; link durumu engine’den gelir.
   */
  const handleBlackoutClear = () => {
    if (!criticalEnabled) return;
    try {
      void triggerImpact('medium');
      setIsBlackout(false);
      setMode('idle');
      setSistemDurumu(DEFAULT_STATUS);
      setBildirim('Güvenli mod kapatıldı — IDLE');
      pushLog('BLACKOUT CLEARED — IDLE');

      publishPayload('RESET', {
        timerHasTime: false,
        isPaused: false,
      });
    } catch {
      setIsBlackout(false);
      setBildirim('Güvenli mod kapatıldı');
    }
  };

  /**
   * V7.0 — preset’i tüm ilgili state’lere uygular (timer başlatmaz).
   * Audio sync açıksa mikrofon izni denenir; blackout’ta no-op.
   */
  const applyPreset = async (preset: RejiPreset, options?: { slotId?: PresetSlotId }) => {
    if (isBlackout) return;

    try {
      void triggerSelection();

      setSelectedTribun(preset.selectedTribun);
      setSelectedScenario(preset.selectedScenario);
      setBpm(preset.bpm);

      if (preset.selectedScenario) {
        const scenario = SCENARIOS.find((s) => s.id === preset.selectedScenario);
        if (scenario) setSistemDurumu(scenario.status);
      }

      if (preset.isListeningAudio) {
        const granted = await requestMicAccessSafe();
        if (granted) {
          setDetectedBpm(DEFAULT_DETECTED_BPM);
          setMicLevelDb(nextMicLevelDb());
          setIsListeningAudio(true);
        } else {
          setIsListeningAudio(false);
          pushLog('MIC ACCESS DENIED — profil audio sync kapalı');
        }
      } else {
        setIsListeningAudio(false);
        setMicLevelDb(-30);
      }

      if (options?.slotId) {
        setActiveSlotId(options.slotId);
      }

      const tribun =
        TRIBUNES.find((t) => t.id === preset.selectedTribun)?.label ?? preset.selectedTribun;
      setBildirim(`Profil uygulandı: ${preset.name}`);
      pushLog(`Profil: ${preset.name} · ${preset.bpm} BPM · ${tribun}`);
      publishPayload('SET_BPM', {
        bpm: preset.bpm,
        tribun: preset.selectedTribun,
      });
    } catch {
      setBildirim('Profil uygulanamadı');
      pushLog('PRESET APPLY ERROR');
    }
  };

  /** V7.0 — hızlı hafıza slotunu yükle. */
  const handleLoadPresetSlot = (id: PresetSlotId) => {
    if (isBlackout) return;
    void applyPreset(presetSlots[id], { slotId: id });
  };

  /** V7.0 — mevcut konfigürasyonu seçili slota kaydet (uzun basış). */
  const handleSavePresetSlot = (id: PresetSlotId) => {
    if (isBlackout) return;
    try {
      void triggerImpact('medium');
      const next: RejiPreset = {
        ...buildCurrentPreset({
          name: presetSlots[id].name,
          selectedScenario,
          bpm,
          selectedTribun,
          isListeningAudio,
        }),
      };
      setPresetSlots((prev) => ({ ...prev, [id]: next }));
      setActiveSlotId(id);
      setBildirim(`${presetSlots[id].name} kaydedildi`);
      pushLog(`Profil kaydedildi: ${presetSlots[id].name}`);
    } catch {
      setBildirim('Profil kaydı başarısız');
    }
  };

  /** V7.0 — currentPreset JSON’unu panoya kopyala + Alert ile göster. */
  const handleExportPreset = async () => {
    if (isBlackout) return;
    try {
      const json = serializePreset(currentPreset);
      await Clipboard.setStringAsync(json);
      void triggerSelection();
      setBildirim('Profil JSON panoya kopyalandı');
      pushLog('PRESET EXPORT OK');
      Alert.alert('Profil Dışa Aktarıldı', json);
    } catch {
      try {
        const json = serializePreset(currentPreset);
        Alert.alert('Profil JSON', json);
        setBildirim('Profil JSON gösterildi (pano kullanılamadı)');
      } catch {
        setBildirim('Profil dışa aktarılamadı');
        pushLog('PRESET EXPORT ERROR');
      }
    }
  };

  /** V7.0 — panodaki JSON profili parse edip tüm state’lere uygula. */
  const handleImportPreset = async () => {
    if (isBlackout) return;
    try {
      void triggerImpact('medium');
      const raw = await Clipboard.getStringAsync();
      const preset = deserializePreset(raw);
      if (!preset) {
        Alert.alert(
          'Profil Yüklenemedi',
          'Panoda geçerli bir Reji profil JSON’u bulunamadı. Önce EXPORT yapın veya JSON kopyalayın.',
        );
        pushLog('PRESET IMPORT INVALID');
        return;
      }

      // İçe aktarılan profili aktif slota da yaz (kalıcı hafıza)
      setPresetSlots((prev) => ({
        ...prev,
        [activeSlotId]: {
          ...preset,
          name: prev[activeSlotId].name,
        },
      }));
      await applyPreset({ ...preset, name: presetSlots[activeSlotId].name });
      pushLog('PRESET IMPORT OK');
    } catch {
      setBildirim('Profil içe aktarılamadı');
      pushLog('PRESET IMPORT ERROR');
      Alert.alert('Hata', 'Profil içe aktarma sırasında bir hata oluştu.');
    }
  };

  /** Sinyal kutusu vurgu renkleri (duruma göre). */
  const signalAccent = isBlackout
    ? '#F87171'
    : isPaused
      ? '#FB923C'
      : timerRunning
        ? '#FBBF24'
        : isLive
          ? '#F87171'
          : isSync
            ? '#A78BFA'
            : '#34D399';

  const signalBorder = isBlackout
    ? 'rgba(248, 113, 113, 0.7)'
    : isPaused
      ? 'rgba(251, 146, 60, 0.5)'
      : timerRunning
        ? 'rgba(251, 191, 36, 0.5)'
        : isLive
          ? 'rgba(248, 113, 113, 0.55)'
          : isSync
            ? 'rgba(167, 139, 250, 0.45)'
            : 'rgba(52, 211, 153, 0.35)';

  // V14 — playback dispatch (kayıt döngüsünü kırar)
  macroDispatchRef.current = (event: MacroEvent) => {
    try {
      isPlayingMacroRef.current = true;
      switch (event.type) {
        case 'ACTION':
          if (event.payload.actionId) handleAction(event.payload.actionId);
          break;
        case 'TRIBUN':
          if (event.payload.tribunId) handleTribunSelect(event.payload.tribunId);
          break;
        case 'SCENARIO': {
          const scenario = SCENARIOS.find((s) => s.id === event.payload.scenarioId);
          if (scenario) handleScenarioSelect(scenario);
          break;
        }
        case 'BPM':
          if (event.payload.bpm) handleBpmSelect(event.payload.bpm);
          break;
        case 'PAUSE_TOGGLE':
          handlePauseToggle();
          break;
        case 'AUDIO_TOGGLE':
          void handleAudioListenToggle();
          break;
        default:
          break;
      }
    } catch {
      pushLog('MACRO DISPATCH ERROR');
    } finally {
      isPlayingMacroRef.current = false;
    }
  };

  const abortMacroPlayback = (reason = "ABORT") => {
    try {
      timelineRef.current.abortPlayback();
      isPlayingMacroRef.current = false;
      setIsPlayingMacro(false);
      setMacroProgress(0);
      pushLog('MACRO PLAYBACK ' + reason);
    } catch {
      setIsPlayingMacro(false);
    }
  };

  const handleMacroRecord = () => {
    try {
      if (!macroRecordEnabled) {
        setBildirim('Makro kayıt kilidi / blackout');
        pushLog('MACRO REC DENIED');
        void triggerErrorHaptic();
        return;
      }
      if (isRecordingMacro) return;
      timelineRef.current.startRecording("Reji Macro");
      setIsRecordingMacro(true);
      setMacroProgress(0);
      setMacroSequence(timelineRef.current.getSequence());
      setBildirim('MACRO REC · kayıt başladı');
      pushLog('MACRO REC START');
      void triggerImpact('medium');
    } catch {
      setBildirim('Makro kayıt başlatılamadı');
    }
  };

  const handleMacroStop = () => {
    try {
      if (isPlayingMacro) {
        abortMacroPlayback('STOPPED');
        setBildirim('Makro oynatma durduruldu');
        return;
      }
      if (isRecordingMacro) {
        const seq = timelineRef.current.stopRecording();
        setIsRecordingMacro(false);
        setMacroSequence(seq);
        setBildirim('MACRO STOP · ' + seq.events.length + ' olay');
        pushLog('MACRO REC STOP · ' + seq.events.length + ' events');
        return;
      }
      setBildirim('Aktif makro yok');
    } catch {
      setIsRecordingMacro(false);
      setIsPlayingMacro(false);
    }
  };

  const handleMacroPlay = () => {
    try {
      if (!macroPlayEnabled) {
        setBildirim('Makro oynatma yalnızca LEAD OPERATOR');
        pushLog('MACRO PLAY DENIED');
        void triggerErrorHaptic();
        return;
      }
      const seq =
        macroSequence.events.length > 0
          ? macroSequence
          : timelineRef.current.getSequence();
      if (!seq.events.length) {
        setBildirim('Oynatılacak makro yok');
        return;
      }
      setMacroSequence(seq);
      setMacroProgress(0);
      setIsPlayingMacro(true);
      isPlayingMacroRef.current = false;
      pushLog('MACRO PLAY START · ' + seq.events.length + ' events');
      setBildirim('MACRO PLAY');
      const ok = timelineRef.current.play(seq, {
        onEvent: (event) => macroDispatchRef.current(event),
        onProgress: (p) => setMacroProgress(p.progress),
        onComplete: () => {
          setIsPlayingMacro(false);
          setMacroProgress(1);
          pushLog('MACRO PLAYBACK COMPLETE');
          setBildirim('Makro tamamlandı');
        },
        onAbort: () => {
          setIsPlayingMacro(false);
          setMacroProgress(0);
        },
      });
      if (!ok) {
        setIsPlayingMacro(false);
        setBildirim('Makro oynatılamadı');
      }
    } catch {
      setIsPlayingMacro(false);
      pushLog('MACRO PLAY ERROR');
    }
  };


  const handleExportMatchReport = async () => {
    try {
      blackboxRef.current.append('SYSTEM', 'MATCH REPORT EXPORT');
      setBlackboxLogs(blackboxRef.current.getLogs());
      const report = blackboxRef.current.buildReport();
      const text = serializeMatchReportJson(report);
      await Clipboard.setStringAsync(text);
      setBildirim(
        'MATCH REPORT · ' +
          report.totalEvents +
          ' olay · avg FPS ' +
          report.telemetry.avgFps +
          ' · max RAM ' +
          report.telemetry.maxMemoryMb +
          ' MB',
      );
      pushLog('BLACKBOX EXPORT OK · ' + report.totalEvents + ' events');
      void triggerImpact('medium');
    } catch {
      setBildirim('Maç raporu dışa aktarılamadı');
      pushLog('BLACKBOX EXPORT ERROR');
      void triggerErrorHaptic();
    }
  };

  const handleRequestLockToggle = () => {
    try {
      if (!canManageLock(operatorRole)) {
        setBildirim('Yalnızca LEAD OPERATOR kilit yönetebilir');
        pushLog('AUTH DENIED — lock manage');
        void triggerErrorHaptic();
        return;
      }
      setPinError(false);
      setLockPinPrompt(isConsoleLocked ? 'unlock' : 'lock');
    } catch {
      setBildirim('Kilit isteği başarısız');
    }
  };

  const handleSubmitLockPin = (pin: string) => {
    try {
      if (!verifyOperatorPin(pin)) {
        setPinError(true);
        setBildirim('INVALID PIN');
        pushLog('AUTH INVALID PIN');
        void triggerErrorHaptic();
        return;
      }
      setPinError(false);
      if (isConsoleLocked || lockPinPrompt === 'unlock') {
        setIsConsoleLocked(false);
        setLockPinPrompt(null);
        setBildirim('CONSOLE UNLOCKED');
        pushLog('SECURITY_UNLOCK');
        publishPayload('SECURITY_UNLOCK');
        void triggerSelection();
        return;
      }
      setIsConsoleLocked(true);
      setLockPinPrompt(null);
      setBildirim('CONSOLE LOCKED');
      pushLog('SECURITY_LOCK');
      publishPayload('SECURITY_LOCK');
      void triggerImpact('medium');
    } catch {
      setPinError(true);
      void triggerErrorHaptic();
    }
  };

  const handleDismissPinError = () => setPinError(false);

  const handleCancelLockPrompt = () => {
    setLockPinPrompt(null);
    setPinError(false);
  };

  const handleCycleOperatorRole = () => {
    try {
      if (isConsoleLocked) return;
      if (operatorRole !== 'LEAD_OPERATOR') {
        setBildirim('Rol değiştirmek için LEAD OPERATOR olun');
        return;
      }
      const next = nextOperatorRole(operatorRole);
      setOperatorRole(next);
      setBildirim('ROLE: ' + formatOperatorRoleLabel(next));
      pushLog('ROLE -> ' + next);
      void triggerSelection();
    } catch {
      // ignore
    }
  };

  const handleArtNetUniverseSelect = (id: ArtNetUniverseId) => {
    if (isBlackout) return;
    setArtNetConfig((prev) => ({ ...prev, selectedUniverse: id }));
    artNetRef.current?.applyConfig({ selectedUniverse: id });
    setBildirim(`Art-Net Universe ${id} seçildi`);
    pushLog(`ART-NET UNIVERSE ${id}`);
  };

  const handleArtNetCycleNet = () => {
    if (isBlackout) return;
    setArtNetConfig((prev) => {
      const net = prev.net >= 7 ? 0 : prev.net + 1;
      artNetRef.current?.applyConfig({ net });
      return { ...prev, net };
    });
  };

  const handleArtNetCycleSubnet = () => {
    if (isBlackout) return;
    setArtNetConfig((prev) => {
      const subnet = prev.subnet >= 15 ? 0 : prev.subnet + 1;
      artNetRef.current?.applyConfig({ subnet });
      return { ...prev, subnet };
    });
  };

  return {
    // state
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
    blackboxLogs,
    blackboxEventCount: blackboxLogs.length,
    blackboxTerminalLogs: blackboxLogs.slice(-BLACKBOX_TERMINAL_LINES),
    networkConfig,
    networkEndpoint,
    networkTransport,
    networkError,
    lastTxTransport,
    // derived
    effectiveBpm,
    timerHasTime,
    timerRunning,
    isSync,
    signalAccent,
    signalBorder,
    // handlers
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
    handleExportMatchReport,
  };
}
