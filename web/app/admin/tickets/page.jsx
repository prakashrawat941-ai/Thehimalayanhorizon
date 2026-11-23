import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { rows } from '@/lib/account';
import { fmtDate } from '@/lib/format';

export default async function Tickets({ searchParams }) {
  const sp = await searchParams;
  const { db } = await requireAdmin('/admin/tickets');
  const { L, lang, status } = await getT();
  const st = ['open', 'answered', 'closed'].includes(sp.status) ? sp.status : 'open';
  const list = await rows(db.from('support_tickets').select('*, partners(business_name)').eq('status', st).order('last_message_at', { ascending: false }).limit(200));
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Support tickets', 'सहायता टिकट')}</h1></div></div>
      <div className="seg-tabs">{['open', 'answered', 'closed'].map((s) => <Link key={s} className={st === s ? 'on' : ''} href={`/admin/tickets?status=${s}`}>{status(s)}</Link>)}</div>
      <section className="ds-panel">{list.length ? <div className="ds-rows">{list.map((t) => (
        <Link key={t.id} className="ds-row" href={`/admin/tickets/${t.id}`}><span className="grow"><strong>{t.subject}</strong><span>{t.partners?.business_name || L('Customer', 'ग्राहक')} · {t.category} · {fmtDate(t.last_message_at || t.created_at, lang)}</span></span></Link>
      ))}</div> : <p className="muted">{L('No tickets.', 'कोई टिकट नहीं।')}</p>}</section>
    </>
  );
}
