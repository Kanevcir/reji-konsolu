/**
 * V28.0 — Room Sharding (Tribün odaları) + Worker pool.
 * İstemciler EAST_TRIBUNE / WEST_TRIBUNE … odalarına ayrılır;
 * Reji komutları Pub/Sub ile odalara paralel dağıtılır.
 */

import type { EventBus } from './eventBus';
import type { StadiumTribuneId } from './seatPixelMap';
import type { OutgoingPayload } from './types';

export const ROOM_ALL = 'ALL_STADIUM';

export type ShardRoomId =
  | 'NORTH_TRIBUNE'
  | 'SOUTH_TRIBUNE'
  | 'EAST_TRIBUNE'
  | 'WEST_TRIBUNE'
  | typeof ROOM_ALL;

export const TRIBUNE_ROOMS: readonly ShardRoomId[] = [
  'NORTH_TRIBUNE',
  'SOUTH_TRIBUNE',
  'EAST_TRIBUNE',
  'WEST_TRIBUNE',
] as const;

export function tribuneToRoom(tribune: StadiumTribuneId): ShardRoomId {
  return `${tribune}_TRIBUNE` as ShardRoomId;
}

export function roomToTribune(room: ShardRoomId): StadiumTribuneId | null {
  if (room === ROOM_ALL) return null;
  const t = room.replace(/_TRIBUNE$/, '') as StadiumTribuneId;
  if (t === 'NORTH' || t === 'SOUTH' || t === 'EAST' || t === 'WEST') return t;
  return null;
}

export type WorkerStats = {
  workerId: string;
  clients: number;
  rooms: Record<string, number>;
  messagesIn: number;
  messagesOut: number;
};

/**
 * Tek WebSocket worker — kendi istemci setini tutar,
 * EventBus üzerinden oda kanallarını dinler.
 */
export class ScaleWorker {
  readonly workerId: string;
  private bus: EventBus;
  private clientsByRoom = new Map<ShardRoomId, Set<string>>();
  private clientRoom = new Map<string, ShardRoomId>();
  private unsubs: Array<() => void> = [];
  private messagesIn = 0;
  private messagesOut = 0;
  /** clientId → son payload (veya sayaç için callback). */
  private deliver: (clientId: string, room: ShardRoomId, raw: string) => void;

  constructor(
    workerId: string,
    bus: EventBus,
    deliver: (clientId: string, room: ShardRoomId, raw: string) => void,
  ) {
    this.workerId = workerId;
    this.bus = bus;
    this.deliver = deliver;
  }

  /** Worker’ı oda kanallarına abone et. */
  start() {
    this.stop();
    const channels: ShardRoomId[] = [...TRIBUNE_ROOMS, ROOM_ALL];
    for (const channel of channels) {
      const unsub = this.bus.subscribe(channel, (msg) => {
        this.messagesIn += 1;
        this.fanoutToLocal(msg.channel as ShardRoomId, msg.payload);
      });
      this.unsubs.push(unsub);
    }
  }

  stop() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  /** İstemciyi tribün odasına bağla. */
  join(clientId: string, room: ShardRoomId) {
    this.leave(clientId);
    let set = this.clientsByRoom.get(room);
    if (!set) {
      set = new Set();
      this.clientsByRoom.set(room, set);
    }
    set.add(clientId);
    this.clientRoom.set(clientId, room);
  }

  leave(clientId: string) {
    const room = this.clientRoom.get(clientId);
    if (!room) return;
    this.clientsByRoom.get(room)?.delete(clientId);
    this.clientRoom.delete(clientId);
  }

  getClientCount() {
    return this.clientRoom.size;
  }

  getStats(): WorkerStats {
    const rooms: Record<string, number> = {};
    for (const [room, set] of this.clientsByRoom) {
      rooms[room] = set.size;
    }
    return {
      workerId: this.workerId,
      clients: this.clientRoom.size,
      rooms,
      messagesIn: this.messagesIn,
      messagesOut: this.messagesOut,
    };
  }

  private fanoutToLocal(room: ShardRoomId, raw: string) {
    if (room === ROOM_ALL) {
      for (const [clientId, clientRoom] of this.clientRoom) {
        try {
          this.deliver(clientId, clientRoom, raw);
          this.messagesOut += 1;
        } catch {
          // ignore
        }
      }
      return;
    }
    const set = this.clientsByRoom.get(room);
    if (!set) return;
    for (const clientId of set) {
      try {
        this.deliver(clientId, room, raw);
        this.messagesOut += 1;
      } catch {
        // ignore
      }
    }
  }
}

