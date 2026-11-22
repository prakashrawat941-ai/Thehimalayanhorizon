import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requirePartner } from '@/lib/partner';
import { rows } from '@/lib/account';
import { Reply } from '@/components/partner/Tickets';

export default async function Ticket({ params }) {
  const { id } = await params;
  const { db } = await requirePartner(`/partner/support/${id}`);
  const { L, lang, status } = await getT();
  const { data: t } = await db.from('support_tickets').select('*').eq('id', id).maybeSingle();
  if (!t) notFound();
  const msgs = await rows(db.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at'));
  const when = (iso) => new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  return (
    <>
      <p className="small"><Link href="/partner/support">← {L('Support', 'सहायता')}</Link></p>
      <div className="ds-head"><div className="grow"><h1>{t.subject}</h1><p className="muted">{t.category} · <span className="badge">{status(t.status)}</span></p></div></div>
      <section className="ds-panel">
        <div className="thread">{msgs.map((m) => (
          <div key={m.id} className={`msg${m.is_admin ? ' admin' : ''}`}><strong>{m.is_admin ? 'THH' : L('You', 'आप')}</strong> <small className="muted">{when(m.created_at)}</small><p>{m.body}</p></div>
        ))}</div>
        <Reply lang={lang} ticketId={t.id} closed={t.status === 'closed'} />
      </section>
    </>
  );
}
