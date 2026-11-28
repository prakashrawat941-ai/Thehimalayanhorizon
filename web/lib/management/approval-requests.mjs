/**
 * Central approval engine — client/server shared rules for the Step 02 approval center.
 *
 * Source of truth is the database (supabase/migrations/20261128035831_step02_approval_engine.sql):
 * routing, permitted actions, self-approval denial, versions, idempotency and duplicate checks all run there.
 * These helpers only pre-check input so a person sees a clear message before a round trip, and map the
 * engine's error codes to text. They never decide what a person may do: the UI shows exactly the server's
 * `allowedActions` for each request.
 */

export const RISKS = ['low', 'medium', 'high', 'critical'];
export const SCOPES = ['inbox', 'mine', 'history', 'all'];
export const STATUSES = ['pending_ceo', 'pending_founder', 'approved', 'applying', 'applied',
  'revision_required', 'rejected', 'withdrawn', 'failed'];

/** Request-level actions other than approve / revise / reject (those stay on the review card). */
export const REQUEST_ACTIONS = ['withdraw', 'escalate', 'resubmit', 'apply'];
/** Actions that the engine requires a note for. */
export const NOTE_REQUIRED = new Set(['reject', 'request_revision', 'escalate', 'withdraw', 'resubmit']);

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const CATEGORY = /^[a-z_]{3,40}$/;
const KEY = /^[A-Za-z0-9:_-]{8,100}$/;
/** Largest rupee amount accepted from the form (₹100 crore). The column is bigint paise; this is a sanity cap. */
export const MAX_RUPEES = 1_000_000_000;

export const isUuid = (v) => typeof v === 'string' && UUID.test(v);
export const isIdempotencyKey = (v) => typeof v === 'string' && KEY.test(v);
export const isVersion = (v) => Number.isSafeInteger(v) && v >= 1 && v <= 2147483647;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * "12,500.50" → 1250050 paise. Empty → null (no amount). Invalid → NaN.
 * Accepts at most two decimals; never uses floating-point multiplication for the result.
 */
export function rupeesToPaise(input) {
  const raw = str(input === null || input === undefined ? '' : String(input)).replace(/[,\s₹]/g, '');
  if (raw === '') return null;
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(raw);
  if (!m) return Number.NaN;
  const rupees = Number(m[1]);
  if (rupees > MAX_RUPEES) return Number.NaN;
  const paise = rupees * 100 + Number((m[2] || '').padEnd(2, '0'));
  return paise > 0 ? paise : Number.NaN;
}

/** 1250050 → "₹12,500.50" (Indian digit grouping). */
export function formatPaise(paise) {
  if (!Number.isSafeInteger(paise)) return '—';
  const rupees = Math.floor(paise / 100);
  const rest = String(paise % 100).padStart(2, '0');
  return `₹${rupees.toLocaleString('en-IN')}${rest === '00' ? '' : `.${rest}`}`;
}

const OFFICE_FIELDS = [
  ['name', 3, 120, true], ['village', 2, 80, true], ['post', 0, 80, false], ['block', 0, 80, false],
  ['district', 2, 80, true], ['state', 2, 80, true], ['country', 0, 60, false],
];

/** Structured payload for the `office` category (mirrors private.approval_validate_payload). */
export function validateOfficePayload(input = {}) {
  const value = {};
  const errors = {};
  for (const [field, min, max, required] of OFFICE_FIELDS) {
    const v = str(input[field]);
    if ((required && v.length < min) || v.length > max) errors[`office.${field}`] = required ? 'required' : 'too_long';
    else if (v) value[field] = v;
  }
  return { value, errors };
}

/**
 * Pre-check a new request. Returns `{ ok, value, errors }` where `value` is ready for `approval_submit`.
 * `policies` is the list from `approval_policy_list` (used only to reject an unknown category early).
 */
