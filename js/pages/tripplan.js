// Trip Planner (Phase 2: screens and flow).
// Dashboard → travel details → map (check / adjust each point) → review.
// The draft is kept on this device and saved after every change, so an interrupted
// session can carry on. Road routes, weather, itinerary and budget come in later phases;
// nothing here invents distances, prices or availability.
import { h, clear, toast, todayISO, icon, art, localPhotos } from '../ui.js';
import { getLang, pick } from '../i18n.js';
import { sb, q } from '../sb.js';
import { locations, themes, user } from '../store.js';
import { allPlaces, placeInput, placeName, distanceKm, nearestPlace, loadLeaflet } from '../places.js';

const L = (en, hi) => (getLang() === 'hi' ? hi : en);
const KEY = 'hh_plan_v2';
const RECENT = 'hh_recent_places';
const MAX_DESTS = 8;
const MAX_DAYS = 30;

export const PREFS = [
  ['nature', 'Nature & peaceful places', 'प्रकृति और शांत जगहें', 'treks-nature'],
  ['villages', 'Mountain villages', 'पहाड़ी गाँव', 'village-life'],
  ['trekking', 'Trekking & hiking', 'ट्रेकिंग और हाइकिंग', 'treks-nature'],
  ['adventure', 'Adventure', 'एडवेंचर', 'treks-nature'],
  ['photography', 'Photography', 'फ़ोटोग्राफ़ी', 'wildlife-birding'],
  ['lakes', 'Lakes & waterfalls', 'झीलें और झरने', 'treks-nature'],
  ['culture', 'Cultural experiences', 'संस्कृति', 'spiritual'],
  ['homestays', 'Homestays', 'होमस्टे', 'village-life'],
  ['workation', 'Workation', 'वर्केशन', 'work-from-mountain'],
  ['family', 'Family travel', 'परिवार के साथ', null],
  ['couple', 'Couple travel', 'कपल ट्रिप', null],
  ['solo', 'Solo travel', 'अकेले यात्रा', null],
];
export const PACES = [
  ['relaxed', 'Relaxed', 'आराम से', 'Fewer places, more rest', 'कम जगहें, ज़्यादा आराम'],
  ['balanced', 'Balanced', 'संतुलित', 'A mix of travel and rest', 'घूमना और आराम दोनों'],
  ['adventure', 'Adventure-focused', 'एडवेंचर वाला', 'Long days, more activities', 'लंबे दिन, ज़्यादा गतिविधियाँ'],
];
export const MODES = [
  ['car', 'Own car / self-drive', 'अपनी कार / सेल्फ़-ड्राइव', 'car'],
  ['bike', 'Motorbike', 'मोटरबाइक', 'car'],
  ['taxi', 'Taxi / hired cab', 'टैक्सी / किराए की गाड़ी', 'car'],
  ['bus', 'Bus', 'बस', 'people'],
  ['train', 'Train + local cab', 'ट्रेन + लोकल गाड़ी', 'map'],
  ['shared', 'Shared ride (Instant Cab)', 'शेयर राइड (इंस्टेंट कैब)', 'people'],
];

// ---------- draft ----------
const blank = () => ({ title: '', start: null, dests: [null], depart: '', ret: '', adults: 2, children: 0, prefs: [], pace: 'balanced', budget: '', mode: 'car', updated: 0 });
export function loadDraft() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && Array.isArray(d.dests) ? { ...blank(), ...d } : null; } catch { return null; }
}
function saveDraft(d) { d.updated = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage off: keep in memory */ } }
function dropDraft() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
const hasContent = (d) => d && (d.start || d.dests.some(Boolean) || d.depart);

// Keep a light copy of a place (custom map pins have no id).
const slim = (p) => (p ? { id: p.id || null, name: p.name, name_hi: p.name_hi || null, district: p.district || null, region: p.region || null,
  lat: Number(p.lat), lng: Number(p.lng), location_id: p.location_id || null, custom: !!p.custom, near: p.near || null } : null);
const pName = (p) => (!p ? '' : p.custom ? `${L('Pin near', 'पिन:')} ${p.near || ''}`.trim() : placeName(p));

