// THH Work (module 07): task model, state machine and UI-side rules. Pure functions, no I/O.
//
// IMPORTANT: this is a UI-side mirror for instant feedback and tests. The server (Codex) must enforce every
// rule here again: transitions, relations (creator / assignee / reviewer), expected version, notes and review gates.
// Nothing in this file writes to a database.

export const TASK_STATUSES = Object.freeze([
  'draft', 'assigned', 'accepted', 'in_progress', 'submitted', 'revision_required',
  'blocked', 'on_hold', 'approved', 'completed', 'cancelled',
]);
export const TASK_PRIORITIES = Object.freeze(['low', 'medium', 'high', 'urgent']);
export const TERMINAL_STATUSES = Object.freeze(['completed', 'cancelled']);
export const OPEN_STATUSES = Object.freeze(TASK_STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s)));

/** Board columns. Each status belongs to exactly one column. */
export const BOARD_COLUMNS = Object.freeze([
  { key: 'todo', statuses: ['draft', 'assigned', 'accepted'] },
  { key: 'doing', statuses: ['in_progress', 'revision_required', 'blocked', 'on_hold'] },
  { key: 'review', statuses: ['submitted'] },
  { key: 'done', statuses: ['approved', 'completed'] },
  { key: 'closed', statuses: ['cancelled'] },
]);

/**
 * Actions. from: allowed statuses; to: next status (null = status unchanged);
 * by: which relation may act; needsNote: note of at least MIN_NOTE chars; needsProgress: 0–100 value.
 * needsReview: the task must not be review-required for this path (see complete).
 */
export const MIN_NOTE = 3;
export const ACTIONS = Object.freeze({
  assign: { from: ['draft'], to: 'assigned', by: ['creator'] },
  accept: { from: ['assigned'], to: 'accepted', by: ['assignee'] },
  start: { from: ['accepted'], to: 'in_progress', by: ['assignee'] },
  progress: { from: ['accepted', 'in_progress', 'revision_required'], to: null, by: ['assignee'], needsProgress: true },
  submit: { from: ['in_progress', 'revision_required'], to: 'submitted', by: ['assignee'], needsEvidence: true },
  request_revision: { from: ['submitted'], to: 'revision_required', by: ['reviewer'], needsNote: true },
  approve: { from: ['submitted'], to: 'approved', by: ['reviewer'] },
  complete: { from: ['submitted', 'approved'], to: 'completed', by: ['creator', 'reviewer'] },
  block: { from: ['accepted', 'in_progress', 'submitted', 'revision_required'], to: 'blocked', by: ['assignee', 'creator'], needsNote: true },
  unblock: { from: ['blocked'], to: 'in_progress', by: ['assignee', 'creator'] },
  hold: { from: ['assigned', 'accepted', 'in_progress', 'submitted', 'revision_required', 'blocked'], to: 'on_hold', by: ['creator'], needsNote: true },
  resume: { from: ['on_hold'], to: 'in_progress', by: ['creator'] },
  cancel: { from: OPEN_STATUSES, to: 'cancelled', by: ['creator'], needsNote: true },
});

export const ACTION_KEYS = Object.freeze(Object.keys(ACTIONS));

/** Relation of the actor to the task. An actor can be several (e.g. creator and reviewer). */
export function relationsOf(task, actor) {
  if (!task || !actor || !actor.id) return [];
  const rel = [];
  if (task.creatorId === actor.id) rel.push('creator');
  if (task.assigneeId === actor.id) rel.push('assignee');
  if (task.reviewerId === actor.id) rel.push('reviewer');
  return rel;
}

/** Is `date` (YYYY-MM-DD) before `today` (YYYY-MM-DD) while the task is still open? Overdue is not a status. */
export function isOverdue(task, todayISO) {
  return Boolean(task && task.dueDate && OPEN_STATUSES.includes(task.status) && task.dueDate < todayISO);
}

export function columnFor(status) {
  return BOARD_COLUMNS.find((c) => c.statuses.includes(status))?.key || null;
}

