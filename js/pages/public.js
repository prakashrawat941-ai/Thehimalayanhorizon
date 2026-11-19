// Public pages: home, explore, place, villages, itineraries.
import { h, card, section, grid, chips, lazy, empty, inr, cover, art, select, icon, localPhotos } from '../ui.js';
import { t, pick, getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
import { locations, themes, locationBySlug, locationById, user } from '../store.js';
import { listingCard, fetchListings } from './listings.js';

const regionLabel = (r) => ({ Garhwal: t('garhwal'), Kumaon: t('kumaon'), Both: t('both') }[r] || r);

export function placeCard(l) {
  return card({
    href: `#/place/${l.slug}`, image: l.image_url, seed: l.slug, title: pick(l, 'name'),
    subtitle: pick(l, 'summary'),
    meta: [regionLabel(l.region), l.district].filter(Boolean).join(' · '),
    tag: l.kind === 'village' ? t('villages') : null,
  });
}

export function itineraryCard(it) {
  return card({
    href: `#/itinerary/${it.slug}`, image: it.image_url, seed: it.slug, title: pick(it, 'title'),
    subtitle: pick(it, 'summary'),
    meta: `${it.days_count} ${t('days')} · ${regionLabel(it.region)}${it.budget_min ? ` · ${inr(it.budget_min)}+` : ''}`,
  });
}

// ---------------- Home ----------------
// Sections come from the admin-controlled home_sections table (order, text, on/off).
// A few fixed design sections (quick actions, culture, why us, seasons, closing banner)
// sit around them.
export async function home() {
  const sections = await q(sb.from('home_sections').select('*').eq('enabled', true).order('position'));
  const page = h('div', { class: 'home' });
  for (const s of sections) {
    const builder = blocks[s.kind];
    if (!builder) continue;
    page.append(builder(s));
    if (s.kind === 'hero') page.append(quickActions());
    if (s.kind === 'villages') page.append(culture());
  }
  if (!sections.length) page.append(blocks.hero({ title: 'The Himalayan Horizon', subtitle: '' }), quickActions());
  page.append(whyUs(), seasons(), closingBand());
  return page;
}

const sTitle = (s) => pick(s, 'title');
const sSub = (s) => pick(s, 'subtitle');
const cta = (s, fallback) => pick(s, 'cta_label') || fallback || t('explore');
const arrowC = () => h('span', { class: 'arrow-c' }, icon('arrow', 14));
const lines = (text) => text.split('\n').flatMap((l, i) => (i ? [h('br'), l] : [l]));

function head(eyebrow, title, note, href, label) {
  return h('div', { class: 'hs-head' },
    h('div', {}, eyebrow ? h('p', { class: 'eyebrow' }, eyebrow) : null, h('h2', {}, title)),
    (note || href) ? h('div', { class: 'hs-head-side' },
      note ? h('p', { class: 'muted' }, note) : null,
      href ? h('a', { class: 'link-more', href }, label || t('view_all'), icon('arrow', 14)) : null) : null);
}

function feature(ic, title, sub) {
  return h('div', { class: 'feature' }, h('span', { class: 'ring' }, icon(ic, 24)),
    h('span', {}, h('strong', {}, title), h('span', { class: 'muted' }, sub)));
}

function photoCard(href, img, title, sub, tag) {
  return h('a', { class: 'pcard', href },
    h('span', { class: 'pcard-media' }, img ? h('img', { src: img, alt: '', loading: 'lazy' }) : null, tag ? h('span', { class: 'pcard-tag' }, tag) : null),
    h('span', { class: 'pcard-body' },
      h('span', { class: 'pcard-text' }, h('span', { class: 'pcard-title' }, title), sub ? h('span', { class: 'pcard-sub' }, sub) : null),
      arrowC()));
}

const blocks = {
  hero(s) {
    const img = s.image_url || 'img/home/hero.jpg';
    return h('section', { class: 'hx' },
      h('div', { class: 'hx-media' },
        h('img', { class: 'hx-img', src: img, alt: '', fetchpriority: 'high' }),
        h('p', { class: 'hx-script', 'aria-hidden': 'true' }, lines(t('hero_script')))),
      h('div', { class: 'wrap hx-inner' },
        h('div', { class: 'hx-text' },
          h('p', { class: 'eyebrow' }, t('hero_eyebrow')),
          h('h1', {}, sTitle(s)),
          sSub(s) ? h('p', { class: 'hx-sub' }, sSub(s)) : null,
          h('div', { class: 'hx-actions' },
            h('a', { class: 'btn btn-lg', href: '#/villages' }, t('nav_villages'), icon('arrow', 16)),
            h('a', { class: 'btn btn-lg btn-ghost hx-ghost', href: s.cta_url || '#/plan' }, cta(s, t('plan')))))));
  },
  themes(s) {
    return h('section', { class: 'wrap hs' }, head(null, sTitle(s), sSub(s)), lazy(async () => {
      const list = await themes();
      return h('div', { class: 'theme-row' }, list.map((th) =>
        h('a', { class: 'theme-pill', href: `#/explore?theme=${th.slug}` }, h('span', { class: 'theme-icon' }, th.icon), h('span', {}, pick(th, 'name')))));
    }));
  },
  destinations(s) {
    return h('section', { class: 'wrap hs' }, head(t('places_eyebrow'), sTitle(s), t('places_note'), s.cta_url || '#/explore'), lazy(async () => {
      const [list, themeList] = await Promise.all([locations(), themes()]);
      const dest = list.filter((l) => l.kind === 'destination');
      const hasPhoto = (l) => !!(l.image_url || localPhotos[l.slug]);
      const shown = [...dest].sort((a, b) => (hasPhoto(b) - hasPhoto(a)) || (b.is_featured - a.is_featured)).slice(0, 4);
      const themeName = (l) => { const th = themeList.find((x) => x.slug === l.theme_slugs?.[0]); return th ? pick(th, 'name') : null; };
      return h('div', { class: 'pgrid pgrid-4' }, shown.map((l) =>
        photoCard(`#/place/${l.slug}`, l.image_url || localPhotos[l.slug], pick(l, 'name'), pick(l, 'summary'), themeName(l))));
    }));
  },
  villages(s) {
    return h('section', { class: 'stay-band' },
      h('div', { class: 'wrap stay-inner' },
        h('div', { class: 'stay-text' },
          h('p', { class: 'eyebrow' }, sTitle(s)),
          h('h2', {}, t('stay_h1'), h('br'), h('em', {}, t('stay_h2'))),
          h('p', { class: 'lead' }, sSub(s) || t('stay_text')),
          h('a', { class: 'btn', href: s.cta_url || '#/villages' }, cta(s, t('nav_villages')), icon('arrow', 16))),
        h('div', { class: 'feature-grid' },
          feature('house', t('f_homestay'), t('f_homestay_sub')), feature('wifi', t('f_internet'), t('f_internet_sub')),
          feature('leaf', t('f_food'), t('f_food_sub')), feature('people', t('f_meaning'), t('f_meaning_sub')))),
      h('div', { class: 'wrap' }, lazy(async () => {
        const vs = (await locations()).filter((l) => l.kind === 'village').slice(0, 6);
        return vs.length ? h('div', { class: 'hscroll' }, vs.map(placeCard)) : null;
      })));
  },
  itineraries(s) {
    return h('section', { class: 'wrap hs' }, head(null, sTitle(s), sSub(s), s.cta_url || '#/itineraries', cta(s)), lazy(async () => {
      const list = await q(sb.from('itineraries').select('*').eq('is_published', true).order('is_featured', { ascending: false }).order('position').limit(6));
      return list.length ? grid(list.map(itineraryCard), 'grid grid-3') : empty();
    }));
  },
  stays(s) { return listingBlock(s, 'homestay'); },
  workspaces(s) {
    return h('section', { class: 'wrap hs' },
      h('div', { class: 'split' },
        h('div', { class: 'split-text' },
          h('p', { class: 'eyebrow' }, t('work_eyebrow')),
          h('h2', {}, sTitle(s) || t('work_h')),
          h('p', { class: 'lead' }, sSub(s) || t('work_text')),
          h('div', { class: 'mini-features' },
            h('div', {}, icon('wifi', 28), h('span', {}, h('strong', {}, t('w_wifi')), h('span', { class: 'muted' }, t('w_wifi_sub')))),
            h('div', {}, icon('desk', 28), h('span', {}, h('strong', {}, t('w_desk')), h('span', { class: 'muted' }, t('w_desk_sub')))),
            h('div', {}, icon('leaf', 28), h('span', {}, h('strong', {}, t('w_calm')), h('span', { class: 'muted' }, t('w_calm_sub'))))),
          h('a', { class: 'btn btn-ghost', href: s.cta_url || '#/workspaces' }, cta(s, t('workspaces')), icon('arrow', 16))),
        h('div', { class: 'split-media' }, h('img', { src: 'img/home/work.jpg', alt: '', loading: 'lazy' }))),
      lazy(async () => {
        const list = await fetchListings('workspace', { limit: 3 });
        return list.length ? h('div', { class: 'mt' }, grid(list.map((x) => listingCard('workspace', x)), 'grid grid-3')) : null;
      }));
  },
  cabs(s) {
    return h('section', { class: 'wrap hs' },
      h('div', { class: 'cab-band' },
        h('div', {}, h('p', { class: 'eyebrow' }, t('nav_cab')), h('h2', {}, sTitle(s)), h('p', {}, sSub(s)),
          h('ol', { class: 'steps' },
            h('li', {}, getLang() === 'hi' ? 'ड्राइवर अपने रूट, गाड़ी और सीटों के साथ राइड डालते हैं' : 'Drivers publish a ride with route, vehicle and seats'),
            h('li', {}, getLang() === 'hi' ? 'आप अपना रूट और तारीख़ चुनते हैं' : 'You pick your route and date'),
            h('li', {}, getLang() === 'hi' ? 'सीट बुक करें, ड्राइवर से सीधे बात करें' : 'Book seats and talk to the driver directly'))),
        h('a', { class: 'btn btn-lg btn-light', href: s.cta_url || '#/cabs' }, cta(s, t('cabs')), icon('arrow', 16))));
  },
  partner_cta(s) {
    return h('section', { class: 'wrap hs' },
      h('div', { class: 'partner-cta' },
        h('div', {}, h('h2', {}, sTitle(s)), h('p', { class: 'muted' }, sSub(s))),
        h('a', { class: 'btn btn-lg', href: s.cta_url || '#/partner/join' }, cta(s, t('become_partner')))));
  },
  text(s) {
    return h('section', { class: 'wrap hs' }, head(null, sTitle(s)), h('p', { class: 'prose' }, sSub(s)),
      s.cta_url ? h('a', { class: 'link-more', href: s.cta_url }, cta(s), icon('arrow', 14)) : null);
  },
};

function listingBlock(s, kind) {
  return h('section', { class: 'wrap hs' }, head(null, sTitle(s), sSub(s), s.cta_url, cta(s)), lazy(async () => {
    const list = await fetchListings(kind, { limit: 6 });
    return list.length ? grid(list.map((x) => listingCard(kind, x)), 'grid grid-3')
      : h('div', { class: 'soft-note' }, getLang() === 'hi'
        ? 'जल्द आ रहा है। होस्ट जुड़ रहे हैं।' : 'Coming soon. Hosts are joining now.',
        ' ', h('a', { href: '#/partner/join' }, t('become_partner')));
  }));
}

function quickActions() {
  const item = (href, img, ic, title, sub) => h('a', { class: 'qa', href },
    h('span', { class: 'qa-img' }, h('img', { src: img, alt: '', loading: 'lazy' })),
    h('span', { class: 'qa-body' }, h('span', { class: 'qa-title' }, icon(ic, 19), title), h('span', { class: 'qa-sub' }, sub)),
    arrowC());
  return h('section', { class: 'wrap qa-row' },
    item('#/cabs', 'img/home/q-cab.jpg', 'car', t('nav_cab'), t('q_cab_sub')),
    item('#/plan', 'img/home/q-plan.jpg', 'map', t('nav_planner'), t('q_plan_sub')),
    item('#/villages', 'img/home/q-village.jpg', 'mountain', t('nav_villages'), t('q_village_sub')));
}

function culture() {
  return h('section', { class: 'wrap hs' },
    h('div', { class: 'split split-culture' },
      h('div', { class: 'split-text' },
        h('p', { class: 'eyebrow' }, t('culture_eyebrow')),
        h('h2', {}, t('culture_h')),
        h('p', { class: 'lead' }, t('culture_text')),
        h('a', { class: 'btn btn-ghost', href: '#/tours' }, t('culture_btn'), icon('arrow', 16))),
      h('div', { class: 'pgrid pgrid-3' },
        photoCard('#/tours', 'img/home/c-food.jpg', t('c_food'), t('c_food_sub')),
        photoCard('#/tours', 'img/home/c-walk.jpg', t('c_walk'), t('c_walk_sub')),
        photoCard('#/tours', 'img/home/c-craft.jpg', t('c_craft'), t('c_craft_sub')))));
}

function whyUs() {
  const item = (ic, title, sub) => h('div', { class: 'why-item' }, h('span', { class: 'ring' }, icon(ic, 24)), h('strong', {}, title), h('span', { class: 'muted' }, sub));
  return h('section', { class: 'why-band' },
    h('div', { class: 'wrap why-inner' },
      h('div', {}, h('p', { class: 'eyebrow' }, t('why_eyebrow')), h('h2', {}, t('why_h1'), h('br'), h('span', { class: 'green' }, t('why_h2'))), h('p', { class: 'muted' }, t('why_text'))),
      h('div', { class: 'why-grid' },
        item('mountain', t('y_trust'), t('y_trust_sub')), item('leaf', t('y_resp'), t('y_resp_sub')),
        item('people', t('y_cur'), t('y_cur_sub')), item('shield', t('y_safe'), t('y_safe_sub')))));
}

function seasons() {
  const s = (key, img) => h('a', { class: 'season', href: '#/explore' },
    h('img', { src: `img/home/${img}.jpg`, alt: '', loading: 'lazy' }),
    h('span', { class: 'season-label' }, h('strong', {}, t(key)), h('span', {}, t(`${key}_sub`))));
  return h('section', { class: 'wrap hs seasons' },
    h('p', { class: 'eyebrow' }, t('seasons_eyebrow')),
    h('div', { class: 'season-row' },
      s('s_spring', 's-spring'), s('s_summer', 's-summer'), s('s_monsoon', 's-monsoon'), s('s_autumn', 's-autumn'), s('s_winter', 's-winter')));
}

function closingBand() {
  return h('section', { class: 'wrap hs' },
    h('div', { class: 'closing' },
      h('div', {}, h('p', { class: 'eyebrow' }, t('cta_eyebrow')), h('h2', {}, t('cta_h')), h('p', {}, t('cta_text'))),
      h('a', { class: 'btn btn-lg btn-light', href: user() ? '#/plan' : '#/login' }, t('plan_your_trip'), icon('arrow', 16))));
}

// ---------------- Explore ----------------
export async function explore({ query }) {
  const [all, themeList] = await Promise.all([locations(), themes()]);
  const region = query.region || '';
  const theme = query.theme || '';
  const kind = query.kind || '';
  const list = all.filter((l) => l.kind !== 'transport_hub' || kind === 'transport_hub')
    .filter((l) => !region || l.region === region)
    .filter((l) => !theme || l.theme_slugs.includes(theme))
    .filter((l) => !kind || l.kind === kind);

  const setQ = (k, v) => {
    const p = new URLSearchParams({ region, theme, kind });
    if (v) p.set(k, v); else p.delete(k);
    [...p.keys()].forEach((key) => { if (!p.get(key)) p.delete(key); });
    location.hash = '#/explore' + (p.toString() ? '?' + p : '');
  };
  const pill = (k, v, label, cur) => h('button', { class: `pill${cur === v ? ' active' : ''}`, onclick: () => setQ(k, v) }, label);

  const hi = getLang() === 'hi';
  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, t('places_eyebrow')),
      h('h1', {}, hi ? 'गाँव और घूमने की जगहें' : 'Villages and places to discover'),
      h('p', { class: 'lead' }, hi ? 'शांत गाँव, मंदिरों वाले कस्बे और झीलें। हर जगह के साथ होमस्टे, गाँव के अनुभव और यात्रा प्लान करने का आसान तरीका।'
        : 'Find a quiet village, a temple town or a lake. Every place has stays, local experiences and an easy way to plan your trip.')),
    h('div', { class: 'filters' },
      pill('region', '', t('all'), region), pill('region', 'Garhwal', t('garhwal'), region), pill('region', 'Kumaon', t('kumaon'), region),
      h('span', { class: 'divider' }),
      pill('kind', '', t('all'), kind), pill('kind', 'village', t('villages'), kind), pill('kind', 'destination', getLang() === 'hi' ? 'जगहें' : 'Destinations', kind)),
    h('div', { class: 'filters' }, pill('theme', '', t('all'), theme),
      themeList.map((th) => pill('theme', th.slug, `${th.icon} ${pick(th, 'name')}`, theme))),
    list.length ? grid(list.map(placeCard), 'grid grid-3') : empty());
}

