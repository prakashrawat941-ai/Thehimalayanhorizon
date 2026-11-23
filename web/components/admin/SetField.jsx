'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';

/** One-click update of a single field (e.g. review status, message status). */
export function SetField({ table, id, field, options, value, idField = 'id' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <span className="row-actions">
      {options.map(([v, label]) => (
        <button key={v} type="button" className={`btn btn-sm ${value === v ? '' : 'btn-ghost'}`} disabled={busy || value === v}
          onClick={async () => { setBusy(true); const { error } = await browserDb().from(table).update({ [field]: v }).eq(idField, id); setBusy(false); if (error) setErr(error.message); else router.refresh(); }}>{label}</button>
      ))}
      {err ? <small className="warn-text">{err}</small> : null}
    </span>
  );
}
