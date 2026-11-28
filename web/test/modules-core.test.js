import { describe, expect, it } from 'vitest';
import {
  createDemoAdapter, csvCell, dayCount, demoAllowedActions, demoScope, isPublicId, maskPhone, NOT_CONNECTED,
  notConnectedAdapter, publicId, queryRows, todayIST, toCsv, validateField, validateForm,
} from '../lib/modules/core.js';
import { ENTITIES } from '../lib/modules/entities.js';

describe('public IDs', () => {
  it('formats proposed IDs', () => {
    expect(publicId('employee', 1)).toBe('THH-EMP-0001');
    expect(publicId('task', 42)).toBe('THH-TSK-000042');
    expect(publicId('office', 7)).toBe('THH-OFF-007');
    expect(publicId('project', 3)).toBe('THH-PRJ-00003');
  });
  it('rejects bad input and overflow', () => {
    expect(publicId('employee', 0)).toBeNull();
    expect(publicId('employee', 1.5)).toBeNull();
    expect(publicId('office', 1000)).toBeNull();
    expect(publicId('nope', 1)).toBeNull();
  });
  it('recognises IDs', () => {
    expect(isPublicId('approval', 'THH-APR-000001')).toBe(true);
    expect(isPublicId('approval', 'THH-APR-1')).toBe(false);
    expect(isPublicId('approval', 'THH-EMP-0001')).toBe(false);
    expect(isPublicId('approval', null)).toBe(false);
  });
});

describe('validateField', () => {
  it('required and empty', () => {
    expect(validateField({ type: 'text', required: true }, '  ')).toBe('required');
    expect(validateField({ type: 'text' }, '')).toBeNull();
  });
  it('text length', () => {
    expect(validateField({ type: 'text', minLength: 3 }, 'ab')).toBe('tooShort');
    expect(validateField({ type: 'text', maxLength: 3 }, 'abcd')).toBe('tooLong');
    expect(validateField({ type: 'text' }, 'x'.repeat(241))).toBe('tooLong');
    expect(validateField({ type: 'textarea' }, 'x'.repeat(4000))).toBeNull();
  });
  it('email and Indian mobile', () => {
    expect(validateField({ type: 'email' }, 'a@b.co')).toBeNull();
    expect(validateField({ type: 'email' }, 'a@b')).toBe('email');
    expect(validateField({ type: 'phone' }, '9876543210')).toBeNull();
    expect(validateField({ type: 'phone' }, '+91 9876543210')).toBeNull();
    expect(validateField({ type: 'phone' }, '1234567890')).toBe('phone');
    expect(validateField({ type: 'phone' }, '98765')).toBe('phone');
  });
  it('numbers and money', () => {
    expect(validateField({ type: 'number', min: 1, max: 5 }, '3')).toBeNull();
    expect(validateField({ type: 'number', min: 1 }, '0')).toBe('min');
    expect(validateField({ type: 'number', max: 5 }, '6')).toBe('max');
    expect(validateField({ type: 'number' }, '2.5')).toBe('number');
    expect(validateField({ type: 'money' }, '1200.50')).toBeNull();
    expect(validateField({ type: 'money' }, '12.345')).toBe('money');
    expect(validateField({ type: 'money' }, '-5')).toBe('money');
    expect(validateField({ type: 'money' }, '0')).toBe('min');
    expect(validateField({ type: 'money', max: 100 }, '101')).toBe('max');
  });
  it('dates, times and options', () => {
    expect(validateField({ type: 'date' }, '2026-02-28')).toBeNull();
    expect(validateField({ type: 'date' }, '2026-02-30')).toBe('date');
    expect(validateField({ type: 'date' }, '28/02/2026')).toBe('date');
    expect(validateField({ type: 'time' }, '23:59')).toBeNull();
    expect(validateField({ type: 'time' }, '24:00')).toBe('time');
    expect(validateField({ type: 'select', options: [{ value: 'a' }] }, 'a')).toBeNull();
    expect(validateField({ type: 'select', options: [{ value: 'a' }] }, 'b')).toBe('option');
  });
  it('files', () => {
    const f = { type: 'image/png', size: 2 * 1024 * 1024, name: 'x.png' };
    expect(validateField({ type: 'file', accept: 'image/*', maxMB: 3 }, f)).toBeNull();
    expect(validateField({ type: 'file', accept: 'application/pdf', maxMB: 3 }, f)).toBe('fileType');
    expect(validateField({ type: 'file', accept: 'image/*', maxMB: 1 }, f)).toBe('fileSize');
  });
});

describe('validateForm', () => {
  it('checks every field and date order', () => {
    const spec = ENTITIES.leave.form;
    expect(validateForm(spec, {}).ok).toBe(false);
    const ok = validateForm(spec, { type: 'casual', from: '2026-12-08', to: '2026-12-09', reason: 'Family' });
    expect(ok).toEqual({ ok: true, errors: {} });
    const bad = validateForm(spec, { type: 'casual', from: '2026-12-09', to: '2026-12-08', reason: 'Family' });
    expect(bad.errors.to).toBe('order');
  });
  it('resolves option lists by name', () => {
    expect(Array.isArray(ENTITIES.approval.form.fields[0].options)).toBe(true);
    expect(validateForm(ENTITIES.approval.form, { category: 'not-a-category' }).errors.category).toBe('option');
  });
});

