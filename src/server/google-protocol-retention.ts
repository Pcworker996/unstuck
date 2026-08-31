export const UNSAVED_PROTOCOL_TTL_MS = 24 * 60 * 60 * 1000;

export function unsavedProtocolExpiresAt(): Date {
  return new Date(Date.now() + UNSAVED_PROTOCOL_TTL_MS);
}

export function shouldClearUnsavedExpiry(value: unknown): boolean {
  return typeof value === "object" && value !== null && "saveRequested" in value && value.saveRequested === true;
}

export function isTerminalProtocolState(value: unknown): boolean {
  return typeof value === "object" && value !== null && "phase" in value && value.phase === "outcome";
}

export function isUnsavedTerminalState(value: unknown): boolean {
  return isTerminalProtocolState(value) && !shouldClearUnsavedExpiry(value);
}

export function isGoogleProtocolExpired(expiresAt: unknown): boolean {
  if (expiresAt instanceof Date) return expiresAt.getTime() <= Date.now();
  if (typeof expiresAt === "object" && expiresAt !== null && "toDate" in expiresAt && typeof expiresAt.toDate === "function") {
    return expiresAt.toDate() <= new Date();
  }
  return false;
}
