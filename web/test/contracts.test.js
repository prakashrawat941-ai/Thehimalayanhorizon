import { describe, it, expect } from 'vitest';
import {
  ERROR_CODES, errorCopy, isErrorCode, toUiResult, ok, fail, canShow, widestScope,
  isDecidable, isStale, noteError, PROPOSED_SLA_HOURS,
} from '@/lib/contracts';

describe('error copy', () => {
  it('has English and Hindi copy for every code', () => {
    for (const code of ERROR_CODES) {
      for (const lang of ['en', 'hi']) {
        const c = errorCopy(code, lang);
        expect(c.title, `${code}/${lang} title`).toBeTruthy();
        expect(c.text, `${code}/${lang} text`).toBeTruthy();
      }
    }
  });
  it('maps unknown codes to INTERNAL_ERROR', () => {
    expect(isErrorCode('NOPE')).toBe(false);
    expect(errorCopy('NOPE', 'en')).toEqual(errorCopy('INTERNAL_ERROR', 'en'));
  });
});

describe('toUiResult', () => {
  it('normalizes the existing { ok } server-action shape', () => {
    expect(toUiResult({ ok: true }).ok).toBe(true);
    const bad = toUiResult({ ok: false, message: 'Nope' });
    expect(bad.ok).toBe(false);
    expect(bad.message).toBe('Nope');
  });
  it('normalizes success and failure envelopes', () => {
    const good = toUiResult(ok({ id: 1 }, 'req-1'));
    expect(good.ok).toBe(true);
    const bad = toUiResult(fail('PERMISSION_DENIED', 'No', 'req-2'));
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe('PERMISSION_DENIED');
  });
  it('treats garbage as a failure, never as success', () => {
    for (const v of [null, undefined, 42, 'ok', {}, { success: 'yes' }]) expect(toUiResult(v).ok).toBe(false);
  });
});

describe('permission hints are deny-by-default', () => {
  const perms = { schemaVersion: 1, grants: [{ resource: 'approval', action: 'read', scope: 'company' }] };
  it('denies with no permissions or unknown schema', () => {
    expect(canShow(null, 'approval', 'read')).toBe(false);
    expect(canShow({ ...perms, schemaVersion: 2 }, 'approval', 'read')).toBe(false);
  });
  it('allows only the granted resource and action', () => {
    expect(canShow(perms, 'approval', 'read')).toBe(true);
    expect(canShow(perms, 'approval', 'approve')).toBe(false);
    expect(canShow(perms, 'finance', 'read')).toBe(false);
  });
  it('ignores expired grants', () => {
    const expired = { schemaVersion: 1, grants: [{ resource: 'approval', action: 'read', scope: 'company', expiresAt: '2020-01-01T00:00:00Z' }] };
    expect(canShow(expired, 'approval', 'read')).toBe(false);
    expect(widestScope(expired, 'approval', 'read')).toBeNull();
  });
});

describe('approval rules', () => {
  it('only pending states are decidable', () => {
    expect(isDecidable('pending_ceo')).toBe(true);
    expect(isDecidable('approved')).toBe(false);
    expect(isDecidable('applied')).toBe(false);
  });
  it('detects stale versions', () => {
    expect(isStale({ version: 2, currentVersion: 3 })).toBe(true);
    expect(isStale({ version: 2, currentVersion: 2 })).toBe(false);
    expect(isStale({ version: 2 })).toBe(false);
  });
  it('requires a note to revise or reject, not to approve', () => {
    expect(noteError('approve', '')).toBeNull();
    expect(noteError('reject', ' ')).toBe('required');
    expect(noteError('revise', 'ok?')).toBeNull();
  });
  it('keeps the proposed SLA hours from the spec', () => {
    expect(PROPOSED_SLA_HOURS).toEqual({ critical: 2, high: 12, medium: 24, low: 72 });
  });
});