export type ScaleClusterStats = {
  workers: number;
  clients: number;
  bus: ReturnType<EventBus['getStats']>;
  perWorker: WorkerStats[];
  deliveries: number;
};

/**
 * Çoklu worker cluster — Redis Pub/Sub omurgası.
 * Reji publish → bus → tüm worker’lar → oda istemcileri.
 */
export class ScaleCluster {
  private bus: EventBus;
  private workers: ScaleWorker[] = [];
  private clientWorker = new Map<string, ScaleWorker>();
  private deliveries = 0;
  /** Simülasyon: clientId → alınan mesaj sayısı. */
  readonly receiveCounts = new Map<string, number>();
  /** Son GOL/payload ham içeriği (doğrulama). */
  readonly lastPayloadByClient = new Map<string, string>();

  constructor(bus: EventBus, workerCount = 4) {
    this.bus = bus;
    const n = Math.max(1, workerCount);
    for (let i = 0; i < n; i++) {
      const worker = new ScaleWorker(`worker-${i}`, bus, (clientId, _room, raw) => {
        this.deliveries += 1;
        this.receiveCounts.set(
          clientId,
          (this.receiveCounts.get(clientId) ?? 0) + 1,
        );
        this.lastPayloadByClient.set(clientId, raw);
      });
      this.workers.push(worker);
    }
  }

  start() {
    for (const w of this.workers) w.start();
  }

  stop() {
    for (const w of this.workers) w.stop();
  }

  /**
   * İstemciyi worker’a hash ile ata + tribün odasına join.
   * Consistent-ish: clientId hash % workers.
   */
  connectClient(clientId: string, room: ShardRoomId) {
    const worker = this.pickWorker(clientId);
    worker.join(clientId, room);
    this.clientWorker.set(clientId, worker);
  }

  disconnectClient(clientId: string) {
    const w = this.clientWorker.get(clientId);
    if (w) w.leave(clientId);
    this.clientWorker.delete(clientId);
  }

  /**
   * Reji yayını — hedef tribün odalarına + isteğe bağlı ALL.
   * zoneMask / targetZone’a göre shard.
   */
  publishRejiPayload(
    payload: OutgoingPayload,
    opts?: { rooms?: ShardRoomId[]; includeAll?: boolean },
  ): number {
    const raw = JSON.stringify(payload);
    const rooms =
      opts?.rooms ??
      roomsForOutgoingTarget(payload.targetZone, payload.zoneMask);
    const channels: string[] = [...rooms];
    if (opts?.includeAll) channels.push(ROOM_ALL);
    return this.bus.publishFanout(channels, raw);
  }

  /** Tek odaya yayın (örn. yalnızca EAST_TRIBUNE). */
  publishToRoom(room: ShardRoomId, payload: OutgoingPayload): number {
    return this.bus.publish(room, JSON.stringify(payload));
  }

  getStats(): ScaleClusterStats {
    return {
      workers: this.workers.length,
      clients: this.clientWorker.size,
      bus: this.bus.getStats(),
      perWorker: this.workers.map((w) => w.getStats()),
      deliveries: this.deliveries,
    };
  }

  private pickWorker(clientId: string): ScaleWorker {
    let hash = 0;
    for (let i = 0; i < clientId.length; i++) {
      hash = (hash * 31 + clientId.charCodeAt(i)) >>> 0;
    }
    return this.workers[hash % this.workers.length]!;
  }
}

/** Outgoing targetZone / zoneMask → Pub/Sub odaları. */
export function roomsForOutgoingTarget(
  targetZone: OutgoingPayload['targetZone'],
  zoneMask: number,
): ShardRoomId[] {
  if (targetZone === 'ALL' || (zoneMask & 0b1111) === 0b1111) {
    return [...TRIBUNE_ROOMS];
  }
  if (targetZone === 'NORTH_SOUTH') {
    return ['NORTH_TRIBUNE', 'SOUTH_TRIBUNE'];
  }
  if (targetZone === 'EAST_WEST') {
    return ['EAST_TRIBUNE', 'WEST_TRIBUNE'];
  }
  const rooms: ShardRoomId[] = [];
  if (zoneMask & 0b0001) rooms.push('NORTH_TRIBUNE');
  if (zoneMask & 0b0010) rooms.push('SOUTH_TRIBUNE');
  if (zoneMask & 0b0100) rooms.push('EAST_TRIBUNE');
  if (zoneMask & 0b1000) rooms.push('WEST_TRIBUNE');
  return rooms.length > 0 ? rooms : [...TRIBUNE_ROOMS];
}
