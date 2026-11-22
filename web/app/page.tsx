import Link from 'next/link';
import type { ReactNode } from 'react';
import { getT } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { getHomeSections, getItineraries, getListings, getLocations, getThemes, type Row } from '@/lib/data';
import type { T } from '@/lib/i18n/core';
import { Icon } from '@/components/Icon';
import { Cover } from '@/components/Cover';
import { imgUrl } from '@/lib/img';
import { Grid, ItineraryCard, ListingCard, PlaceCard } from '@/components/Blocks';
import { PlaceSearch } from '@/components/PlaceSearch';
import { searchLabels } from '@/lib/searchLabels';

// Old database links used "#/x"; the new site uses real paths.
const LEGACY_PATHS: Record<string, string> = { stays: '/homestays', tours: '/village-tours', explore: '/destinations', 'partner/join': '/partner/join' };
function href(url: string | null | undefined, fallback: string) {
  if (!url) return fallback;
  if (url.startsWith('#/')) { const p = url.slice(2); return LEGACY_PATHS[p] ?? '/' + p; }
  return url;
}

const Arrow = () => <span className="arrow-c"><Icon name="arrow" size={14} /></span>;

function Head({ eyebrow, title, note, link, label }: { eyebrow?: string | null; title: string; note?: string; link?: string; label?: string }) {
  return (
    <div className="hs-head">
      <div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h2>{title}</h2></div>
      {note || link ? (
        <div className="hs-head-side">
          {note ? <p className="muted">{note}</p> : null}
          {link ? <Link className="link-more" href={link}>{label}<Icon name="arrow" size={14} /></Link> : null}
        </div>
      ) : null}
    </div>
  );
}

