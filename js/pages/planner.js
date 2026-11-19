// Trip planner: suggest a day-by-day plan from the traveller's choices, let them edit
// it, and save it to their account.
import { h, field, input, select, textarea, toast, busy, empty, inr, todayISO, clear, fmtDate } from '../ui.js';
import { t, pick, getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
import { locations, themes, locationBySlug, user } from '../store.js';

const DRAFT_KEY = 'hh_trip_draft';
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } };
const saveDraft = (d) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ } };

// Pick the best curated itinerary, or assemble one from published places.
export function suggest({ days, region, themeSlugs, itins, locs, startSlug }) {
  const score = (it) => {
    let s = 0;
    s += it.theme_slugs.filter((x) => themeSlugs.includes(x)).length * 3;
    if (region && (it.region === region || it.region === 'Both')) s += 2;
    s -= Math.abs(it.days_count - days) * 0.8;
    if (startSlug && (it.days || []).some((d) => d.location === startSlug)) s += 4;
    return s;
  };
  const best = [...itins].sort((a, b) => score(b) - score(a))[0];
  if (best && score(best) > 1) {
    const base = best.days.slice(0, days).map((d, i) => ({ ...d, day: i + 1 }));
    while (base.length < days) {
      const last = base[base.length - 1];
      base.push({ day: base.length + 1, title: 'Free day', title_hi: 'खाली दिन', plan: 'Rest, local walks or a village visit.', plan_hi: 'आराम, आसपास सैर या गाँव की यात्रा।', location: last?.location || '' });
    }
    return { days: base, fromItinerary: best };
  }
  // Assemble from places: villages first, two days per place.
  let pool = locs.filter((l) => l.kind === 'village' || l.kind === 'destination')
    .filter((l) => !region || l.region === region)
    .filter((l) => !themeSlugs.length || l.theme_slugs.some((x) => themeSlugs.includes(x)));
  if (!pool.length) pool = locs.filter((l) => l.kind !== 'transport_hub' && (!region || l.region === region));
  pool.sort((a, b) => (b.kind === 'village') - (a.kind === 'village') || b.is_featured - a.is_featured);
  if (startSlug) {
    const s = locs.find((l) => l.slug === startSlug);
    if (s) pool = [s, ...pool.filter((l) => l.id !== s.id)];
  }
  const out = [];
  for (let i = 0; i < days; i++) {
    const l = pool[Math.floor(i / 2) % Math.max(pool.length, 1)];
    if (!l) break;
    const first = i % 2 === 0;
    out.push({
      day: i + 1,
      title: first ? `Arrive in ${l.name}` : `${l.name}: explore`,
      title_hi: first ? `${l.name_hi || l.name} पहुँचें` : `${l.name_hi || l.name}: घूमें`,
      plan: first ? l.summary : 'Village walk, local food and time with your hosts.',
      plan_hi: first ? (l.summary_hi || l.summary) : 'गाँव की सैर, स्थानीय खाना और मेज़बानों के साथ समय।',
      location: l.slug,
    });
  }
  return { days: out, fromItinerary: null };
}

