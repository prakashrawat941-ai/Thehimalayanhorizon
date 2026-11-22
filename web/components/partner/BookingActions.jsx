'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';

/** Confirm / decline / check in / complete. The database checks every step (dates, rooms free, order). */
export function BookingActions({ lang, b, today }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go(status, ask) {
    let note = '';
    if (ask) { note = window.prompt(ask) ?? null; if (note === null) return; }
    setBusy(true); setErr('');
    const { error } = await browserDb().rpc('set_booking_status', { p_id: b.id, p_status: status, p_note: note || '' });
    setBusy(false);
    if (error) setErr(/not available|enough|free/i.test(error.message) ? L('Not available: the rooms are already taken for these dates.', 'उपलब्ध नहीं: इन तारीख़ों पर कमरे पहले ही बुक हैं।') : error.message);
    else router.refresh();
  }
  return (
    <div className="row-actions">
      {b.status === 'requested' ? <>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => go('confirmed')}>{L('Confirm', 'कन्फर्म')}</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => go('declined', L('Reason for the guest (optional)', 'मेहमान के लिए कारण (वैकल्पिक)'))}>{L('Decline', 'मना करें')}</button>
      </> : null}
      {b.status === 'confirmed' && b.kind === 'homestay' ? <button type="button" className="btn btn-sm" disabled={busy || b.start_date > today} title={b.start_date > today ? L('Available from the check-in date', 'चेक-इन की तारीख़ से') : ''} onClick={() => go('checked_in')}>{L('Check in', 'चेक-इन')}</button> : null}
      {b.status === 'checked_in' || (b.status === 'confirmed' && b.kind !== 'homestay') ? <button type="button" className="btn btn-sm" disabled={busy} onClick={() => go('completed')}>{L('Mark completed', 'पूरा करें')}</button> : null}
      {['confirmed', 'checked_in', 'completed'].includes(b.status) && b.kind === 'homestay' ? <Link className="btn btn-ghost btn-sm" href={`/account/bookings/${b.id}`}>{L('Voucher', 'वाउचर')}</Link> : null}
      {err ? <small className="warn-text" role="alert">{err}</small> : null}
    </div>
  );
}