function Feature({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return <div className="feature"><span className="ring"><Icon name={icon} size={24} /></span><span><strong>{title}</strong><span className="muted">{sub}</span></span></div>;
}

function PhotoCard({ link, img, seed, title, sub, tag }: { link: string; img?: string | null; seed: string; title: string; sub?: string; tag?: string | null }) {
  return (
    <Link className="pcard" href={link}>
      <span className="pcard-media"><Cover url={img} seed={seed} className="" />{tag ? <span className="pcard-tag">{tag}</span> : null}</span>
      <span className="pcard-body"><span className="pcard-text"><span className="pcard-title">{title}</span>{sub ? <span className="pcard-sub">{sub}</span> : null}</span><Arrow /></span>
    </Link>
  );
}

export default async function Home() {
  const tr = await getT();
  const { t, pick, L } = tr;
  const [sections, session] = await Promise.all([getHomeSections(), getSession()]);
  const signedIn = !!session.user;

  const sTitle = (s: Row) => pick(s, 'title');
  const sSub = (s: Row) => pick(s, 'subtitle');
  const cta = (s: Row, fb?: string) => pick(s, 'cta_label') || fb || t('explore');

  const blocks: Record<string, (s: Row) => Promise<ReactNode> | ReactNode> = {
    hero: (s) => (
      <section className="hx" key={s.id}>
        <div className="hx-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hx-img" src={imgUrl(s.image_url) || '/img/home/hero.jpg'} alt="" fetchPriority="high" />
          <p className="hx-script" aria-hidden="true">{t('hero_script').split('\n').map((l, i) => <span key={i}>{i ? <br /> : null}{l}</span>)}</p>
        </div>
        <div className="wrap hx-inner">
          <div className="hx-text">
            <p className="eyebrow">{t('tagline')}</p>
            <h1>{sTitle(s)}</h1>
            {sSub(s) ? <p className="hx-sub">{sSub(s)}</p> : null}
            <div className="hx-actions">
              <Link className="btn btn-lg" href="/villages">{t('nav_villages')}<Icon name="arrow" size={16} /></Link>
              <Link className="btn btn-lg btn-ghost hx-ghost" href={href(s.cta_url, '/plan')}>{cta(s, t('plan'))}</Link>
            </div>
            <div className="hero-search"><PlaceSearch lang={tr.lang} labels={searchLabels(tr)} /></div>
          </div>
        </div>
      </section>
    ),
    themes: async (s) => {
      const list = await getThemes();
      return (
        <section className="wrap hs" key={s.id}>
          <Head title={sTitle(s)} note={sSub(s)} link="/experiences" label={t('view_all')} />
          <div className="theme-row">
            {list.map((th) => <Link key={th.id} className="theme-pill" href={`/experiences/${th.slug}`}><span className="theme-icon">{th.icon}</span><span>{pick(th, 'name')}</span></Link>)}
          </div>
        </section>
      );
    },
    destinations: async (s) => {
      const [list, themes] = await Promise.all([getLocations(), getThemes()]);
      const LOCAL = new Set(['almora', 'jageshwar', 'binsar', 'munsiyari']);
      const hasPhoto = (l: Row) => (l.image_url || LOCAL.has(l.slug) ? 1 : 0);
      const shown = list.filter((l) => l.kind === 'destination').sort((a, b) => hasPhoto(b) - hasPhoto(a) || Number(b.is_featured) - Number(a.is_featured)).slice(0, 4);
      const themeName = (l: Row) => { const th = themes.find((x) => x.slug === l.theme_slugs?.[0]); return th ? pick(th, 'name') : null; };
      return (
        <section className="wrap hs" key={s.id}>
          <Head eyebrow={t('places_eyebrow')} title={sTitle(s)} note={t('places_note')} link="/destinations" label={t('view_all')} />
          <div className="pgrid pgrid-4">
            {shown.map((l) => <PhotoCard key={l.id} link={`/destinations/${l.slug}`} img={l.image_url} seed={l.slug} title={pick(l, 'name')} sub={pick(l, 'summary')} tag={themeName(l)} />)}
          </div>
        </section>
      );
    },
    villages: async (s) => {
      const vs = (await getLocations()).filter((l) => l.kind === 'village').slice(0, 6);
      return (
        <section className="stay-band" key={s.id}>
          <div className="wrap stay-inner">
            <div className="stay-text">
              <p className="eyebrow">{sTitle(s)}</p>
              <h2>{t('stay_h1')}<br /><em>{t('stay_h2')}</em></h2>
              <p className="lead">{sSub(s) || t('stay_text')}</p>
              <Link className="btn" href="/villages">{cta(s, t('nav_villages'))}<Icon name="arrow" size={16} /></Link>
            </div>
            <div className="feature-grid">
              <Feature icon="house" title={t('f_homestay')} sub={t('f_homestay_sub')} />
              <Feature icon="wifi" title={t('f_internet')} sub={t('f_internet_sub')} />
              <Feature icon="leaf" title={t('f_food')} sub={t('f_food_sub')} />
              <Feature icon="people" title={t('f_meaning')} sub={t('f_meaning_sub')} />
            </div>
          </div>
          {vs.length ? <div className="wrap"><div className="hscroll">{vs.map((l) => <PlaceCard key={l.id} l={l} tr={tr} />)}</div></div> : null}
        </section>
      );
    },
    itineraries: async (s) => {
      const list = (await getItineraries()).slice(0, 6);
      return (
        <section className="wrap hs" key={s.id}>
          <Head title={sTitle(s)} note={sSub(s)} link="/itineraries" label={cta(s)} />
          {list.length ? <Grid>{list.map((it) => <ItineraryCard key={it.id} it={it} tr={tr} />)}</Grid> : <div className="soft-note">{t('coming_soon')}</div>}
        </section>
      );
    },
    stays: (s) => listingBlock(s, 'homestay', '/homestays'),
    workspaces: async (s) => {
      const list = await getListings('workspace', { limit: 3 });
      return (
        <section className="wrap hs" key={s.id}>
          <div className="split">
            <div className="split-text">
              <p className="eyebrow">{t('work_eyebrow')}</p>
              <h2>{sTitle(s) || t('work_h')}</h2>
              <p className="lead">{sSub(s) || t('work_text')}</p>
              <div className="mini-features">
                <div><Icon name="wifi" size={28} /><span><strong>{t('w_wifi')}</strong><span className="muted">{t('w_wifi_sub')}</span></span></div>
                <div><Icon name="desk" size={28} /><span><strong>{t('w_desk')}</strong><span className="muted">{t('w_desk_sub')}</span></span></div>
                <div><Icon name="leaf" size={28} /><span><strong>{t('w_calm')}</strong><span className="muted">{t('w_calm_sub')}</span></span></div>
              </div>
              <Link className="btn btn-ghost" href="/workspaces">{cta(s, t('workspaces'))}<Icon name="arrow" size={16} /></Link>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="split-media"><img src="/img/home/work.jpg" alt="" loading="lazy" /></div>
          </div>
          {list.length ? <div className="mt"><Grid>{list.map((x) => <ListingCard key={x.id} kind="workspace" x={x} tr={tr} />)}</Grid></div> : null}
        </section>
      );
    },
    cabs: (s) => (
      <section className="wrap hs" key={s.id}>
        <div className="cab-band">
          <div>
            <p className="eyebrow">{t('nav_cab')}</p><h2>{sTitle(s)}</h2><p>{sSub(s)}</p>
            <ol className="steps">
              <li>{L('Drivers publish a ride with route, vehicle and seats', 'ड्राइवर अपने रूट, गाड़ी और सीटों के साथ राइड डालते हैं')}</li>
              <li>{L('You pick your route and date', 'आप अपना रूट और तारीख़ चुनते हैं')}</li>
              <li>{L('Book seats; the fare is paid to the driver directly', 'सीट बुक करें; किराया सीधे ड्राइवर को दें')}</li>
            </ol>
          </div>
          <Link className="btn btn-lg btn-light" href="/cab">{cta(s, t('cabs'))}<Icon name="arrow" size={16} /></Link>
        </div>
      </section>
    ),
    partner_cta: (s) => (
      <section className="wrap hs" key={s.id}>
        <div className="partner-cta">
          <div><h2>{sTitle(s)}</h2><p className="muted">{sSub(s)}</p></div>
          <Link className="btn btn-lg" href="/partner/join">{cta(s, t('become_partner'))}</Link>
        </div>
      </section>
    ),
    text: (s) => (
      <section className="wrap hs" key={s.id}>
        <Head title={sTitle(s)} />
        <p className="prose">{sSub(s)}</p>
        {s.cta_url ? <Link className="link-more" href={href(s.cta_url, '/')}>{cta(s)}<Icon name="arrow" size={14} /></Link> : null}
      </section>
    ),
  };

  async function listingBlock(s: Row, kind: 'homestay', route: string) {
    const list = await getListings(kind, { limit: 6 });
    return (
      <section className="wrap hs" key={s.id}>
        <Head title={sTitle(s)} note={sSub(s)} link={route} label={cta(s)} />
        {list.length ? <Grid>{list.map((x) => <ListingCard key={x.id} kind={kind} x={x} tr={tr} />)}</Grid>
          : <div className="soft-note">{t('no_listings')} <Link href="/partner/join">{t('become_partner')}</Link></div>}
      </section>
    );
  }

  const rendered = await Promise.all(sections.map(async (s) => (blocks[s.kind] ? blocks[s.kind](s) : null)));
  const hasHero = sections.some((s) => s.kind === 'hero');

  return (
    <div className="home">
      {!hasHero ? blocks.hero({ id: 'fallback-hero', title: 'The Himalayan Horizon', title_hi: 'द हिमालयन होराइज़न' }) as ReactNode : null}
      {rendered.slice(0, 1)}
      <QuickActions tr={tr} />
      {rendered.slice(1)}
      <Culture tr={tr} />
      <WhyUs tr={tr} />
      <Seasons tr={tr} />
      <section className="wrap hs">
        <div className="closing">
          <div><p className="eyebrow">{t('cta_eyebrow')}</p><h2>{t('cta_h')}</h2><p>{t('cta_text')}</p></div>
          <Link className="btn btn-lg btn-light" href={signedIn ? '/plan' : '/login?next=/plan'}>{t('plan_your_trip')}<Icon name="arrow" size={16} /></Link>
        </div>
      </section>
    </div>
  );
}

function QuickActions({ tr }: { tr: T }) {
  const { t } = tr;
  const item = (link: string, img: string, ic: string, title: string, sub: string) => (
    <Link className="qa" href={link} key={link}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <span className="qa-img"><img src={img} alt="" loading="lazy" /></span>
      <span className="qa-body"><span className="qa-title"><Icon name={ic} size={19} />{title}</span><span className="qa-sub">{sub}</span></span>
      <Arrow />
    </Link>
  );
  return (
    <section className="wrap qa-row">
      {item('/cab', '/img/home/q-cab.jpg', 'car', t('nav_cab'), t('q_cab_sub'))}
      {item('/plan', '/img/home/q-plan.jpg', 'map', t('nav_planner'), t('q_plan_sub'))}
      {item('/villages', '/img/home/q-village.jpg', 'mountain', t('nav_villages'), t('q_village_sub'))}
    </section>
  );
}

function Culture({ tr }: { tr: T }) {
  const { t } = tr;
  return (
    <section className="wrap hs">
      <div className="split split-culture">
        <div className="split-text">
          <p className="eyebrow">{t('culture_eyebrow')}</p><h2>{t('culture_h')}</h2><p className="lead">{t('culture_text')}</p>
          <Link className="btn btn-ghost" href="/village-tours">{t('culture_btn')}<Icon name="arrow" size={16} /></Link>
        </div>
        <div className="pgrid pgrid-3">
          <PhotoCard link="/village-tours" img="/img/home/c-food.jpg" seed="food" title={t('c_food')} sub={t('c_food_sub')} />
          <PhotoCard link="/village-tours" img="/img/home/c-walk.jpg" seed="walk" title={t('c_walk')} sub={t('c_walk_sub')} />
          <PhotoCard link="/village-tours" img="/img/home/c-craft.jpg" seed="craft" title={t('c_craft')} sub={t('c_craft_sub')} />
        </div>
      </div>
    </section>
  );
}

function WhyUs({ tr }: { tr: T }) {
  const { t } = tr;
  const item = (ic: string, title: string, sub: string) => (
    <div className="why-item" key={ic}><span className="ring"><Icon name={ic} size={24} /></span><strong>{title}</strong><span className="muted">{sub}</span></div>
  );
  return (
    <section className="why-band">
      <div className="wrap why-inner">
        <div><p className="eyebrow">{t('why_eyebrow')}</p><h2>{t('why_h1')}<br /><span className="green">{t('why_h2')}</span></h2><p className="muted">{t('why_text')}</p></div>
        <div className="why-grid">
          {item('mountain', t('y_trust'), t('y_trust_sub'))}{item('leaf', t('y_resp'), t('y_resp_sub'))}
          {item('people', t('y_cur'), t('y_cur_sub'))}{item('shield', t('y_safe'), t('y_safe_sub'))}
        </div>
      </div>
    </section>
  );
}

function Seasons({ tr }: { tr: T }) {
  const { t } = tr;
  const s = (key: string, img: string) => (
    <Link className="season" href="/destinations" key={key}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/img/home/${img}.jpg`} alt="" loading="lazy" />
      <span className="season-label"><strong>{t(key)}</strong><span>{t(`${key}_sub`)}</span></span>
    </Link>
  );
  return (
    <section className="wrap hs seasons">
      <p className="eyebrow">{t('seasons_eyebrow')}</p>
      <div className="season-row">
        {s('s_spring', 's-spring')}{s('s_summer', 's-summer')}{s('s_monsoon', 's-monsoon')}{s('s_autumn', 's-autumn')}{s('s_winter', 's-winter')}
      </div>
    </section>
  );
}
