import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { getItineraries, getListings, getLocation, getLocations, getReviews, getThemes } from '@/lib/data';
import { getWeather, weatherLabel } from '@/lib/weather';
import { fmtDate, km } from '@/lib/format';
import { Chips, Grid, ItineraryCard, ListingCard, PlaceCard, Section, regionLabel } from '@/components/Blocks';
import { Cover } from '@/components/Cover';
import { imgUrl } from '@/lib/img';
import { Icon } from '@/components/Icon';
export async function generateMetadata({ params }) {
    const { slug } = await params;
    const l = await getLocation(slug);
    if (!l)
        return {};
    const { pick } = await getT();
    const image = imgUrl(l.image_url);
    return {
        title: pick(l, 'name'), description: pick(l, 'summary').slice(0, 160), alternates: { canonical: `/destinations/${slug}` },
        openGraph: image ? { images: [image] } : undefined,
    };
}
export default async function Destination({ params }) {
    const { slug } = await params;
    const l = await getLocation(slug);
    if (!l)
        notFound();
    const tr = await getT();
    const { t, L, pick, district, lang } = tr;
    const hasGeo = typeof l.lat === 'number' && typeof l.lng === 'number';
    const [themes, all, stays, works, tours, its, reviews, weather] = await Promise.all([
        getThemes(), getLocations(), getListings('homestay', { locationId: l.id }), getListings('workspace', { locationId: l.id }),
        getListings('village_tour', { locationId: l.id }), getItineraries(), getReviews(l.id),
        hasGeo ? getWeather(l.lat, l.lng) : Promise.resolve(null),
    ]);
    const related = its.filter((it) => (Array.isArray(it.days) ? it.days : []).some((d) => d.location === l.slug));
    const nearby = hasGeo
        ? all.filter((x) => x.id !== l.id && x.kind !== 'transport_hub' && typeof x.lat === 'number')
            .map((x) => ({ x, d: km(l, x) })).filter((o) => o.d <= 80).sort((a, b) => a.d - b.d).slice(0, 4)
        : [];
    const gallery = (l.gallery || []).filter(Boolean);
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    const bbox = hasGeo ? `${l.lng - 0.06},${l.lat - 0.04},${l.lng + 0.06},${l.lat + 0.04}` : '';
    const jsonLd = {
        '@context': 'https://schema.org', '@type': 'TouristDestination', name: l.name, description: l.summary,
        ...(hasGeo ? { geo: { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng } } : {}),
        ...(imgUrl(l.image_url) ? { image: imgUrl(l.image_url) } : {}),
    };
    return (<div className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/>
      <p className="small"><Link href="/destinations">← {t('all_destinations')}</Link></p>
      <div className="detail-hero">
        <Cover url={l.image_url} seed={l.slug} className="detail-img" eager/>
        <div className="detail-hero-text">
          <p className="eyebrow">{[regionLabel(tr, l.region), district(l.district)].filter(Boolean).join(' · ')}</p>
          <h1>{pick(l, 'name')}</h1>
        </div>
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <p className="lead">{pick(l, 'summary')}</p>
          {l.description ? <div className="prose">{String(l.description).split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div> : null}
          <Chips items={(l.theme_slugs || []).map((s) => { const th = themes.find((x) => x.slug === s); return th ? `${th.icon} ${pick(th, 'name')}` : null; })}/>
          {gallery.length ? <div className="gallery">{gallery.map((g, i) => <Cover key={i} url={g} seed={`${l.slug}-${i}`} className="gallery-img"/>)}</div> : null}

          {tours.length ? <Section title={L('Village experiences', 'गाँव के अनुभव')}><Grid cls="grid">{tours.map((x) => <ListingCard key={x.id} kind="village_tour" x={x} tr={tr}/>)}</Grid></Section> : null}
          <Section title={t('stays_nearby')}>
            {stays.length ? <Grid cls="grid">{stays.map((x) => <ListingCard key={x.id} kind="homestay" x={x} tr={tr}/>)}</Grid>
            : <div className="soft-note">{t('no_listings')} <Link href="/partner/join">{t('become_partner')}</Link></div>}
          </Section>
          {works.length ? <Section title={t('workspaces')}><Grid cls="grid">{works.map((x) => <ListingCard key={x.id} kind="workspace" x={x} tr={tr}/>)}</Grid></Section> : null}
          {related.length ? <Section title={t('itineraries')}><Grid cls="grid">{related.map((it) => <ItineraryCard key={it.id} it={it} tr={tr}/>)}</Grid></Section> : null}
          {nearby.length ? (<Section title={t('nearby')} subtitle={L('Straight-line distance, approximate. Road distance is longer.', 'सीधी दूरी, लगभग। सड़क से दूरी ज़्यादा होगी।')}>
              <Grid cls="grid">{nearby.map(({ x, d }) => <div key={x.id}><PlaceCard l={x} tr={tr}/><p className="small muted">~{Math.round(d)} km</p></div>)}</Grid>
            </Section>) : null}
          <Section title={t('reviews')} subtitle={reviews.length ? `${avg.toFixed(1)} / 5 · ${reviews.length}` : undefined}>
            {reviews.length ? reviews.map((r) => (<div className="review" key={r.id}>
                <span className="stars" aria-label={`${r.rating} / 5`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className="small muted"> · {fmtDate(r.created_at, lang)}</span>
                {r.body ? <p>{r.body}</p> : null}
              </div>)) : <p className="muted">{t('no_reviews')}</p>}
          </Section>
        </div>
        <aside className="detail-side">
          <div className="panel sticky">
            {weather ? (() => {
            const w = weatherLabel(weather.code, lang);
            return (<div className="kv"><span>{t('weather')}</span>
                <div className="weather"><span style={{ fontSize: '2rem' }} aria-hidden="true">{w.icon}</span><span className="weather-t">{weather.temp}°C</span><span>{w.text}</span></div>
                <small className="muted">{t('weather_note')}</small>
              </div>);
        })() : null}
            {weather?.elevation != null ? <div className="kv"><span>{t('altitude')}</span><strong>~{weather.elevation.toLocaleString('en-IN')} m ({t('approx')})</strong></div> : null}
            {l.best_season ? <div className="kv"><span>{t('best_season')}</span><strong>{l.best_season}</strong></div> : null}
            {l.district ? <div className="kv"><span>{t('district')}</span><strong>{district(l.district)}</strong></div> : null}
            {l.how_to_reach ? <div className="kv"><span>{t('how_to_reach')}</span><p>{l.how_to_reach}</p></div> : null}
            <Link className="btn btn-block" href={`/plan?place=${l.slug}`}>{t('plan')}</Link>
            {l.is_cab_point ? <Link className="btn btn-ghost btn-block" href="/cab">{t('cabs')}</Link> : null}
          </div>
          {hasGeo ? (<div className="panel mt">
              <div className="kv"><span>{t('map')}</span></div>
              <iframe className="map-frame" title={`${t('map')}: ${l.name}`} loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${l.lat},${l.lng}`}/>
              <a className="small" href={`https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lng}#map=12/${l.lat}/${l.lng}`} target="_blank" rel="noopener noreferrer">
                <Icon name="map" size={14}/> {t('open_map')}</a>
            </div>) : null}
        </aside>
      </div>
    </div>);
}
