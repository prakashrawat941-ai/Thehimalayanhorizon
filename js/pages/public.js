// Public pages: home, explore, place, villages, itineraries.
import { h, card, section, grid, chips, lazy, empty, inr, cover, art, select } from '../ui.js';
import { t, pick, getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
import { locations, themes, locationBySlug, locationById } from '../store.js';
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
export async function home() {
  const sections = await q(sb.from('home_sections').select('*').eq('enabled', true).order('position'));
  const page = h('div', { class: 'page home' });
  for (const s of sections) {
    const builder = blocks[s.kind];
    if (builder) page.append(builder(s));
  }
  if (!sections.length) page.append(blocks.hero({ title: 'The Himalayan Horizon', subtitle: '' }));
  return page;
}

const sTitle = (s) => pick(s, 'title');
const sSub = (s) => pick(s, 'subtitle');
const cta = (s, fallback) => pick(s, 'cta_label') || fallback || t('explore');
const more = (s) => (s.cta_url ? h('a', { class: 'link-more', href: s.cta_url }, `${cta(s)} →`) : null);

const blocks = {
  hero(s) {
    return h('section', { class: 'hero' },
      h('div', { class: 'hero-art' }, s.image_url ? cover(s.image_url, 'hero', 'hero-img') : heroArt()),
      h('div', { class: 'hero-content' },
        h('p', { class: 'eyebrow' }, 'Uttarakhand · देवभूमि'),
        h('h1', {}, sTitle(s)),
        sSub(s) ? h('p', { class: 'hero-sub' }, sSub(s)) : null,
        quickSearch(),
        h('div', { class: 'hero-actions' },
          s.cta_url ? h('a', { class: 'btn btn-lg', href: s.cta_url }, cta(s, t('plan'))) : null,
          h('a', { class: 'btn btn-lg btn-light', href: '#/villages' }, t('villages')))));
  },
  themes(s) {
    return section(sTitle(s), sSub(s), lazy(async () => {
      const list = await themes();
      return h('div', { class: 'theme-row' }, list.map((th) =>
        h('a', { class: 'theme-pill', href: `#/explore?theme=${th.slug}`, style: { '--tc': th.color } },
          h('span', { class: 'theme-icon' }, th.icon), h('span', {}, pick(th, 'name')))));
    }));
  },
  villages(s) {
    return h('section', { class: 'section village-band' },
      h('div', { class: 'village-band-inner' },
        h('div', { class: 'section-head' },
          h('div', {}, h('p', { class: 'eyebrow' }, t('village_focus')), h('h2', {}, sTitle(s)), h('p', { class: 'muted' }, sSub(s))),
          more(s)),
        lazy(async () => {
          const villagesList = (await locations()).filter((l) => l.kind === 'village');
          const tours = await fetchListings('village_tour', { limit: 4 });
          return h('div', {},
            grid(villagesList.slice(0, 6).map(placeCard), 'grid grid-3'),
            tours.length ? h('div', { class: 'mt' }, h('h3', {}, getLang() === 'hi' ? 'गाँव के अनुभव' : 'Village experiences'), grid(tours.map((x) => listingCard('village_tour', x)))) : null);
        })));
  },
  itineraries(s) {
    return section(sTitle(s), sSub(s), lazy(async () => {
      const list = await q(sb.from('itineraries').select('*').eq('is_published', true).order('is_featured', { ascending: false }).order('position').limit(6));
      return list.length ? grid(list.map(itineraryCard), 'grid grid-3') : empty();
    }), more(s));
  },
  destinations(s) {
    return section(sTitle(s), sSub(s), lazy(async () => {
      const list = (await locations()).filter((l) => l.kind === 'destination');
      const featured = [...list.filter((l) => l.is_featured), ...list.filter((l) => !l.is_featured)].slice(0, 8);
      return h('div', { class: 'scroller' }, featured.map(placeCard));
    }), more(s));
  },
  stays(s) { return listingBlock(s, 'homestay'); },
  workspaces(s) { return listingBlock(s, 'workspace'); },
  cabs(s) {
    return h('section', { class: 'section cab-band' },
      h('div', { class: 'cab-band-inner' },
        h('div', {}, h('h2', {}, sTitle(s)), h('p', {}, sSub(s)),
          h('ol', { class: 'steps' },
            h('li', {}, getLang() === 'hi' ? 'ड्राइवर अपने रूट, गाड़ी और सीटों के साथ राइड डालते हैं' : 'Drivers publish a ride with route, vehicle and seats'),
            h('li', {}, getLang() === 'hi' ? 'आप अपना रूट और तारीख़ चुनते हैं' : 'You pick your route and date'),
            h('li', {}, getLang() === 'hi' ? 'सीट बुक करें, ड्राइवर से सीधे बात करें' : 'Book seats and talk to the driver directly'))),
        h('a', { class: 'btn btn-lg btn-light', href: s.cta_url || '#/cabs' }, cta(s, t('cabs')))));
  },
  partner_cta(s) {
    return h('section', { class: 'section partner-cta' },
      h('div', {}, h('h2', {}, sTitle(s)), h('p', {}, sSub(s))),
      h('a', { class: 'btn btn-lg', href: s.cta_url || '#/partner/join' }, cta(s, t('become_partner'))));
  },
  text(s) {
    return section(sTitle(s), null, h('p', { class: 'prose' }, sSub(s)), more(s));
  },
};

function listingBlock(s, kind) {
  return section(sTitle(s), sSub(s), lazy(async () => {
    const list = await fetchListings(kind, { limit: 6 });
    return list.length ? grid(list.map((x) => listingCard(kind, x)), 'grid grid-3')
      : h('div', { class: 'soft-note' }, getLang() === 'hi'
        ? 'जल्द आ रहा है। होस्ट जुड़ रहे हैं।' : 'Coming soon — hosts are joining now.',
        ' ', h('a', { href: '#/partner/join' }, t('become_partner')));
  }), more(s));
}

function quickSearch() {
  const sel = select([['', getLang() === 'hi' ? 'कहाँ जाना है?' : 'Where to?']], '', { 'aria-label': t('search') });
  locations().then((list) => {
    list.filter((l) => l.kind !== 'transport_hub').forEach((l) => sel.append(h('option', { value: l.slug }, pick(l, 'name'))));
  }).catch(() => {});
  const form = h('form', { class: 'quick-search', onsubmit: (e) => {
    e.preventDefault();
    location.hash = sel.value ? `#/place/${sel.value}` : '#/explore';
  } }, sel, h('button', { class: 'btn', type: 'submit' }, t('search')));
  return form;
}

function heroArt() {
  const a = art('himalaya-hero', 'dawn');
  a.classList.add('hero-img');
  return a;
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

  return h('div', { class: 'page' },
    h('h1', {}, t('explore')),
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
