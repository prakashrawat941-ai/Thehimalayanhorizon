'use client';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, CardHeader, DataTable, Dialog, EmptyState, Field, Input, Textarea, UiIcon } from '@/components/ui';
import { isOverdue, OPEN_STATUSES } from '@/lib/work/task-model';
import { publicId, toCsv, validateForm } from '@/lib/modules/core';
import { downloadText } from '@/components/modules/TableSection';
import { STATUS_LABEL, tt } from './i18n';

/* Month calendar of tasks by due date. */
export function TaskCalendar({ tasks, lang, today, onOpen }) {
  const L = tt(lang);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const byDay = useMemo(() => {
    const map = {};
    for (const t of tasks) if (t.dueDate?.startsWith(month)) (map[t.dueDate] ||= []).push(t);
    return map;
  }, [tasks, month]);
  const shift = (n) => setMonth(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7));
  const week = lang === 'hi' ? ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const list = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="ui-cal">
      <div className="ui-cal-head">
        <Button size="sm" variant="secondary" onClick={() => shift(-1)} aria-label={L('Previous month', 'पिछला महीना')}>‹</Button>
        <h3 aria-live="polite">{first.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>
        <Button size="sm" variant="secondary" onClick={() => shift(1)} aria-label={L('Next month', 'अगला महीना')}>›</Button>
      </div>
      <div className="ui-cal-grid" aria-hidden="true">
        {week.map((w) => <div key={w} className="ui-cal-wd">{w}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, '0')}`;
          const ev = byDay[d] || [];
          return <div key={d} className={`ui-cal-day${ev.length ? ' has-ev' : ''}${d === today ? ' is-today' : ''}`}><span>{i + 1}</span>{ev.slice(0, 2).map((t) => <small key={t.id}>{t.title}</small>)}</div>;
        })}
      </div>
      <h4 className="ui-subhead">{L('Due this month', 'इस महीने देय')}</h4>
      {list.length ? (
        <ul className="ui-cal-list">
          {list.flatMap(([d, ts]) => ts.map((t) => (
            <li key={t.id}><button type="button" className="ui-link-btn" onClick={() => onOpen(t.id)}><code className="ui-code">{t.id}</code> {t.title}</button> — {d}{isOverdue(t, today) ? <> <Badge tone="danger">{L('Overdue', 'देर से')}</Badge></> : null}</li>
          )))}
        </ul>
      ) : <p className="ui-muted">{L('No tasks due this month.', 'इस महीने कोई काम देय नहीं।')}</p>}
    </div>
  );
}

/* Projects with permanent IDs and milestones. */
const PROJECT_FORM = { fields: [
  { key: 'name', type: 'text', required: true, minLength: 3, maxLength: 120 },
  { key: 'due', type: 'date', required: true },
  { key: 'milestones', type: 'textarea', maxLength: 2000 },
] };

export function ProjectsPanel({ projects, setProjects, tasks, lang, person, actor, today }) {
  const L = tt(lang);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  function create(e) {
    e.preventDefault();
    const v = validateForm(PROJECT_FORM, values);
    setErrors(v.errors);
    if (!v.ok) return;
    const n = projects.length + 1;
    const ms = String(values.milestones || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20)
      .map((title, i) => ({ id: publicId('milestone', n * 100 + i + 1), title, done: false }));
    setProjects([{ id: publicId('project', n), name: values.name.trim(), ownerId: actor.id, due: values.due, milestones: ms }, ...projects]);
    setCreating(false); setValues({});
  }
  const toggle = (pid, mid) => setProjects(projects.map((p) => (p.id === pid ? { ...p, milestones: p.milestones.map((x) => (x.id === mid ? { ...x, done: !x.done } : x)) } : p)));
  const err = (k) => (errors[k] ? L('Check this field.', 'यह फ़ील्ड जाँचें।') : undefined);
  return (
    <div className="ui-mod-section">
      <div className="ui-mod-toolbar"><span /><Button size="sm" iconLeft="plus" onClick={() => setCreating(true)}>{L('New project', 'नया प्रोजेक्ट')}</Button></div>
      {projects.length ? (
        <div className="ui-projects">
          {projects.map((p) => {
            const linked = tasks.filter((t) => t.projectId === p.id);
            const done = linked.filter((t) => t.status === 'completed').length;
            return (
              <Card key={p.id}>
                <CardHeader level={3} title={p.name} description={`${p.id} · ${L('Owner', 'ज़िम्मेदार')}: ${person(p.ownerId)} · ${L('Due', 'देय')} ${p.due}`}
                  actions={p.due < today && p.milestones.some((x) => !x.done) ? <Badge tone="danger">{L('Overdue', 'देर से')}</Badge> : null} />
                <p className="ui-muted">{L('Linked tasks', 'जुड़े काम')}: {linked.length} · {L('completed', 'पूरे')}: {done}</p>
                <h4 className="ui-subhead">{L('Milestones', 'पड़ाव')}</h4>
                {p.milestones.length ? (
                  <ul className="ui-checklist">
                    {p.milestones.map((x) => <li key={x.id}><label className="ui-check"><input type="checkbox" checked={x.done} onChange={() => toggle(p.id, x.id)} /> <span><code className="ui-code">{x.id}</code> {x.title}</span></label></li>)}
                  </ul>
                ) : <p className="ui-muted">{L('No milestones yet.', 'अभी कोई पड़ाव नहीं।')}</p>}
              </Card>
            );
          })}
        </div>
      ) : <EmptyState title={L('No projects yet', 'अभी कोई प्रोजेक्ट नहीं')} />}
      <Dialog open={creating} onClose={() => setCreating(false)} title={L('New project', 'नया प्रोजेक्ट')} size="lg"
        footer={<><Button variant="secondary" onClick={() => setCreating(false)}>{L('Cancel', 'रद्द करें')}</Button><Button type="submit" form="new-project">{L('Create project', 'प्रोजेक्ट बनाएँ')}</Button></>}>
        <form id="new-project" onSubmit={create} noValidate className="ui-form-grid">
          <Field label={L('Project name', 'प्रोजेक्ट का नाम')} required error={err('name')}><Input value={values.name || ''} maxLength={120} onChange={(e) => setValues({ ...values, name: e.target.value })} /></Field>
          <Field label={L('Due date', 'देय तारीख़')} required error={err('due')}><Input type="date" value={values.due || ''} onChange={(e) => setValues({ ...values, due: e.target.value })} /></Field>
          <Field className="ui-span-2" label={L('Milestones (one per line)', 'पड़ाव (हर पंक्ति में एक)')} error={err('milestones')}><Textarea rows={4} value={values.milestones || ''} onChange={(e) => setValues({ ...values, milestones: e.target.value })} /></Field>
        </form>
      </Dialog>
    </div>
  );
}

/* Per-person work summary from the tasks loaded on this screen (official reports come from the server). */
export function WorkReports({ tasks, lang, person, today }) {
  const L = tt(lang);
  const rows = useMemo(() => {
    const by = {};
    for (const t of tasks) {
      const k = t.assigneeId || '—';
      const r = (by[k] ||= { id: k, name: person(k), assigned: 0, open: 0, completed: 0, overdue: 0, review: 0 });
      r.assigned += 1;
      if (OPEN_STATUSES.includes(t.status)) r.open += 1;
      if (t.status === 'completed') r.completed += 1;
      if (t.status === 'submitted') r.review += 1;
      if (isOverdue(t, today)) r.overdue += 1;
    }
    return Object.values(by);
  }, [tasks, person, today]);
  const cols = [['name', L('Person', 'व्यक्ति')], ['assigned', L('Assigned', 'सौंपे')], ['open', L('Open', 'खुले')], ['review', L('In review', 'समीक्षा में')], ['completed', L('Completed', 'पूरे')], ['overdue', L('Overdue', 'देर से')]];
  return (
    <div className="ui-mod-section">
      <div className="ui-mod-toolbar"><span />
        <Button size="sm" variant="secondary" iconLeft="doc" disabled={!rows.length} onClick={() => downloadText('thh-work-summary.csv', toCsv(cols.map(([key, label]) => ({ key, label })), rows))}>{L('Export CSV', 'CSV निर्यात')}</Button>
      </div>
      <DataTable caption={L('Work by person', 'व्यक्ति के अनुसार काम')} hideCaption rows={rows}
        columns={cols.map(([key, header], i) => ({ key, header, primary: i === 0, align: i ? 'end' : undefined }))}
        empty={<EmptyState title={L('No tasks yet', 'अभी कोई काम नहीं')} />} />
      <p className="ui-inline-note" role="note"><UiIcon name="info" size={14} /> {L('Counted from the tasks on this screen. Official employee and project performance reports come from the server.', 'इस स्क्रीन के कामों से गिना गया। आधिकारिक कर्मचारी और प्रोजेक्ट प्रदर्शन रिपोर्ट सर्वर से आती हैं।')}</p>
    </div>
  );
}

/* Subtasks, comments, collaborators and attachments inside the task detail. */
export function TaskExtras({ task, extras = {}, onChange, lang, person, actor }) {
  const L = tt(lang);
  const [comment, setComment] = useState('');
  const [sub, setSub] = useState('');
  const subtasks = extras.subtasks || [];
  const comments = extras.comments || [];
  const addSub = (e) => { e.preventDefault(); const s = sub.trim(); if (s.length < 2) return; onChange({ ...extras, subtasks: [...subtasks, { id: `${task.id}-S${subtasks.length + 1}`, title: s.slice(0, 160), done: false }] }); setSub(''); };
  const toggleSub = (id) => onChange({ ...extras, subtasks: subtasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) });
  const addComment = (e) => { e.preventDefault(); const c = comment.trim(); if (c.length < 1) return; onChange({ ...extras, comments: [...comments, { id: `c${comments.length + 1}`, by: actor.id, text: c.slice(0, 2000), at: new Date().toISOString() }] }); setComment(''); };
  return (
    <div className="ui-task-extras">
      <h4 className="ui-subhead">{L('Collaborators', 'सहयोगी')}</h4>
      <p className="ui-muted">{(task.collaboratorIds || []).length ? task.collaboratorIds.map(person).join(', ') : L('None added.', 'कोई नहीं जोड़ा।')}</p>

      <h4 className="ui-subhead">{L('Subtasks', 'उप-कार्य')} <span className="ui-muted">({subtasks.filter((x) => x.done).length}/{subtasks.length})</span></h4>
      {subtasks.length ? <ul className="ui-checklist">{subtasks.map((x) => <li key={x.id}><label className="ui-check"><input type="checkbox" checked={x.done} onChange={() => toggleSub(x.id)} /> <span>{x.title}</span></label></li>)}</ul> : null}
      <form className="ui-inline-add" onSubmit={addSub}>
        <label className="ui-sr-only" htmlFor={`sub-${task.id}`}>{L('New subtask', 'नया उप-कार्य')}</label>
        <Input id={`sub-${task.id}`} value={sub} maxLength={160} placeholder={L('Add a subtask', 'उप-कार्य जोड़ें')} onChange={(e) => setSub(e.target.value)} />
        <Button type="submit" size="sm" variant="secondary" disabled={sub.trim().length < 2}>{L('Add', 'जोड़ें')}</Button>
      </form>

      <h4 className="ui-subhead">{L('Comments', 'टिप्पणियाँ')}</h4>
      {comments.length ? (
        <ol className="ui-history">{comments.map((c) => <li key={c.id}><strong>{person(c.by)}</strong> <span className="ui-muted">· {new Date(c.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</span><p>{c.text}</p></li>)}</ol>
      ) : <p className="ui-muted">{L('No comments yet.', 'अभी कोई टिप्पणी नहीं।')}</p>}
      <form className="ui-inline-add" onSubmit={addComment}>
        <label className="ui-sr-only" htmlFor={`cm-${task.id}`}>{L('Comment', 'टिप्पणी')}</label>
        <Textarea id={`cm-${task.id}`} rows={2} value={comment} maxLength={2000} placeholder={L('Write a comment', 'टिप्पणी लिखें')} onChange={(e) => setComment(e.target.value)} />
        <Button type="submit" size="sm" variant="secondary" disabled={!comment.trim()}>{L('Post', 'भेजें')}</Button>
      </form>

      <h4 className="ui-subhead">{L('Attachments', 'संलग्नक')}</h4>
      <p className="ui-muted"><UiIcon name="doc" size={14} /> {L('File attachments need document storage. Not connected yet.', 'फ़ाइल संलग्न करने के लिए दस्तावेज़ भंडारण चाहिए। अभी जुड़ा नहीं।')}</p>
      <p className="ui-muted"><UiIcon name="bell" size={14} /> {L('Due-date reminders are sent by the notification service when it is live.', 'देय-तारीख़ की याद दिलाने वाली सूचनाएँ, सूचना सेवा चालू होने पर भेजी जाएँगी।')}</p>
      <span className="ui-sr-only">{STATUS_LABEL[task.status]?.[0]}</span>
    </div>
  );
}
