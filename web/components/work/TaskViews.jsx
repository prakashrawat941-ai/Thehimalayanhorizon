'use client';
import { BOARD_COLUMNS, isOverdue } from '@/lib/work/task-model';
import { Badge, DataTable, EmptyState } from '@/components/ui';
import { PRIORITY_LABEL, STATUS_LABEL, tt } from './i18n';

const PRIORITY_TONE = { low: 'neutral', medium: 'info', high: 'warning', urgent: 'danger' };
const COLUMN_LABEL = {
  todo: ['To do', 'करने हैं'], doing: ['In progress', 'चल रहे'], review: ['In review', 'समीक्षा में'],
  done: ['Done', 'पूरे'], closed: ['Closed', 'बंद'],
};

export function TaskChip({ task, lang, person, today }) {
  const L = tt(lang);
  return (
    <span className="ui-task-chip-meta">
      <Badge tone={PRIORITY_TONE[task.priority]}>{L(...PRIORITY_LABEL[task.priority])}</Badge>
      {isOverdue(task, today) ? <Badge tone="danger">{L('Overdue', 'देर से')}</Badge> : null}
      <span className="ui-muted">{person(task.assigneeId)}</span>
    </span>
  );
}

/** Kanban-style board. Cards are buttons (keyboard and screen-reader friendly); status changes happen in the detail dialog, not by dragging. */
export function TaskBoard({ tasks, lang, person, today, onOpen }) {
  const L = tt(lang);
  if (!tasks.length) return <EmptyState title={L('No tasks match', 'कोई काम मेल नहीं खाता')} description={L('Change the filters or create a new task.', 'फ़िल्टर बदलें या नया काम बनाएँ।')} />;
  return (
    <div className="ui-board" role="list" aria-label={L('Task board', 'काम का बोर्ड')}>
      {BOARD_COLUMNS.map((col) => {
        const items = tasks.filter((t) => col.statuses.includes(t.status));
        return (
          <section key={col.key} className="ui-board-col" role="listitem" aria-label={L(...COLUMN_LABEL[col.key])}>
            <h3 className="ui-board-head">{L(...COLUMN_LABEL[col.key])} <span className="ui-tab-count">{items.length}</span></h3>
            {items.length === 0 ? <p className="ui-muted ui-board-none">{L('Nothing here', 'यहाँ कुछ नहीं')}</p> : null}
            <ul className="ui-board-list">
              {items.map((t) => (
                <li key={t.id}>
                  <button type="button" className="ui-task-card" onClick={() => onOpen(t.id)}>
                    <span className="ui-task-id">{t.id}</span>
                    <span className="ui-task-title">{t.title}</span>
                    <TaskChip task={t} lang={lang} person={person} today={today} />
                    <span className="ui-task-foot">
                      <Badge tone="teal">{L(...STATUS_LABEL[t.status])}</Badge>
                      {t.dueDate ? <span className="ui-muted">{L('Due', 'तिथि')} {t.dueDate}</span> : null}
                    </span>
                    <span className="ui-progress" aria-label={`${t.progress}%`}><span style={{ width: `${t.progress}%` }} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function TaskList({ tasks, lang, person, today, onOpen }) {
  const L = tt(lang);
  const rows = tasks.map((t) => ({
    id: t.id, title: t.title, status: t.status, priority: t.priority,
    assignee: person(t.assigneeId), due: t.dueDate || '—', progress: t.progress,
    overdue: isOverdue(t, today), raw: t,
  }));
  return (
    <DataTable
      caption={L('Tasks', 'काम')}
      rows={rows}
      rowKey="id"
      skeletonRows={3}
      pagination={undefined}
      empty={<EmptyState title={L('No tasks match', 'कोई काम मेल नहीं खाता')} description={L('Change the filters or create a new task.', 'फ़िल्टर बदलें या नया काम बनाएँ।')} />}
      columns={[
        { key: 'id', header: L('ID', 'आईडी'), sortable: true, render: (r) => <button type="button" className="ui-link-btn" onClick={() => onOpen(r.id)}>{r.id}</button> },
        { key: 'title', header: L('Task', 'काम'), sortable: true, primary: true },
        { key: 'status', header: L('Status', 'स्थिति'), sortable: true, render: (r) => <Badge tone="teal">{L(...STATUS_LABEL[r.status])}</Badge> },
        { key: 'priority', header: L('Priority', 'प्राथमिकता'), sortable: true, render: (r) => <Badge tone={PRIORITY_TONE[r.priority]}>{L(...PRIORITY_LABEL[r.priority])}</Badge> },
        { key: 'assignee', header: L('Assignee', 'सौंपा गया'), sortable: true },
        { key: 'due', header: L('Due', 'तिथि'), sortable: true, render: (r) => <>{r.due}{r.overdue ? <> <Badge tone="danger">{L('Overdue', 'देर से')}</Badge></> : null}</> },
        { key: 'progress', header: L('Progress', 'प्रगति'), sortable: true, align: 'right', render: (r) => `${r.progress}%` },
      ]}
    />
  );
}

/** Newest first, across the tasks in view. Each line names the actor and the change. */
export function ActivityList({ tasks, lang, person, actionLabel }) {
  const L = tt(lang);
  const events = tasks
    .flatMap((t) => t.history.map((h) => ({ ...h, taskId: t.id, title: t.title })))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  if (!events.length) return <EmptyState title={L('No activity yet', 'अभी कोई गतिविधि नहीं')} />;
  return (
    <ol className="ui-timeline" aria-label={L('Activity', 'गतिविधि')}>
      {events.map((e, i) => (
        <li key={`${e.taskId}-${e.at}-${i}`}>
          <div><strong>{e.taskId}</strong> · {e.title}</div>
          <div>{actionLabel(e.action)} · {person(e.actorId)}{e.to ? ` → ${L(...STATUS_LABEL[e.to])}` : ''}</div>
          <time dateTime={e.at} className="ui-muted">{e.at.replace('T', ' ').slice(0, 16)} UTC</time>
          {e.note ? <p className="ui-timeline-note">{e.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

