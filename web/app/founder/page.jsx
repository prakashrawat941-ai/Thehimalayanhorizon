import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import { loadFinance, loadPeople, loadWork } from '@/lib/dash/management-live';
import { decide } from '@/app/management/dashboard-actions';
import { DashError } from '@/components/dash/DashStates';
import { FounderOverview, WorkQueue } from '@/components/dash/management';

export default async function FounderHome() {
  const { db, user, mfaNeeded } = await requireManagement('founder','/founder');
  if (mfaNeeded) return null;
  const { L, lang } = await getT();
  const [finance, people, work] = await Promise.all([loadFinance(db), loadPeople(db), loadWork(db,'founder',user.id,'founder')]);
  const waiting = work.error ? null : work.data.filter((x) => x.actions.length).length;
  return (
    <FounderOverview lang={lang} finance={finance.data} waiting={waiting} mfaReady={people.error ? null : people.data.filter((p) => p.role !== 'admin' && p.mfa === 'verified').length} teamSize={people.error ? null : people.data.filter((p) => p.role !== 'admin').length}>
      {finance.error ? <DashError title={L('Couldn’t load this', 'यह लोड नहीं हुआ')} text={L('Check your connection and try again. Nothing was changed.', 'कनेक्शन जाँचकर फिर कोशिश करें। कुछ नहीं बदला गया।')} retry={L('Try again', 'फिर कोशिश करें')} /> : null}
      <WorkQueue lang={lang} title={L('Waiting for you', 'आपका इंतज़ार')} items={work.data || []} connected={!work.error} decide={decide} />
    </FounderOverview>
  );
}
