import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { WorkQueue } from '@/components/dash/management';

// management_work is not live yet (handoff D1): the list shows "Not connected yet", never sample rows.
export default async function Page() {
  await requireAdmin('/founder/approvals');
  const { L, lang } = await getT();
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Founder', 'संस्थापक')}</p><h1>{L('My approvals', 'मेरी मंज़ूरियाँ')}</h1><p className="muted">{L('Critical changes, finance requests and expense claims. A decision note is required.', 'महत्वपूर्ण बदलाव, वित्तीय अनुरोध और खर्च दावे। फ़ैसले का नोट ज़रूरी है।')}</p></div></div>
      <WorkQueue lang={lang} title={L('Waiting for you', 'आपका इंतज़ार')} items={[]} connected={false} />
    </>
  );
}
