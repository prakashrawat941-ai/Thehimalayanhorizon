import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { APP_VERSION } from '@/lib/config';
import { Kpi, KpiRow } from '@/components/dash/parts';
import { WorkQueue } from '@/components/dash/management';

export default async function CoFounderReleases() {
  await requireAdmin('/co-founder/releases');
  const { L, lang } = await getT();
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Co-founder', 'सह-संस्थापक')}</p><h1>{L('App releases', 'ऐप रिलीज़')}</h1>
        <p className="muted">{L('Request a new app release. The CEO approves.', 'नई ऐप रिलीज़ का अनुरोध करें। CEO मंज़ूरी देते हैं।')}</p></div></div>
      <KpiRow><Kpi label={L('Live app version', 'लाइव ऐप संस्करण')} value={APP_VERSION} /></KpiRow>
      <WorkQueue lang={lang} title={L('Release requests', 'रिलीज़ अनुरोध')} items={[]} connected={false} />
    </>
  );
}
