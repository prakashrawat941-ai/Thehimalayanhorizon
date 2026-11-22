import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { getItinerary, getLocations, type Row } from '@/lib/data';
import { inr } from '@/lib/format';
import { Cover } from '@/components/Cover';
import { imgUrl } from '@/lib/img';
import { regionLabel } from '@/components/Blocks';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const it = await getItinerary(slug);
  if (!it) return {};
  const { pick } = await getT();
  const image = imgUrl(it.image_url);
  return { title: pick(it, 'title'), description: pick(it, 'summary').slice(0, 160), alternates: { canonical: `/itineraries/${slug}` }, openGraph: image ? { images: [image] } : undefined };
}

export default async function Itinerary({ params }: { params: Params }) {
  const { slug } = await params;
  const it = await getItinerary(slug);
  if (!it) notFound();
  const tr = await getT();
  const { t, L, pick, lang } = tr;
  const locs = await getLocations();
  const days: Row[] = Array.isArray(it.days) ? it.days : [];
  const diff: Record<string, string> = { easy: L('Easy', 'आसान'), moderate: L('Moderate', 'मध्यम'), challenging: L('Challenging', 'कठिन') };
  return (
    <div className="page">
      <p className="small"><Link href="/itineraries">← {t('itineraries')}</Link></p>
      <div className="detail-hero">
        <Cover url={it.image_url} seed={it.slug} className="detail-img" eager />
        <div className="detail-hero-text"><p className="eyebrow">{it.days_count} {t('days')} · {regionLabel(tr, it.region)}</p><h1>{pick(it, 'title')}</h1></div>
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <p className="lead">{pick(it, 'summary')}</p>
          <ol className="timeline">
            {days.map((d, i) => {
              const loc = locs.find((l) => l.slug === d.location);
              return (
                <li key={i}>
                  <div className="timeline-day">{t('day')} {d.day ?? i + 1}</div>
                  <div>
                    <h3>{(lang === 'hi' && d.title_hi) || d.title}</h3>
                    <p>{(lang === 'hi' && d.plan_hi) || d.plan}</p>
                    {loc ? <Link className="chip chip-link" href={`/destinations/${loc.slug}`}>📍 {pick(loc, 'name')}</Link> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <aside className="detail-side">
          <div className="panel sticky">
            {it.budget_min ? <div className="kv"><span>{t('budget')}</span><strong>{inr(it.budget_min)} – {inr(it.budget_max)}</strong><small className="muted">{t('approx')}</small></div> : null}
            {it.best_season ? <div className="kv"><span>{t('best_season')}</span><strong>{it.best_season}</strong></div> : null}
            <div className="kv"><span>{t('difficulty')}</span><strong>{diff[it.difficulty] || it.difficulty}</strong></div>
            <Link className="btn btn-block" href={`/plan?from=${it.slug}`}>{t('use_this_plan')}</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
