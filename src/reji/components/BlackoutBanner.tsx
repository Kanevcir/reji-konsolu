/**
 * V6.0 — Blackout / Safe Mode uyarı bandı.
 */

import { Text, TouchableOpacity, View } from 'react-native';

import { rejiStyles as styles } from '../styles';

type BlackoutBannerProps = {
  visible: boolean;
  onRequestExit: () => void;
};

export function BlackoutBanner({ visible, onRequestExit }: BlackoutBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.blackoutBanner}>
      <Text style={styles.blackoutBannerTitle}>SİSTEM GÜVENLİ MODDA (BLACKOUT ACTIVE)</Text>
      <Text style={styles.blackoutBannerHint}>
        Timer, haptic, audio ve LED matris durduruldu. Çıkmak için manuel onay gerekir.
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Güvenli moddan çıkış onayı iste"
        activeOpacity={0.75}
        onPress={onRequestExit}
        style={styles.blackoutExitBtn}>
        <Text style={styles.blackoutExitBtnText}>GÜVENLİ MODDAN ÇIK (ONAY GEREKLİ)</Text>
      </TouchableOpacity>
    </View>
  );
}