export async function planner({ query }) {
  const [locs, themeList, itins] = await Promise.all([
    locations(), themes(), q(sb.from('itineraries').select('*').eq('is_published', true))]);
  const hi = getLang() === 'hi';
  const draft = loadDraft();
  const fromIt = query.from ? itins.find((x) => x.slug === query.from) : null;

  const st = {
    title: fromIt ? pick(fromIt, 'title') : (draft?.title || ''),
    start_date: draft?.start_date || '',
    days_count: fromIt?.days_count || draft?.days_count || 4,
    travellers: draft?.travellers || 2,
    budget: draft?.budget || '',
    region: fromIt?.region === 'Both' ? '' : (fromIt?.region || draft?.region || ''),
    theme_slugs: fromIt?.theme_slugs || draft?.theme_slugs || ['village-life'],
    days: fromIt ? fromIt.days : (draft?.days || []),
    from_itinerary_id: fromIt?.id || draft?.from_itinerary_id || null,
  };

  const daysBox = h('div', { class: 'day-editor' });
  const titleIn = input({ value: st.title, placeholder: hi ? 'जैसे: माँ-पापा के साथ कुमाऊँ' : 'e.g. Kumaon with family', maxlength: 160 });
  const startIn = input({ type: 'date', value: st.start_date, min: todayISO() });
  const daysIn = input({ type: 'number', min: 1, max: 30, value: st.days_count });
  const travIn = input({ type: 'number', min: 1, max: 50, value: st.travellers });
  const budgetIn = input({ type: 'number', min: 0, step: 500, value: st.budget, placeholder: '₹' });
  const regionIn = select([['', t('both')], ['Garhwal', t('garhwal')], ['Kumaon', t('kumaon')]], st.region);
  const themeBox = h('div', { class: 'chips' }, themeList.map((th) => {
    const on = st.theme_slugs.includes(th.slug);
    const b = h('button', { type: 'button', class: `pill${on ? ' active' : ''}`, onclick: () => {
      const i = st.theme_slugs.indexOf(th.slug);
      if (i >= 0) st.theme_slugs.splice(i, 1); else st.theme_slugs.push(th.slug);
      b.classList.toggle('active');
    } }, `${th.icon} ${pick(th, 'name')}`);
    return b;
  }));

  const collect = () => Object.assign(st, {
    title: titleIn.value.trim(), start_date: startIn.value, days_count: Math.min(30, Math.max(1, Number(daysIn.value) || 1)),
    travellers: Number(travIn.value) || 1, budget: budgetIn.value ? Number(budgetIn.value) : '', region: regionIn.value,
  });

  const placeOpts = [['', '—'], ...locs.filter((l) => l.kind !== 'transport_hub').map((l) => [l.slug, pick(l, 'name')])];
  const paintDays = () => {
    clear(daysBox);
    if (!st.days.length) {
      daysBox.append(h('p', { class: 'muted' }, hi ? 'ऊपर अपनी पसंद चुनकर "प्लान सुझाएँ" दबाइए।' : 'Choose your preferences above and tap “Suggest a plan”.'));
      return;
    }
    st.days.forEach((d, i) => {
      const title = input({ value: (hi && d.title_hi) || d.title || '', 'aria-label': `${t('day')} ${i + 1}` });
      const plan = textarea({ rows: 2 }, (hi && d.plan_hi) || d.plan || '');
      const loc = select(placeOpts, d.location || '');
      title.addEventListener('input', () => { d.title = title.value; d.title_hi = title.value; saveDraft(collect()); });
      plan.addEventListener('input', () => { d.plan = plan.value; d.plan_hi = plan.value; saveDraft(collect()); });
      loc.addEventListener('change', () => { d.location = loc.value; saveDraft(collect()); });
      daysBox.append(h('div', { class: 'day-card' },
        h('div', { class: 'day-num' }, `${t('day')} ${i + 1}`),
        h('div', { class: 'day-fields' }, title, plan, loc),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('delete'), onclick: () => {
          st.days.splice(i, 1); st.days.forEach((x, j) => { x.day = j + 1; }); saveDraft(collect()); paintDays(); } }, '✕')));
    });
    daysBox.append(h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => {
      st.days.push({ day: st.days.length + 1, title: '', plan: '', location: '' }); paintDays(); } }, `+ ${t('day')}`));
    daysBox.append(staysHint());
  };

  const staysHint = () => {
    const slugs = [...new Set(st.days.map((d) => d.location).filter(Boolean))];
    if (!slugs.length) return '';
    return h('div', { class: 'soft-note' }, hi ? 'इन जगहों पर ठहरने और घूमने के विकल्प: ' : 'Stays and experiences for these places: ',
      slugs.map((s) => { const l = locationBySlug(s); return l ? h('a', { class: 'chip chip-link', href: `#/place/${s}` }, pick(l, 'name')) : null; }));
  };

  const suggestBtn = h('button', { type: 'button', class: 'btn', onclick: () => {
    collect();
    const res = suggest({ days: st.days_count, region: st.region, themeSlugs: st.theme_slugs, itins, locs, startSlug: query.place });
    st.days = res.days;
    st.from_itinerary_id = res.fromItinerary?.id || null;
    if (!st.title) titleIn.value = st.title = res.fromItinerary ? pick(res.fromItinerary, 'title') : (hi ? 'मेरी उत्तराखंड यात्रा' : 'My Uttarakhand trip');
    saveDraft(st);
    paintDays();
    daysBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } }, t('build_plan'));

  const saveBtn = h('button', { type: 'button', class: 'btn btn-accent', onclick: () => saveTrip() }, t('save_trip'));
  async function saveTrip() {
    collect();
    if (!user()) { saveDraft(st); location.hash = '#/login?next=plan/quick'; return; }
    if (!st.days.length) { toast(hi ? 'पहले प्लान बनाइए' : 'Build a plan first', 'warn'); return; }
    await busy(saveBtn, async () => {
      const row = {
        title: st.title || (hi ? 'मेरी यात्रा' : 'My trip'), start_date: st.start_date || null, days_count: st.days.length,
        travellers: st.travellers, budget: st.budget === '' ? null : st.budget, theme_slugs: st.theme_slugs,
        from_itinerary_id: st.from_itinerary_id, days: st.days,
      };
      const saved = await q(sb.from('trips').insert(row).select().single());
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      toast(t('saved'));
      location.hash = `#/trip/${saved.id}`;
    });
  }

  if (!st.days.length && query.place) suggestBtn.click();
  paintDays();

  return h('div', { class: 'page' },
    h('p', { class: 'eyebrow' }, t('nav_planner')),
    h('h1', {}, hi ? 'अपनी उत्तराखंड यात्रा प्लान करें' : 'Plan your Uttarakhand trip'),
    h('p', { class: 'lead' }, hi ? 'अपनी पसंद बताइए, हम दिन-ब-दिन प्लान सुझाएँगे। फिर उसे जैसा चाहें बदलिए और सेव कीजिए।'
      : 'Tell us what you like and we suggest a day-by-day plan. Change anything, then save it.'),
    h('div', { class: 'panel planner-form' },
      field(t('trip_title'), titleIn),
      h('div', { class: 'row3' }, field(t('start'), startIn), field(t('days'), daysIn), field(t('travellers'), travIn)),
      h('div', { class: 'row2' }, field(t('region'), regionIn), field(t('budget'), budgetIn)),
      field(t('interests'), themeBox),
      h('div', { class: 'actions' }, suggestBtn)),
    h('h2', {}, hi ? 'आपका प्लान' : 'Your plan'),
    daysBox,
    h('div', { class: 'actions sticky-actions' }, saveBtn));
}

