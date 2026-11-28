import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { rows } from '@/lib/account';
import { Reply } from '@/components/partner/Tickets';

export default async function AdminTicket({ params }) {
  const { id } = await params;
  const { db } = await requireAdmin(`/admin/tickets/${id}`);
  const { L, lang, status } = await getT();
  const { data: t } = await db.from('support_tickets').select('*, partners(business_name, phone)').eq('id', id).maybeSingle();
  if (!t) notFound();
  const msgs = await rows(db.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at'));
  const when = (iso) => new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  return (
    <>
      <p className="small"><Link href="/admin/tickets">← {L('Support tickets', 'सहायता टिकट')}</Link></p>
      <div className="ds-head"><div className="grow"><h1>{t.subject}</h1><p className="muted">{t.partners?.business_name} {t.partners?.phone ? `· ${t.partners.phone}` : ''} · {t.category} · {status(t.status)}</p></div></div>
      <section className="ds-panel">
        <div className="thread">{msgs.map((m) => <div key={m.id} className={`msg${m.is_admin ? ' admin' : ''}`}><strong>{m.is_admin ? 'THH' : t.partners?.business_name || L('User', 'यूज़र')}</strong> <small className="muted">{when(m.created_at)}</small><p>{m.body}</p></div>)}</div>
        <Reply lang={lang} ticketId={t.id} closed={t.status === 'closed'} />
      </section>
    </>
  );
}
