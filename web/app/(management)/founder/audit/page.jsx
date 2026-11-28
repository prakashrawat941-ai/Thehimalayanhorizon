import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import { loadAudit } from '@/lib/dash/management-data';
import { loadManagementEvents } from '@/lib/dash/management-live';
import { DashEmpty, DashError } from '@/components/dash/DashStates';
import { ListRow, Panel } from '@/components/dash/parts';

export default async function FounderAudit() {
  const { db, mfaNeeded } = await requireManagement('founder','/founder/audit');
  if (mfaNeeded) return null;
  const { L, lang } = await getT();
  const [audit, management] = await Promise.all([loadAudit(db, 30), loadManagementEvents(db)]);
  const entries = audit.error || management.error ? [] : [...audit.data, ...management.data].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,30);
  const when = (iso) => new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const tone = (a) => (/delete/i.test(a) ? 'red' : /insert/i.test(a) ? 'green' : 'blue');
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Founder', 'संस्थापक')}</p><h1>{L('Audit log', 'ऑडिट लॉग')}</h1>
        <p className="muted">{L('Latest 30 changes, newest first. Includes team decisions and site changes.', 'नए 30 बदलाव, नया सबसे ऊपर। टीम के फ़ैसले और साइट बदलाव भी शामिल हैं।')}</p></div>
</div>
      {(audit.error || management.error) ? <DashError title={L('Couldn’t load this', 'यह लोड नहीं हुआ')} text={L('Check your connection and try again. Nothing was changed.', 'कनेक्शन जाँचकर फिर कोशिश करें। कुछ नहीं बदला गया।')} retry={L('Try again', 'फिर कोशिश करें')} />
        : !entries.length ? <DashEmpty title={L('No entries yet', 'अभी कोई एंट्री नहीं')} />
          : <Panel>{entries.map((a) => <ListRow key={a.id} icon="layers" tone={tone(a.action)} title={`${a.action} · ${a.table_name}`} sub={`${a.actorName || (a.actor ? a.actor.slice(0, 8) : L('system', 'सिस्टम'))} · ${when(a.created_at)}`} />)}</Panel>}
    </>
  );
}
