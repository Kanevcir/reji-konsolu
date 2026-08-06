/**
 * V18.0 — Sanal Stadyum Simülatörü ve Yük Testi
 * (Virtual Crowd & Stress Simulator).
 *
 * OutgoingPayload’ı dinleyen izole motor: 1000 sanal cihaz,
 * rastgele bölge + zoneMask eşleşmesi. V20 — MatrixCommand ile (x,y) renk.
 */

import { getSyncedTimestamp } from './clockSync';
import { evaluatePixel } from './pixelMapper';
import { deviceMatchesZoneMask, ZONE_BIT, type SpatialZoneId } from './zoneManager';
import type { OutgoingPayload } from './types';

export const VIRTUAL_CROWD_SIZE = 1000;
export const VIRTUAL_CROWD_COLS = 40;
export const VIRTUAL_CROWD_ROWS = 25; // 40×25 = 1000

const ZONE_POOL: SpatialZoneId[] = ['NORTH', 'SOUTH', 'EAST', 'WEST'];

export type VirtualNode = {
  id: number;
  zone: SpatialZoneId;
  zoneBit: number;
  /** Normalize stadium coords 0–1 (V20 matrix). */
  x: number;
  y: number;
};

export type CrowdSimMetrics = {
  simulatedNodes: number;
  activeNodes: number;
  avgLatencyMs: number;
  lastAppliedAt: number;
  frame: number;
};

export type CrowdSimSnapshot = {
  /** 0 = off, 1 = on — length VIRTUAL_CROWD_SIZE */
  lit: Uint8Array;
  /** packed RGB per node (r,g,b) length size*3 */
  rgb: Uint8Array;
  metrics: CrowdSimMetrics;
};

function zoneBitFor(zone: SpatialZoneId): number {
  return ZONE_BIT[zone];
}

function colorForPayload(payload: OutgoingPayload): [number, number, number] {
  if (payload.status === 'SAFE_MODE' || payload.action === 'EMERGENCY_BLACKOUT') {
    return [15, 23, 42];
  }
  if (payload.status === 'IDLE' || payload.action === 'RESET' || payload.action === 'PAUSE') {
    return [51, 65, 85];
  }
  if (payload.bpm >= 140) return [248, 113, 113];
  if (payload.bpm <= 100) return [52, 211, 153];
  if (payload.swarmProtocol) return [34, 211, 238];
  return [251, 191, 36];
}

function shouldLight(payload: OutgoingPayload, zoneBit: number): boolean {
  if (payload.status === 'SAFE_MODE' || payload.action === 'EMERGENCY_BLACKOUT') {
    return false;
  }
  if ((payload.zoneMask & ZONE_BIT.ALL) === 0) return false;
  return deviceMatchesZoneMask(payload.zoneMask, zoneBit);
}

/**
 * Bağımsız sanal kalabalık motoru.
 * React state tutmaz; applyPayload ile senkron snapshot üretir.
 */
export class VirtualCrowdEngine {
  readonly nodes: VirtualNode[];
  private lit: Uint8Array;
  private rgb: Uint8Array;
  private frame = 0;
  private lastAppliedAt = 0;
  private lastAvgLatencyMs = 0;
  private lastActive = 0;

  constructor(size = VIRTUAL_CROWD_SIZE) {
    this.nodes = [];
    this.lit = new Uint8Array(size);
    this.rgb = new Uint8Array(size * 3);
    for (let i = 0; i < size; i++) {
      const zone = ZONE_POOL[Math.floor(Math.random() * ZONE_POOL.length)]!;
      this.nodes.push({
        id: i,
        zone,
        zoneBit: zoneBitFor(zone),
        x: Math.random(),
        y: Math.random(),
      });
    }
  }

  getSize() {
    return this.nodes.length;
  }

  /** Payload uygula — zoneMask / matrix / PTP. */
  applyPayload(payload: OutgoingPayload): CrowdSimSnapshot {
    try {
      const now = getSyncedTimestamp();
      const payloadTsMs =
        payload.timestamp > 1_000_000_000_000
          ? payload.timestamp
          : payload.timestamp * 1000;
      const baseLatency = Math.max(0, now - payloadTsMs);
      const matrix = payload.matrix;
      const useMatrix = Boolean(matrix?.engaged);

      const fallback = colorForPayload(payload);
      let active = 0;
      let latencySum = 0;

      for (let i = 0; i < this.nodes.length; i++) {
        const node = this.nodes[i]!;
        const inZone = shouldLight(payload, node.zoneBit);
        const o = i * 3;

        if (!inZone) {
          this.lit[i] = 0;
          this.rgb[o] = 15;
          this.rgb[o + 1] = 23;
          this.rgb[o + 2] = 42;
          continue;
        }

        let r = fallback[0];
        let g = fallback[1];
        let b = fallback[2];
        let on = true;

        if (useMatrix && matrix) {
          const color = evaluatePixel(node.x, node.y, now, matrix);
          r = color[0];
          g = color[1];
          b = color[2];
          on = !(r <= 20 && g <= 28 && b <= 48);
        }

        this.lit[i] = on ? 1 : 0;
        this.rgb[o] = r;
        this.rgb[o + 1] = g;
        this.rgb[o + 2] = b;
        if (on) {
          active += 1;
          latencySum += baseLatency + (i % 19);
        }
      }

      this.frame += 1;
      this.lastAppliedAt = now;
      this.lastActive = active;
      this.lastAvgLatencyMs =
        active > 0 ? Number((latencySum / active).toFixed(1)) : Number(baseLatency.toFixed(1));

      return this.snapshot();
    } catch {
      return this.snapshot();
    }
  }

  snapshot(): CrowdSimSnapshot {
    return {
      lit: this.lit,
      rgb: this.rgb,
      metrics: {
        simulatedNodes: this.nodes.length,
        activeNodes: this.lastActive,
        avgLatencyMs: this.lastAvgLatencyMs,
        lastAppliedAt: this.lastAppliedAt,
        frame: this.frame,
      },
    };
  }

  clear(): CrowdSimSnapshot {
    this.lit.fill(0);
    for (let i = 0; i < this.rgb.length; i += 3) {
      this.rgb[i] = 15;
      this.rgb[i + 1] = 23;
      this.rgb[i + 2] = 42;
    }
    this.lastActive = 0;
    this.lastAvgLatencyMs = 0;
    this.frame += 1;
    this.lastAppliedAt = getSyncedTimestamp();
    return this.snapshot();
  }
}

export function formatCrowdLatency(ms: number): string {
  return `~${Math.max(0, Math.round(ms))} ms`;
}

export function rgbToCss(r: number, g: number, b: number): string {
  return `rgb(${r},${g},${b})`;
}
