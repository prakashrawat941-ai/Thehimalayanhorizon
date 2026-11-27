'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { NOTE_MAX, validNote } from './ui';

/**
 * Bottom sheet (phone) / dialog (laptop) that collects a required note before a decision.
 * `action(formData)` is a server action owned by Codex; it must validate again and return
 * { ok: true } or { ok: false, message }. The dialog never reports success on its own.
 */
export function NoteDialog({ title, subtitle, fields = null, hidden = {}, buttons, noteLabel, required, failed, cancel, action, onClose }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, start] = useTransition();
  const box = useRef(null);
  useEffect(() => {
    box.current?.querySelector('textarea, input, select')?.focus();
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  const submit = (value) => (e) => {
    e.preventDefault();
    if (!validNote(note)) { setError(required); return; }
    const form = new FormData(box.current.querySelector('form'));
    form.set('decision', value);
    start(async () => {
      try {
        const res = await action(form);
        if (res?.ok) onClose(true); else setError(res?.message || failed);
      } catch { setError(failed); }
    });
  };
  return (
    <div className="dsx-ov" onPointerDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="dsx-md" role="dialog" aria-modal="true" aria-labelledby="dsx-md-h" ref={box}>
        <h2 id="dsx-md-h">{title}</h2>
        {subtitle ? <p className="dsx-note">{subtitle}</p> : null}
        <form onSubmit={(e) => e.preventDefault()}>
          {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {fields}
          <div className="dsx-fld">
            <label htmlFor="dsx-note">{noteLabel}</label>
            <textarea id="dsx-note" name="note" rows={3} maxLength={NOTE_MAX} value={note} aria-invalid={Boolean(error)} aria-describedby={error ? 'dsx-note-err' : undefined}
              onChange={(e) => { setNote(e.target.value); if (error) setError(''); }} />
            {error ? <span className="err" id="dsx-note-err" role="alert">{error}</span> : null}
          </div>
          <div className="dsx-acts">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onClose()}>{cancel}</button>
            {buttons.map((b) => (
              <button key={b.value} type="submit" className={`btn${b.tone === 'danger' ? ' btn-danger' : b.tone === 'ghost' ? ' btn-ghost' : ''}`} disabled={busy} onClick={submit(b.value)}>{b.label}</button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