const nights = (d) => (d.depart && d.ret ? Math.round((new Date(d.ret) - new Date(d.depart)) / 864e5) : null);
const daysOf = (d) => { const n = nights(d); return n == null ? null : n + 1; };
const fmtD = (iso) => (iso ? new Date(`${iso}T12:00:00+05:30`).toLocaleDateString(getLang() === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function validate(d) {
  const errs = {};
  if (!d.start) errs.start = L('Choose where you start from.', 'शुरुआत की जगह चुनें।');
  const dests = d.dests.filter(Boolean);
  if (!dests.length) errs.dests = L('Add at least one destination.', 'कम से कम एक मंज़िल जोड़ें।');
  else if (d.dests.some((x) => !x)) errs.dests = L('Choose a place for every destination row, or remove the empty one.', 'हर मंज़िल के लिए जगह चुनें, या ख़ाली पंक्ति हटाएँ।');
  else if (d.start && dests.length === 1 && same(dests[0], d.start)) errs.dests = L('Destination must be different from the start.', 'मंज़िल शुरुआत से अलग होनी चाहिए।');
  else if (dests.some((x, i) => i > 0 && same(x, dests[i - 1]))) errs.dests = L('The same place is listed twice in a row.', 'एक ही जगह लगातार दो बार है।');
  if (!d.depart) errs.depart = L('Choose a departure date.', 'जाने की तारीख़ चुनें।');
  else if (d.depart < todayISO()) errs.depart = L('Departure cannot be in the past.', 'जाने की तारीख़ बीती हुई नहीं हो सकती।');
  if (!d.ret) errs.ret = L('Choose a return date.', 'वापसी की तारीख़ चुनें।');
  else if (d.depart && d.ret < d.depart) errs.ret = L('Return must be on or after departure.', 'वापसी, जाने की तारीख़ या उसके बाद हो।');
  else if (daysOf(d) > MAX_DAYS) errs.ret = L(`Trips can be up to ${MAX_DAYS} days.`, `ट्रिप ज़्यादा से ज़्यादा ${MAX_DAYS} दिन की हो सकती है।`);
  if (!(d.adults >= 1)) errs.people = L('At least one adult is needed.', 'कम से कम एक वयस्क ज़रूरी है।');
  if (d.budget !== '' && !(Number(d.budget) >= 0)) errs.budget = L('Budget must be a positive amount.', 'बजट सही रक़म हो।');
  return errs;
}
const same = (a, b) => a && b && (a.id && b.id ? a.id === b.id : Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4);

// Small shared bits
const back = (href) => h('a', { class: 'icon-btn', href, 'aria-label': L('Back', 'वापस') }, h('span', { 'aria-hidden': 'true' }, '←'));
function steps(active) {
  const list = [L('Details', 'जानकारी'), L('Map', 'मैप'), L('Review', 'जाँचें')];
  return h('ol', { class: 'tp-steps', 'aria-label': L('Steps', 'चरण') }, list.map((s, i) =>
    h('li', { class: i < active ? 'done' : i === active ? 'on' : '', 'aria-current': i === active ? 'step' : null }, h('span', {}, String(i + 1)), s)));
}

export function recordRecent(slug) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT) || '[]').filter((s) => s !== slug);
    list.unshift(slug); localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 8)));
  } catch { /* ignore */ }
}
const recentSlugs = () => { try { return JSON.parse(localStorage.getItem(RECENT) || '[]'); } catch { return []; } };

