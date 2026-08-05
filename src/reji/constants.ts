/**
 * Reji Kontrol Konsolu V1.0 — sabitler ve katalog verileri.
 */

import type {
  BpmOption,
  LedOption,
  ModuleBadge,
  RejiAction,
  ScenarioOption,
  TribunOption,
} from './types';

/** Koreografi / senaryo geri sayım süresi (saniye). */
export const TIMER_SECONDS = 15;

/** Varsayılan ritim hızı. */
export const DEFAULT_BPM: BpmOption = 120;

/** Bekleme / hazır sinyal metinleri. */
export const DEFAULT_STATUS = 'Sistem Hazır — 120 FPS Senkron';
export const READY_STATUS = 'Sistem Hazır - Beklemede';
export const LIVE_STATUS = 'KOREOGRAFİ CANLI YAYINDA! (Tribünler Aktif)';
export const PAUSED_STATUS = 'KOREOGRAFİ DURAKLATILDI';

/** Gecikme paneli varsayılan değeri (ms). */
export const DEFAULT_LATENCY = 12;

/** Seçilebilir BPM değerleri. */
export const BPM_OPTIONS: BpmOption[] = [100, 120, 140];

/** Tribün hedef seçenekleri. */
export const TRIBUNES: TribunOption[] = [
  { id: 'all', label: 'Tüm Stadyum' },
  { id: 'ns', label: 'Kuzey/Güney (Kale Arkaları)' },
  { id: 'ew', label: 'Doğu/Batı' },
];

/** Hazır koreografi senaryoları. */
export const SCENARIOS: ScenarioOption[] = [
  {
    id: 'opening',
    title: 'AÇILIŞ DEV MOKAJP (Işık + Ritim)',
    status: 'Senaryo: Açılış Dev Mokajp — Işık + Ritim hazır',
  },
  {
    id: 'goal',
    title: 'GOL SEVİNCİ (Flaş Işık Fırtınası)',
    status: 'Senaryo: Gol Sevinci — Flaş Işık Fırtınası yüklendi',
  },
  {
    id: 'victory',
    title: 'GALİBİYET RİTMİ (Sarı-Kırmızı Dalga)',
    status: 'Senaryo: Galibiyet Ritmi — Sarı-Kırmızı Dalga hazır',
  },
];

/** Ana reji aksiyon butonları. */
export const ACTIONS: RejiAction[] = [
  {
    id: 'live',
    label: 'KOREOGRAFİ BAŞLAT',
    colors: ['#059669', '#0284C7'],
  },
  {
    id: 'sync',
    label: 'IŞIK & RİTİM SENKRONU',
    colors: ['#7C3AED', '#1E3A8A'],
  },
  {
    id: 'reset',
    label: 'SİSTEMİ SIFIRLA',
    colors: ['#DC2626', '#991B1B'],
  },
];

/** Galatasaray temalı LED renk döngüsü (sarı / kırmızı / beyaz). */
export const GS_LIGHTS = ['#FDB913', '#A90432', '#FFFFFF', '#FDB913'] as const;

/** Dört yönlü sanal tribün LED yerleşimi. */
export const LEDS: LedOption[] = [
  { id: 'north', label: 'Kuzey', group: 'ns', position: 'top' },
  { id: 'south', label: 'Güney', group: 'ns', position: 'bottom' },
  { id: 'east', label: 'Doğu', group: 'ew', position: 'right' },
  { id: 'west', label: 'Batı', group: 'ew', position: 'left' },
];

/**
 * V5.0 — Çoklu açı reji monitörü kamera kareleri.
 * group: tribün filtresi ile STANDBY / OUT OF SCOPE hesabı için.
 */
export const MULTI_VIEW_CAMERAS = [
  {
    id: 'cam1',
    camLabel: 'CAM 1',
    title: 'Kuzey Tribünü',
    subtitle: 'Dev Mozaik',
    group: 'ns' as const,
    colorOffset: 0,
  },
  {
    id: 'cam2',
    camLabel: 'CAM 2',
    title: 'Güney Tribünü',
    subtitle: 'Işık & Ritim',
    group: 'ns' as const,
    colorOffset: 1,
  },
  {
    id: 'cam3',
    camLabel: 'CAM 3',
    title: 'Doğu Tribünü',
    subtitle: 'Sarı-Kırmızı Dalga',
    group: 'ew' as const,
    colorOffset: 2,
  },
  {
    id: 'cam4',
    camLabel: 'CAM 4',
    title: 'Batı Tribünü',
    subtitle: 'Saha İçi Reji Açısı',
    group: 'ew' as const,
    colorOffset: 3,
  },
] as const;

/** V1.0 tamamlanan modül rozetleri. */
export const MODULE_BADGES: ModuleBadge[] = [
  { id: 'core', label: 'V1.0 Çekirdek' },
  { id: 'led', label: 'LED Matris' },
  { id: 'tribun', label: 'Tribün Ayrıştırıcı' },
  { id: 'timer', label: 'Timer & Ping' },
];

/** Ekranda tutulacak maksimum log satırı. */
export const MAX_VISIBLE_LOGS = 3;

/** ACK gecikmesi alt/üst sınır (ms). */
export const ACK_DELAY_MIN_MS = 50;
export const ACK_DELAY_MAX_MS = 100;
