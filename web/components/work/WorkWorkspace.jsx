'use client';
import { useMemo, useState } from 'react';
import {
  Badge, Button, Card, CardHeader, Dialog, FilterBar, NotConnectedState, Stat, StatGrid, Tabs, ToastProvider, useToast,
} from '@/components/ui';
import {
  ACTIONS, actionsFor, applyAction, createTask, isOverdue, summarise, taskPublicId, todayIST, TASK_PRIORITIES, TASK_STATUSES,
} from '@/lib/work/task-model';
import { ActivityList, TaskBoard, TaskChip, TaskList } from './TaskViews';
import { TaskForm } from './TaskForm';
import { ActionDialog } from './ActionDialog';
import { ACTION_LABEL, ERROR_TEXT, PRIORITY_LABEL, STATUS_LABEL, tt } from './i18n';

const PAGE_SIZE = 10;

/**
 * THH Work workspace for one dashboard (Founder, CEO or Co-Founder).
 *
 *   source: null      -> "Not connected yet" (no data is shown). Default on management routes until Codex's API exists.
 *   source: 'demo'    -> in-memory sample tasks, labelled as sample, never saved. Demo route only.
 *   source: 'backend' -> reserved for Codex's adapter (see docs/DATA-CONTRACTS.md). Not implemented in this branch.
 *
 * `actor` is who is acting (in production it comes from the server session, never from the browser).
 */
export function WorkWorkspace(props) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}

