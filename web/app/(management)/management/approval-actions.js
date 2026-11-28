'use server';

import { revalidatePath } from 'next/cache';
import { requireManagement } from '@/lib/management/guard';
import {
  isIdempotencyKey, isUuid, isVersion, readEngineError, STATUSES, validateResubmission, validateSubmission,
} from '@/lib/management/approval-requests.mjs';

const paths = {
  founder: '/founder/approval-center',
  ceo: '/ceo/approval-center',
  co_founder: '/co-founder/approval-center',
};
const decisions = { approve: 'approve', revise: 'request_revision', reject: 'reject' };
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

async function session(role) {
  if (!Object.hasOwn(paths, role)) return { fail: { ok: false, code: 'VALIDATION_FAILED' } };
  const { db, mfaNeeded } = await requireManagement(role, paths[role]);
  if (mfaNeeded) return { fail: { ok: false, code: 'MFA_REQUIRED' } };
  return { db };
}

function fail(error) {
  const e = readEngineError(error);
  return { ok: false, code: e.code, field: e.field };
}

export async function reviewApproval(role, id, input) {
  if (!Object.hasOwn(paths, role) || typeof id !== 'string' || !uuid.test(id) ||
      !Object.hasOwn(decisions, input?.decision) || !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1 || typeof input.note !== 'string' || input.note.length > 1000) {
    return { ok: false, code: 'VALIDATION_FAILED' };
  }

  const { db, mfaNeeded } = await requireManagement(role, paths[role]);
  if (mfaNeeded) return { ok: false, code: 'MFA_REQUIRED' };

  // An exact retry of a given decision is idempotent. PostgreSQL checks the version under a lock.
  const { error } = await db.rpc('approval_decide', {
    p_id: id,
    p_decision: decisions[input.decision],
    p_note: input.note,
    p_expected_version: input.expectedVersion,
    p_idempotency_key: `${id}:${input.expectedVersion}:${input.decision}`,
  });
  if (error) return { ok: false, code: error.message === 'STALE_VERSION' ? 'STALE_VERSION' : 'REVIEW_FAILED' };
  revalidatePath(paths[role]);
  return { ok: true };
}

/**
 * One page of requests. `status` is optional and must be an engine status (used by the "Ready to apply" view).
 */
export async function listApprovals(role, scope, offset = 0, status = null) {
  if (!Object.hasOwn(paths, role) || !['inbox', 'mine', 'history', 'all'].includes(scope) ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > 2147483647 ||
      (status !== null && !STATUSES.includes(status))) return null;
  const { db, mfaNeeded } = await requireManagement(role, paths[role]);
  if (mfaNeeded) return null;

  const { data, error } = await db.rpc('approval_list', {
    p_scope: scope, p_status: status, p_limit: 20, p_offset: offset,
  });
  return error ? null : data;
}

/** Counts for the header strip and the approval policies (category list) for the new-request form. */
export async function approvalOverview(role) {
  const s = await session(role);
  if (s.fail) return s.fail;
  const [counts, policies] = await Promise.all([s.db.rpc('approval_counts'), s.db.rpc('approval_policy_list')]);
  if (counts.error || policies.error) return fail(counts.error || policies.error);
  return { ok: true, counts: counts.data, policies: Array.isArray(policies.data) ? policies.data : [] };
}

/** Full request with payload and append-only decision history. */
export async function getApproval(role, id) {
  if (!isUuid(id)) return { ok: false, code: 'VALIDATION_FAILED' };
  const s = await session(role);
  if (s.fail) return s.fail;
  const { data, error } = await s.db.rpc('approval_get', { p_id: id });
  if (error) return fail(error);
  return { ok: true, request: data };
}

/**
 * New request. The idempotency key is created once per open form by the browser, so a double click or a
 * network retry returns the first result instead of creating a second request.
 */
export async function submitApproval(role, input, idempotencyKey) {
  if (!isIdempotencyKey(idempotencyKey)) return { ok: false, code: 'VALIDATION_FAILED', field: 'idempotencyKey' };
  const s = await session(role);
  if (s.fail) return s.fail;
  const checked = validateSubmission(input);
  if (!checked.ok) return { ok: false, code: 'VALIDATION_FAILED', errors: checked.errors };
  const v = checked.value;
  const { data, error } = await s.db.rpc('approval_submit', {
    p_category: v.category,
    p_title: v.title,
    p_reason: v.reason,
    p_risk: v.risk,
    p_amount_paise: v.amountPaise,
    p_payload: v.payload,
    p_changes: [],
    p_idempotency_key: idempotencyKey,
  });
  if (error) return fail(error);
  revalidatePath(paths[role]);
  return { ok: true, request: data };
}

/** Withdraw (requester) or escalate to the Founder (CEO). Both need a note; the server checks permission. */
export async function actOnApproval(role, id, input) {
  const action = input?.action;
  if (!isUuid(id) || !['withdraw', 'escalate'].includes(action) || !isVersion(input?.expectedVersion) ||
      typeof input.note !== 'string' || input.note.trim().length < 3 || input.note.length > 1000) {
    return { ok: false, code: 'VALIDATION_FAILED' };
  }
  const s = await session(role);
  if (s.fail) return s.fail;
  const { data, error } = await s.db.rpc('approval_decide', {
    p_id: id,
    p_decision: action,
    p_note: input.note.trim(),
    p_expected_version: input.expectedVersion,
    p_idempotency_key: `${id}:${input.expectedVersion}:${action}`,
  });
  if (error) return fail(error);
  revalidatePath(paths[role]);
  return { ok: true, request: data };
}

/** Resubmit after "revision required". Sends only the changed fields plus the required note. */
export async function resubmitApproval(role, id, input, original) {
  if (!isUuid(id) || !isVersion(input?.expectedVersion)) return { ok: false, code: 'VALIDATION_FAILED' };
  const s = await session(role);
  if (s.fail) return s.fail;
  const checked = validateResubmission(input, original || {});
  if (!checked.ok) return { ok: false, code: 'VALIDATION_FAILED', errors: checked.errors };
  const v = checked.value;
  const { data, error } = await s.db.rpc('approval_resubmit', {
    p_id: id,
    p_note: v.note,
    p_expected_version: input.expectedVersion,
    p_idempotency_key: `${id}:${input.expectedVersion}:resubmit`,
    p_title: v.title,
    p_reason: v.reason,
    p_payload: v.payload,
    p_changes: null,
    p_amount_paise: v.amountPaise,
  });
  if (error) return fail(error);
  revalidatePath(paths[role]);
  return { ok: true, request: data };
}

/**
 * Execute an approved request. This is separate from approval and only the policy's executor roles may run it.
 * A failure is recorded by the engine (status "failed", error kept) and can be retried with the new version.
 */
export async function applyApproval(role, id, expectedVersion) {
  if (!isUuid(id) || !isVersion(expectedVersion)) return { ok: false, code: 'VALIDATION_FAILED' };
  const s = await session(role);
  if (s.fail) return s.fail;
  const { data, error } = await s.db.rpc('approval_apply', {
    p_id: id, p_expected_version: expectedVersion, p_idempotency_key: `${id}:${expectedVersion}:apply`,
  });
  if (error) return fail(error);
  revalidatePath(paths[role]);
  // The engine answers normally when execution failed; report that honestly instead of as success.
  if (data?.status === 'failed') return { ok: false, code: 'APPLY_FAILED', request: data };
  return { ok: true, request: data };
}
