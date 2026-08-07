/**
 * V30.0 — Connection Auth & Role-Based Security.
 * JWT-benzeri imzalı token + Admin-only komut middleware.
 * CLIENT_READONLY yalnızca yayın dinleyebilir.
 */

import { getJwtSecret, getJwtTtlMs } from './runtimeConfig';

export type ConnectionRole = 'ADMIN' | 'CLIENT_READONLY';

export type AuthClaims = {
  /** Bağlantı / cihaz kimliği. */
  sub: string;
  role: ConnectionRole;
  /** Issued-at (ms). */
  iat: number;
  /** Expiry (ms). */
  exp: number;
};

export type TokenVerifyResult =
  | { ok: true; claims: AuthClaims }
  | { ok: false; error: string };

export type AuthGateResult =
  | { ok: true; claims: AuthClaims }
  | { ok: false; error: string; code: 'NO_TOKEN' | 'INVALID' | 'EXPIRED' | 'FORBIDDEN' };

/** Admin’e özel Reji komutları (Theme / GOL / Strobe / Blackout…). */
export const ADMIN_ONLY_ACTIONS = new Set([
  'START_SHOW',
  'PAUSE',
  'RESET',
  'SET_BPM',
  'EMERGENCY_BLACKOUT',
  'SECURITY_LOCK',
  'SECURITY_UNLOCK',
]);

/** @deprecated Use getJwtSecret() — kept for sim / fallbacks. */
export const DEFAULT_AUTH_SECRET = getJwtSecret();
/** Token TTL (ms) — JWT_TTL_MS / EXPO_PUBLIC_JWT_TTL_MS. */
export const DEFAULT_TOKEN_TTL_MS = getJwtTtlMs();

/** Canlı secret (her çağrıda env okur). */
export function resolveAuthSecret(override?: string): string {
  return override && override.length > 0 ? override : getJwtSecret();
}

function toBase64Url(input: string): string {
  try {
    if (typeof btoa === 'function') {
      return btoa(input)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    }
  } catch {
    // fall through
  }
  // Node
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const buf = Buffer.from(input, 'utf8');
    return buf
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  } catch {
    return input;
  }
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const b64 = padded + pad;
  try {
    if (typeof atob === 'function') {
      return atob(b64);
    }
  } catch {
    // fall through
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/** Taşınabilir HMAC-SHA256 (Node crypto) veya FNV fallback. */
export function signBytes(secret: string, data: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto') as typeof import('crypto');
    if (crypto?.createHmac) {
      return crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    }
  } catch {
    // RN / web fallback
  }
  // FNV-1a 32-bit karışımı (demo/middleware; Node testleri HMAC kullanır)
  let h = 0x811c9dc5;
  const s = secret + ':' + data;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function issueAccessToken(
  input: {
    sub: string;
    role: ConnectionRole;
    ttlMs?: number;
    nowMs?: number;
  },
  secret: string = resolveAuthSecret(),
): string {
  const now = input.nowMs ?? Date.now();
  const claims: AuthClaims = {
    sub: input.sub,
    role: input.role,
    iat: now,
    exp: now + (input.ttlMs ?? getJwtTtlMs()),
  };
  const body = toBase64Url(JSON.stringify(claims));
  const sig = signBytes(secret, body);
  return `${body}.${sig}`;
}

export function verifyAccessToken(
  token: string | null | undefined,
  secret: string = resolveAuthSecret(),
  nowMs: number = Date.now(),
): TokenVerifyResult {
  try {
    if (!token || typeof token !== 'string') {
      return { ok: false, error: 'missing token' };
    }
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { ok: false, error: 'malformed token' };
    }
    const [body, sig] = parts as [string, string];
    const expected = signBytes(secret, body);
    if (sig !== expected) {
      return { ok: false, error: 'bad signature' };
    }
    const json = fromBase64Url(body);
    const claims = JSON.parse(json) as AuthClaims;
    if (!claims?.sub || (claims.role !== 'ADMIN' && claims.role !== 'CLIENT_READONLY')) {
      return { ok: false, error: 'invalid claims' };
    }
    if (typeof claims.exp !== 'number' || nowMs > claims.exp) {
      return { ok: false, error: 'token expired' };
    }
    return { ok: true, claims };
  } catch {
    return { ok: false, error: 'token parse error' };
  }
}

export function isAdminOnlyAction(action: string): boolean {
  return ADMIN_ONLY_ACTIONS.has(action);
}

/**
 * WebSocket / API middleware — yalnızca ADMIN Reji komutu yayınlayabilir.
 * CLIENT_READONLY → FORBIDDEN.
 */
export function authorizeAdminCommand(
  token: string | null | undefined,
  action: string,
  secret: string = resolveAuthSecret(),
  nowMs?: number,
): AuthGateResult {
  const verified = verifyAccessToken(token, secret, nowMs ?? Date.now());
  if (!verified.ok) {
    return {
      ok: false,
      error: verified.error,
      code: verified.error.includes('expired')
        ? 'EXPIRED'
        : token
          ? 'INVALID'
          : 'NO_TOKEN',
    };
  }
  if (verified.claims.role !== 'ADMIN') {
    return {
      ok: false,
      error: 'CLIENT_READONLY cannot publish Reji commands',
      code: 'FORBIDDEN',
    };
  }
  if (isAdminOnlyAction(action) || action.length > 0) {
    // Tüm OutgoingAction’lar admin kapısından geçer
    return { ok: true, claims: verified.claims };
  }
  return { ok: true, claims: verified.claims };
}

/** İstemci bağlantısı — sadece dinleme rolü. */
export function authorizeClientConnect(
  token: string | null | undefined,
  secret: string = resolveAuthSecret(),
  nowMs?: number,
): AuthGateResult {
  const verified = verifyAccessToken(token, secret, nowMs ?? Date.now());
  if (!verified.ok) {
    return {
      ok: false,
      error: verified.error,
      code: token ? 'INVALID' : 'NO_TOKEN',
    };
  }
  return { ok: true, claims: verified.claims };
}

export function formatRoleLabel(role: ConnectionRole): string {
  return role === 'ADMIN' ? 'ADMIN' : 'CLIENT (READ-ONLY)';
}
