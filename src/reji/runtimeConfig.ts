/**
 * V31.0 — Runtime configuration (env-driven).
 * JWT, Redis, PTP, ports — static secrets / hosts here only as safe fallbacks.
 */

export type RuntimeEnv = 'development' | 'production' | 'test';

type EnvBag = Record<string, string | undefined>;

function readEnv(): EnvBag {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env as EnvBag;
    }
  } catch {
    // RN / restricted
  }
  return {};
}

function envString(key: string, fallback: string): string {
  const v = readEnv()[key];
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return fallback;
}

function envInt(key: string, fallback: number): number {
  const raw = readEnv()[key];
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envFloat(key: string, fallback: number): number {
  const raw = readEnv()[key];
  if (raw == null || raw === '') return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = readEnv()[key];
  if (raw == null || raw === '') return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

/** NODE_ENV / EXPO_PUBLIC_APP_ENV */
export function getRuntimeEnv(): RuntimeEnv {
  const v = (
    envString('APP_ENV', '') ||
    envString('EXPO_PUBLIC_APP_ENV', '') ||
    envString('NODE_ENV', 'development')
  ).toLowerCase();
  if (v === 'production' || v === 'prod') return 'production';
  if (v === 'test') return 'test';
  return 'development';
}

/** JWT / access-token HMAC secret (server: JWT_SECRET, client: EXPO_PUBLIC_JWT_SECRET). */
export function getJwtSecret(): string {
  return (
    envString('JWT_SECRET', '') ||
    envString('EXPO_PUBLIC_JWT_SECRET', '') ||
    'reji-dev-only-change-me'
  );
}

export function getJwtTtlMs(): number {
  return envInt('JWT_TTL_MS', envInt('EXPO_PUBLIC_JWT_TTL_MS', 12 * 60 * 60 * 1000));
}

export function getRedisUrl(): string {
  return envString('REDIS_URL', 'redis://127.0.0.1:6379');
}

export function getHttpPort(): number {
  return envInt('PORT', envInt('HTTP_PORT', 8080));
}

export function getWsPath(): string {
  return envString('WS_PATH', envString('EXPO_PUBLIC_WS_PATH', '/ws'));
}

export function getPublicWsHost(): string {
  return (
    envString('EXPO_PUBLIC_WS_HOST', '') ||
    envString('WS_HOST', '127.0.0.1')
  );
}

export function getPublicWsPort(): number {
  return envInt('EXPO_PUBLIC_WS_PORT', envInt('WS_PORT', getHttpPort()));
}

export function getPublicWsSecure(): boolean {
  return envBool(
    'EXPO_PUBLIC_WS_SECURE',
    envBool('WS_SECURE', getRuntimeEnv() === 'production'),
  );
}

/** PTP network buffer defaults (ms). */
export function getPtpNetworkBufferMs(): number {
  return envInt('PTP_NETWORK_BUFFER_MS', envInt('EXPO_PUBLIC_PTP_NETWORK_BUFFER_MS', 80));
}

export function getPtpEmergencyBufferMs(): number {
  return envInt('PTP_EMERGENCY_BUFFER_MS', 25);
}

export function getPtpBufferMinMs(): number {
  return envInt('PTP_BUFFER_MIN_MS', 40);
}

export function getPtpBufferMaxMs(): number {
  return envInt('PTP_BUFFER_MAX_MS', 250);
}

export function getPingIntervalMs(): number {
  return envInt('WS_PING_INTERVAL_MS', 5_000);
}

export function getPongTimeoutMs(): number {
  return envInt('WS_PONG_TIMEOUT_MS', 15_000);
}

export function getWorkerId(): string {
  const pid =
    typeof process !== 'undefined' && typeof process.pid === 'number'
      ? process.pid
      : 0;
  return envString('WORKER_ID', envString('HOSTNAME', `worker-${pid}`));
}

export function getAdminBootstrapKey(): string {
  return envString('ADMIN_BOOTSTRAP_KEY', 'reji-admin-bootstrap-dev');
}

export function getUdpMulticastGroup(): string {
  return envString('UDP_MULTICAST_GROUP', envString('EXPO_PUBLIC_UDP_MULTICAST_GROUP', '239.255.90.1'));
}

export function getUdpMulticastPort(): number {
  return envInt('UDP_MULTICAST_PORT', envInt('EXPO_PUBLIC_UDP_MULTICAST_PORT', 9090));
}

/** Snapshot for /health and logs (no secrets). */
export function getPublicConfigSnapshot() {
  return {
    env: getRuntimeEnv(),
    httpPort: getHttpPort(),
    wsPath: getWsPath(),
    wsHost: getPublicWsHost(),
    wsPort: getPublicWsPort(),
    wsSecure: getPublicWsSecure(),
    redisConfigured: Boolean(envString('REDIS_URL', '')),
    ptpBufferMs: getPtpNetworkBufferMs(),
    ptpBufferMaxMs: getPtpBufferMaxMs(),
    pingIntervalMs: getPingIntervalMs(),
    pongTimeoutMs: getPongTimeoutMs(),
    workerId: getWorkerId(),
  };
}