// ---------- 1. Dashboard ----------
export async function dashboard({ query = {} } = {}) {
  // Old links: "use this itinerary" goes to the quick planner; "plan a trip here" pre-fills the destination.
  if (query.from) { location.hash = `#/plan/quick?from=${encodeURIComponent(query.from)}`; return h('div'); }
  const [locs, themeList, places] = await Promise.all([locations(), themes(), allPlaces()]);
  if (query.place) {
    const loc = locs.find((l) => l.slug === query.place);
    const p = loc && places.find((x) => x.location_id === loc.id);
    location.hash = p ? `#/plan/new?to=${p.id}` : `#/plan/quick?place=${encodeURIComponent(query.place)}`;
    return h('div');
  }
  const draft = loadDraft();
  const placeFor = (loc) => places.find((p) => p.location_id === loc.id);
  const photo = (l) => l.image_url || localPhotos[l.slug];

  const startNew = () => { dropDraft(); location.hash = '#/plan/new'; };
  let armed = false;
  const newBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-lg', onclick: () => {
    if (!armed) { armed = true; newBtn.textContent = L('Tap again to discard the draft', 'ड्राफ़्ट हटाने के लिए फिर टैप करें'); return; }
    startNew();
  } }, L('Start a new trip', 'नई ट्रिप शुरू करें'));

  const draftCard = hasContent(draft) ? h('section', { class: 'tp-draft' },
    h('div', { class: 'grow' },
      h('p', { class: 'eyebrow' }, L('Unfinished trip', 'अधूरी ट्रिप')),
      h('strong', {}, [pName(draft.start), ...draft.dests.filter(Boolean).map(pName)].filter(Boolean).join(' → ') || L('Draft trip', 'ड्राफ़्ट ट्रिप')),
      h('span', { class: 'muted small' }, [draft.depart && `${fmtD(draft.depart)}${draft.ret ? ` – ${fmtD(draft.ret)}` : ''}`, `${L('saved on this device', 'इस फ़ोन में सेव')}`].filter(Boolean).join(' · '))),
    h('div', { class: 'tp-draft-actions' },
      h('a', { class: 'btn btn-lg', href: '#/plan/new' }, L('Continue my trip', 'ट्रिप जारी रखें'), icon('arrow', 16)), newBtn)) : null;

  const recent = recentSlugs().map((s) => locs.find((l) => l.slug === s)).filter(Boolean).slice(0, 6);
  const suggested = [...locs].filter((l) => l.kind !== 'transport_hub')
    .sort((a, b) => (b.is_featured - a.is_featured) || ((b.kind === 'village') - (a.kind === 'village')) || (!!photo(b) - !!photo(a))).slice(0, 6);

  const destCard = (l) => {
    const p = placeFor(l);
    const img = photo(l);
    return h('article', { class: 'tp-dest' },
      h('a', { class: 'tp-dest-img', href: `#/place/${l.slug}`, 'aria-label': pick(l, 'name') }, img ? h('img', { src: img, alt: '', loading: 'lazy' }) : art(l.slug)),
      h('div', { class: 'tp-dest-body' },
        h('a', { href: `#/place/${l.slug}` }, h('strong', {}, pick(l, 'name'))),
        h('span', { class: 'muted small' }, [l.district, l.region].filter(Boolean).join(' · ')),
        p ? h('a', { class: 'tp-add', href: `#/plan/new?to=${p.id}` }, '+ ', L('Plan a trip here', 'यहाँ की ट्रिप प्लान करें')) : null));
  };

  const myTrips = h('div', { class: 'tp-trips' });
  if (!user()) {
    myTrips.append(h('p', { class: 'tp-empty' }, L('Log in to see the trips you have saved.', 'सेव की गई ट्रिप देखने के लिए लॉगिन करें।'), ' ',
      h('a', { href: '#/login?next=plan' }, L('Log in', 'लॉगिन'))));
  } else {
    q(sb.from('trips').select('id,title,start_date,days_count,travellers').order('created_at', { ascending: false }).limit(6)).then((rows) => {
      if (!rows.length) { myTrips.append(h('p', { class: 'tp-empty' }, L('No saved trips yet. Your first one will show here.', 'अभी कोई ट्रिप सेव नहीं। पहली ट्रिप यहाँ दिखेगी।'))); return; }
      const today = todayISO();
      rows.forEach((tr) => {
        const end = tr.start_date ? new Date(new Date(`${tr.start_date}T12:00:00Z`).getTime() + (tr.days_count - 1) * 864e5).toISOString().slice(0, 10) : null;
        const [label, cls] = !tr.start_date ? [L('No date', 'तारीख़ नहीं'), 'pill-done'] : end < today ? [L('Completed', 'पूरी'), 'pill-done']
          : tr.start_date <= today ? [L('Ongoing', 'चल रही'), 'pill-ok'] : [L('Upcoming', 'आने वाली'), 'pill-warn'];
        myTrips.append(h('a', { class: 'tp-trip', href: `#/trip/${tr.id}` },
          h('span', { class: 'grow' }, h('strong', {}, tr.title), h('span', { class: 'muted small' },
            [tr.start_date && fmtD(tr.start_date), `${tr.days_count} ${L('days', 'दिन')}`, `${tr.travellers} ${L('travellers', 'यात्री')}`].filter(Boolean).join(' · '))),
          h('span', { class: `pill ${cls}` }, label)));
      });
    }).catch(() => myTrips.append(h('p', { class: 'tp-empty' }, L('Could not load your trips. Check your internet.', 'आपकी ट्रिप लोड नहीं हुईं। इंटरनेट देखें।'))));
  }

  return h('div', { class: 'tp' },
    h('section', { class: 'tp-hero' },
      h('img', { src: 'img/home/hero.jpg', alt: '' }),
      h('div', { class: 'wrap' },
        h('p', { class: 'eyebrow' }, L('Trip Planner', 'ट्रिप प्लानर')),
        h('h1', {}, L('Plan your Himalayan journey', 'अपनी हिमालय यात्रा प्लान करें')),
        h('p', {}, L('Choose where you start and where you want to go. We show the route, a day-wise plan, stays and an honest cost estimate.',
          'कहाँ से शुरू करना है और कहाँ जाना है, चुनिए। हम रास्ता, दिन-वार प्लान, रुकने की जगहें और ख़र्च का सही अंदाज़ा दिखाएँगे।')),
        draftCard ? null : h('a', { class: 'btn btn-lg btn-gold', href: '#/plan/new' }, L('Create my trip', 'मेरी ट्रिप बनाएँ'), icon('arrow', 16)))),
    h('div', { class: 'wrap tp-body' },
      draftCard,
      h('section', {}, h('div', { class: 'tp-sec-head' }, h('h2', {}, L('My saved trips', 'मेरी सेव ट्रिप')), user() ? h('a', { class: 'link-more', href: '#/account' }, L('All trips', 'सभी ट्रिप'), icon('arrow', 14)) : null), myTrips),
      h('section', {}, h('h2', {}, L('Recently viewed', 'हाल में देखी जगहें')),
        recent.length ? h('div', { class: 'tp-dests' }, recent.map(destCard))
          : h('p', { class: 'tp-empty' }, L('Places you open on the site will show here.', 'साइट पर जो जगहें खोलेंगे, वे यहाँ दिखेंगी।'))),
      h('section', {}, h('div', { class: 'tp-sec-head' }, h('h2', {}, L('Suggested Himalayan destinations', 'सुझाई गई हिमालयी जगहें')),
        h('a', { class: 'link-more', href: '#/explore' }, L('Explore all', 'सभी देखें'), icon('arrow', 14))),
        h('div', { class: 'tp-dests' }, suggested.map(destCard))),
      h('section', {}, h('h2', {}, L('Popular travel experiences', 'लोकप्रिय अनुभव')),
        h('div', { class: 'tp-exp' }, themeList.map((th) => h('a', { class: 'tp-exp-item', href: `#/explore?theme=${th.slug}` },
          h('span', { class: 'tp-exp-ico', 'aria-hidden': 'true' }, th.icon), h('span', {}, pick(th, 'name')))))),
      h('p', { class: 'small muted' }, L('Want the old quick planner?', 'पुराना क्विक प्लानर चाहिए?'), ' ', h('a', { href: '#/plan/quick' }, L('Open quick plan', 'क्विक प्लान खोलें')))));
}

