import { getT } from '@/lib/i18n/server';
import { ComingSoon, PageHead } from '@/components/Blocks';
// No gallery table yet. We never show made-up posts or photos; this stays "Coming soon"
// until real content exists.
export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('gallery'), robots: { index: false } };
}
export default async function Page() {
    const tr = await getT();
    return <div className="page narrow"><PageHead title={tr.t('gallery')}/><ComingSoon tr={tr}/></div>;
}
