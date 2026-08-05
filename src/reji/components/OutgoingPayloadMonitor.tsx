/**
 * V2.0/V2.1 — Canlı Outgoing Payload Monitor + ACK delivery feedback.
 */

import { memo } from 'react';
import { Text, View } from 'react-native';

import { formatDeliveryLabel } from '../socket';
import { rejiStyles as styles } from '../styles';
import type { DeliveryStatus, OutgoingPayload } from '../types';
import type { NetworkTransport } from '../networkEngine';

type OutgoingPayloadMonitorProps = {
  payload: OutgoingPayload;
  deliveryStatus: DeliveryStatus;
  transport?: NetworkTransport;
};

function OutgoingPayloadMonitorComponent({
  payload,
  deliveryStatus,
  transport = 'offline',
}: OutgoingPayloadMonitorProps) {
  const jsonText = JSON.stringify(payload, null, 2);
  const acknowledged = deliveryStatus === 'ACK_RECEIVED';
  const pending = deliveryStatus === 'PENDING';
  const failed = deliveryStatus === 'FAILED';

  return (
    <View style={styles.payloadMonitor}>
      <Text style={styles.sectionLabel}>CANLI YAYINLANAN SİNYAL PAKETİ (OUTGOING JSON)</Text>
      <View style={styles.payloadBox}>
        <Text style={styles.payloadCode}>{jsonText}</Text>
      </View>

      <View
        style={[
          styles.ackRow,
          acknowledged && styles.ackRowOk,
          pending && styles.ackRowPending,
          failed && styles.ackRowFailed,
        ]}>
        <View
          style={[
            styles.ackDot,
            acknowledged && styles.ackDotOk,
            pending && styles.ackDotPending,
            failed && styles.ackDotFailed,
          ]}
        />
        <Text
          style={[
            styles.ackText,
            acknowledged && styles.ackTextOk,
            pending && styles.ackTextPending,
            failed && styles.ackTextFailed,
          ]}>
          {formatDeliveryLabel(deliveryStatus, transport)}
        </Text>
      </View>
    </View>
  );
}

export const OutgoingPayloadMonitor = memo(OutgoingPayloadMonitorComponent);
