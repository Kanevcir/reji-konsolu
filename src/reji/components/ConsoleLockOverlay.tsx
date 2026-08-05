/**
 * V12.0 — CONSOLE LOCKED PIN katmanı (semi-transparent modal).
 */

import { memo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { PIN_LENGTH, normalizePinInput } from '../securityLock';
import { rejiStyles as styles } from '../styles';

type Props = {
  visible: boolean;
  pinError: boolean;
  /** Kilit açıkken PIN ile kilitleme — iptal göster. */
  showCancel?: boolean;
  onSubmitPin: (pin: string) => void;
  onDismissError: () => void;
  onCancel?: () => void;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

function ConsoleLockOverlayComponent({
  visible,
  pinError,
  showCancel = false,
  onSubmitPin,
  onDismissError,
  onCancel,
}: Props) {
  const [digits, setDigits] = useState('');

  if (!visible) return null;

  const pushDigit = (key: string) => {
    if (pinError) onDismissError();

    if (key === '⌫') {
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    if (!key) return;

    setDigits((prev) => {
      const next = normalizePinInput(prev + key);
      if (next.length === PIN_LENGTH) {
        // Bir sonraki tick’te submit — state güncellensin
        setTimeout(() => {
          onSubmitPin(next);
          setDigits('');
        }, 40);
      }
      return next;
    });
  };

  return (
    <View style={styles.lockOverlay} pointerEvents="auto">
      <View style={styles.lockModal}>
        <Text style={styles.lockModalTitle}>CONSOLE LOCKED</Text>
        <Text style={styles.lockModalSubtitle}>ENTER PIN TO UNLOCK</Text>

        <View style={styles.lockPinRow}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={`pin-${i}`}
              style={[
                styles.lockPinDot,
                i < digits.length && styles.lockPinDotFilled,
                pinError && styles.lockPinDotError,
              ]}
            />
          ))}
        </View>

        {pinError ? <Text style={styles.lockPinError}>INVALID PIN</Text> : null}

        <View style={styles.lockKeypad}>
          {KEYS.map((key, index) => {
            if (!key) {
              return <View key={`pad-empty-${index}`} style={styles.lockKeyEmpty} />;
            }
            return (
              <TouchableOpacity
                key={`pad-${key}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={key === '⌫' ? 'Sil' : `Rakam ${key}`}
                activeOpacity={0.75}
                onPress={() => pushDigit(key)}
                style={styles.lockKey}>
                <Text style={styles.lockKeyText}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {showCancel && onCancel ? (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.75}
            onPress={onCancel}
            style={styles.lockToggleBtn}>
            <Text style={styles.lockToggleBtnText}>İPTAL</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export const ConsoleLockOverlay = memo(ConsoleLockOverlayComponent);
