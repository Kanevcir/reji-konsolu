/**
 * V2.1 / V9.0 Ağ Katmanı — WebSocket / ACK / link etiketleri.
 */

import { ACK_DELAY_MAX_MS, ACK_DELAY_MIN_MS } from './constants';
import type { NetworkLinkStatus, NetworkTransport } from './networkEngine';
import type { DeliveryStatus, SocketStatus } from './types';

/** 50–100 ms arası rastgele ACK gecikmesi (yerel soft-ACK). */
export function randomAckDelayMs() {
  return ACK_DELAY_MIN_MS + Math.floor(Math.random() * (ACK_DELAY_MAX_MS - ACK_DELAY_MIN_MS + 1));
}

/** SocketStatus ↔ NetworkLinkStatus normalize. */
export function normalizeLinkStatus(status: SocketStatus | NetworkLinkStatus): NetworkLinkStatus {
  if (status === 'RECONNECTING') return 'CONNECTING';
  return status as NetworkLinkStatus;
}

/** Üst paneller için okunabilir soket etiketi. */
export function formatSocketLabel(status: SocketStatus, endpoint?: string) {
  const link = normalizeLinkStatus(status);
  const ep = endpoint ?? '—';
  if (link === 'CONNECTED') return `SOCKET: ONLINE (${ep})`;
  if (link === 'CONNECTING') return `SOCKET: CONNECTING (${ep})`;
  if (link === 'FALLBACK_UDP') return `SOCKET: FALLBACK_UDP (${ep})`;
  return `SOCKET: DISCONNECTED (${ep})`;
}

/** Delivery satırı metni. */
export function formatDeliveryLabel(status: DeliveryStatus, transport?: NetworkTransport) {
  if (status === 'ACK_RECEIVED') {
    if (transport === 'udp_multicast') return 'STATUS: SENT VIA UDP_MULTICAST_FALLBACK';
    return 'STATUS: SENT & ACKNOWLEDGED';
  }
  if (status === 'PENDING') return 'STATUS: SENT — AWAITING ACK';
  if (status === 'FAILED') return 'STATUS: DELIVERY FAILED (LINK DOWN)';
  return 'STATUS: IDLE';
}

/** Telemetri / StatusPanel için transport etiketi. */
export function formatTransportLabel(transport: NetworkTransport) {
  if (transport === 'websocket') return 'WS';
  if (transport === 'udp_multicast') return 'UDP_MULTICAST';
  return 'OFFLINE';
}