export function validateSubmission(input = {}, policies = null) {
  const errors = {};
  const category = str(input.category);
  if (!CATEGORY.test(category) || (Array.isArray(policies) && !policies.some((p) => p.category === category))) errors.category = 'required';
  const title = str(input.title);
  if (title.length < 5 || title.length > 160) errors.title = 'length_5_160';
  const reason = str(input.reason);
  if (reason.length < 10 || reason.length > 3000) errors.reason = 'length_10_3000';
  const risk = str(input.risk);
  if (!RISKS.includes(risk)) errors.risk = 'required';
  const amountPaise = rupeesToPaise(input.amount);
  if (Number.isNaN(amountPaise)) errors.amount = 'invalid';
  let payload = {};
  if (category === 'office') {
    const office = validateOfficePayload(input.office);
    Object.assign(errors, office.errors);
    payload = office.value;
  }
  const ok = Object.keys(errors).length === 0;
  return { ok, errors, value: ok ? { category, title, reason, risk, amountPaise, payload } : null };
}

/** Pre-check a resubmission after "revision required". Only changed fields are sent; a note is required. */
export function validateResubmission(input = {}, original = {}) {
  const errors = {};
  const note = str(input.note);
  if (note.length < 3 || note.length > 1000) errors.note = 'length_3_1000';
  const title = str(input.title);
  if (title && (title.length < 5 || title.length > 160)) errors.title = 'length_5_160';
  const reason = str(input.reason);
  if (reason && (reason.length < 10 || reason.length > 3000)) errors.reason = 'length_10_3000';
  const amountPaise = rupeesToPaise(input.amount);
  if (Number.isNaN(amountPaise)) errors.amount = 'invalid';
  let payload = null;
  if (original.category === 'office' && input.office) {
    const office = validateOfficePayload(input.office);
    Object.assign(errors, office.errors);
    if (JSON.stringify(office.value) !== JSON.stringify(original.payload || {})) payload = office.value;
  }
  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok ? {
      note,
      title: title && title !== original.title ? title : null,
      reason: reason && reason !== original.reason ? reason : null,
      amountPaise: amountPaise !== null && amountPaise !== original.amountPaise ? amountPaise : null,
      payload,
    } : null,
  };
}

/** True when the server would route this request to the Founder (policy flag, or any amount). */
export function needsFounder(policy, amountPaise) {
  return !!policy?.requiresFounder || (Number.isSafeInteger(amountPaise) && amountPaise > 0);
}

/** Request-level actions the server permits on this row, in display order. */
export function requestActions(row) {
  const allowed = Array.isArray(row?.allowedActions) ? row.allowedActions : [];
  return REQUEST_ACTIONS.filter((a) => allowed.includes(a));
}

export function canReview(row) {
  const allowed = Array.isArray(row?.allowedActions) ? row.allowedActions : [];
  return ['approve', 'reject', 'request_revision'].every((a) => allowed.includes(a));
}

/** Engine error → `{ code, field }`. Supabase puts the code in `message` and the detail in `hint`. */
export function readEngineError(error) {
  if (!error) return null;
  const known = ['AUTH_REQUIRED', 'MFA_REQUIRED', 'PERMISSION_DENIED', 'VALIDATION_FAILED', 'DUPLICATE_REQUEST',
    'STALE_VERSION', 'INVALID_TRANSITION', 'APPROVAL_REQUIRED', 'NOT_FOUND'];
  const code = known.includes(error.message) ? error.message : 'SERVER_ERROR';
  const field = code === 'VALIDATION_FAILED' && typeof error.hint === 'string' && error.hint !== code ? error.hint : null;
  return { code, field };
}