// ---------- 2. Travel details ----------
export async function details({ query }) {
  const places = await allPlaces();
  const d = loadDraft() || blank();
  if (query.to) {
    const p = places.find((x) => x.id === query.to);
    if (p && !d.dests.some((x) => x && x.id === p.id)) { const i = d.dests.findIndex((x) => !x); if (i >= 0) d.dests[i] = slim(p); else d.dests.push(slim(p)); }
  }
  if (!d.depart) { d.depart = todayISO(7); d.ret = todayISO(9); }
  saveDraft(d);
  const errBox = {};
  const save = () => {
    saveDraft(d);
    if (!Object.values(errBox).some((el) => el.textContent)) return;
    const errs = validate(d);
    Object.entries(errBox).forEach(([k, el]) => { if (el.textContent) el.textContent = errs[k] || ''; });
  };
  const errEl = (k) => (errBox[k] = h('p', { class: 'form-err', role: 'alert', id: `tp-err-${k}` }));

  // Start
  const startI = placeInput({ id: 'tp-start', label: L('Starting location', 'कहाँ से शुरू'), placeholder: L('City, town or village', 'शहर, कस्बा या गाँव'),
    value: d.start, onChange: (p) => { d.start = slim(p); save(); } });

  // Destinations (add / remove / reorder)
  const destList = h('ol', { class: 'tp-destlist' });
  const paintDests = () => {
    clear(destList);
    d.dests.forEach((p, i) => {
      const pi = placeInput({ id: `tp-dest-${i}`, label: d.dests.length > 1 ? `${L('Destination', 'मंज़िल')} ${i + 1}` : L('Destination', 'मंज़िल'),
        placeholder: L('Where do you want to go?', 'कहाँ जाना है?'), value: p, compact: true, onChange: (np) => { d.dests[i] = slim(np); save(); } });
      const move = (dir) => { const j = i + dir; [d.dests[i], d.dests[j]] = [d.dests[j], d.dests[i]]; save(); paintDests(); destList.querySelectorAll('.tp-move')[Math.max(0, j * 2 + (dir > 0 ? 1 : 0))]?.focus(); };
      destList.append(h('li', { class: 'tp-destrow' },
        h('div', { class: 'tp-desthead' },
        h('span', { class: 'tp-num', 'aria-hidden': 'true' }, String(i + 1)),
        h('span', { class: 'tp-destlabel', 'aria-hidden': 'true' }, d.dests.length > 1 ? `${L('Destination', 'मंज़िल')} ${i + 1}` : L('Destination', 'मंज़िल')),
        h('div', { class: 'tp-rowtools' },
          h('button', { type: 'button', class: 'tp-move', disabled: i === 0, 'aria-label': L(`Move destination ${i + 1} up`, `मंज़िल ${i + 1} ऊपर करें`), onclick: () => move(-1) }, '↑'),
          h('button', { type: 'button', class: 'tp-move', disabled: i === d.dests.length - 1, 'aria-label': L(`Move destination ${i + 1} down`, `मंज़िल ${i + 1} नीचे करें`), onclick: () => move(1) }, '↓'),
          h('button', { type: 'button', class: 'tp-move tp-del', disabled: d.dests.length === 1, 'aria-label': L(`Remove destination ${i + 1}`, `मंज़िल ${i + 1} हटाएँ`),
            onclick: () => { d.dests.splice(i, 1); save(); paintDests(); } }, '✕'))),
        pi.el));
    });
    addBtn.disabled = d.dests.length >= MAX_DESTS;
  };
  const addBtn = h('button', { type: 'button', class: 'tp-addrow', onclick: () => { d.dests.push(null); save(); paintDests(); destList.querySelector(`#tp-dest-${d.dests.length - 1}`)?.focus(); } },
    '+ ', L('Add another destination', 'एक और मंज़िल जोड़ें'));
  paintDests();

  // Dates
  const departI = h('input', { class: 'input', type: 'date', id: 'tp-depart', min: todayISO(), value: d.depart });
  const retI = h('input', { class: 'input', type: 'date', id: 'tp-ret', min: d.depart || todayISO(), value: d.ret });
  const dayInfo = h('p', { class: 'tp-dayinfo', 'aria-live': 'polite' });
  const paintDays = () => {
    const n = daysOf(d);
    dayInfo.textContent = n && n > 0 ? `${n} ${L(n > 1 ? 'days' : 'day', 'दिन')} · ${n - 1} ${L(n - 1 === 1 ? 'night' : 'nights', 'रात')}` : '';
  };
  departI.addEventListener('change', () => { d.depart = departI.value; retI.min = d.depart; if (d.ret && d.ret < d.depart) { d.ret = d.depart; retI.value = d.ret; } save(); paintDays(); });
  retI.addEventListener('change', () => { d.ret = retI.value; save(); paintDays(); });
  paintDays();

  // People
  const counter = (key, label, min, max) => {
    const out = h('output', { class: 'stepper-n', id: `tp-${key}`, 'aria-live': 'polite' }, String(d[key]));
    const set = (dv) => { d[key] = Math.min(max, Math.max(min, d[key] + dv)); out.textContent = String(d[key]); total.textContent = String(d.adults + d.children); save(); };
    return h('div', { class: 'field' }, h('span', { class: 'field-label', id: `tp-${key}-l` }, label),
      h('div', { class: 'stepper', role: 'group', 'aria-labelledby': `tp-${key}-l` },
        h('button', { type: 'button', 'aria-label': `${L('Fewer', 'कम')} ${label}`, onclick: () => set(-1) }, '−'), out,
        h('button', { type: 'button', 'aria-label': `${L('More', 'ज़्यादा')} ${label}`, onclick: () => set(1) }, '+')));
  };
  const total = h('strong', {}, String(d.adults + d.children));

  // Preferences
  const prefBox = h('div', { class: 'tp-chips', role: 'group', 'aria-label': L('Travel preferences', 'यात्रा की पसंद') }, PREFS.map(([k, en, hi]) => {
    const b = h('button', { type: 'button', class: `tp-chip${d.prefs.includes(k) ? ' on' : ''}`, 'aria-pressed': String(d.prefs.includes(k)), onclick: () => {
      const i = d.prefs.indexOf(k); if (i >= 0) d.prefs.splice(i, 1); else d.prefs.push(k);
      b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', String(i < 0)); save();
    } }, L(en, hi));
    return b;
  }));

  // Pace
  const paceBox = h('div', { class: 'tp-cards3', role: 'radiogroup', 'aria-label': L('Travel pace', 'यात्रा की रफ़्तार') }, PACES.map(([k, en, hi, sen, shi]) =>
    h('label', { class: 'tp-radio' }, h('input', { type: 'radio', name: 'tp-pace', value: k, checked: d.pace === k, onchange: () => { d.pace = k; save(); } }),
      h('span', {}, h('strong', {}, L(en, hi)), h('small', {}, L(sen, shi))))));

  // Mode
  const modeBox = h('div', { class: 'tp-cards3 tp-modes', role: 'radiogroup', 'aria-label': L('Preferred travel mode', 'यात्रा का साधन') }, MODES.map(([k, en, hi, ic]) =>
    h('label', { class: 'tp-radio tp-radio-row' }, h('input', { type: 'radio', name: 'tp-mode', value: k, checked: d.mode === k, onchange: () => { d.mode = k; save(); } }),
      icon(ic, 18), h('span', {}, L(en, hi)))));

  // Budget
  const budgetI = h('input', { class: 'input', id: 'tp-budget', type: 'number', inputmode: 'numeric', min: 0, step: 500, value: d.budget, placeholder: L('e.g. 25000', 'जैसे 25000') });
  budgetI.addEventListener('input', () => { d.budget = budgetI.value === '' ? '' : Number(budgetI.value); save(); });

  const form = h('form', { class: 'tp-form', novalidate: true, onsubmit: (e) => {
    e.preventDefault();
    if (!startI.validate()) { /* placeInput shows its own hint */ }
    d.dests.forEach((_, i) => { const el = destList.querySelector(`#tp-dest-${i}`); if (el && el.value.trim() && !d.dests[i]) { /* typed but not chosen */ } });
    const errs = validate(d);
    Object.entries(errBox).forEach(([k, el]) => { el.textContent = errs[k] || ''; });
    const first = Object.keys(errs)[0];
    if (first) {
      const target = { start: '#tp-start', dests: '.tp-destlist', depart: '#tp-depart', ret: '#tp-ret', people: '#tp-adults', budget: '#tp-budget' }[first];
      form.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast(errs[first], 'warn');
      return;
    }
    save();
    location.hash = '#/plan/map';
  } },
    h('section', { class: 'tp-card' }, h('h2', {}, L('Where are you going?', 'कहाँ जा रहे हैं?')),
      startI.el, errEl('start'),
      h('div', { class: 'tp-sublabel' }, L('Destinations — in the order you want to visit', 'मंज़िलें — जिस क्रम में जाना है')),
      destList, addBtn, errEl('dests')),
    h('section', { class: 'tp-card' }, h('h2', {}, L('When?', 'कब?')),
      h('div', { class: 'row2' },
        h('label', { class: 'field', for: 'tp-depart' }, h('span', { class: 'field-label' }, L('Departure date', 'जाने की तारीख़')), departI, errEl('depart')),
        h('label', { class: 'field', for: 'tp-ret' }, h('span', { class: 'field-label' }, L('Return date', 'वापसी की तारीख़')), retI, errEl('ret'))),
      dayInfo),
    h('section', { class: 'tp-card' }, h('h2', {}, L('Who is travelling?', 'कौन जा रहा है?')),
      h('div', { class: 'row2' }, counter('adults', L('Adults', 'वयस्क'), 1, 30), counter('children', L('Children (under 12)', 'बच्चे (12 से कम)'), 0, 20)),
      h('p', { class: 'tp-dayinfo' }, L('Total travellers: ', 'कुल यात्री: '), total), errEl('people')),
    h('section', { class: 'tp-card' }, h('h2', {}, L('What do you enjoy?', 'आपको क्या पसंद है?')),
      h('p', { class: 'muted small' }, L('Pick as many as you like.', 'जितनी चाहें चुनें।')), prefBox,
      h('div', { class: 'tp-sublabel' }, L('Travel pace', 'यात्रा की रफ़्तार')), paceBox),
    h('section', { class: 'tp-card' }, h('h2', {}, L('Budget and travel mode', 'बजट और साधन')),
      h('label', { class: 'field', for: 'tp-budget' }, h('span', { class: 'field-label' }, L('Approximate total budget (₹, optional)', 'कुल बजट लगभग (₹, वैकल्पिक)')), budgetI, errEl('budget')),
      h('div', { class: 'tp-sublabel' }, L('Preferred travel mode', 'यात्रा का साधन')), modeBox),
    h('div', { class: 'sticky-cta' }, h('button', { class: 'btn btn-lg btn-block', type: 'submit' }, L('Continue', 'आगे बढ़ें'), icon('arrow', 16))));

  return h('div', { class: 'app-page tp-page' },
    h('div', { class: 'app-head' }, back('#/plan'), h('div', { class: 'grow' }, h('h1', {}, L('Travel details', 'यात्रा की जानकारी')),
      h('p', { class: 'muted' }, L('Saved on this device as you type.', 'लिखते ही इस फ़ोन में सेव होता है।')))),
    steps(0), form);
}

