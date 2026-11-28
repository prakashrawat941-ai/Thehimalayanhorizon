'use client';
import { useState } from 'react';
import { Button, Dialog, Field, Input, Textarea } from '@/components/ui/workspace';
import { ACTIONS, MIN_NOTE } from '@/lib/work/task-model';
import { ACTION_LABEL, ERROR_TEXT, tt } from './i18n';

const NOTE_LABEL = {
  block: ['Reason (required)', 'कारण (ज़रूरी)'], hold: ['Reason (required)', 'कारण (ज़रूरी)'],
  cancel: ['Reason (required)', 'कारण (ज़रूरी)'], request_revision: ['What needs changing (required)', 'क्या बदलना है (ज़रूरी)'],
  submit: ['Evidence or link (optional)', 'सबूत या लिंक (वैकल्पिक)'],
};

/**
 * Asks for the extra input a transition needs (note, evidence, progress) and only then applies it.
 * onApply(input) returns { ok, code?, message? }. The dialog closes only on ok: true.
 */
export function ActionDialog({ open, onClose, actionKey, task, lang, onApply }) {
  const L = tt(lang);
  const a = ACTIONS[actionKey];
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(String(task?.progress ?? 0));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const danger = actionKey === 'cancel';
  const needsNote = Boolean(a?.needsNote);
  const noteTooShort = needsNote && note.trim().length < MIN_NOTE;

  async function confirm() {
    if (busy) return;
    if (noteTooShort) { setError(L('Write at least 3 characters.', 'कम से कम 3 अक्षर लिखें।')); return; }
    const p = Number(progress);
    if (a.needsProgress && (!Number.isInteger(p) || p < 0 || p > 100)) { setError(L('Progress must be a whole number from 0 to 100.', 'प्रगति 0 से 100 के बीच पूरी संख्या होनी चाहिए।')); return; }
    setBusy(true);
    const res = await onApply({ note, progress: p, expectedVersion: task.version });
    setBusy(false);
    if (res?.ok) { setNote(''); setError(''); onClose(true); return; }
    setError(L(...(ERROR_TEXT[res?.code] || ERROR_TEXT.INTERNAL_ERROR)));
  }

  return (
    <Dialog
      open={open}
      onClose={() => { setError(''); onClose(false); }}
      title={`${L(...ACTION_LABEL[actionKey])} · ${task?.id ?? ''}`}
      description={task?.title}
      footer={(
        <>
          <Button variant="secondary" onClick={() => { setError(''); onClose(false); }}>{L('Cancel', 'रद्द करें')}</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={confirm}>{L(...ACTION_LABEL[actionKey])}</Button>
        </>
      )}
    >
      {error ? <p className="ui-form-error" role="alert">{error}</p> : null}
      {a?.needsProgress ? (
        <Field label={L('Progress (%)', 'प्रगति (%)')} required hint={L('Whole number 0–100.', '0–100 के बीच पूरी संख्या।')}>
          <Input type="number" min="0" max="100" step="1" value={progress} onChange={(e) => setProgress(e.target.value)} />
        </Field>
      ) : null}
      {needsNote || a?.needsEvidence ? (
        <Field label={L(...NOTE_LABEL[actionKey])} required={needsNote} error={noteTooShort && note.length > 0 ? L('Too short.', 'बहुत छोटा।') : ''}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} />
        </Field>
      ) : null}
    </Dialog>
  );
}
