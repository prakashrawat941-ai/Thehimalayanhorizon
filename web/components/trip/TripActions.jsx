'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { shareLink, stopSharing, deleteTrip } from '@/lib/trip/save';
import { Icon } from '../Icon';

export function TripActions({ id, shared, lang }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [msg, setMsg] = useState('');
  return (
    <div className="row-actions no-print">
      <Link className="btn" href={`/plan?trip=${id}`}>{L('Edit in planner', 'प्लानर में बदलें')}</Link>
      <button type="button" className="btn btn-ghost" onClick={async () => {
        try { const url = await shareLink(id); if (navigator.share) await navigator.share({ url }).catch(() => {}); else { await navigator.clipboard.writeText(url); setMsg(L('Share link copied', 'शेयर लिंक कॉपी हो गया')); } router.refresh(); }
        catch (e) { setMsg(e.message); }
      }}><Icon name="globe" size={16} /> {L('Share link', 'शेयर लिंक')}</button>
      {shared ? <button type="button" className="btn btn-ghost" onClick={async () => { try { await stopSharing(id); setMsg(L('Link turned off', 'लिंक बंद')); router.refresh(); } catch (e) { setMsg(e.message); } }}>{L('Stop sharing', 'शेयर बंद करें')}</button> : null}
      <button type="button" className="btn btn-ghost" onClick={() => window.print()}><Icon name="doc" size={16} /> {L('Download PDF', 'PDF डाउनलोड')}</button>
      <button type="button" className="btn btn-ghost" onClick={async () => { if (!window.confirm(L('Delete this trip?', 'यह ट्रिप हटाएँ?'))) return; try { await deleteTrip(id); router.push('/account/trips'); } catch (e) { setMsg(e.message); } }}>{L('Delete', 'हटाएँ')}</button>
      {msg ? <small className="muted" role="status">{msg}</small> : null}
    </div>
  );
}
