import { loadWork } from '@/lib/dash/management-live';
import { decide } from '@/app/management/dashboard-actions';
import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import { WorkQueue } from '@/components/dash/management';

// management_work is not live yet (handoff D1): the list shows "Not connected yet", never sample rows.
export default async function Page() {
  const { db, user, mfaNeeded } = await requireManagement('ceo','/ceo/requests');
  if (mfaNeeded) return null;
  const { L, lang } = await getT();
  const work = await loadWork(db,'ceo',user.id,'requests');
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('CEO', 'मुख्य कार्यकारी')}</p><h1>{L('Sent to Founder', 'संस्थापक को भेजे')}</h1><p className="muted">{L('Finance requests and critical changes you raised.', 'आपके भेजे वित्तीय अनुरोध और महत्वपूर्ण बदलाव।')}</p></div></div>
      <WorkQueue lang={lang} title={L('Your requests', 'आपके अनुरोध')} items={work.data || []} connected={!work.error} decide={decide} />
    </>
  );
}