const MESSAGES = {
  AUTH_REQUIRED: ['Please sign in again.', 'कृपया फिर से साइन इन करें।'],
  MFA_REQUIRED: ['Two-step verification is required. Verify and try again.', 'दो-चरण सत्यापन ज़रूरी है। सत्यापित करके फिर कोशिश करें।'],
  PERMISSION_DENIED: ['You are not allowed to do this for this request.', 'आप इस अनुरोध पर यह नहीं कर सकते।'],
  VALIDATION_FAILED: ['Some details are missing or invalid. Nothing was saved.', 'कुछ जानकारी अधूरी या ग़लत है। कुछ भी सहेजा नहीं गया।'],
  DUPLICATE_REQUEST: ['An open request for the same change already exists.', 'इसी बदलाव का एक खुला अनुरोध पहले से है।'],
  STALE_VERSION: ['This request changed after you opened it. Reload it to see the latest version.', 'खोलने के बाद अनुरोध बदल गया। नया संस्करण देखने के लिए दोबारा खोलें।'],
  INVALID_TRANSITION: ['This request is no longer at a stage where that action is possible.', 'अनुरोध अब उस चरण में नहीं है जहाँ यह संभव हो।'],
  APPROVAL_REQUIRED: ['This request must be approved before it can be applied.', 'लागू करने से पहले अनुरोध की मंज़ूरी ज़रूरी है।'],
  NOT_FOUND: ['This request was not found or is not visible to you.', 'अनुरोध नहीं मिला या आपको नहीं दिखता।'],
  SERVER_ERROR: ['Could not complete this. Nothing was changed.', 'यह पूरा नहीं हो सका। कुछ भी नहीं बदला।'],
};

export function engineMessage(code, lang = 'en') {
  const m = MESSAGES[code] || MESSAGES.SERVER_ERROR;
  return lang === 'hi' ? m[1] : m[0];
}

export const STATUS_LABEL = {
  pending_ceo: ['Waiting for CEO', 'CEO के पास लंबित'],
  pending_founder: ['Waiting for Founder', 'संस्थापक के पास लंबित'],
  approved: ['Approved — not yet applied', 'मंज़ूर — अभी लागू नहीं'],
  applying: ['Applying', 'लागू हो रहा है'],
  applied: ['Applied', 'लागू हुआ'],
  revision_required: ['Revision required', 'संशोधन ज़रूरी'],
  rejected: ['Rejected', 'अस्वीकृत'],
  withdrawn: ['Withdrawn', 'वापस लिया'],
  failed: ['Apply failed — can retry', 'लागू करना विफल — फिर कोशिश करें'],
};

export const ACTION_LABEL = {
  submit: ['Submitted', 'भेजा गया'],
  approve: ['Approved', 'मंज़ूर किया'],
  reject: ['Rejected', 'अस्वीकार किया'],
  request_revision: ['Revision requested', 'संशोधन माँगा'],
  escalate: ['Sent to Founder', 'संस्थापक को भेजा'],
  withdraw: ['Withdrawn', 'वापस लिया'],
  resubmit: ['Resubmitted', 'दोबारा भेजा'],
  apply: ['Applied', 'लागू किया'],
  apply_failed: ['Apply failed', 'लागू करना विफल'],
};

export const ROLE_NAME = {
  founder: ['Founder', 'संस्थापक'], ceo: ['CEO', 'CEO'], co_founder: ['Co-Founder', 'सह-संस्थापक'],
  employee: ['Employee', 'कर्मचारी'], admin: ['Admin', 'एडमिन'],
};

export const pick = (pair, lang) => (Array.isArray(pair) ? (lang === 'hi' ? pair[1] : pair[0]) : pair);

/** Server history rows → ApprovalTimeline items. */
export function toTimeline(history = [], lang = 'en') {
  return (Array.isArray(history) ? history : []).map((h) => ({
    at: typeof h.at === 'string' ? h.at : '',
    action: pick(ACTION_LABEL[h.action] || h.action, lang),
    actor: [h.actorName, pick(ROLE_NAME[h.actorRole] || h.actorRole, lang)].filter(Boolean).join(' · '),
    note: h.note || undefined,
  }));
}
