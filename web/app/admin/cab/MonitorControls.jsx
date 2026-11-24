'use client';

import { useActionState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';

export function MonitorRefresh({ label, loadingLabel, watchIncidents }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) router.refresh();
    };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    const db = watchIncidents ? browserDb() : null;
    const channel = db?.channel('admin-cab-sos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_incidents' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sos_incidents' }, refresh)
      .subscribe((status) => { if (status === 'SUBSCRIBED') refresh(); });
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
      if (channel) void db.removeChannel(channel);
    };
  }, [router, watchIncidents]);

  return <button className="btn btn-ghost btn-sm" type="button" disabled={pending}
    onClick={() => startTransition(() => router.refresh())}>
    {pending ? loadingLabel : label}
  </button>;
}

export function MonitorAction({ action, label, pendingLabel, noteLabel, note, confirm, danger }) {
  const [state, submit, pending] = useActionState(action, {});
  return <form action={submit} className="stack" onSubmit={confirm
    ? (event) => { if (!window.confirm(confirm)) event.preventDefault(); }
    : undefined}>
    {noteLabel && <label className="field">
      <span>{noteLabel}</span>
      <textarea className="input" name="note" rows={2} maxLength={1000} defaultValue={note} />
    </label>}
    <div><button type="submit" className={`btn btn-sm ${danger ? 'btn-danger-ghost' : ''}`}
      disabled={pending || state.saved}>{pending ? pendingLabel : label}</button></div>
    {state.error && <p className="form-err" role="alert">{state.error}</p>}
  </form>;
}