function Inner({ lang = "en", source = null, people = [], actor = { id: null }, initialTasks = [], roleTitle }) {
  const L = tt(lang);
  const toast = useToast();
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState('board');
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [dialog, setDialog] = useState(null); // { actionKey }
  const today = todayIST();

  const person = (id) => people.find((p) => p.id === id)?.name || id || '—';
  const actionLabel = (key) => (ACTION_LABEL[key] ? L(...ACTION_LABEL[key]) : key);

  const shown = useMemo(() => tasks.filter((t) => {
    if (filters.q && !`${t.id} ${t.title}`.toLowerCase().includes(filters.q.toLowerCase())) return false;
    if (filters.status && t.status !== filters.status) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.scope === 'mine' && t.assigneeId !== actor.id) return false;
    if (filters.scope === 'created' && t.creatorId !== actor.id) return false;
    if (filters.scope === 'review' && t.reviewerId !== actor.id) return false;
    return true;
  }), [tasks, filters, actor.id]);

  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageRows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const stats = summarise(tasks, today);
  const open = tasks.find((t) => t.id === openId) || null;

  if (source === null) {
    return (
      <NotConnectedState
        title={L('Tasks are not connected yet', 'काम अभी जुड़े नहीं हैं')}
        description={L('This list fills in when the task service is live. No sample tasks are shown here.', 'कार्य सेवा चालू होते ही यह सूची भरेगी। यहाँ कोई नमूना काम नहीं दिखाया जाता।')}
      />
    );
  }

  function replace(next) { setTasks((list) => list.map((t) => (t.id === next.id ? next : t))); }

  function create(input) {
    const nextNo = tasks.length + 1;
    const res = createTask(input, { actor, publicId: taskPublicId(nextNo), nowIso: new Date().toISOString() });
    if (!res.ok) return { ok: false, errors: res.errors };
    setTasks((list) => [res.task, ...list]);
    setCreating(false);
    toast.success(L(`Task ${res.task.id} created and assigned.`, `काम ${res.task.id} बनाया और सौंपा गया।`));
    return { ok: true };
  }

  function apply(actionKey, input = {}) {
    const current = tasks.find((t) => t.id === openId);
    if (!current) return { ok: false, code: 'NOT_FOUND' };
    const res = applyAction(current, actionKey, actor, input, new Date().toISOString());
    if (!res.ok) return res;
    replace(res.task);
    toast.success(L(`Saved: ${actionLabel(actionKey)}.`, `सहेजा गया: ${actionLabel(actionKey)}।`));
    return res;
  }

  function act(actionKey) {
    const needsDialog = ACTIONS[actionKey].needsNote || ACTIONS[actionKey].needsProgress || ACTIONS[actionKey].needsEvidence;
    if (needsDialog) { setDialog({ actionKey }); return; }
    const res = apply(actionKey, {});
    if (!res.ok) toast.error(L(...(ERROR_TEXT[res.code] || ERROR_TEXT.INTERNAL_ERROR)));
  }

  return (
    <div className="ui-work">
      {source === 'demo' ? (
        <p className="ui-demo-banner" role="note"><Badge tone="warning">{L('Sample data', 'नमूना डेटा')}</Badge> {L('These tasks are sample data for review. Changes are not saved and nothing is sent to anyone.', 'ये काम समीक्षा के लिए नमूना डेटा हैं। बदलाव सहेजे नहीं जाते और किसी को कुछ भेजा नहीं जाता।')}</p>
      ) : null}

      <StatGrid>
        <Stat label={L('Open tasks', 'खुले काम')} value={stats.open} hint={L('In this list', 'इस सूची में')} />
        <Stat label={L('Waiting for review', 'समीक्षा का इंतज़ार')} value={stats.inReview} />
        <Stat label={L('Overdue', 'देर से')} value={stats.overdue} />
        <Stat label={L('Completed', 'पूरे हुए')} value={stats.completed} />
      </StatGrid>

      <Card>
        <CardHeader
          title={roleTitle || L('THH Work', 'THH वर्क')}
          description={L('Assign, track, review and close tasks. Every change is recorded.', 'काम सौंपें, देखें, समीक्षा करें और बंद करें। हर बदलाव दर्ज होता है।')}
          actions={<Button iconLeft="plus" onClick={() => setCreating(true)}>{L('New task', 'नया काम')}</Button>}
        />
        <Tabs
          label={L('Work views', 'काम के दृश्य')}
          value={view}
          onChange={setView}
          tabs={[
            { id: 'board', label: L('Board', 'बोर्ड'), content: null },
            { id: 'list', label: L('List', 'सूची'), content: null },
            { id: 'activity', label: L('Activity', 'गतिविधि'), content: null },
          ]}
        />
        <div className="ui-work-body">
          {view !== 'activity' ? (
            <FilterBar
              value={filters}
              onChange={(next) => { setFilters(next); setPage(1); }}
              search={{ label: L('Search tasks', 'काम खोजें'), placeholder: L('Search by ID or title', 'आईडी या शीर्षक से खोजें') }}
              filters={[
                { key: 'scope', label: L('Show', 'दिखाएँ'), allLabel: L('All tasks in view', 'दृश्य के सभी काम'), options: [
                  { value: 'mine', label: L('Assigned to me', 'मुझे सौंपे गए') },
                  { value: 'created', label: L('Created by me', 'मेरे बनाए हुए') },
                  { value: 'review', label: L('I review', 'मैं समीक्षा करता हूँ') },
                ] },
                { key: 'status', label: L('Status', 'स्थिति'), options: TASK_STATUSES.map((s) => ({ value: s, label: L(...STATUS_LABEL[s]) })) },
                { key: 'priority', label: L('Priority', 'प्राथमिकता'), options: TASK_PRIORITIES.map((p) => ({ value: p, label: L(...PRIORITY_LABEL[p]) })) },
              ]}
            />
          ) : null}

          {view === 'board' ? <TaskBoard tasks={shown} lang={lang} person={person} today={today} onOpen={setOpenId} /> : null}
          {view === 'list' ? (
            <>
              <TaskList tasks={pageRows} lang={lang} person={person} today={today} onOpen={setOpenId} />
              {shown.length > PAGE_SIZE ? (
                <nav className="ui-pager" aria-label={L('Pagination', 'पन्ने')}>
                  <span className="ui-pager-status" aria-live="polite">{L('Page', 'पन्ना')} {page} / {pageCount}</span>
                  <span className="ui-pager-btns">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{L('Previous', 'पिछला')}</Button>
                    <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>{L('Next', 'अगला')}</Button>
                  </span>
                </nav>
              ) : null}
            </>
          ) : null}
          {view === 'activity' ? <ActivityList tasks={tasks} lang={lang} person={person} actionLabel={actionLabel} /> : null}
        </div>
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} title={L('New task', 'नया काम')} description={L('It is assigned as soon as you save.', 'सहेजते ही यह सौंप दिया जाएगा।')} size="lg">
        <TaskForm lang={lang} people={people} onSubmit={create} onCancel={() => setCreating(false)} />
      </Dialog>

      <Dialog open={Boolean(open)} onClose={() => setOpenId(null)} title={open ? `${open.id} · ${open.title}` : ''} size="lg" side>
        {open ? (
          <TaskDetail
            task={open}
            lang={lang}
            person={person}
            today={today}
            allowed={actionsFor(open, actor)}
            actionLabel={actionLabel}
            onAct={act}
          />
        ) : null}
      </Dialog>

      {dialog && open ? (
        <ActionDialog
          open
          lang={lang}
          actionKey={dialog.actionKey}
          task={open}
          onClose={(saved) => setDialog(null)}
          onApply={(input) => apply(dialog.actionKey, input)}
        />
      ) : null}
    </div>
  );
}

