'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';

const CATS = [['booking', 'Booking', 'बुकिंग'], ['payout', 'Payout', 'पेआउट'], ['kyc', 'KYC', 'KYC'], ['listing', 'Listing', 'लिस्टिंग'], ['technical', 'Technical', 'तकनीकी'], ['other', 'Other', 'अन्य']];

export function NewTicket({ lang, partnerId, base }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [v, setV] = useState({ subject: '', category: 'booking', body: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault(); setErr('');
      if (v.subject.trim().length < 3 || v.body.trim().length < 5) return setErr(L('Write a subject and a message.', 'विषय और मैसेज लिखें।'));
      setBusy(true);
      const { data, error } = await browserDb().rpc('open_ticket', { p_subject: v.subject.trim().slice(0, 160), p_category: v.category, p_body: v.body.trim().slice(0, 4000), p_partner: partnerId });
      setBusy(false);
      if (error) return setErr(error.message);
      const id = data?.id || data;
      router.push(typeof id === 'string' ? `${base}/${id}` : base); router.refresh();
    }}>
      <div className="form-grid">
        <label className="field"><span className="field-label">{L('Subject', 'विषय')}</span><input className="input" value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} maxLength={160} /></label>
        <label className="field"><span className="field-label">{L('Topic', 'विषय का प्रकार')}</span><select className="input" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{CATS.map(([k, en, hi]) => <option key={k} value={k}>{lang === 'hi' ? hi : en}</option>)}</select></label>
      </div>
      <label className="field"><span className="field-label">{L('Message', 'मैसेज')}</span><textarea className="input" rows={4} maxLength={4000} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} /></label>
      {err ? <p className="form-err" role="alert">{err}</p> : null}
      <button className="btn" disabled={busy}>{L('Send to THH team', 'THH टीम को भेजें')}</button>
    </form>
  );
}

export function Reply({ lang, ticketId, closed, allowClose = true }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const post = async (close) => {
    if (!close && body.trim().length < 1) return;
    setBusy(true); setErr('');
    const { error } = await browserDb().rpc('post_ticket_message', { p_ticket: ticketId, p_body: body.trim().slice(0, 4000) || (close ? 'Closed' : ''), p_close: !!close });
    setBusy(false);
    if (error) setErr(error.message); else { setBody(''); router.refresh(); }
  };
  if (closed) return <p className="muted">{L('This ticket is closed.', 'यह टिकट बंद है।')}</p>;
  return (
    <div className="stack">
      <textarea className="input" rows={3} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} aria-label={L('Reply', 'जवाब')} />
      {err ? <p className="form-err" role="alert">{err}</p> : null}
      <div className="row-actions">
        <button type="button" className="btn" disabled={busy || !body.trim()} onClick={() => post(false)}>{L('Send reply', 'जवाब भेजें')}</button>
        {allowClose ? <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => post(true)}>{L('Close ticket', 'टिकट बंद करें')}</button> : null}
      </div>
    </div>
  );
}
