import { describe, it, expect } from 'vitest';
import {
  createTask, applyAction, actionsFor, validateTaskInput, isOverdue, summarise, BOARD_COLUMNS, TASK_STATUSES,
  taskPublicId, todayIST, columnFor, relationsOf,
} from '@/lib/work/task-model';

const FOUNDER = { id: 'emp-1' };
const CEO = { id: 'emp-2' };
const CF = { id: 'emp-3' };
const NOW = '2026-11-28T00:00:00.000Z';

function base(extra = {}) {
  const r = createTask({
    title: 'Prepare homestay checklist', description: '', assigneeId: 'emp-2', reviewerId: 'emp-1',
    reviewRequired: true, priority: 'high', startDate: '2026-11-28', dueDate: '2026-12-05', estimateHours: 6, ...extra,
  }, { actor: FOUNDER, publicId: taskPublicId(1), nowIso: NOW });
  if (!r.ok) throw new Error('fixture invalid: ' + JSON.stringify(r.errors));
  return r.task;
}
function run(task, key, actor, input = {}) { return applyAction(task, key, actor, input, NOW); }

describe('task model: structure', () => {
  it('every status is in exactly one board column', () => {
    for (const s of TASK_STATUSES) {
      const hits = BOARD_COLUMNS.filter((c) => c.statuses.includes(s));
      expect(hits.length, s).toBe(1);
    }
    expect(columnFor('submitted')).toBe('review');
  });
  it('public IDs use the spec format', () => {
    expect(taskPublicId(1)).toBe('THH-TSK-000001');
    expect(taskPublicId(123456)).toBe('THH-TSK-123456');
  });
  it('IST date is a YYYY-MM-DD string', () => {
    expect(todayIST(new Date('2026-11-27T20:00:00Z'))).toBe('2026-11-28');
  });
});

describe('task creation and validation', () => {
  it('rejects a self-review and a missing reviewer when review is required', () => {
    const e1 = validateTaskInput({ title: 'Abc', assigneeId: 'x', priority: 'low', reviewRequired: true });
    expect(e1.reviewerId).toBe('reviewer');
    const e2 = validateTaskInput({ title: 'Abc', assigneeId: 'x', priority: 'low', reviewRequired: true, reviewerId: 'x' });
    expect(e2.reviewerId).toBe('self');
  });
  it('rejects short titles, unknown priority, due before start, bad estimate', () => {
    const e = validateTaskInput({ title: 'Ab', assigneeId: 'x', priority: 'vital', startDate: '2026-12-05', dueDate: '2026-12-01', estimateHours: -1 });
    expect(e.title).toBe('title');
    expect(e.priority).toBe('priority');
    expect(e.dueDate).toBe('order');
    expect(e.estimateHours).toBe('estimate');
  });
  it('creates an assigned task with history and version 1', () => {
    const t = base();
    expect(t.status).toBe('assigned');
    expect(t.version).toBe(1);
    expect(t.history[0].action).toBe('create');
  });
  it('does not keep a reviewer when review is not required', () => {
    const r = createTask({ title: 'Simple task', assigneeId: 'emp-2', priority: 'low', reviewRequired: false, reviewerId: 'emp-1' }, { actor: FOUNDER, publicId: 'THH-TSK-000002', nowIso: NOW });
    expect(r.task.reviewerId).toBeNull();
  });
});

describe('happy path: Founder → CEO → review → done', () => {
  it('runs assign-accept-start-progress-submit-approve-complete', () => {
    let t = base();
    t = run(t, 'accept', CEO).task;
    t = run(t, 'start', CEO).task;
    t = run(t, 'progress', CEO, { progress: 60 }).task;
    expect(t.progress).toBe(60);
    t = run(t, 'submit', CEO, { note: 'Checklist attached in drive' }).task;
    expect(t.status).toBe('submitted');
    t = run(t, 'approve', FOUNDER).task;
    expect(t.status).toBe('approved');
    t = run(t, 'complete', FOUNDER).task;
    expect(t.status).toBe('completed');
    expect(t.progress).toBe(100);
    expect(t.history.map((h) => h.action)).toEqual(['create', 'accept', 'start', 'progress', 'submit', 'approve', 'complete']);
  });
  it('does not mutate the input task', () => {
    const t = base();
    run(t, 'accept', CEO);
    expect(t.status).toBe('assigned');
  });
});

