import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { loadFounderFinance } from '@/lib/dash/management-data';
import { DashError } from '@/components/dash/DashStates';
import { FounderOverview, WorkQueue } from '@/components/dash/management';

export default async function FounderHome() {
  const { db } = await requireAdmin('/founder');
  const { L, lang } = await getT();
  const finance = await loadFounderFinance(db);
  return (
    <FounderOverview lang={lang} finance={finance.data} waiting={null} mfaReady={null} teamSize={null}>
      {finance.error ? <DashError title={L('Couldn’t load this', 'यह लोड नहीं हुआ')} text={L('Check your connection and try again. Nothing was changed.', 'कनेक्शन जाँचकर फिर कोशिश करें। कुछ नहीं बदला गया।')} retry={L('Try again', 'फिर कोशिश करें')} /> : null}
      <WorkQueue lang={lang} title={L('Waiting for you', 'आपका इंतज़ार')} items={[]} connected={false} />
    </FounderOverview>
  );
}
