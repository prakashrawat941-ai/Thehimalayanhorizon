import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { getLocations } from '@/lib/data';
import { PageHead, PlaceCard, Grid } from '@/components/Blocks';
import { PlaceSearch } from '@/components/PlaceSearch';
import { searchLabels } from '@/lib/searchLabels';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('search'), robots: { index: false } };
}

export default async function Search() {
  const tr = await getT();
  const featured = (await getLocations()).filter((l) => l.is_featured && l.kind !== 'transport_hub').slice(0, 6);
  return (
    <div className="page">
      <PageHead title={tr.t('search')} lead={tr.t('search_hint')} />
      <PlaceSearch lang={tr.lang} labels={searchLabels(tr)} autoFocus />
      {featured.length ? (
        <section className="section">
          <div className="section-head"><h2>{tr.L('Popular places', 'लोकप्रिय जगहें')}</h2><Link className="link-more" href="/destinations">{tr.t('view_all')}</Link></div>
          <Grid>{featured.map((l) => <PlaceCard key={l.id} l={l} tr={tr} />)}</Grid>
        </section>
      ) : null}
    </div>
  );
}
