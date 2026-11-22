import Link from 'next/link';
import type { ReactNode } from 'react';
import { Cover } from './Cover';
import { Icon } from './Icon';
import type { T } from '@/lib/i18n/core';
import { KINDS, type ListingKind, type Row } from '@/lib/data';
import { inr, listingSlug } from '@/lib/format';

export function Card({ href, image, seed, title, subtitle, meta, tag }: {
  href: string; image?: string | null; seed: string; title: string; subtitle?: string; meta?: string; tag?: string | null;
}) {
  return (
    <Link className="card" href={href}>
      <div className="card-media"><Cover url={image} seed={seed} />{tag ? <span className="card-tag">{tag}</span> : null}</div>
      <div className="card-body">
        <h3 className="card-title">{title}</h3>
        {subtitle ? <p className="card-sub">{subtitle}</p> : null}
        {meta ? <div className="card-meta">{meta}</div> : null}
      </div>
    </Link>
  );
}

export function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <div><h2>{title}</h2>{subtitle ? <p className="muted">{subtitle}</p> : null}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ text, action, icon = 'layers' }: { text: string; action?: ReactNode; icon?: string }) {
  return <div className="empty"><span className="empty-ico"><Icon name={icon} size={26} /></span><p>{text}</p>{action}</div>;
}

export function Chips({ items }: { items: (string | null | undefined | false)[] }) {
  const list = items.filter(Boolean) as string[];
  if (!list.length) return null;
  return <div className="chips">{list.map((x) => <span className="chip" key={x}>{x}</span>)}</div>;
}

export function Grid({ children, cls = 'grid grid-3' }: { children: ReactNode; cls?: string }) {
  return <div className={cls}>{children}</div>;
}

export const regionLabel = (tr: T, r: string) => ({ Garhwal: tr.t('garhwal'), Kumaon: tr.t('kumaon'), Both: tr.t('both') } as Record<string, string>)[r] || r;

export function PlaceCard({ l, tr }: { l: Row; tr: T }) {
  return (
    <Card href={`/destinations/${l.slug}`} image={l.image_url} seed={l.slug} title={tr.pick(l, 'name')}
      subtitle={tr.pick(l, 'summary')} meta={[regionLabel(tr, l.region), tr.district(l.district)].filter(Boolean).join(' · ')}
      tag={l.kind === 'village' ? tr.t('villages') : null} />
  );
}

export function ItineraryCard({ it, tr }: { it: Row; tr: T }) {
  return (
    <Card href={`/itineraries/${it.slug}`} image={it.image_url} seed={it.slug} title={tr.pick(it, 'title')}
      subtitle={tr.pick(it, 'summary')}
      meta={`${it.days_count} ${tr.t('days')} · ${regionLabel(tr, it.region)}${it.budget_min ? ` · ${inr(it.budget_min)}+ (${tr.t('approx')})` : ''}`} />
  );
}

export function listingPrice(kind: ListingKind, x: Row, tr: T) {
  const k = KINDS[kind];
  const v = x[k.priceField];
  return v ? `${inr(v)} ${tr.t(k.unit)}` : '';
}

export function ListingCard({ kind, x, tr, locName }: { kind: ListingKind; x: Row; tr: T; locName?: string }) {
  const k = KINDS[kind];
  return (
    <Card href={`${k.route}/${listingSlug(x[k.nameField], x.id)}`} image={x.images?.[0]} seed={x.id}
      title={x[k.nameField]} subtitle={x.summary}
      meta={[x.village || locName || x.district, listingPrice(kind, x, tr)].filter(Boolean).join(' · ')} />
  );
}

export function PageHead({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string }) {
  return (
    <div className="page-head">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {lead ? <p className="lead">{lead}</p> : null}
    </div>
  );
}

export function ComingSoon({ tr, title }: { tr: T; title?: string }) {
  return <Empty icon="doc" text={`${title ? title + ' — ' : ''}${tr.t('coming_soon')}. ${tr.t('coming_soon_text')}`} />;
}
