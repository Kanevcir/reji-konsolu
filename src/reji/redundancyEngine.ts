/**
 * V19.0 — Çift Konsol Otomatik Yedeklilik (Hot-Standby & Failover).
 * HEARTBEAT 500ms; SLAVE 1.5s (3 HB) sessizlikte MASTER’a auto-promote.
 */

import { getSyncedTimestamp } from './clockSync';
import type { MacroSequence } from './timelineSequencer';
import type { OutgoingPayload } from './types';

export type ConsoleRole = 'MASTER' | 'SLAVE' | 'STANDALONE';
export type PeerStatus = 'CONNECTED' | 'DISCONNECTED';

export const HEARTBEAT_INTERVAL_MS = 500;
/** 3 heartbeat kaçırılınca failover. */
export const MASTER_TIMEOUT_MS = 1500;

export type RedundancySyncState = {
  zoneMask: number;
  bpm: number;
  macro: MacroSequence;
  payload: OutgoingPayload;
};

export type RedundancyHeartbeatPacket = {
  type: 'HEARTBEAT';
  role: ConsoleRole;
  consoleId: string;
  ts: number;
};

export type RedundancySyncPacket = {
  type: 'SYNC_STATE';
  role: 'MASTER';
  consoleId: string;
  ts: number;
  zoneMask: number;
  bpm: number;
  macro: MacroSequence;
  payload: OutgoingPayload;
};

export type RedundancyPacket = RedundancyHeartbeatPacket | RedundancySyncPacket;

export const FAILOVER_BLACKBOX_MSG =
  'FAILOVER_TRIGGERED: SLAVE_PROMOTED_TO_MASTER';

