import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requirePartner } from '@/lib/partner';
import { rows } from '@/lib/account';
import { fmtDate } from '@/lib/format';
import { NewTicket } from '@/components/partner/Tickets';

export default async function Support() {
  const { db, partner } = await requirePartner('/partner/support');
  const { L, lang, status } = await getT();
  const list = await rows(db.from('support_tickets').select('*').eq('partner_id', partner.id).order('last_message_at', { ascending: false }));
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Support', 'सहायता')}</h1></div></div>
      <div className="ds-cols">
        <section className="ds-panel">
          <h2>{L('Your tickets', 'आपके टिकट')}</h2>
          {list.length ? <div className="ds-rows">{list.map((t) => (
            <Link key={t.id} className="ds-row" href={`/partner/support/${t.id}`}><span className="grow"><strong>{t.subject}</strong><span>{t.category} · {fmtDate(t.last_message_at || t.created_at, lang)}</span></span><span className={`badge badge-${t.status === 'answered' ? 'new' : t.status === 'closed' ? 'full' : 'pending'}`}>{status(t.status)}</span></Link>
          ))}</div> : <p className="muted">{L('No tickets yet.', 'अभी कोई टिकट नहीं।')}</p>}
        </section>
        <section className="ds-panel"><h2>{L('New ticket', 'नया टिकट')}</h2><NewTicket lang={lang} partnerId={partner.id} base="/partner/support" /></section>
      </div>
    </>
  );
}
