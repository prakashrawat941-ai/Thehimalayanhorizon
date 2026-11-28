'use client';
import { useState } from 'react';
import { Button, Field, Input, Select, Switch, Textarea } from '@/components/ui/workspace';
import { TASK_PRIORITIES, validateTaskInput } from '@/lib/work/task-model';
import { PRIORITY_LABEL, tt } from './i18n';

const EMPTY = { title: '', description: '', assigneeId: '', reviewRequired: false, reviewerId: '', priority: 'medium', startDate: '', dueDate: '', estimateHours: '' };

/**
 * Create-task form. Validation runs here (UI) and again on the server. onSubmit(input) returns
 * { ok, errors? }. The form closes only when it returns ok: true.
 */
export function TaskForm({ lang, people, onSubmit, onCancel }) {
  const L = tt(lang);
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const msg = {
    title: L('Write a title of 3–160 characters.', '3–160 अक्षरों का शीर्षक लिखें।'),
    assigneeId: L('Choose who will do this.', 'चुनें कौन यह काम करेगा।'),
    reviewerId: L('Choose a reviewer (not the same person as the assignee).', 'समीक्षक चुनें (सौंपे गए व्यक्ति से अलग)।'),
    priority: L('Choose a priority.', 'प्राथमिकता चुनें।'),
    dueDate: L('Due date cannot be before the start date.', 'अंतिम तिथि शुरू होने की तिथि से पहले नहीं हो सकती।'),
    estimateHours: L('Estimate must be 0–1000 hours.', 'अनुमान 0–1000 घंटे होना चाहिए।'),
    description: L('Keep the description under 2000 characters.', 'विवरण 2000 अक्षरों से कम रखें।'),
    startDate: L('Use a valid date.', 'सही तिथि लिखें।'),
  };
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const input = { ...v, reviewerId: v.reviewRequired ? v.reviewerId : null };
    const local = validateTaskInput(input);
    setErrors(local);
    setServerError('');
    if (Object.keys(local).length) return;
    setBusy(true);
    const res = await onSubmit(input);
    setBusy(false);
    if (res && res.ok === false) {
      setErrors(res.errors || {});
      setServerError(res.message || '');
    }
  }
  // Field-level message for the field's error code (the code itself is never shown to people).
  const err = (k) => (errors[k] ? msg[k] || '' : '');
  return (
    <form onSubmit={submit} noValidate aria-describedby={serverError ? 'task-form-error' : undefined}>
      {serverError ? <p id="task-form-error" className="ui-form-error" role="alert">{serverError}</p> : null}
      <Field label={L('Title', 'शीर्षक')} required error={err('title')}>
        <Input value={v.title} onChange={set('title')} maxLength={160} />
      </Field>
      <Field label={L('Description', 'विवरण')} hint={L('What done looks like.', 'पूरा होने पर कैसा दिखेगा।')} error={err('description')}>
        <Textarea value={v.description} onChange={set('description')} rows={3} />
      </Field>
      <div className="ui-form-grid">
        <Field label={L('Assign to', 'किसे सौंपें')} required error={err('assigneeId')}>
          <Select value={v.assigneeId} onChange={set('assigneeId')}>
            <option value="">{L('Choose…', 'चुनें…')}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
          </Select>
        </Field>
        <Field label={L('Priority', 'प्राथमिकता')} required error={err('priority')}>
          <Select value={v.priority} onChange={set('priority')}>
            {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{L(...PRIORITY_LABEL[p])}</option>)}
          </Select>
        </Field>
        <Field label={L('Start date', 'शुरू की तिथि')} error={err('startDate')}>
          <Input type="date" value={v.startDate} onChange={set('startDate')} />
        </Field>
        <Field label={L('Due date', 'अंतिम तिथि')} error={err('dueDate')}>
          <Input type="date" value={v.dueDate} onChange={set('dueDate')} />
        </Field>
        <Field label={L('Estimate (hours)', 'अनुमान (घंटे)')} error={err('estimateHours')}>
          <Input type="number" min="0" max="1000" step="0.5" value={v.estimateHours} onChange={set('estimateHours')} />
        </Field>
      </div>
      <Switch
        checked={v.reviewRequired}
        onCheckedChange={(on) => setV((s) => ({ ...s, reviewRequired: on }))}
        label={L('Needs a reviewer before it is marked complete', 'पूरा करने से पहले समीक्षक की मंज़ूरी चाहिए')}
      />
      {v.reviewRequired ? (
        <Field label={L('Reviewer', 'समीक्षक')} required error={err('reviewerId')}>
          <Select value={v.reviewerId} onChange={set('reviewerId')}>
            <option value="">{L('Choose…', 'चुनें…')}</option>
            {people.filter((p) => p.id !== v.assigneeId).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
          </Select>
        </Field>
      ) : null}
      <div className="ui-actions-row">
        <Button type="submit" loading={busy}>{L('Create task', 'काम बनाएँ')}</Button>
        <Button variant="secondary" onClick={onCancel}>{L('Cancel', 'रद्द करें')}</Button>
      </div>
    </form>
  );
}