// ---------------- Place ----------------
export async function place({ params }) {
  await locations();
  let l = locationBySlug(params.slug);
  if (!l) l = await q(sb.from('locations').select('*').eq('slug', params.slug).maybeSingle());
  if (!l) return empty();
  const themeList = await themes();
  const [stays, works, tours, its] = await Promise.all([
    fetchListings('homestay', { location: l.id }), fetchListings('workspace', { location: l.id }),
    fetchListings('village_tour', { location: l.id }),
    q(sb.from('itineraries').select('*').eq('is_published', true).order('position')),
  ]);
  const related = its.filter((it) => (it.days || []).some((d) => d.location === l.slug));
  const gallery = (l.gallery || []).filter(Boolean);
  return h('div', { class: 'page' },
    h('div', { class: 'detail-hero' }, cover(l.image_url, l.slug, 'detail-img'),
      h('div', { class: 'detail-hero-text' },
        h('p', { class: 'eyebrow' }, [regionLabel(l.region), l.district].filter(Boolean).join(' · ')),
        h('h1', {}, pick(l, 'name')))),
    h('div', { class: 'detail-layout' },
      h('div', { class: 'detail-main' },
        h('p', { class: 'lead' }, pick(l, 'summary')),
        l.description ? h('div', { class: 'prose' }, l.description.split(/\n{2,}/).map((p) => h('p', {}, p))) : null,
        chips(l.theme_slugs.map((s) => { const th = themeList.find((x) => x.slug === s); return th ? `${th.icon} ${pick(th, 'name')}` : null; })),
        gallery.length ? h('div', { class: 'gallery' }, gallery.map((g) => cover(g, l.slug, 'gallery-img'))) : null,
        tours.length ? section(getLang() === 'hi' ? 'गाँव के अनुभव' : 'Village experiences', null, grid(tours.map((x) => listingCard('village_tour', x)))) : null,
        stays.length ? section(t('stays'), null, grid(stays.map((x) => listingCard('homestay', x)))) : null,
        works.length ? section(t('workspaces'), null, grid(works.map((x) => listingCard('workspace', x)))) : null,
        related.length ? section(t('itineraries'), null, grid(related.map(itineraryCard))) : null),
      h('aside', { class: 'detail-side' },
        h('div', { class: 'panel' },
          l.best_season ? h('div', { class: 'kv' }, h('span', {}, t('best_season')), h('strong', {}, l.best_season)) : null,
          l.how_to_reach ? h('div', { class: 'kv' }, h('span', {}, t('how_to_reach')), h('p', {}, l.how_to_reach)) : null,
          h('a', { class: 'btn btn-block', href: `#/plan?place=${l.slug}` }, t('plan')),
          l.is_cab_point ? h('a', { class: 'btn btn-ghost btn-block', href: `#/cabs?to=${l.slug}` }, t('cabs')) : null))));
}

