/**
 * V4.0 — Audio Beat Detection & Microphone Sync (simülasyon + güvenli fallback).
 * Gerçek mikrofon yoksa bile stadyum ritmi tespit ediliyormuş gibi BPM üretir.
 */

/** Canlı dinlemede BPM alt/üst sınırları. */
export const AUTO_BPM_MIN = 110;
export const AUTO_BPM_MAX = 135;

/** Varsayılan tespit edilen BPM (manuel 120 ile uyumlu orta değer). */
export const DEFAULT_DETECTED_BPM = 120;

/** Mikrofon seviye aralığı (dB, simüle). */
export const MIC_DB_MIN = -52;
export const MIC_DB_MAX = -8;

/**
 * Mikrofon erişimini dener / simüle eder.
 * Hata olursa false döner; uygulama çökmez.
 */
export async function requestMicAccessSafe(): Promise<boolean> {
  try {
    // V4.0: gerçek Audio API bağlanana kadar güvenli simülasyon
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  } catch {
    return false;
  }
}

/**
 * Önceki BPM’e göre 110–135 aralığında rastgele yürüyüş.
 * Ani sıçrama yerine küçük delta ile “canlı tespit” hissi verir.
 */
export function nextDetectedBpm(previous: number) {
  try {
    const delta = Math.floor(Math.random() * 5) - 2; // -2..+2
    const next = previous + delta;
    return Math.min(AUTO_BPM_MAX, Math.max(AUTO_BPM_MIN, next));
  } catch {
    return DEFAULT_DETECTED_BPM;
  }
}

/**
 * Mikrofon giriş seviyesini dB olarak simüle eder.
 * dB → 0..1 normalize için `normalizeMicLevel` kullanılır.
 */
export function nextMicLevelDb() {
  try {
    return MIC_DB_MIN + Math.random() * (MIC_DB_MAX - MIC_DB_MIN);
  } catch {
    return -30;
  }
}

/** dB değerini 0–1 arası bar doluluğuna çevirir. */
export function normalizeMicLevel(db: number) {
  try {
    const clamped = Math.min(MIC_DB_MAX, Math.max(MIC_DB_MIN, db));
    return (clamped - MIC_DB_MIN) / (MIC_DB_MAX - MIC_DB_MIN);
  } catch {
    return 0.4;
  }
}
