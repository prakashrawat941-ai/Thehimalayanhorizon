'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
import { inr } from '@/lib/format';

/**
 * Confirm / decline / check in / complete. The database checks every step (dates, rooms free, order)
 * through set_booking_status; the page only refreshes after the server says yes.
 */
export function BookingActions({ lang, b, today }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dialog, setDialog] = useState(''); // '' | 'confirm' | 'decline'
  const [reason, setReason] = useState('');
  const box = useRef(null);

  useEffect(() => {
    if (!dialog) return undefined;
    const prev = document.activeElement;
    box.current?.querySelector('textarea, button')?.focus();
    const esc = (e) => { if (e.key === 'Escape' && !busy) setDialog(''); };
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); prev?.focus?.(); };
  }, [dialog, busy]);

  async function go(status, note = '') {
    setBusy(true); setErr('');
    const { error } = await browserDb().rpc('set_booking_status', { p_id: b.id, p_status: status, p_note: note });
    setBusy(false);
    if (error) {
      setErr(/not available|enough|free/i.test(error.message) ? L('Not available: the rooms are already taken for these dates.', 'उपलब्ध नहीं: इन तारीख़ों पर कमरे पहले ही बुक हैं।') : error.message);
      return;
    }
    setDialog(''); setReason('');
    router.refresh();
  }

  const REASONS = [L('Fully booked for these dates', 'इन तारीख़ों पर पूरा बुक है'), L('Closed for repairs', 'मरम्मत के लिए बंद'), L('Group is too large', 'ग्रुप बहुत बड़ा है')];
  return (
    <>
      <div className="pp-acts">
        {b.status === 'requested' ? <>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => { setErr(''); setDialog('confirm'); }}>{L('Confirm', 'कन्फर्म')}</button>
          <button type="button" className="btn btn-sm btn-danger-ghost" disabled={busy} onClick={() => { setErr(''); setDialog('decline'); }}>{L('Decline', 'मना करें')}</button>
        </> : null}
        {b.status === 'confirmed' && b.kind === 'homestay' ? <button type="button" className="btn btn-sm" disabled={busy || b.start_date > today} title={b.start_date > today ? L('Available from the check-in date', 'चेक-इन की तारीख़ से') : ''} onClick={() => go('checked_in')}>{busy ? '…' : L('Check in', 'चेक-इन')}</button> : null}
        {b.status === 'confirmed' && b.kind === 'homestay' && b.start_date > today ? <small className="muted">{L('Check-in opens on the arrival date', 'चेक-इन आने की तारीख़ पर खुलेगा')}</small> : null}
        {b.status === 'checked_in' || (b.status === 'confirmed' && b.kind !== 'homestay') ? <button type="button" className="btn btn-sm" disabled={busy} onClick={() => go('completed')}>{busy ? '…' : L('Mark completed', 'पूरा करें')}</button> : null}
        {['confirmed', 'checked_in', 'completed'].includes(b.status) && b.kind === 'homestay' ? <Link className="btn btn-ghost btn-sm" href={`/account/bookings/${b.id}`}>{L('Voucher', 'वाउचर')}</Link> : null}
        {err && !dialog ? <small className="warn-text" role="alert">{err}</small> : null}
      </div>

      {dialog ? (
        <div className="pp-ov" onClick={() => { if (!busy) setDialog(''); }}>
          <div className="pp-md" role="dialog" aria-modal="true" aria-labelledby={`bk-dlg-${b.id}`} ref={box} onClick={(e) => e.stopPropagation()}>
            {dialog === 'confirm' ? <>
              <h2 id={`bk-dlg-${b.id}`}>{L('Confirm this booking?', 'यह बुकिंग कन्फर्म करें?')}</h2>
              <p className="small" style={{ margin: '0 0 10px' }}><strong>{b.guest_name}</strong> · {b.summary}</p>
              {b.total_amount != null ? <div className="pp-money"><div><span>{L('Estimate', 'अनुमान')}</span><span>{inr(b.total_amount)}</span></div>
                <p>{L('The system fixes the final amount, THH commission and your share when you confirm.', 'कन्फर्म करने पर सिस्टम अंतिम रकम, THH कमीशन और आपका हिस्सा तय करेगा।')}</p></div> : null}
              <p className="small muted">{L('Make sure the rooms are free on these dates.', 'पक्का करें कि इन तारीख़ों पर कमरे ख़ाली हैं।')}</p>
            </> : <>
              <h2 id={`bk-dlg-${b.id}`}>{L('Decline this request?', 'यह रिक्वेस्ट मना करें?')}</h2>
              <label className="field"><span className="field-label">{L('Reason the guest will see (optional)', 'मेहमान को दिखने वाला कारण (वैकल्पिक)')}</span>
                <textarea className="input" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
              <div className="chips" style={{ marginTop: 8 }}>{REASONS.map((r) => <button key={r} type="button" className={`chip chip-toggle${reason === r ? ' on' : ''}`} aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>)}</div>
            </>}
            {err ? <p className="form-err" role="alert">{err}</p> : null}
            <div className="pp-acts">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setDialog('')}>{L('Cancel', 'रद्द करें')}</button>
              {dialog === 'confirm'
                ? <button type="button" className="btn" disabled={busy} onClick={() => go('confirmed')}>{busy ? L('Confirming…', 'कन्फर्म हो रहा है…') : L('Confirm booking', 'बुकिंग कन्फर्म करें')}</button>
                : <button type="button" className="btn btn-danger" disabled={busy} onClick={() => go('declined', reason.trim())}>{busy ? L('Declining…', 'मना हो रहा है…') : L('Decline', 'मना करें')}</button>}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
