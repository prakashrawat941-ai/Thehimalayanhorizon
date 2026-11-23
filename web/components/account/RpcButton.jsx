'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { browserDb } from '@/lib/supabase/client';

/**
 * Button that calls a database function (the server checks the rules), asks for
 * confirmation first, then refreshes the page. Used for "Cancel" actions.
 */
export function RpcButton({ fn, args, label, confirmText, className = 'btn btn-ghost btn-sm', doneText }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <span className="rpc-btn">
      <button type="button" className={className} disabled={busy} aria-busy={busy}
        onClick={async () => {
          if (confirmText && !window.confirm(confirmText)) return;
          setBusy(true); setErr('');
          const { error } = await browserDb().rpc(fn, args);
          setBusy(false);
          if (error) { setErr(error.message); return; }
          if (doneText) setErr(doneText);
          router.refresh();
        }}>
        {label}
      </button>
      {err ? <small className="muted" role="status"> {err}</small> : null}
    </span>
  );
}
