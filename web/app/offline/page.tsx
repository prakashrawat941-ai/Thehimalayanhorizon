import { getT } from '@/lib/i18n/server';
import { Empty } from '@/components/Blocks';

export const metadata = { robots: { index: false } };

export default async function Offline() {
  const { t } = await getT();
  return <div className="page narrow"><h1>{t('offline_title')}</h1><Empty icon="globe" text={t('offline_text')} /></div>;
}
