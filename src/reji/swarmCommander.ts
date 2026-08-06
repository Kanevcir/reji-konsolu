/**
 * V17.0 — BLE Sürü Zekası Komuta Merkezi (Swarm Mesh Commander).
 * Swarm aktifken OutgoingPayload.swarmProtocol=true — saha cihazları
 * hücresel kopsa bile BLE hop ile ~100 komşuya komutu sıçratır.
 */

/** Tahmini mesh düğüm aralığı (aktifken). */
export const SWARM_MESH_NODES_MIN = 3800;
export const SWARM_MESH_NODES_MAX = 5200;
/** Pasifken gösterilen düğüm sayısı. */
export const SWARM_MESH_NODES_IDLE = 0;

export type SwarmMeshStatus = 'ACTIVE' | 'INACTIVE';

/** Kilit / blackout altında swarm engellenir. */
export function canEngageSwarm(
  isConsoleLocked: boolean,
  isBlackout: boolean,
): boolean {
  return !isConsoleLocked && !isBlackout;
}

export function formatMeshStatusLabel(active: boolean): SwarmMeshStatus {
  return active ? 'ACTIVE' : 'INACTIVE';
}

export function buildSwarmEngagedMessage(estimatedNodes: number): string {
  return `SWARM_MESH_ENGAGED · ${estimatedNodes} NODES`;
}

export function buildSwarmDisengagedMessage(): string {
  return 'SWARM_MESH_DISENGAGED';
}

/** Aktif mesh için yumuşak jitter’lı düğüm tahmini. */
export function nextEstimatedMeshNodes(prev: number, active: boolean): number {
  try {
    if (!active) return SWARM_MESH_NODES_IDLE;
    const base =
      prev > 0
        ? prev
        : Math.round((SWARM_MESH_NODES_MIN + SWARM_MESH_NODES_MAX) / 2);
    const delta = Math.round((Math.random() * 2 - 1) * 80);
    return Math.min(
      SWARM_MESH_NODES_MAX,
      Math.max(SWARM_MESH_NODES_MIN, base + delta),
    );
  } catch {
    return active ? 4500 : 0;
  }
}

/** Engage anında başlangıç düğüm tahmini. */
export function initialEstimatedMeshNodes(): number {
  return Math.round((SWARM_MESH_NODES_MIN + SWARM_MESH_NODES_MAX) / 2);
}