export async function trip({ params }) {
  if (!user()) { location.hash = `#/login?next=trip/${params.id}`; return h('div'); }
  const tr = await q(sb.from('trips').select('*').eq('id', params.id).maybeSingle());
  if (!tr) return empty();
  await locations();
  const hi = getLang() === 'hi';
  const del = h('button', { class: 'btn btn-danger btn-sm', onclick: async () => {
    if (!confirm(hi ? 'यह यात्रा हटाएँ?' : 'Delete this trip?')) return;
    await busy(del, async () => { await q(sb.from('trips').delete().eq('id', tr.id)); toast(t('deleted')); location.hash = '#/account'; });
  } }, t('delete'));
  const share = h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
    const text = `${tr.title}\n` + tr.days.map((d) => `${t('day')} ${d.day}: ${(hi && d.title_hi) || d.title}`).join('\n');
    if (navigator.share) navigator.share({ title: tr.title, text }).catch(() => {});
    else { await navigator.clipboard?.writeText(text); toast(hi ? 'कॉपी हो गया' : 'Copied'); }
  } }, hi ? 'शेयर करें' : 'Share');
  return h('div', { class: 'page narrow' },
    h('p', { class: 'eyebrow' }, [tr.start_date && fmtDate(tr.start_date), `${tr.days_count} ${t('days')}`, `${tr.travellers} ${t('travellers')}`, tr.budget && inr(tr.budget)].filter(Boolean).join(' · ')),
    h('h1', {}, tr.title),
    h('div', { class: 'actions' }, share, del),
    h('ol', { class: 'timeline' }, tr.days.map((d) => {
      const l = locationBySlug(d.location);
      return h('li', {}, h('div', { class: 'timeline-day' }, `${t('day')} ${d.day}`),
        h('div', {}, h('h3', {}, (hi && d.title_hi) || d.title), h('p', {}, (hi && d.plan_hi) || d.plan),
          l ? h('a', { class: 'chip chip-link', href: `#/place/${l.slug}` }, `📍 ${pick(l, 'name')}`) : null));
    })));
}