describe('gates', () => {
  it('review-required task cannot complete from submitted', () => {
    let t = base();
    t = run(t, 'accept', CEO).task; t = run(t, 'start', CEO).task; t = run(t, 'submit', CEO, { note: 'done' }).task;
    const r = run(t, 'complete', FOUNDER);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('APPROVAL_REQUIRED');
  });
  it('task without review can be completed straight from submitted', () => {
    let t = base({ reviewRequired: false, reviewerId: null });
    t = run(t, 'accept', CEO).task; t = run(t, 'start', CEO).task; t = run(t, 'submit', CEO, { note: 'done' }).task;
    expect(run(t, 'complete', FOUNDER).ok).toBe(true);
  });
  it('assignee cannot approve their own work', () => {
    let t = base();
    t = run(t, 'accept', CEO).task; t = run(t, 'start', CEO).task; t = run(t, 'submit', CEO, { note: 'done' }).task;
    const r = run(t, 'approve', CEO);
    expect(r.code).toBe('PERMISSION_DENIED');
  });
  it('an unrelated employee is denied every action', () => {
    const t = base();
    for (const key of ['accept', 'cancel', 'hold']) expect(run(t, key, CF, { note: 'nope' }).code, key).toBe('PERMISSION_DENIED');
    const draft = { ...t, status: 'draft' };
    expect(run(draft, 'assign', CF).code).toBe('PERMISSION_DENIED');
    expect(actionsFor(t, CF)).toEqual([]);
  });
  it('revision requires a note and returns the task to the assignee', () => {
    let t = base();
    t = run(t, 'accept', CEO).task; t = run(t, 'start', CEO).task; t = run(t, 'submit', CEO, { note: 'v1' }).task;
    expect(run(t, 'request_revision', FOUNDER, { note: '' }).code).toBe('VALIDATION_FAILED');
    t = run(t, 'request_revision', FOUNDER, { note: 'Add the stay list' }).task;
    expect(t.status).toBe('revision_required');
    expect(actionsFor(t, CEO)).toContain('submit');
  });
  it('cancel and hold need a reason', () => {
    const t = base();
    expect(run(t, 'cancel', FOUNDER, { note: 'x' }).code).toBe('VALIDATION_FAILED');
    expect(run(t, 'cancel', FOUNDER, { note: 'Scope changed' }).task.status).toBe('cancelled');
    expect(run(t, 'hold', FOUNDER, { note: '' }).code).toBe('VALIDATION_FAILED');
  });
  it('only the creator can assign, hold or cancel', () => {
    const t = base();
    expect(run(t, 'hold', CEO, { note: 'pause please' }).code).toBe('PERMISSION_DENIED');
  });
  it('a closed task accepts no further action', () => {
    const t = run(base(), 'cancel', FOUNDER, { note: 'Dropped' }).task;
    expect(actionsFor(t, FOUNDER)).toEqual([]);
    expect(run(t, 'accept', CEO).code).toBe('INVALID_TRANSITION');
  });
  it('progress must be an integer 0–100', () => {
    let t = base();
    t = run(t, 'accept', CEO).task; t = run(t, 'start', CEO).task;
    expect(run(t, 'progress', CEO, { progress: 101 }).code).toBe('VALIDATION_FAILED');
    expect(run(t, 'progress', CEO, { progress: 12.5 }).code).toBe('VALIDATION_FAILED');
  });
  it('rejects a stale expected version (concurrency)', () => {
    const t = base();
    const r = run(t, 'accept', CEO, { expectedVersion: 7 });
    expect(r.code).toBe('STALE_VERSION');
    expect(run(t, 'accept', CEO, { expectedVersion: 1 }).ok).toBe(true);
  });
  it('blocked and on-hold tasks resume through their own actions', () => {
    let t = base();
    t = run(t, 'accept', CEO).task; t = run(t, 'start', CEO).task;
    t = run(t, 'block', CEO, { note: 'Waiting for photos' }).task;
    expect(t.status).toBe('blocked');
    t = run(t, 'unblock', CEO).task;
    expect(t.status).toBe('in_progress');
    t = run(t, 'hold', FOUNDER, { note: 'Budget freeze' }).task;
    expect(run(t, 'resume', FOUNDER).task.status).toBe('in_progress');
  });
});

describe('overdue, summaries, relations', () => {
  it('overdue only for open tasks past due date', () => {
    const t = base({ startDate: null, dueDate: '2026-11-20' });
    expect(isOverdue(t, '2026-11-28')).toBe(true);
    expect(isOverdue({ ...t, status: 'completed' }, '2026-11-28')).toBe(false);
    expect(isOverdue(base({ dueDate: '2026-12-20' }), '2026-11-28')).toBe(false);
  });
  it('summary counts only what it is given', () => {
    const list = [base(), { ...base(), status: 'submitted' }, { ...base(), status: 'completed', dueDate: '2000-01-01' }];
    expect(summarise(list, '2026-11-28')).toEqual({ total: 3, open: 2, overdue: 0, inReview: 1, completed: 1 });
    const late = [{ ...base({ startDate: null, dueDate: '2026-11-01' }) }];
    expect(summarise(late, '2026-11-28').overdue).toBe(1);
    expect(summarise([], '2026-11-28')).toEqual({ total: 0, open: 0, overdue: 0, inReview: 0, completed: 0 });
  });
  it('one person can hold several relations', () => {
    const t = { ...base(), creatorId: 'emp-2', assigneeId: 'emp-3', reviewerId: 'emp-2' };
    expect(relationsOf(t, { id: 'emp-2' })).toEqual(['creator', 'reviewer']);
  });
});
