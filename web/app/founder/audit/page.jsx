import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { loadAudit } from '@/lib/dash/management-data';
import { DashEmpty, DashError } from '@/components/dash/DashStates';
import { ListRow, Panel } from '@/components/dash/parts';

export default async function FounderAudit() {
  const { db } = await requireAdmin('/founder/audit');
  const { L, lang } = await getT();
  const audit = await loadAudit(db, 30);
  const when = (iso) => new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const tone = (a) => (/delete/i.test(a) ? 'red' : /insert/i.test(a) ? 'green' : 'blue');
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Founder', 'संस्थापक')}</p><h1>{L('Audit log', 'ऑडिट लॉग')}</h1>
        <p className="muted">{L('Latest 30 changes, newest first. Management actions will appear here too once connected.', 'नए 30 बदलाव, नया सबसे ऊपर। जुड़ने के बाद मैनेजमेंट के काम भी यहाँ दिखेंगे।')}</p></div>
        <Link className="btn btn-ghost" href="/admin/audit">{L('Full log', 'पूरा लॉग')}</Link></div>
      {audit.error ? <DashError title={L('Couldn’t load this', 'यह लोड नहीं हुआ')} text={L('Check your connection and try again. Nothing was changed.', 'कनेक्शन जाँचकर फिर कोशिश करें। कुछ नहीं बदला गया।')} retry={L('Try again', 'फिर कोशिश करें')} />
        : !audit.data.length ? <DashEmpty title={L('No entries yet', 'अभी कोई एंट्री नहीं')} />
          : <Panel>{audit.data.map((a) => <ListRow key={a.id} icon="layers" tone={tone(a.action)} title={`${a.action} · ${a.table_name}`} sub={`${a.actorName || (a.actor ? a.actor.slice(0, 8) : L('system', 'सिस्टम'))} · ${when(a.created_at)}`} />)}</Panel>}
    </>
  );
}
