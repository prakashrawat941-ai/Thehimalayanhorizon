// THH Step 02 module engine: pure helpers shared by every leadership module. No I/O.
//
// IMPORTANT
// - Validation here is a UI mirror for instant feedback. Codex's RPCs must validate every field again.
// - The UI never decides permissions. Real rows carry `allowedActions` computed by the server; the UI only
//   renders those buttons. The demo adapter computes allowed actions from status alone and is labelled as sample.
// - Public IDs are issued by the server. ID_FORMATS documents the proposed formats (docs/DATA-CONTRACTS.md).

export const NOT_CONNECTED = Object.freeze({ success: false, error: Object.freeze({ code: 'INTEGRATION_UNAVAILABLE' }) });

/** Proposed permanent public ID formats. Server-issued, never generated in production by the browser. */
export const ID_FORMATS = Object.freeze({
  employee: ['THH-EMP-', 4], task: ['THH-TSK-', 6], project: ['THH-PRJ-', 5], approval: ['THH-APR-', 6],
  leave: ['THH-LV-', 6], office: ['THH-OFF-', 3], ticket: ['THH-TKT-', 6], meeting: ['THH-MTG-', 5],
  campaign: ['THH-CMP-', 5], expense: ['THH-EXP-', 6], finance_request: ['THH-FIN-', 6], incident: ['THH-INC-', 5],
  tourist: ['THH-TRS-', 6], business: ['THH-LBZ-', 5], policy: ['THH-POL-', 3], candidate: ['THH-CAN-', 5],
  personnel_action: ['THH-PAC-', 5], destination: ['THH-DST-', 5], partner: ['THH-PTR-', 5],
  listing_change: ['THH-LCR-', 5], announcement: ['THH-ANN-', 5], report: ['THH-RPT-', 6],
  verification: ['THH-FVR-', 5], service_request: ['THH-SRV-', 6], investment: ['THH-INV-', 5],
  content: ['THH-CNT-', 5], advertisement: ['THH-ADV-', 5], milestone: ['THH-MST-', 5],
});

export function publicId(kind, n) {
  const f = ID_FORMATS[kind];
  if (!f || !Number.isInteger(n) || n < 1) return null;
  const s = String(n);
  if (s.length > f[1]) return null;
  return f[0] + s.padStart(f[1], '0');
}

export function isPublicId(kind, value) {
  const f = ID_FORMATS[kind];
  if (!f || typeof value !== 'string') return false;
  return new RegExp(`^${f[0].replace(/-/g, '\\-')}\\d{${f[1]}}$`).test(value);
}

/** Today's date in India (YYYY-MM-DD). Display only; the server's IST date is authoritative. */
export function todayIST(now = new Date()) {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_IN = /^(\+91[\s-]?)?[6-9]\d{9}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validDate(s) {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

/**
 * Validate one value against a field spec. Returns an error key or null.
 * Error keys: required, tooShort, tooLong, email, phone, number, min, max, money, date, time, option, fileType, fileSize.
 */
export function validateField(field, value) {
  if (isEmpty(value)) return field.required ? 'required' : null;
  const v = typeof value === 'string' ? value.trim() : value;
  switch (field.type) {
    case 'email': return EMAIL.test(v) ? null : 'email';
    case 'phone': return PHONE_IN.test(String(v).replace(/\s+/g, ' ')) ? null : 'phone';
    case 'number': {
      const n = Number(v);
      if (!Number.isInteger(n)) return 'number';
      if (field.min !== undefined && n < field.min) return 'min';
      if (field.max !== undefined && n > field.max) return 'max';
      return null;
    }
    case 'money': {
      if (!/^\d+(\.\d{1,2})?$/.test(String(v))) return 'money';
      const n = Number(v);
      if (n <= 0) return 'min';
      if (n > (field.max ?? 1e9)) return 'max';
      return null;
    }
    case 'date': return validDate(v) ? null : 'date';
    case 'time': return TIME.test(v) ? null : 'time';
    case 'select': return (field.options || []).some((o) => o.value === v) ? null : 'option';
    case 'file': {
      const f = value;
      if (field.accept && f.type && !field.accept.split(',').some((a) => (a.endsWith('/*') ? f.type.startsWith(a.slice(0, -1)) : f.type === a.trim()))) return 'fileType';
      if (field.maxMB && f.size > field.maxMB * 1024 * 1024) return 'fileSize';
      return null;
    }
    default: {
      const len = String(v).length;
      if (field.minLength && len < field.minLength) return 'tooShort';
      if (len > (field.maxLength ?? (field.type === 'textarea' ? 4000 : 240))) return 'tooLong';
      return null;
    }
  }
}

/**
 * Validate a form. spec: { fields: [...], rules?: [{ type: 'dateOrder', from, to } | { type: 'timeOrder', from, to }] }
 * Returns { ok, errors: { [key]: errorKey } }.
 */
export function validateForm(spec, values = {}) {
  const errors = {};
  for (const f of spec.fields) {
    if (f.when && !f.when(values)) continue;
    const e = validateField(f, values[f.key]);
    if (e) errors[f.key] = e;
  }
  for (const r of spec.rules || []) {
    const a = values[r.from], b = values[r.to];
    if (isEmpty(a) || isEmpty(b) || errors[r.from] || errors[r.to]) continue;
    if ((r.type === 'dateOrder' || r.type === 'timeOrder') && b < a) errors[r.to] = 'order';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Inclusive day count between two YYYY-MM-DD dates (display only; leave balance is computed by the server). */
export function dayCount(from, to) {
  if (!validDate(from) || !validDate(to) || to < from) return 0;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
}

/** Filter + search + paginate a list of rows (used by the demo adapter and live read-only lists). */
export function queryRows(rows, { filters = {}, q = '', searchKeys = [], page = 1, pageSize = 10 } = {}) {
  const needle = String(q || '').trim().toLowerCase();
  const shown = rows.filter((r) => {
    for (const [k, v] of Object.entries(filters)) if (v && String(r[k]) !== String(v)) return false;
    if (needle && !searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(needle))) return false;
    return true;
  });
  const size = Math.min(Math.max(1, pageSize), 50);
  const p = Math.max(1, page);
  return { items: shown.slice((p - 1) * size, p * size), total: shown.length };
}

/** Escape one CSV cell (also neutralises spreadsheet formula injection). */
export function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns, rows) {
  const head = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(','));
  return [head, ...body].join('\r\n');
}

/** Mask a phone number for list views: keeps the last 4 digits. */
export function maskPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 4 ? `••••••${d.slice(-4)}` : '';
}

