import { loadWork } from '@/lib/dash/management-live';
import { decide } from '@/app/(management)/management/dashboard-actions';
import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import { WorkQueue } from '@/components/dash/management';

// management_work is not live yet (handoff D1): the list shows "Not connected yet", never sample rows.
export default async function Page() {
  const { db, user, mfaNeeded } = await requireManagement('ceo','/ceo/reviews');
  if (mfaNeeded) return null;
  const { L, lang } = await getT();
  const work = await loadWork(db,'ceo',user.id,'reviews');
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('CEO', 'मुख्य कार्यकारी')}</p><h1>{L('Approve requests', 'अनुरोध मंज़ूर करें')}</h1><p className="muted">{L('Partner onboarding, website changes and app releases sent by the Co-founder.', 'सह-संस्थापक के भेजे पार्टनर, वेबसाइट बदलाव और ऐप रिलीज़।')}</p></div></div>
      <WorkQueue lang={lang} title={L('Waiting for you', 'आपका इंतज़ार')} items={work.data || []} connected={!work.error} decide={decide} />
    </>
  );
}
