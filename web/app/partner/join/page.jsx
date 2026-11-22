import { getT } from '@/lib/i18n/server';
import { Moving } from '@/components/Moving';
export async function generateMetadata() { const { t } = await getT(); return { title: t('become_partner') }; }
export default async function Page() {
    const { t } = await getT();
    return <Moving title={t('become_partner')} legacyPath="partner/join" part="Part 5"/>;
}
