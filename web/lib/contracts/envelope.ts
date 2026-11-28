import { ErrorCode, isErrorCode } from './errors';

/**
 * API envelope (Master Spec, "Shared technical contracts").
 * STATUS: PROPOSED v0 (frontend). Codex owns the server implementation.
 *
 *   success: { success: true,  data, requestId }
 *   error:   { success: false, error: { code, message }, requestId }
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ApiFailure {
  success: false;
  error: { code: ErrorCode; message: string };
  requestId: string;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

/** Consequential writes carry these (Master Spec). The server derives the actor; the client never sends it. */
export interface WriteMeta {
  /** Version the user saw. A mismatch must come back as STALE_VERSION. */
  expectedVersion: number;
  /** One key per user intent; a retry reuses it so the server can dedupe (DUPLICATE_REQUEST). */
  idempotencyKey: string;
  /** Set when an approved request authorises the write. */
  approvalRef?: string;
}

/** Result shape the UI components consume. Server actions that already return { ok } map onto it. */
export type UiResult<T = undefined> =
  | { ok: true; data?: T; requestId?: string }
  | { ok: false; code: ErrorCode; message: string; requestId?: string };

export function ok<T>(data: T, requestId: string): ApiSuccess<T> {
  return { success: true, data, requestId };
}

export function fail(code: ErrorCode, message: string, requestId: string): ApiFailure {
  return { success: false, error: { code, message }, requestId };
}

export function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.requestId !== 'string') return false;
  if (v.success === true) return 'data' in v;
  if (v.success === false) {
    const e = v.error as Record<string, unknown> | undefined;
    return !!e && typeof e.code === 'string' && typeof e.message === 'string';
  }
  return false;
}

/**
 * Turn whatever a server action or fetch returned into a UiResult.
 * Accepts the envelope, the existing { ok, message } convention, and thrown/unknown values.
 * Never reports success unless the server said so.
 */
export function toUiResult<T = undefined>(value: unknown): UiResult<T> {
  if (isEnvelope(value)) {
    if (value.success) return { ok: true, data: value.data as T, requestId: value.requestId };
    const code = isErrorCode(value.error.code) ? value.error.code : 'INTERNAL_ERROR';
    return { ok: false, code, message: value.error.message, requestId: value.requestId };
  }
  if (typeof value === 'object' && value !== null && 'ok' in value) {
    const v = value as { ok: unknown; message?: unknown; code?: unknown; requestId?: unknown; data?: unknown };
    if (v.ok === true) return { ok: true, data: v.data as T, requestId: typeof v.requestId === 'string' ? v.requestId : undefined };
    return {
      ok: false,
      code: isErrorCode(v.code) ? v.code : 'INTERNAL_ERROR',
      message: typeof v.message === 'string' ? v.message : '',
      requestId: typeof v.requestId === 'string' ? v.requestId : undefined,
    };
  }
  return { ok: false, code: 'INTERNAL_ERROR', message: '' };
}

/** Parse a fetch Response body as an envelope. Network or parse problems become INTEGRATION_UNAVAILABLE / INTERNAL_ERROR. */
export async function readEnvelope<T>(res: Response): Promise<UiResult<T>> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, code: res.status >= 500 ? 'INTEGRATION_UNAVAILABLE' : 'INTERNAL_ERROR', message: '' };
  }
  return toUiResult<T>(body);
}

/** One idempotency key per user intent. Falls back when crypto.randomUUID is missing (old WebViews). */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
