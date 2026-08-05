/**
 * V12.0 — Operatör Güvenliği, Rol Yönetimi ve Ekran Kilit Protokolü.
 */

/** Konsol operatör rolleri. */
export type OperatorRole = 'LEAD_OPERATOR' | 'ASSISTANT' | 'VIEWER';

export const OPERATOR_ROLES: OperatorRole[] = [
  'LEAD_OPERATOR',
  'ASSISTANT',
  'VIEWER',
];

/** Varsayılan 4 haneli PIN (Galatasaray 1905). */
export const DEFAULT_OPERATOR_PIN = '1905';

export const PIN_LENGTH = 4;

export type SecurityLockState = {
  operatorRole: OperatorRole;
  isConsoleLocked: boolean;
};

export const DEFAULT_SECURITY_LOCK: SecurityLockState = {
  operatorRole: 'LEAD_OPERATOR',
  isConsoleLocked: false,
};

/** Rol rozet metni — örn. "LEAD OPERATOR". */
export function formatOperatorRoleLabel(role: OperatorRole) {
  if (role === 'LEAD_OPERATOR') return 'LEAD OPERATOR';
  if (role === 'ASSISTANT') return 'ASSISTANT';
  return 'VIEWER';
}

/** AUTH telemetri satırı. */
export function formatAuthStatusLabel(state: SecurityLockState) {
  const role = formatOperatorRoleLabel(state.operatorRole);
  const lock = state.isConsoleLocked ? 'LOCKED' : 'UNLOCKED';
  return `AUTH: ${role} (${lock})`;
}

/** PIN yalnızca rakam, tam 4 hane. */
export function normalizePinInput(raw: string) {
  return raw.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

/** PIN doğrulama (try-catch korumalı). */
export function verifyOperatorPin(
  input: string,
  expected: string = DEFAULT_OPERATOR_PIN,
): boolean {
  try {
    const pin = normalizePinInput(input);
    const target = normalizePinInput(expected);
    return pin.length === PIN_LENGTH && pin === target;
  } catch {
    return false;
  }
}

/**
 * Kritik aksiyonlar (Blackout / Reset / Senaryo) serbest mi?
 * Kilitli veya VIEWER → hayır.
 */
export function canOperateCritical(
  role: OperatorRole,
  isConsoleLocked: boolean,
): boolean {
  if (isConsoleLocked) return false;
  if (role === 'VIEWER') return false;
  return true;
}

/** Kilit aç/kapa — yalnızca LEAD_OPERATOR. */
export function canManageLock(role: OperatorRole) {
  return role === 'LEAD_OPERATOR';
}

/** Rol değiştirme — yalnızca LEAD ve kilit açıkken. */
export function canChangeRole(role: OperatorRole, isConsoleLocked: boolean) {
  return role === 'LEAD_OPERATOR' && !isConsoleLocked;
}

/** Sonraki rol (rozet döngüsü). */
export function nextOperatorRole(current: OperatorRole): OperatorRole {
  const idx = OPERATOR_ROLES.indexOf(current);
  return OPERATOR_ROLES[(idx + 1) % OPERATOR_ROLES.length] ?? 'LEAD_OPERATOR';
}