describe('helpers', () => {
  it('dayCount is inclusive and safe', () => {
    expect(dayCount('2026-12-08', '2026-12-09')).toBe(2);
    expect(dayCount('2026-12-09', '2026-12-08')).toBe(0);
    expect(dayCount('bad', '2026-12-08')).toBe(0);
  });
  it('todayIST uses India time', () => {
    expect(todayIST(new Date('2026-11-27T19:00:00Z'))).toBe('2026-11-28');
    expect(todayIST(new Date('2026-11-27T18:00:00Z'))).toBe('2026-11-27');
  });
  it('queryRows filters, searches and caps page size', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ id: `r${i}`, status: i % 2 ? 'a' : 'b', name: `Name ${i}` }));
    expect(queryRows(rows, { filters: { status: 'a' } }).total).toBe(30);
    expect(queryRows(rows, { q: 'name 5', searchKeys: ['name'] }).total).toBe(11);
    expect(queryRows(rows, { pageSize: 500 }).items.length).toBe(50);
    expect(queryRows(rows, { page: 2, pageSize: 25 }).items[0].id).toBe('r25');
  });
  it('CSV escapes quotes, commas and formula injection', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+91')).toBe("'+91");
    expect(csvCell(null)).toBe('');
    expect(toCsv([{ key: 'a', label: 'A' }], [{ a: 1 }, { a: 'x,y' }])).toBe('A\r\n1\r\n"x,y"');
  });
  it('maskPhone keeps last 4 digits only', () => {
    expect(maskPhone('+91 98765 43210')).toBe('••••••3210');
    expect(maskPhone('')).toBe('');
  });
});

describe('notConnectedAdapter', () => {
  it('never returns data and never pretends to save', async () => {
    for (const fn of ['list', 'get', 'create', 'act']) {
      const res = await notConnectedAdapter[fn]('approval', {});
      expect(res).toEqual(NOT_CONNECTED);
      expect(res.error.code).toBe('INTEGRATION_UNAVAILABLE');
    }
  });
});

describe('demo adapter', () => {
  const seed = () => ({ leave: [{ id: 'THH-LV-000001', status: 'pending', employeeName: 'A', type: 'casual' }], employee: [{ id: 'THH-EMP-0001', status: 'active', name: 'A' }] });
  const at = () => '2026-11-28T00:00:00Z';

  it('lists with allowed actions from status', async () => {
    const a = createDemoAdapter(ENTITIES, seed(), { now: at });
    const res = await a.list('leave');
    expect(res.data.total).toBe(1);
    expect(res.data.items[0].allowedActions).toEqual(['approve', 'reject', 'cancel']);
  });
  it('enforces version, transition and note', async () => {
    const a = createDemoAdapter(ENTITIES, seed(), { now: at });
    expect((await a.act('leave', 'THH-LV-000001', 'approve', {}, {})).error.code).toBe('STALE_VERSION');
    expect((await a.act('leave', 'THH-LV-000001', 'reject', { note: 'x' }, { expectedVersion: 1 })).error.code).toBe('VALIDATION_FAILED');
    const ok = await a.act('leave', 'THH-LV-000001', 'approve', {}, { expectedVersion: 1 });
    expect(ok.data.status).toBe('approved');
    expect(ok.data.version).toBe(2);
    expect(ok.data.history.at(-1)).toMatchObject({ action: 'approve', from: 'pending', to: 'approved' });
    expect((await a.act('leave', 'THH-LV-000001', 'approve', {}, { expectedVersion: 2 })).error.code).toBe('INVALID_TRANSITION');
    expect((await a.act('leave', 'missing', 'approve', {}, { expectedVersion: 1 })).error.code).toBe('NOT_FOUND');
  });
  it('routes sensitive actions to approval without changing status', async () => {
    const a = createDemoAdapter(ENTITIES, seed(), { now: at });
    const res = await a.act('employee', 'THH-EMP-0001', 'suspend', { note: 'Policy breach' }, { expectedVersion: 1 });
    expect(res.data.status).toBe('active');
    expect(res.data.pendingApproval).toBe('suspend');
    expect(res.data.allowedActions).toEqual([]);
  });
  it('creates with validation, public ID and idempotency', async () => {
    const a = createDemoAdapter(ENTITIES, seed(), { now: at });
    expect((await a.create('leave', { type: 'casual' })).error.code).toBe('VALIDATION_FAILED');
    const values = { type: 'sick', from: '2026-12-01', to: '2026-12-01', reason: 'Fever' };
    const r1 = await a.create('leave', values, { idempotencyKey: 'k1' });
    const r2 = await a.create('leave', values, { idempotencyKey: 'k1' });
    expect(r1.data.id).toBe('THH-LV-000002');
    expect(r2.data.id).toBe(r1.data.id);
    expect((await a.list('leave')).data.total).toBe(2);
  });
  it('applies demo scopes', () => {
    expect(demoScope({ status: 'pending', requesterName: 'B' }, 'inbox', 'A')).toBe(true);
    expect(demoScope({ status: 'pending', requesterName: 'A' }, 'inbox', 'A')).toBe(false); // no self-approval
    expect(demoScope({ status: 'executed', requesterName: 'A' }, 'history', 'A')).toBe(true);
    expect(demoScope({ status: 'pending', requesterName: 'A' }, 'mine', 'A')).toBe(true);
    expect(demoScope({ status: 'pending', requesterName: 'B', stage: 'ceo_review' }, 'inbox', 'A', 'founder')).toBe(false);
    expect(demoScope({ status: 'pending', requesterName: 'B', stage: 'founder_review' }, 'inbox', 'A', 'founder')).toBe(true);
  });
  it('demoAllowedActions ignores unknown entity', () => {
    expect(demoAllowedActions(undefined, { status: 'x' })).toEqual([]);
  });
});
