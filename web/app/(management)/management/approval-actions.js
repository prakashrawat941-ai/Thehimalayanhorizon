'use server';

import { revalidatePath } from 'next/cache';
import { requireManagement } from '@/lib/management/guard';

const paths = {
  founder: '/founder/approval-center',
  ceo: '/ceo/approval-center',
  co_founder: '/co-founder/approval-center',
};
const decisions = { approve: 'approve', revise: 'request_revision', reject: 'reject' };
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

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

export async function listApprovals(role, scope, offset = 0) {
  if (!Object.hasOwn(paths, role) || !['inbox', 'mine', 'history'].includes(scope) ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > 2147483647) return null;
  const { db, mfaNeeded } = await requireManagement(role, paths[role]);
  if (mfaNeeded) return null;

  const { data, error } = await db.rpc('approval_list', {
    p_scope: scope, p_limit: 20, p_offset: offset,
  });
  return error ? null : data;
}
