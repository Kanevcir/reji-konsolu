/**
 * Reji Kontrol Konsolu V1.0 — paylaşılan tip tanımları.
 * Tüm state makinesi ve UI seçimleri bu tipler üzerinden ilerler.
 */

/** Ana çalışma modu: bekleme, canlı koreografi veya ritim senkronu. */
export type RejiMode = 'idle' | 'live' | 'sync';

/** Tribün hedefi: tüm stadyum, kale arkaları veya yan tribünler. */
export type TribunId = 'all' | 'ns' | 'ew';

/** Hazır koreografi senaryosu kimliği. */
export type ScenarioId = 'opening' | 'goal' | 'victory';

/** Ritim hızı seçenekleri (BPM). */
export type BpmOption = 100 | 120 | 140;

/** Sanal stadyum LED konum kimlikleri. */
export type LedId = 'north' | 'south' | 'east' | 'west';

/** LED’in hangi tribün grubuna ait olduğu. */
export type LedGroup = 'ns' | 'ew';

/** LED’in stadyum çerçevesindeki yerleşimi. */
export type LedPosition = 'top' | 'bottom' | 'left' | 'right';

/** Ana reji aksiyon butonu modeli. */
export type RejiAction = {
  id: RejiMode | 'reset';
  label: string;
  colors: [string, string];
};

/** Tribün seçim satırı modeli. */
export type TribunOption = {
  id: TribunId;
  label: string;
};

/** Senaryo kartı modeli. */
export type ScenarioOption = {
  id: ScenarioId;
  title: string;
  status: string;
};

/** Sanal stadyum LED modeli. */
export type LedOption = {
  id: LedId;
  label: string;
  group: LedGroup;
  position: LedPosition;
};

/** Zaman damgalı reji log satırı. */
export type RejiLogEntry = {
  id: string;
  time: string;
  message: string;
};

/** Sistem durum rozeti (tamamlanan V1.0 bileşenleri). */
export type ModuleBadge = {
  id: string;
  label: string;
};

/** V2.0/V6.0 ağ katmanı — dışarı yayınlanacak sinyal aksiyonları. */
export type OutgoingAction =
  | 'START_SHOW'
  | 'PAUSE'
  | 'RESET'
  | 'SET_BPM'
  | 'EMERGENCY_BLACKOUT'
  /** V12.0 — operatör kilit / güvenlik olayları */
  | 'SECURITY_LOCK'
  | 'SECURITY_UNLOCK';

/** V2.0 ağ katmanı — hedef tribün bölgesi. */
export type OutgoingTargetZone = 'ALL' | 'NORTH_SOUTH' | 'EAST_WEST';

/** V2.0/V6.0 ağ katmanı — yayın durumu. */
export type OutgoingStatus = 'ACTIVE' | 'IDLE' | 'SAFE_MODE';

/**
 * Canlı Outgoing Payload (yayınlanmaya hazır JSON paketi).
 * Ağ katmanına gönderilecek sinyal sözleşmesi.
 */
export type OutgoingPayload = {
  timestamp: number;
  action: OutgoingAction;
  targetZone: OutgoingTargetZone;
  bpm: number;
  status: OutgoingStatus;
};

/** V2.1 / V9.0 — WebSocket / hibrit ağ bağlantı durumu. */
export type SocketStatus =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'FALLBACK_UDP'
  /** @deprecated V9 — CONNECTING kullanın */
  | 'RECONNECTING';

/**
 * V2.1 — Payload teslim / ACK geri bildirimi.
 * PENDING: gönderildi, yanıt bekleniyor
 * ACK_RECEIVED: sunucu 200 OK
 * FAILED: soket kopuk veya zaman aşımı simülasyonu
 */
export type DeliveryStatus = 'IDLE' | 'PENDING' | 'ACK_RECEIVED' | 'FAILED';