/** Action keys the actor may take right now (UI affordance only; server decides). */
export function actionsFor(task, actor) {
  const rel = relationsOf(task, actor);
  return ACTION_KEYS.filter((key) => {
    const a = ACTIONS[key];
    if (!a.from.includes(task.status)) return false;
    if (!a.by.some((r) => rel.includes(r))) return false;
    if (key === 'complete' && task.status === 'submitted' && task.reviewRequired) return false;
    return true;
  });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates create/edit input. Returns { field: message } (empty object = valid). */
export function validateTaskInput(input = {}) {
  const errors = {};
  const title = String(input.title ?? '').trim();
  if (title.length < 3 || title.length > 160) errors.title = 'title';
  if (String(input.description ?? '').length > 2000) errors.description = 'description';
  if (!input.assigneeId) errors.assigneeId = 'assignee';
  if (!TASK_PRIORITIES.includes(input.priority)) errors.priority = 'priority';
  if (input.reviewRequired) {
    if (!input.reviewerId) errors.reviewerId = 'reviewer';
    else if (input.reviewerId === input.assigneeId) errors.reviewerId = 'self';
  }
  if (input.startDate && !DATE_RE.test(input.startDate)) errors.startDate = 'date';
  if (input.dueDate && !DATE_RE.test(input.dueDate)) errors.dueDate = 'date';
  if (input.startDate && input.dueDate && DATE_RE.test(input.startDate) && DATE_RE.test(input.dueDate) && input.dueDate < input.startDate) {
    errors.dueDate = 'order';
  }
  if (input.estimateHours !== null && input.estimateHours !== undefined && input.estimateHours !== '') {
    const h = Number(input.estimateHours);
    if (!Number.isFinite(h) || h < 0 || h > 1000) errors.estimateHours = 'estimate';
  }
  return errors;
}

/** Builds a new task object. `publicId` comes from the caller (server sequence in production). */
export function createTask(input, { actor, publicId, nowIso }) {
  const errors = validateTaskInput(input);
  if (Object.keys(errors).length) return { ok: false, code: 'VALIDATION_FAILED', errors };
  const task = {
    id: publicId,
    title: String(input.title).trim(),
    description: String(input.description ?? '').trim(),
    creatorId: actor.id,
    assigneeId: input.assigneeId,
    reviewerId: input.reviewRequired ? input.reviewerId : null,
    reviewRequired: Boolean(input.reviewRequired),
    departmentId: input.departmentId || null,
    priority: input.priority,
    startDate: input.startDate || null,
    dueDate: input.dueDate || null,
    estimateHours: input.estimateHours === '' || input.estimateHours == null ? null : Number(input.estimateHours),
    progress: 0,
    status: 'assigned',
    version: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
    history: [{ at: nowIso, actorId: actor.id, action: 'create', from: null, to: 'assigned', note: '' }],
  };
  return { ok: true, task };
}

/**
 * Applies one action. Checks, in order: known action, expected version, status, relation, note/progress/evidence,
 * review gate. Returns { ok: true, task } (a new object, input is not mutated) or { ok: false, code, message }.
 */
export function applyAction(task, actionKey, actor, input = {}, nowIso) {
  const a = ACTIONS[actionKey];
  if (!a) return { ok: false, code: 'VALIDATION_FAILED', message: 'unknown action' };
  if (input.expectedVersion !== undefined && input.expectedVersion !== task.version) {
    return { ok: false, code: 'STALE_VERSION', message: 'task changed; reload' };
  }
  if (!a.from.includes(task.status)) return { ok: false, code: 'INVALID_TRANSITION', message: `${actionKey} from ${task.status}` };
  const rel = relationsOf(task, actor);
  if (!a.by.some((r) => rel.includes(r))) return { ok: false, code: 'PERMISSION_DENIED', message: 'not allowed for this task' };
  const note = String(input.note ?? '').trim();
  if (a.needsNote && note.length < MIN_NOTE) return { ok: false, code: 'VALIDATION_FAILED', message: 'note required' };
  if (a.needsEvidence && note.length > 1000) return { ok: false, code: 'VALIDATION_FAILED', message: 'evidence note too long' };
  if (actionKey === 'complete' && task.status === 'submitted' && task.reviewRequired) {
    return { ok: false, code: 'APPROVAL_REQUIRED', message: 'review required before completion' };
  }
  let progress = task.progress;
  if (a.needsProgress) {
    const p = Number(input.progress);
    if (!Number.isInteger(p) || p < 0 || p > 100) return { ok: false, code: 'VALIDATION_FAILED', message: 'progress 0–100' };
    progress = p;
  }
  const to = a.to ?? task.status;
  if (actionKey === 'complete' || actionKey === 'approve') progress = actionKey === 'complete' ? 100 : progress;
  const event = { at: nowIso, actorId: actor.id, action: actionKey, from: task.status, to, note };
  const next = {
    ...task,
    status: to,
    progress,
    version: task.version + 1,
    updatedAt: nowIso,
    history: [...task.history, event],
  };
  return { ok: true, task: next };
}

/** Summary counts for a list of tasks. Only counts what is in the list: no invented figures. */
export function summarise(tasks, todayISO) {
  const out = { total: tasks.length, open: 0, overdue: 0, inReview: 0, completed: 0 };
  for (const t of tasks) {
    if (OPEN_STATUSES.includes(t.status)) out.open += 1;
    if (isOverdue(t, todayISO)) out.overdue += 1;
    if (t.status === 'submitted') out.inReview += 1;
    if (t.status === 'completed') out.completed += 1;
  }
  return out;
}

/** IST calendar date (YYYY-MM-DD) for overdue checks. */
export function todayIST(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Public business ID, e.g. THH-TSK-000001 (six-digit sequence, never reused). */
export function taskPublicId(n) {
  return `THH-TSK-${String(n).padStart(6, '0')}`;
}
