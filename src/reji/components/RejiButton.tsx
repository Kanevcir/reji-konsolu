/**
 * Ana reji aksiyon butonu — gradyanlı, yüksek dokunma alanı.
 * Basışta V3.0 Heavy/Medium haptic impact tetikler (güvenli fallback’li).
 */

import { Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { triggerImpact, type ImpactStrength } from '../haptics';
import { rejiStyles as styles } from '../styles';

type RejiButtonProps = {
  label: string;
  colors: [string, string];
  onPress: () => void;
  /** Uzun basma — örn. SİSTEMİ SIFIRLA ile DISCONNECTED simülasyonu. */
  onLongPress?: () => void;
  delayLongPress?: number;
  /** Dokunsal darbe gücü (varsayılan heavy — ana reji butonları). */
  hapticStrength?: ImpactStrength;
};

export function RejiButton({
  label,
  colors,
  onPress,
  onLongPress,
  delayLongPress = 650,
  hapticStrength = 'heavy',
}: RejiButtonProps) {
  const handlePress = () => {
    void triggerImpact(hapticStrength);
    onPress();
  };

  const handleLongPress = onLongPress
    ? () => {
        void triggerImpact('medium');
        onLongPress();
      }
    : undefined;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.72}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={delayLongPress}
      style={styles.buttonWrap}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
        <Text style={styles.buttonText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
