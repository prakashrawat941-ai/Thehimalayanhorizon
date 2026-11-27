import { loadWork } from '@/lib/dash/management-live';
import { decide } from '@/app/management/dashboard-actions';
import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import { WorkQueue } from '@/components/dash/management';

// management_work is not live yet (handoff D1): the list shows "Not connected yet", never sample rows.
export default async function Page() {
  const { db, user, mfaNeeded } = await requireManagement('founder','/founder/approvals');
  if (mfaNeeded) return null;
  const { L, lang } = await getT();
  const work = await loadWork(db,'founder',user.id,'founder');
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Founder', 'संस्थापक')}</p><h1>{L('My approvals', 'मेरी मंज़ूरियाँ')}</h1><p className="muted">{L('Critical changes, finance requests and expense claims. A decision note is required.', 'महत्वपूर्ण बदलाव, वित्तीय अनुरोध और खर्च दावे। फ़ैसले का नोट ज़रूरी है।')}</p></div></div>
      <WorkQueue lang={lang} title={L('Waiting for you', 'आपका इंतज़ार')} items={work.data || []} connected={!work.error} decide={decide} />
    </>
  );
}