export function createConsoleId(): string {
  try {
    return `reji-${getSyncedTimestamp().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
  } catch {
    return `reji-${Date.now()}`;
  }
}

export function isRedundancyPacket(raw: string): boolean {
  try {
    if (!raw.includes('"HEARTBEAT"') && !raw.includes('"SYNC_STATE"')) {
      return false;
    }
    const parsed = JSON.parse(raw) as { type?: string };
    return parsed.type === 'HEARTBEAT' || parsed.type === 'SYNC_STATE';
  } catch {
    return false;
  }
}

export function parseRedundancyPacket(raw: string): RedundancyPacket | null {
  try {
    const parsed = JSON.parse(raw) as RedundancyPacket;
    if (parsed?.type === 'HEARTBEAT' || parsed?.type === 'SYNC_STATE') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function formatConsoleRoleBadge(role: ConsoleRole): string {
  if (role === 'MASTER') return 'MASTER (ACTIVE)';
  if (role === 'SLAVE') return 'SLAVE (STANDBY)';
  return 'STANDALONE';
}

export type RedundancyEngineHandlers = {
  /** WS/UDP üzerinden ham paket gönder. */
  sendRaw: (body: string) => void | Promise<void>;
  /** MASTER sync içeriği. */
  getSyncState: () => RedundancySyncState;
  onRoleChange?: (role: ConsoleRole, reason: string) => void;
  onPeerStatus?: (status: PeerStatus) => void;
  onSyncState?: (state: RedundancySyncState) => void;
};

/**
 * Hot-standby motoru — timer’lar try-catch korumalı.
 */
export class RedundancyEngine {
  readonly consoleId: string;
  private role: ConsoleRole = 'STANDALONE';
  private peerStatus: PeerStatus = 'DISCONNECTED';
  private lastPeerHeartbeatAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private handlers: RedundancyEngineHandlers | null = null;

  constructor(consoleId = createConsoleId()) {
    this.consoleId = consoleId;
  }

  getRole() {
    return this.role;
  }

  getPeerStatus() {
    return this.peerStatus;
  }

  start(handlers: RedundancyEngineHandlers) {
    this.stop();
    this.handlers = handlers;
    this.timer = setInterval(() => {
      try {
        this.tick();
      } catch {
        // tick hatası motoru bozmaz
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setRole(next: ConsoleRole, reason = 'manual') {
    if (this.role === next) return;
    this.role = next;
    if (next === 'STANDALONE') {
      this.setPeerStatus('DISCONNECTED');
      this.lastPeerHeartbeatAt = 0;
    }
    try {
      this.handlers?.onRoleChange?.(next, reason);
    } catch {
      // ignore
    }
  }

  /** Dışarıdan gelen WS/UDP mesajı. */
  handleIncoming(raw: string) {
    try {
      const packet = parseRedundancyPacket(raw);
      if (!packet) return;
      if (packet.consoleId === this.consoleId) return;

      this.lastPeerHeartbeatAt = getSyncedTimestamp();
      this.setPeerStatus('CONNECTED');

      if (packet.type === 'HEARTBEAT') {
        // SLAVE iken MASTER heartbeat’i takip
        return;
      }

      if (packet.type === 'SYNC_STATE' && this.role === 'SLAVE') {
        this.handlers?.onSyncState?.({
          zoneMask: packet.zoneMask,
          bpm: packet.bpm,
          macro: packet.macro,
          payload: packet.payload,
        });
      }
    } catch {
      // ignore
    }
  }

  /** SLAVE → MASTER (oto veya manuel). */
  promoteToMaster(reason: 'auto' | 'manual' = 'manual') {
    try {
      const wasSlave = this.role === 'SLAVE';
      this.setRole(
        'MASTER',
        reason === 'auto' ? 'auto-promote' : 'manual-promote',
      );
      return wasSlave && reason === 'auto';
    } catch {
      return false;
    }
  }

  switchToSlave() {
    this.setRole('SLAVE', 'manual-slave');
    this.lastPeerHeartbeatAt = getSyncedTimestamp();
  }

  switchToStandalone() {
    this.setRole('STANDALONE', 'manual-standalone');
  }

  private setPeerStatus(next: PeerStatus) {
    if (this.peerStatus === next) return;
    this.peerStatus = next;
    try {
      this.handlers?.onPeerStatus?.(next);
    } catch {
      // ignore
    }
  }

  private tick() {
    if (!this.handlers) return;
    const now = getSyncedTimestamp();

    // SLAVE: MASTER sessizliği → auto-promote
    if (this.role === 'SLAVE') {
      const last = this.lastPeerHeartbeatAt || now;
      // İlk SLAVE geçişinde lastPeer set edilir; peer yoksa timeout
      if (now - last >= MASTER_TIMEOUT_MS) {
        this.setPeerStatus('DISCONNECTED');
        this.promoteToMaster('auto');
      }
    } else if (this.role === 'MASTER' || this.role === 'STANDALONE') {
      // Peer heartbeat zaman aşımı
      if (
        this.lastPeerHeartbeatAt > 0 &&
        now - this.lastPeerHeartbeatAt >= MASTER_TIMEOUT_MS
      ) {
        this.setPeerStatus('DISCONNECTED');
      }
    }

    void this.emitHeartbeatAndSync();
  }

  private async emitHeartbeatAndSync() {
    if (!this.handlers) return;
    try {
      const hb: RedundancyHeartbeatPacket = {
        type: 'HEARTBEAT',
        role: this.role,
        consoleId: this.consoleId,
        ts: getSyncedTimestamp(),
      };
      await this.handlers.sendRaw(JSON.stringify(hb));

      if (this.role === 'MASTER') {
        const sync = this.handlers.getSyncState();
        const packet: RedundancySyncPacket = {
          type: 'SYNC_STATE',
          role: 'MASTER',
          consoleId: this.consoleId,
          ts: getSyncedTimestamp(),
          zoneMask: sync.zoneMask,
          bpm: sync.bpm,
          macro: sync.macro,
          payload: sync.payload,
        };
        await this.handlers.sendRaw(JSON.stringify(packet));
      }
    } catch {
      // gönderim hatası tick’i bozmaz
    }
  }
}