// ---------------- Villages (main focus) ----------------
export async function villages() {
  const [all, tours] = await Promise.all([locations(), fetchListings('village_tour')]);
  const vs = all.filter((l) => l.kind === 'village');
  const hi = getLang() === 'hi';
  return h('div', { class: 'page' },
    h('div', { class: 'intro-block' },
      h('p', { class: 'eyebrow' }, t('village_focus')),
      h('h1', {}, hi ? 'उत्तराखंड के गाँव' : 'Villages of Uttarakhand'),
      h('p', { class: 'lead' }, hi
        ? 'गाँव में रुकिए, स्थानीय परिवारों के साथ खाना खाइए, लोकगीत, हस्तकला, खेती और मंदिरों की परंपराएँ उन्हीं से सीखिए। आपकी यात्रा का पैसा सीधे गाँव तक पहुँचता है।'
        : 'Stay in a village, eat with local families and learn folk songs, crafts, farming and temple traditions from the people who keep them alive. Your trip money goes straight to the village.')),
    tours.length ? section(hi ? 'गाँव के अनुभव' : 'Village experiences', null, grid(tours.map((x) => listingCard('village_tour', x)), 'grid grid-3')) : null,
    section(hi ? 'गाँव' : 'Villages', null, vs.length ? grid(vs.map(placeCard), 'grid grid-3') : empty()),
    h('div', { class: 'partner-cta section' },
      h('div', {}, h('h2', {}, hi ? 'आप गाँव में रहते हैं?' : 'Do you live in a village?'),
        h('p', {}, hi ? 'होमस्टे या गाँव का टूर चलाइए। रजिस्टर कीजिए, एडमिन मंज़ूरी देंगे।' : 'Host a homestay or a village walk. Register and the admin will approve you.')),
      h('a', { class: 'btn btn-lg', href: '#/partner/join' }, t('become_partner'))));
}

