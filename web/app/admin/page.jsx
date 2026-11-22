import { getT } from '@/lib/i18n/server';
import { Moving } from '@/components/Moving';
export async function generateMetadata() { const { t } = await getT(); return { title: t('admin') }; }
export default async function Page() {
    const { t } = await getT();
    return <Moving title={t('admin')} legacyPath="admin" part="Part 6"/>;
}
