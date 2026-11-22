import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { ComingSoon, PageHead } from '@/components/Blocks';

// No blog table yet. We never show made-up posts or photos; this stays "Coming soon"
// until real content exists.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('blog'), robots: { index: false } };
}

export default async function Page() {
  const tr = await getT();
  return <div className="page narrow"><PageHead title={tr.t('blog')} /><ComingSoon tr={tr} /></div>;
}
