/**
 * V3.0 Donanım Katmanı — güvenli haptic / titreşim sarmalayıcıları.
 * expo-haptics başarısız olursa Vibration API’ye düşer; her iki yol da try/catch ile korunur.
 */

import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

export type ImpactStrength = 'heavy' | 'medium' | 'light';

/** Haptic motor kullanılabilir mi (runtime’da güncellenir). */
let hapticMotorReady = true;

/** Haptic motor durumunu okur (UI paneli için). */
export function isHapticMotorActive() {
  return hapticMotorReady;
}

/** Motoru güvenli şekilde pasife alır (cihaz desteklemiyor / hata). */
function markHapticUnavailable() {
  hapticMotorReady = false;
}

/**
 * Vibration fallback — web’de no-op, native’de kısa darbe.
 * Hata olursa sessizce yutulur (uygulama çökmez).
 */
function vibrateFallback(patternMs: number | number[] = 20) {
  try {
    if (Platform.OS === 'web') return;
    Vibration.vibrate(patternMs);
  } catch {
    // Donanım yok / izin yok — güvenli no-op
  }
}

/**
 * Impact Feedback (Heavy / Medium / Light).
 * Önce expo-haptics dener; olmazsa Vibration’a düşer.
 */
export async function triggerImpact(strength: ImpactStrength = 'medium') {
  try {
    const style =
      strength === 'heavy'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : strength === 'light'
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium;

    await Haptics.impactAsync(style);
    hapticMotorReady = true;
  } catch {
    markHapticUnavailable();
    vibrateFallback(strength === 'heavy' ? 40 : strength === 'light' ? 12 : 22);
  }
}

/**
 * BPM ritmine uygun hafif haptic pulse.
 * LED beat ile aynı tempoda çağrılır; Light impact tercih edilir.
 */
export async function triggerRhythmPulse() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    hapticMotorReady = true;
  } catch {
    markHapticUnavailable();
    vibrateFallback(10);
  }
}

/** Selection tick — küçük UI seçimleri için (tribün / BPM). */
export async function triggerSelection() {
  try {
    await Haptics.selectionAsync();
    hapticMotorReady = true;
  } catch {
    markHapticUnavailable();
    vibrateFallback(8);
  }
}

/**
 * V12.0 — Haptic Error (geçersiz PIN vb.).
 * Notification error + kısa titreşim deseni.
 */
export async function triggerErrorHaptic() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    hapticMotorReady = true;
  } catch {
    markHapticUnavailable();
    vibrateFallback([0, 40, 40, 40]);
  }
}
