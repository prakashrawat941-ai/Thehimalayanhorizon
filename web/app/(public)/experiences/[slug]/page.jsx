import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { getItineraries, getLocations, getThemes } from '@/lib/data';
import { Empty, Grid, ItineraryCard, PlaceCard, Section } from '@/components/Blocks';
export async function generateMetadata({ params }) {
    const { slug } = await params;
    const th = (await getThemes()).find((x) => x.slug === slug);
    if (!th)
        return {};
    const { pick } = await getT();
    return { title: pick(th, 'name'), description: pick(th, 'summary'), alternates: { canonical: `/experiences/${slug}` } };
}
export default async function Experience({ params }) {
    const { slug } = await params;
    const tr = await getT();
    const { t, pick } = tr;
    const [themes, locs, its] = await Promise.all([getThemes(), getLocations(), getItineraries()]);
    const th = themes.find((x) => x.slug === slug);
    if (!th)
        notFound();
    const places = locs.filter((l) => (l.theme_slugs || []).includes(slug) && l.kind !== 'transport_hub');
    const plans = its.filter((it) => (it.theme_slugs || []).includes(slug));
    return (<div className="page">
      <p className="small"><Link href="/experiences">← {t('experiences')}</Link></p>
      <div className="page-head">
        <p className="eyebrow" style={{ fontSize: '1.6rem' }} aria-hidden="true">{th.icon}</p>
        <h1>{pick(th, 'name')}</h1>
        <p className="lead">{pick(th, 'summary')}</p>
      </div>
      <Section title={t('destinations')}>{places.length ? <Grid>{places.map((l) => <PlaceCard key={l.id} l={l} tr={tr}/>)}</Grid> : <Empty text={t('coming_soon')}/>}</Section>
      {plans.length ? <Section title={t('itineraries')}><Grid>{plans.map((it) => <ItineraryCard key={it.id} it={it} tr={tr}/>)}</Grid></Section> : null}
    </div>);
}
