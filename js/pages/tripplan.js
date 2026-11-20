// Trip Planner: dashboard, travel details and the map step.
// Route, itinerary, budget and summary live in js/trip/.
// The draft is kept on this device and saved after every change, so an interrupted
// session can carry on. Road routes, weather, itinerary and budget come in later phases;
// nothing here invents distances, prices or availability.
import { h, clear, toast, todayISO, icon, art, localPhotos } from '../ui.js';
import { getLang, pick, districtName } from '../i18n.js';
import { sb, q } from '../sb.js';
import { locations, themes, user } from '../store.js';
import { allPlaces, placeInput, placeName, distanceKm, nearestPlace, loadLeaflet } from '../places.js';
import { tripStage, STAGES } from '../trip/trips.js';
import { L, MAX_DESTS, PREFS, PACES, MODES, blank, loadDraft, saveDraft, dropDraft, hasContent, slim, pName, daysOf, fmtD, validate, back, steps } from '../trip/common.js';

const RECENT = 'hh_recent_places';

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

  // Saved destinations (needs the trip-planner database update; hidden until then).
  let saved = null;
  const savedBox = h('section', { hidden: true });
  if (user()) {
    try {
      const r = await sb.from('saved_destinations').select('location_id');
      if (!r.error) saved = new Set(r.data.map((x) => x.location_id));
    } catch { /* table not there yet */ }
  }
  const heart = (l) => {
    if (!saved) return null;
    const b = h('button', { type: 'button', class: `tp-heart${saved.has(l.id) ? ' on' : ''}`, 'aria-pressed': String(saved.has(l.id)),
      'aria-label': L(`Save ${l.name}`, `${pick(l, 'name')} सेव करें`), onclick: async () => {
        const on = !saved.has(l.id);
        const r = on ? await sb.from('saved_destinations').insert({ location_id: l.id }) : await sb.from('saved_destinations').delete().eq('location_id', l.id);
        if (r.error) { toast(r.error.message, 'err'); return; }
        if (on) saved.add(l.id); else saved.delete(l.id);
        document.querySelectorAll(`.tp-heart[data-id="${l.id}"]`).forEach((x) => { x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); x.textContent = on ? '♥' : '♡'; });
        paintSaved();
      } }, saved.has(l.id) ? '♥' : '♡');
    b.dataset.id = l.id;
    return b;
  };
  const destCard = (l) => {
    const p = placeFor(l);
    const img = photo(l);
    return h('article', { class: 'tp-dest' },
      h('a', { class: 'tp-dest-img', href: `#/place/${l.slug}`, 'aria-label': pick(l, 'name') }, img ? h('img', { src: img, alt: '', loading: 'lazy' }) : art(l.slug)),
      heart(l),
      h('div', { class: 'tp-dest-body' },
        h('a', { href: `#/place/${l.slug}` }, h('strong', {}, pick(l, 'name'))),
        h('span', { class: 'muted small' }, [districtName(l.district), districtName(l.region)].filter(Boolean).join(' · ')),
        p ? h('a', { class: 'tp-add', href: `#/plan/new?to=${p.id}` }, '+ ', L('Plan a trip here', 'यहाँ की ट्रिप प्लान करें')) : null));
  };
  function paintSaved() {
    if (!saved) return;
    clear(savedBox).append(h('h2', {}, L('Saved destinations', 'सेव की गई जगहें')));
    const list = locs.filter((l) => saved.has(l.id));
    savedBox.append(list.length ? h('div', { class: 'tp-dests' }, list.map(destCard)) : h('p', { class: 'tp-empty' }, L('Tap ♡ on a place to save it here.', 'किसी जगह पर ♡ दबाकर उसे यहाँ सेव करें।')));
    savedBox.hidden = false;
  }
  paintSaved();

  const myTrips = h('div', { class: 'tp-trips' });
  if (!user()) {
    myTrips.append(h('p', { class: 'tp-empty' }, L('Log in to see the trips you have saved.', 'सेव की गई ट्रिप देखने के लिए लॉगिन करें।'), ' ',
      h('a', { href: '#/login?next=plan' }, L('Log in', 'लॉगिन'))));
  } else {
    q(sb.from('trips').select('*').order('created_at', { ascending: false }).limit(5)).then((rows) => {
      if (!rows.length) { myTrips.append(h('p', { class: 'tp-empty' }, L('No saved trips yet. Your first one will show here.', 'अभी कोई ट्रिप सेव नहीं। पहली ट्रिप यहाँ दिखेगी।'))); return; }
      rows.forEach((tr) => {
        const st = STAGES.find((x) => x[0] === tripStage(tr));
        myTrips.append(h('a', { class: 'tp-trip', href: `#/trip/${tr.id}` },
          h('span', { class: 'grow' }, h('strong', {}, tr.title), h('span', { class: 'muted small' },
            [tr.start_date && fmtD(tr.start_date), `${tr.days_count} ${L('days', 'दिन')}`, `${tr.travellers} ${L('travellers', 'यात्री')}`].filter(Boolean).join(' · '))),
          h('span', { class: `pill ${st[3]}` }, L(st[1], st[2]).replace(/ trips?$| itineraries$/i, '').replace(/ ट्रिप$| प्लान$/, ''))));
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
      h('section', {}, h('div', { class: 'tp-sec-head' }, h('h2', {}, L('My saved trips', 'मेरी सेव ट्रिप')), user() ? h('a', { class: 'link-more', href: '#/trips' }, L('All trips', 'सभी ट्रिप'), icon('arrow', 14)) : null), myTrips),
      savedBox,
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
      dayInfo,
      h('label', { class: 'check' }, (() => { const c = h('input', { type: 'checkbox', id: 'tp-rt' }); c.checked = d.roundTrip !== false; c.addEventListener('change', () => { d.roundTrip = c.checked; save(); }); return c; })(),
        h('span', {}, L('Come back to the starting point at the end', 'आख़िर में शुरुआत की जगह पर वापस आना है')))),
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
          h('span', { class: 'muted small' }, [i === 0 ? L('Start', 'शुरुआत') : `${L('Stop', 'पड़ाव')} ${i}`, districtName(p.district), `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`].filter(Boolean).join(' · '))),
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

  const total = d.dests.reduce((s, p, i) => s + distanceKm(i ? d.dests[i - 1] : d.start, p), 0); // straight line, shown as such
  return h('div', { class: 'app-page tp-page' },
    h('div', { class: 'app-head' }, back('#/plan/new'), h('div', { class: 'grow' }, h('h1', {}, L('Check your places on the map', 'मैप पर जगहें जाँचें')),
      h('p', { class: 'muted' }, L('Drag a pin to the exact spot, or change the order below.', 'पिन को सही जगह खिसकाएँ, या नीचे क्रम बदलें।')))),
    steps(1),
    box,
    h('p', { class: 'small muted' }, L(`Dashed lines join your stops in order (straight-line ~${Math.round(total)} km). The real road route and drive times are worked out in the next step.`,
      `डैश वाली लाइन पड़ावों को क्रम से जोड़ती है (सीधी दूरी ~${Math.round(total)} किमी)। असली सड़क का रास्ता और समय अगले चरण में निकलेगा।`)),
    list,
    h('div', { class: 'sticky-cta' }, h('a', { class: 'btn btn-lg btn-block', href: '#/plan/route' }, L('Continue', 'आगे बढ़ें'), icon('arrow', 16))));
}