export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Statuses allowed for an action, from an entity spec (demo only). */
export function demoAllowedActions(entitySpec, row) {
  if (!entitySpec?.actions || !row || row.pendingApproval) return [];
  return Object.entries(entitySpec.actions).filter(([, a]) => !a.from || a.from.includes(row.status)).map(([k]) => k);
}

/** Demo-only scope rules. On real routes the server applies scope from the signed-in user. */
export function demoScope(row, scope, actorName, role) {
  if (!scope) return true;
  if (scope === 'inbox') {
    const stage = { founder: 'founder_review', ceo: 'ceo_review' }[role];
    return ['pending'].includes(row.status) && row.requesterName !== actorName && (!stage || !row.stage || row.stage === stage);
  }
  if (scope === 'mine') return row.requesterName === actorName;
  if (scope === 'history') return !['pending', 'revision_requested'].includes(row.status);
  return true;
}

/** Adapter used on every real route until Codex's API for that module exists: never returns data, never pretends to save. */
export const notConnectedAdapter = Object.freeze({
  kind: 'not_connected',
  async list() { return NOT_CONNECTED; },
  async get() { return NOT_CONNECTED; },
  async create() { return NOT_CONNECTED; },
  async act() { return NOT_CONNECTED; },
});

/**
 * In-memory adapter for the sample-data review route only. Everything it returns is labelled sample by the UI.
 * entities: { [entity]: { idKind, initialStatus, actions: { key: { from?, to?, needsNote?, patch? } }, form? } }
 */
export function createDemoAdapter(entities, seed = {}, { now = () => new Date().toISOString() } = {}) {
  const store = {};
  const counters = {};
  for (const [name, rows] of Object.entries(seed)) {
    store[name] = rows.map((r) => ({ version: 1, history: [], ...r }));
    counters[name] = rows.length;
  }
  const spec = (e) => entities[e] || {};
  const withActions = (e, r) => ({ ...r, allowedActions: demoAllowedActions(spec(e), r) });
  const fail = (code, extra) => ({ success: false, error: { code, ...extra } });
  const seenKeys = new Map();

  return {
    kind: 'demo',
    async list(entity, query = {}) {
      const rows = (store[entity] || []).filter((r) => demoScope(r, query.scope, query.actorName, query.role)).map((r) => withActions(entity, r));
      return { success: true, data: queryRows(rows, { ...query, searchKeys: query.searchKeys || spec(entity).searchKeys || ['id'] }) };
    },
    async get(entity, id) {
      const row = (store[entity] || []).find((r) => r.id === id);
      return row ? { success: true, data: withActions(entity, row) } : fail('NOT_FOUND');
    },
    async create(entity, values, meta = {}) {
      const s = spec(entity);
      if (meta.idempotencyKey && seenKeys.has(meta.idempotencyKey)) return seenKeys.get(meta.idempotencyKey);
      if (s.form) {
        const v = validateForm(s.form, values);
        if (!v.ok) return fail('VALIDATION_FAILED', { fields: v.errors });
      }
      counters[entity] = (counters[entity] || 0) + 1;
      const id = publicId(s.idKind, counters[entity]) || `${entity}-${counters[entity]}`;
      const row = { ...values, id, status: s.initialStatus || 'pending', version: 1, createdAt: now(), history: [{ action: 'create', at: now() }] };
      store[entity] = [row, ...(store[entity] || [])];
      const res = { success: true, data: withActions(entity, row) };
      if (meta.idempotencyKey) seenKeys.set(meta.idempotencyKey, res);
      return res;
    },
    async act(entity, id, action, input = {}, meta = {}) {
      const s = spec(entity);
      const a = s.actions?.[action];
      const list = store[entity] || [];
      const idx = list.findIndex((r) => r.id === id);
      if (idx < 0) return fail('NOT_FOUND');
      const row = list[idx];
      if (!a) return fail('VALIDATION_FAILED');
      if (!Number.isInteger(meta.expectedVersion) || meta.expectedVersion !== row.version) return fail('STALE_VERSION');
      if (a.from && !a.from.includes(row.status)) return fail('INVALID_TRANSITION');
      if (a.needsNote && String(input.note || '').trim().length < 3) return fail('VALIDATION_FAILED', { fields: { note: 'tooShort' } });
      const next = {
        ...row,
        ...(a.patch ? a.patch(row, input) : {}),
        status: a.viaApproval ? row.status : a.to || row.status,
        pendingApproval: a.viaApproval ? action : row.pendingApproval ?? null,
        version: row.version + 1,
        history: [...(row.history || []), { action, note: input.note || null, at: now(), from: row.status, to: a.viaApproval ? row.status : a.to || row.status, viaApproval: !!a.viaApproval }],
      };
      store[entity] = list.map((r, i) => (i === idx ? next : r));
      return { success: true, data: withActions(entity, next) };
    },
  };
}