function TaskDetail({ task, lang, person, today, allowed, actionLabel, onAct }) {
  const L = tt(lang);
  const overdue = isOverdue(task, today);
  return (
    <div className="ui-task-detail">
      <div className="ui-task-detail-top">
        <Badge tone="teal">{L(...STATUS_LABEL[task.status])}</Badge>
        {overdue ? <Badge tone="danger">{L('Overdue', 'देर से')}</Badge> : null}
        <TaskChip task={task} lang={lang} person={person} today={today} />
      </div>
      <dl className="ui-meta">
        <div><dt>{L('Created by', 'किसने बनाया')}</dt><dd>{person(task.creatorId)}</dd></div>
        <div><dt>{L('Assigned to', 'सौंपा गया')}</dt><dd>{person(task.assigneeId)}</dd></div>
        <div><dt>{L('Reviewer', 'समीक्षक')}</dt><dd>{task.reviewRequired ? person(task.reviewerId) : L('Not needed', 'ज़रूरत नहीं')}</dd></div>
        <div><dt>{L('Dates', 'तिथियाँ')}</dt><dd>{task.startDate || '—'} → {task.dueDate || '—'}</dd></div>
        <div><dt>{L('Estimate', 'अनुमान')}</dt><dd>{task.estimateHours != null ? `${task.estimateHours} h` : '—'}</dd></div>
        <div><dt>{L('Progress', 'प्रगति')}</dt><dd>{task.progress}%</dd></div>
        <div><dt>{L('Version', 'संस्करण')}</dt><dd>{task.version}</dd></div>
      </dl>
      {task.description ? <p>{task.description}</p> : null}
      <h4 className="ui-subhead">{L('Actions you can take now', 'अभी आप ये कर सकते हैं')}</h4>
      {allowed.length ? (
        <div className="ui-actions-row">
          {allowed.map((key) => (
            <Button key={key} variant={key === 'cancel' || key === 'block' ? 'secondary' : 'primary'} onClick={() => onAct(key)}>
              {actionLabel(key)}
            </Button>
          ))}
        </div>
      ) : <p className="ui-muted">{L('No action is open to you on this task right now.', 'इस काम पर अभी आपके लिए कोई कार्रवाई खुली नहीं है।')}</p>}
      <h4 className="ui-subhead">{L('History', 'इतिहास')}</h4>
      <ActivityList tasks={[task]} lang={lang} person={person} actionLabel={actionLabel} />
    </div>
  );
}