// ---------------- Itineraries ----------------
export async function itineraries({ query }) {
  const [list, themeList] = await Promise.all([
    q(sb.from('itineraries').select('*').eq('is_published', true).order('position')), themes()]);
  const theme = query.theme || '';
  const shown = theme ? list.filter((it) => it.theme_slugs.includes(theme)) : list;
  return h('div', { class: 'page' },
    h('h1', {}, t('itineraries')),
    h('div', { class: 'filters' },
      h('a', { class: `pill${!theme ? ' active' : ''}`, href: '#/itineraries' }, t('all')),
      themeList.map((th) => h('a', { class: `pill${theme === th.slug ? ' active' : ''}`, href: `#/itineraries?theme=${th.slug}` }, `${th.icon} ${pick(th, 'name')}`))),
    shown.length ? grid(shown.map(itineraryCard), 'grid grid-3') : empty());
}

export async function itinerary({ params }) {
  const it = await q(sb.from('itineraries').select('*').eq('slug', params.slug).maybeSingle());
  if (!it) return empty();
  await locations();
  const days = Array.isArray(it.days) ? it.days : [];
  return h('div', { class: 'page' },
    h('div', { class: 'detail-hero' }, cover(it.image_url, it.slug, 'detail-img'),
      h('div', { class: 'detail-hero-text' },
        h('p', { class: 'eyebrow' }, `${it.days_count} ${t('days')} · ${regionLabel(it.region)}`),
        h('h1', {}, pick(it, 'title')))),
    h('div', { class: 'detail-layout' },
      h('div', { class: 'detail-main' },
        h('p', { class: 'lead' }, pick(it, 'summary')),
        h('ol', { class: 'timeline' }, days.map((d) => {
          const loc = locationBySlug(d.location);
          return h('li', {},
            h('div', { class: 'timeline-day' }, `${t('day')} ${d.day}`),
            h('div', {},
              h('h3', {}, (getLang() === 'hi' && d.title_hi) || d.title),
              h('p', {}, (getLang() === 'hi' && d.plan_hi) || d.plan),
              loc ? h('a', { class: 'chip chip-link', href: `#/place/${loc.slug}` }, `📍 ${pick(loc, 'name')}`) : null));
        }))),
      h('aside', { class: 'detail-side' },
        h('div', { class: 'panel' },
          it.budget_min ? h('div', { class: 'kv' }, h('span', {}, t('budget')), h('strong', {}, `${inr(it.budget_min)} – ${inr(it.budget_max)}`)) : null,
          it.best_season ? h('div', { class: 'kv' }, h('span', {}, t('best_season')), h('strong', {}, it.best_season)) : null,
          h('div', { class: 'kv' }, h('span', {}, getLang() === 'hi' ? 'कठिनाई' : 'Difficulty'), h('strong', {}, it.difficulty)),
          h('a', { class: 'btn btn-block', href: `#/plan?from=${it.slug}` }, t('use_this_plan'))))));
}

export { regionLabel, locationById };
