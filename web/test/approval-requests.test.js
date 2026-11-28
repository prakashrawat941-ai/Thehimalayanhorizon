import { describe, expect, it } from 'vitest';
import {
  canReview, engineMessage, formatPaise, isIdempotencyKey, needsFounder, readEngineError, requestActions,
  rupeesToPaise, toTimeline, validateOfficePayload, validateResubmission, validateSubmission,
} from '../lib/management/approval-requests.mjs';

const POLICIES = [
  { category: 'website_cms', label: 'Website & CMS change', requiresFounder: false },
  { category: 'office', label: 'New village office', requiresFounder: true },
];
const good = { category: 'website_cms', title: 'Update homepage hero', reason: 'Winter season photos for Munsiyari', risk: 'low', amount: '' };

describe('rupeesToPaise', () => {
  it('converts rupee text to integer paise without floating-point error', () => {
    expect(rupeesToPaise('12,500.50')).toBe(1250050);
    expect(rupeesToPaise('₹ 0.10')).toBe(10);
    expect(rupeesToPaise('19.99')).toBe(1999);
    expect(rupeesToPaise('1')).toBe(100);
  });
  it('treats empty as no amount and rejects invalid, zero, negative and over-cap input', () => {
    expect(rupeesToPaise('')).toBeNull();
    expect(rupeesToPaise(undefined)).toBeNull();
    for (const bad of ['abc', '0', '0.00', '-5', '1.234', '1e5', '1000000001']) expect(Number.isNaN(rupeesToPaise(bad)), bad).toBe(true);
  });
  it('formats paise back with Indian grouping', () => {
    expect(formatPaise(1250050)).toBe('₹12,500.50');
    expect(formatPaise(10000000)).toBe('₹1,00,000');
    expect(formatPaise(null)).toBe('—');
  });
});

describe('validateSubmission', () => {
  it('accepts a complete request and returns the RPC-ready value', () => {
    const r = validateSubmission(good, POLICIES);
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ category: 'website_cms', title: 'Update homepage hero', reason: 'Winter season photos for Munsiyari', risk: 'low', amountPaise: null, payload: {} });
  });
  it('mirrors the engine limits for title, reason, risk, category and amount', () => {
    const r = validateSubmission({ category: 'nope', title: 'abc', reason: 'short', risk: 'extreme', amount: 'x' }, POLICIES);
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['amount', 'category', 'reason', 'risk', 'title']);
    expect(validateSubmission({ ...good, title: 'x'.repeat(161) }).errors.title).toBeTruthy();
    expect(validateSubmission({ ...good, reason: 'x'.repeat(3001) }).errors.reason).toBeTruthy();
  });
  it('requires the structured office payload for the office category', () => {
    const missing = validateSubmission({ ...good, category: 'office', office: { name: 'Sarmoli office' } }, POLICIES);
    expect(missing.ok).toBe(false);
    expect(missing.errors['office.village']).toBe('required');
    const ok = validateSubmission({ ...good, category: 'office', office: { name: 'Sarmoli office', village: 'Sarmoli', district: 'Pithoragarh', state: 'Uttarakhand', post: ' ' } }, POLICIES);
    expect(ok.ok).toBe(true);
    expect(ok.value.payload).toEqual({ name: 'Sarmoli office', village: 'Sarmoli', district: 'Pithoragarh', state: 'Uttarakhand' });
  });
  it('trims and length-checks optional office fields', () => {
    expect(validateOfficePayload({ name: 'Abc', village: 'Xy', district: 'Dd', state: 'Ss', country: 'x'.repeat(61) }).errors['office.country']).toBe('too_long');
  });
});

describe('validateResubmission', () => {
  const original = { title: 'Update homepage hero', reason: 'Winter season photos for Munsiyari', amountPaise: null, category: 'website_cms', payload: {} };
  it('requires a note and sends only changed fields', () => {
    expect(validateResubmission({ note: '' }, original).errors.note).toBeTruthy();
    const r = validateResubmission({ note: 'Added photo credits', title: 'Update homepage hero', reason: 'Winter photos with credits for Munsiyari', amount: '' }, original);
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ note: 'Added photo credits', title: null, reason: 'Winter photos with credits for Munsiyari', amountPaise: null, payload: null });
  });
  it('re-validates a changed office payload', () => {
    const office = { title: 'New office', reason: 'Field office for Sarmoli homestays', category: 'office', payload: { name: 'Sarmoli office', village: 'Sarmoli', district: 'Pithoragarh', state: 'Uttarakhand' } };
    expect(validateResubmission({ note: 'Fixed district', office: { ...office.payload, district: '' } }, office).errors['office.district']).toBe('required');
    expect(validateResubmission({ note: 'No change', office: { ...office.payload } }, office).value.payload).toBeNull();
  });
});

describe('server-driven actions', () => {
  it('shows only request-level actions the server allows, in a stable order', () => {
    expect(requestActions({ allowedActions: ['apply', 'withdraw', 'approve'] })).toEqual(['withdraw', 'apply']);
    expect(requestActions({ allowedActions: ['approve', 'reject', 'request_revision', 'escalate'] })).toEqual(['escalate']);
    expect(requestActions({})).toEqual([]);
  });
  it('allows the review card only when all three review actions are allowed', () => {
    expect(canReview({ allowedActions: ['approve', 'reject', 'request_revision'] })).toBe(true);
    expect(canReview({ allowedActions: ['approve'] })).toBe(false);
    expect(canReview({ allowedActions: ['withdraw'] })).toBe(false);
  });
  it('predicts Founder routing for flagged categories and any amount', () => {
    expect(needsFounder(POLICIES[0], null)).toBe(false);
    expect(needsFounder(POLICIES[0], 100)).toBe(true);
    expect(needsFounder(POLICIES[1], null)).toBe(true);
  });
});

describe('engine errors and history', () => {
  it('reads the engine code from message and the field from hint', () => {
    expect(readEngineError({ message: 'VALIDATION_FAILED', hint: 'title' })).toEqual({ code: 'VALIDATION_FAILED', field: 'title' });
    expect(readEngineError({ message: 'STALE_VERSION', hint: 'STALE_VERSION' })).toEqual({ code: 'STALE_VERSION', field: null });
    expect(readEngineError({ message: 'duplicate key value violates…' }).code).toBe('SERVER_ERROR');
    expect(readEngineError(null)).toBeNull();
  });
  it('has English and Hindi messages for every code', () => {
    for (const code of ['MFA_REQUIRED', 'DUPLICATE_REQUEST', 'STALE_VERSION', 'APPROVAL_REQUIRED', 'UNKNOWN']) {
      expect(engineMessage(code, 'en').length).toBeGreaterThan(10);
      expect(engineMessage(code, 'hi')).not.toBe(engineMessage(code, 'en'));
    }
  });
  it('maps append-only history rows to the timeline', () => {
    const t = toTimeline([{ action: 'escalate', actorName: 'Asha', actorRole: 'ceo', at: '2026-11-28T10:00:00Z', note: 'Budget impact' }], 'en');
    expect(t).toEqual([{ at: '2026-11-28T10:00:00Z', action: 'Sent to Founder', actor: 'Asha · CEO', note: 'Budget impact' }]);
    expect(toTimeline(null)).toEqual([]);
  });
  it('accepts browser-generated idempotency keys and rejects short or unsafe ones', () => {
    expect(isIdempotencyKey('submit:2f1c9a0e-0d5b-4b36-9b0c-3c9a2b1d7e11')).toBe(true);
    expect(isIdempotencyKey('short')).toBe(false);
    expect(isIdempotencyKey('submit:<script>')).toBe(false);
  });
});
