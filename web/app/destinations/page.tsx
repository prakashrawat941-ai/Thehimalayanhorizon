import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { getLocations, getThemes } from '@/lib/data';
import { Empty, Grid, PageHead, PlaceCard } from '@/components/Blocks';
import { FilterPills } from '@/components/Filters';
import { PlaceSearch } from '@/components/PlaceSearch';
import { searchLabels } from '@/lib/searchLabels';

export async function generateMetadata(): Promise<Metadata> {
  const { t, L } = await getT();
  return { title: t('destinations'), description: L('Villages, temple towns, lakes and treks across Garhwal and Kumaon.', 'गढ़वाल और कुमाऊँ के गाँव, मंदिरों वाले कस्बे, झीलें और ट्रेक।'), alternates: { canonical: '/destinations' } };
}

type SP = Promise<Record<string, string | undefined>>;

export default async function Destinations({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tr = await getT();
  const { t, L, pick } = tr;
  const [all, themes] = await Promise.all([getLocations(), getThemes()]);
  const params = { region: sp.region, theme: sp.theme, kind: sp.kind };
  const list = all.filter((l) => l.kind !== 'transport_hub')
    .filter((l) => !sp.region || l.region === sp.region)
    .filter((l) => !sp.theme || (l.theme_slugs || []).includes(sp.theme))
    .filter((l) => !sp.kind || l.kind === sp.kind);
  return (
    <div className="page">
      <PageHead eyebrow={t('places_eyebrow')} title={L('Villages and places to discover', 'गाँव और घूमने की जगहें')}
        lead={L('Find a quiet village, a temple town or a lake. Every place has stays, local experiences and an easy way to plan your trip.',
          'शांत गाँव, मंदिरों वाले कस्बे और झीलें। हर जगह के साथ होमस्टे, गाँव के अनुभव और यात्रा प्लान करने का आसान तरीका।')} />
      <div style={{ margin: '8px 0 18px' }}><PlaceSearch lang={tr.lang} labels={searchLabels(tr)} /></div>
      <FilterPills base="/destinations" params={params} name="region" options={[['', t('all')], ['Garhwal', t('garhwal')], ['Kumaon', t('kumaon')]]} />
      <FilterPills base="/destinations" params={params} name="kind" options={[['', t('all')], ['village', t('villages')], ['destination', t('destinations')], ['town', L('Towns', 'कस्बे')]]} />
      <FilterPills base="/destinations" params={params} name="theme" options={[['', t('all')], ...themes.map((th) => [th.slug, `${th.icon} ${pick(th, 'name')}`] as [string, string])]} />
      <p className="muted small">{list.length} {t('results')}</p>
      {list.length ? <Grid>{list.map((l) => <PlaceCard key={l.id} l={l} tr={tr} />)}</Grid> : <Empty text={t('nothing_here')} />}
    </div>
  );
}