// ---------- 3. Map: check and adjust each point ----------
export async function mapStep() {
  const d = loadDraft();
  if (!d || Object.keys(validate(d)).some((k) => k === 'start' || k === 'dests')) { location.hash = '#/plan/new'; return h('div'); }
  const places = await allPlaces();
  const box = h('div', { class: 'tp-map' }, h('p', { class: 'muted small tp-map-msg' }, L('Loading map…', 'मैप लोड हो रहा है…')));
  const list = h('ol', { class: 'tp-pointlist' });
  const points = () => [d.start, ...d.dests];
  let map = null; let Lf = null; let layer = null;

  const label = (i) => (i === 0 ? 'S' : String(i));
  function setPoint(i, p) { if (i === 0) d.start = p; else d.dests[i - 1] = p; saveDraft(d); }

  function paintList() {
    clear(list);
    points().forEach((p, i) => {
      const orig = p.custom && p.orig ? p.orig : null;
      list.append(h('li', { class: 'tp-point' },
        h('span', { class: `tp-pin${i === 0 ? ' start' : ''}`, 'aria-hidden': 'true' }, label(i)),
        h('div', { class: 'grow' },
          h('strong', {}, pName(p)),
          h('span', { class: 'muted small' }, [i === 0 ? L('Start', 'शुरुआत') : `${L('Stop', 'पड़ाव')} ${i}`, p.district, `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`].filter(Boolean).join(' · '))),
        h('div', { class: 'tp-rowtools' },
          i > 1 ? h('button', { type: 'button', class: 'tp-move', 'aria-label': L(`Move stop ${i} up`, `पड़ाव ${i} ऊपर`), onclick: () => { [d.dests[i - 2], d.dests[i - 1]] = [d.dests[i - 1], d.dests[i - 2]]; saveDraft(d); paint(); } }, '↑') : null,
          i > 0 && i < d.dests.length ? h('button', { type: 'button', class: 'tp-move', 'aria-label': L(`Move stop ${i} down`, `पड़ाव ${i} नीचे`), onclick: () => { [d.dests[i], d.dests[i - 1]] = [d.dests[i - 1], d.dests[i]]; saveDraft(d); paint(); } }, '↓') : null,
          orig ? h('button', { type: 'button', class: 'tp-move tp-reset', 'aria-label': L('Undo pin move', 'पिन वापस'), title: L('Back to listed place', 'सूची वाली जगह पर वापस'), onclick: () => { setPoint(i, orig); paint(); } }, '↺') : null)));
    });
  }

  function paintMap(fit) {
    if (!map) return;
    if (layer) layer.remove();
    layer = Lf.layerGroup().addTo(map);
    const pts = points();
    Lf.polyline(pts.map((p) => [p.lat, p.lng]), { color: '#1f4d3a', weight: 3, opacity: 0.7, dashArray: '6 8' }).addTo(layer);
    pts.forEach((p, i) => {
      const m = Lf.marker([p.lat, p.lng], {
        draggable: true, keyboard: true, title: pName(p), alt: pName(p),
        icon: Lf.divIcon({ className: '', html: `<span class="tp-pin${i === 0 ? ' start' : ''}">${label(i)}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
      }).addTo(layer);
      m.bindTooltip(pName(p));
      m.on('dragend', () => {
        const ll = m.getLatLng();
        const pt = { lat: ll.lat, lng: ll.lng };
        const near = nearestPlace(places, pt);
        const orig = p.custom ? p.orig : p;
        // Snap back onto a listed place if dropped right on it; otherwise keep the exact pin.
        const np = near && near.d < 1.5 ? slim(near.place)
          : { ...slim({ name: `Pin near ${near ? near.place.name : ''}`.trim(), lat: pt.lat, lng: pt.lng, custom: true, near: near ? `${placeName(near.place)} (~${Math.round(near.d)} km)` : '' }), orig };
        setPoint(i, np);
        toast(np.custom ? L('Pin moved. The exact spot is saved.', 'पिन खिसकाया गया। सही जगह सेव हो गई।') : `${L('Set to', 'जगह:')} ${placeName(np)}`);
        paint(false);
      });
    });
    if (fit) map.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [36, 36], maxZoom: 11 });
  }
  function paint(fit = true) { paintList(); paintMap(fit); }

  (async () => {
    try { Lf = await loadLeaflet(); } catch {
      clear(box).append(h('p', { class: 'tp-map-msg error-box' }, L('Map could not load. Check your internet — you can still continue with the list below.', 'मैप लोड नहीं हुआ। इंटरनेट देखें — नीचे की सूची से आगे बढ़ सकते हैं।')));
      return;
    }
    clear(box);
    map = Lf.map(box, { scrollWheelZoom: false });
    Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
    paintMap(true);
    setTimeout(() => map.invalidateSize(), 150);
  })();
  paintList();

  const total = d.dests.reduce((s, p, i) => s + distanceKm(i ? d.dests[i - 1] : d.start, p), 0);
  return h('div', { class: 'app-page tp-page' },
    h('div', { class: 'app-head' }, back('#/plan/new'), h('div', { class: 'grow' }, h('h1', {}, L('Check your places on the map', 'मैप पर जगहें जाँचें')),
      h('p', { class: 'muted' }, L('Drag a pin to the exact spot, or change the order below.', 'पिन को सही जगह खिसकाएँ, या नीचे क्रम बदलें।')))),
    steps(1),
    box,
    h('p', { class: 'small muted' }, L(`Dashed lines join your stops in order (straight-line ~${Math.round(total)} km). The real road route and drive times are worked out in the next step.`,
      `डैश वाली लाइन पड़ावों को क्रम से जोड़ती है (सीधी दूरी ~${Math.round(total)} किमी)। असली सड़क का रास्ता और समय अगले चरण में निकलेगा।`)),
    list,
    h('div', { class: 'sticky-cta' }, h('a', { class: 'btn btn-lg btn-block', href: '#/plan/review' }, L('Continue', 'आगे बढ़ें'), icon('arrow', 16))));
}

// ---------- 4. Review ----------
export async function review() {
  const d = loadDraft();
  if (!d || Object.keys(validate(d)).length) { location.hash = '#/plan/new'; return h('div'); }
  const [locs, themeList] = await Promise.all([locations(), themes()]);
  const n = daysOf(d);
  const stops = [d.start, ...d.dests];
  if (!d.title) d.title = `${pName(d.dests[d.dests.length - 1])} ${L('trip', 'ट्रिप')}`;
  const titleI = h('input', { class: 'input tp-title', id: 'tp-title', maxlength: 120, value: d.title, 'aria-label': L('Trip name', 'ट्रिप का नाम') });
  titleI.addEventListener('input', () => { d.title = titleI.value; saveDraft(d); });
  const row = (k, v, edit) => h('div', { class: 'tp-rv-row' }, h('span', { class: 'muted' }, k), h('strong', {}, v), edit ? h('a', { class: 'tp-edit', href: edit }, L('Edit', 'बदलें')) : null);
  const prefNames = d.prefs.map((k) => PREFS.find((p) => p[0] === k)).filter(Boolean).map((p) => L(p[1], p[2]));
  const pace = PACES.find((p) => p[0] === d.pace); const mode = MODES.find((m) => m[0] === d.mode);

  // Hand over to the existing quick planner so the trip can be saved today.
  const quick = () => {
    const slugs = [...new Set(d.prefs.map((k) => PREFS.find((p) => p[0] === k)?.[3]).filter(Boolean))].filter((s) => themeList.some((t) => t.slug === s));
    const firstLoc = d.dests.map((p) => p.location_id && locs.find((l) => l.id === p.location_id)).find(Boolean);
    try {
      localStorage.setItem('hh_trip_draft', JSON.stringify({ title: d.title, start_date: d.depart, days_count: n, travellers: d.adults + d.children,
        budget: d.budget === '' ? '' : Number(d.budget), region: '', theme_slugs: slugs.length ? slugs : ['village-life'], days: [] }));
    } catch { /* ignore */ }
    location.hash = `#/plan/quick${firstLoc ? `?place=${firstLoc.slug}` : ''}`;
  };

  return h('div', { class: 'app-page tp-page' },
    h('div', { class: 'app-head' }, back('#/plan/map'), h('div', { class: 'grow' }, h('h1', {}, L('Review your trip', 'अपनी ट्रिप जाँचें')))),
    steps(2),
    h('section', { class: 'tp-card' },
      h('label', { class: 'field-label', for: 'tp-title' }, L('Trip name', 'ट्रिप का नाम')), titleI,
      h('ol', { class: 'tp-route' }, stops.map((p, i) => h('li', {}, h('span', { class: `tp-pin${i === 0 ? ' start' : ''}`, 'aria-hidden': 'true' }, i === 0 ? 'S' : String(i)), h('span', {}, pName(p))))),
      h('a', { class: 'tp-edit', href: '#/plan/map' }, L('Adjust on map', 'मैप पर बदलें'))),
    h('section', { class: 'tp-card tp-rv' },
      row(L('Dates', 'तारीख़'), `${fmtD(d.depart)} – ${fmtD(d.ret)} (${n} ${L(n > 1 ? 'days' : 'day', 'दिन')})`, '#/plan/new'),
      row(L('Travellers', 'यात्री'), `${d.adults} ${L(d.adults > 1 ? 'adults' : 'adult', 'वयस्क')}${d.children ? `, ${d.children} ${L(d.children > 1 ? 'children' : 'child', 'बच्चे')}` : ''}`, '#/plan/new'),
      row(L('Preferences', 'पसंद'), prefNames.length ? prefNames.join(', ') : L('None chosen', 'कोई नहीं'), '#/plan/new'),
      row(L('Pace', 'रफ़्तार'), pace ? L(pace[1], pace[2]) : '—', '#/plan/new'),
      row(L('Travel mode', 'साधन'), mode ? L(mode[1], mode[2]) : '—', '#/plan/new'),
      row(L('Budget', 'बजट'), d.budget === '' ? L('Not set', 'तय नहीं') : `₹${Number(d.budget).toLocaleString('en-IN')} ${L('(approx.)', '(लगभग)')}`, '#/plan/new')),
    d.mode === 'shared' ? h('p', { class: 'soft-note' }, L('Shared rides are journeys other travellers already plan. You can search them in Instant Cab.', 'शेयर राइड वे यात्राएँ हैं जो दूसरे लोग पहले से कर रहे हैं। इन्हें इंस्टेंट कैब में खोजें।'), ' ',
      h('a', { href: `#/cab/find?from=${d.start.id || ''}&to=${d.dests[0].id || ''}&date=${d.depart}&n=${Math.min(10, d.adults + d.children)}` }, L('Search shared rides', 'शेयर राइड खोजें'))) : null,
    h('section', { class: 'tp-next' },
      h('strong', {}, L('Coming next in the planner', 'प्लानर में आगे आ रहा है')),
      h('p', { class: 'muted small' }, L('Road route and drive time for every stop, weather, a day-wise itinerary, stays and the full budget.',
        'हर पड़ाव का सड़क रास्ता और समय, मौसम, दिन-वार प्लान, रुकने की जगहें और पूरा बजट।'))),
    h('div', { class: 'sticky-cta tp-cta2' },
      h('button', { type: 'button', class: 'btn btn-lg btn-block', onclick: quick }, L('Make a quick day plan and save', 'क्विक दिन-वार प्लान बनाएँ और सेव करें'), icon('arrow', 16))));
}
