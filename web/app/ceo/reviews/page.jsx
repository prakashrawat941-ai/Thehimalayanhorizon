import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { WorkQueue } from '@/components/dash/management';

// management_work is not live yet (handoff D1): the list shows "Not connected yet", never sample rows.
export default async function Page() {
  await requireAdmin('/ceo/reviews');
  const { L, lang } = await getT();
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('CEO', 'मुख्य कार्यकारी')}</p><h1>{L('Approve requests', 'अनुरोध मंज़ूर करें')}</h1><p className="muted">{L('Partner onboarding, website changes and app releases sent by the Co-founder.', 'सह-संस्थापक के भेजे पार्टनर, वेबसाइट बदलाव और ऐप रिलीज़।')}</p></div></div>
      <WorkQueue lang={lang} title={L('Waiting for you', 'आपका इंतज़ार')} items={[]} connected={false} />
    </>
  );
}
