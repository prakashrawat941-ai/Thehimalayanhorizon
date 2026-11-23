// Vehicle catalog (makes → models → variants), vehicle pictures with honest labels,
// and the searchable vehicle picker used by drivers.
// Pictures: only admin-approved images (Wikimedia Commons with credit, or owner photos).
// No exact match → same model, labelled "Representative image" → clean category drawing.
import { h, clear, icon } from '../ui.js';
import { getLang } from '../i18n.js';
import { sb, q } from '../sb.js';

const L = (en, hi) => (getLang() === 'hi' ? hi : en);
let cat = null;

export async function catalog() {
  if (cat) return cat;
  const [makes, models, variants, images] = await Promise.all([
    q(sb.from('vehicle_makes').select('id,name').eq('is_active', true).order('name')).catch(() => []),
    q(sb.from('vehicle_models').select('id,make_id,name,category').eq('is_active', true).order('name')).catch(() => []),
    q(sb.from('vehicle_variants').select('id,model_id,model_year,variant,seats_total,passenger_seats,is_verified').eq('is_active', true)).catch(() => []),
    q(sb.from('vehicle_images').select('id,model_id,variant_id,model_year,angle,url,source_url,author,licence,is_generic,sort').eq('status', 'approved').order('sort')).catch(() => []),
  ]);
  const makeById = Object.fromEntries((makes || []).map((m) => [m.id, m]));
  const full = (models || []).map((m) => ({ ...m, make: makeById[m.make_id]?.name || '', label: `${makeById[m.make_id]?.name || ''} ${m.name}`.trim() }));
  cat = { makes: makes || [], models: full, variants: variants || [], images: images || [] };
  return cat;
}
export const resetCatalog = () => { cat = null; };

// Find the catalog model for a saved vehicle/ride name such as "Maruti Suzuki Ertiga" or "Maruti Ertiga".
export function modelFor(name, c = cat) {
  if (!c || !name) return null;
  const n = String(name).toLowerCase().replace(/\s+/g, ' ').trim();
  return c.models.find((m) => m.label.toLowerCase() === n)
    || c.models.filter((m) => n.includes(m.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0] || null;
}

// Best picture: exact variant/year → same model (labelled) → none (drawing).
export function pictureFor(model, { variantId = null, angle = 'front_34' } = {}, c = cat) {
  if (!c || !model) return null;
  const imgs = c.images.filter((i) => i.model_id === model.id);
  const pickAngle = (list) => list.find((i) => i.angle === angle) || list[0] || null;
  const exact = variantId ? pickAngle(imgs.filter((i) => i.variant_id === variantId && !i.is_generic)) : null;
  if (exact) return { ...exact, exact: true };
  const any = pickAngle(imgs);
  return any ? { ...any, exact: false } : null;
}

const SHAPES = {
  hatchback: 'M14 46h6c1-7 6-11 12-11s11 4 12 11h28c1-7 6-11 12-11s11 4 12 11h4c3 0 4-2 4-5v-6c0-3-2-5-5-6l-12-3-12-11c-2-2-5-3-8-3H40c-4 0-7 1-10 4l-9 10-6 2c-3 1-4 3-4 6v6c0 3 1 5 3 5z',
  sedan: 'M10 46h8c1-7 6-11 12-11s11 4 12 11h32c1-7 6-11 12-11s11 4 12 11h6c2 0 3-2 3-4v-7c0-2-2-4-4-4l-14-2-12-10c-3-2-6-3-9-3H46c-4 0-7 1-10 4l-9 9-13 2c-3 1-5 3-5 6v5c0 2 1 4 1 4z',
  suv: 'M12 46h6c1-7 6-11 12-11s11 4 12 11h32c1-7 6-11 12-11s11 4 12 11h6c2 0 4-2 4-4V30c0-3-2-5-5-6l-8-2-9-11c-2-2-4-3-7-3H34c-3 0-5 1-7 3l-8 11-6 2c-3 1-4 3-4 6v12c0 2 1 4 3 4z',
  muv: 'M8 46h8c1-7 6-11 12-11s11 4 12 11h38c1-7 6-11 12-11s11 4 12 11h6c2 0 3-2 3-4v-9c0-3-2-5-5-5l-12-2-10-12c-2-2-5-3-8-3H34c-4 0-7 1-9 4l-9 11-6 2c-3 1-4 3-4 6v8c0 2 1 4 2 4z',
  van: 'M8 46h8c1-7 6-11 12-11s11 4 12 11h38c1-7 6-11 12-11s11 4 12 11h8c2 0 3-2 3-4V18c0-4-3-7-7-7H30c-4 0-7 2-9 5L12 30l-4 2c-2 1-3 3-3 5v5c0 2 1 4 3 4z',
  tempo_traveller: 'M4 46h10c1-7 6-11 12-11s11 4 12 11h46c1-7 6-11 12-11s11 4 12 11h6c2 0 3-2 3-4V16c0-4-3-7-7-7H26c-4 0-7 2-9 6L8 30l-3 1c-2 1-3 3-3 5v6c0 2 1 4 2 4z',
};
SHAPES.other = SHAPES.sedan;
const CAT_LABEL = { hatchback: L('Hatchback', 'हैचबैक'), sedan: L('Sedan', 'सेडान'), suv: 'SUV', muv: 'MUV', van: L('Van', 'वैन'), tempo_traveller: L('Tempo Traveller', 'टेम्पो ट्रैवलर'), other: L('Car', 'कार') };

function drawing(category = 'other') {
  const el = h('div', { class: 'veh-draw', 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 130 56"><path d="${SHAPES[category] || SHAPES.other}"/><circle cx="30" cy="46" r="8"/><circle cx="${category === 'tempo_traveller' ? 96 : category === 'hatchback' ? 84 : 86}" cy="46" r="8"/></svg>`;
  return el;
}

// Picture block with honest caption. size: 'lg' (picker, ride page) or 'sm' (cards).
export function vehicleVisual(name, { variantId = null, size = 'lg', model = null } = {}) {
  const box = h('figure', { class: `veh-vis veh-${size}` });
  const paint = () => {
    const m = model || modelFor(name);
    const pic = pictureFor(m, { variantId });
    clear(box);
    if (pic) {
      const img = h('img', { src: pic.url, alt: m ? m.label : name || '', loading: 'lazy', decoding: 'async', width: 480, height: 300, referrerpolicy: 'no-referrer' });
      img.addEventListener('error', () => { img.replaceWith(drawing(m?.category)); });
      box.append(img);
      if (size === 'lg') {
        box.append(h('figcaption', {},
          pic.exact ? null : h('span', { class: 'veh-tag' }, L('Representative image', 'प्रतिनिधि तस्वीर')),
          h('span', { class: 'veh-credit' }, [pic.author && `${L('Photo', 'फ़ोटो')}: ${pic.author}`, pic.licence].filter(Boolean).join(' · '),
            pic.source_url ? [' · ', h('a', { href: pic.source_url, target: '_blank', rel: 'noopener' }, L('source', 'स्रोत'))] : null)));
      } else if (!pic.exact) box.append(h('span', { class: 'veh-tag sm' }, L('Representative', 'प्रतिनिधि')));
    } else {
      box.append(drawing(m?.category));
      if (size === 'lg') box.append(h('figcaption', {}, h('span', { class: 'veh-tag soft' }, `${m ? CAT_LABEL[m.category] || '' : ''}${m ? ' · ' : ''}${L('Photo coming soon', 'फ़ोटो जल्द')}`)));
    }
  };
  if (cat) paint(); else { box.append(drawing()); catalog().then(paint).catch(() => {}); }
  return box;
}

// Searchable picker. Returns { el, value() } where value() gives the vehicle row or { error }.
const TYPE_SLUG = { swift: 'swift', 'wagon r': 'wagonr', ertiga: 'ertiga', bolero: 'bolero', eeco: 'eeco' };
export function vehiclePicker(v = {}, { regInput, acInput } = {}) {
  const st = { model: null, variant: null, manual: false };
  const search = h('input', { class: 'input', id: 'vh-search', type: 'search', autocomplete: 'off', placeholder: L('Type company or model, e.g. Ertiga', 'कंपनी या मॉडल लिखें, जैसे Ertiga'), 'aria-controls': 'vh-results' });
  const makeSel = h('select', { class: 'input', id: 'vh-make', 'aria-label': L('Company', 'कंपनी') }, h('option', { value: '' }, L('All companies', 'सभी कंपनियाँ')));
  const results = h('div', { class: 'vh-results', id: 'vh-results', role: 'listbox' });
  const chosen = h('div', { class: 'vh-chosen' });
  const variants = h('div', { class: 'vh-variants' });
  const seatsNote = h('p', { class: 'small' });
  const manualModel = h('input', { class: 'input', id: 'vh-model', value: '', placeholder: 'e.g. Force Urbania' });
  const manualSeats = h('input', { class: 'input', id: 'vh-seats', type: 'number', min: 1, max: 12, value: 4 });
  const manualBox = h('div', { class: 'stack', hidden: true },
    h('div', { class: 'row2' },
      h('label', { class: 'field', for: 'vh-model' }, h('span', { class: 'field-label' }, L('Company and model', 'कंपनी और मॉडल')), manualModel),
      h('label', { class: 'field', for: 'vh-seats' }, h('span', { class: 'field-label' }, L('Passenger seats', 'यात्री सीटें')), manualSeats)),
    h('p', { class: 'small muted' }, L('Cars not in the list are checked by our team before your first ride.', 'जो गाड़ियाँ सूची में नहीं हैं, उन्हें हमारी टीम पहली राइड से पहले जाँचेगी।')));
  const toggleManual = h('button', { type: 'button', class: 'link-btn small' }, L('My car is not in the list', 'मेरी गाड़ी सूची में नहीं है'));

  function list() {
    const c = cat; if (!c) return;
    const t = search.value.trim().toLowerCase();
    const words = t.split(/\s+/).filter(Boolean);
    let found = c.models.filter((m) => (!makeSel.value || m.make_id === makeSel.value) && words.every((w) => m.label.toLowerCase().includes(w)));
    if (!found.length && t.length >= 3) { // small spelling mistakes: compare letters in order
      const loose = (s) => s.replace(/[^a-z0-9]/g, '');
      found = c.models.filter((m) => { const a = loose(m.label.toLowerCase()); let i = 0; for (const ch of loose(t)) { i = a.indexOf(ch, i); if (i < 0) return false; i += 1; } return true; });
    }
    clear(results);
    if (st.model && !t) { results.hidden = true; return; }
    results.hidden = false;
    found.slice(0, 12).forEach((m) => results.append(h('button', { type: 'button', role: 'option', class: 'vh-opt', onclick: () => pick(m) },
      vehicleVisual(m.label, { size: 'sm', model: m }), h('span', {}, h('strong', {}, m.name), h('small', {}, `${m.make} · ${CAT_LABEL[m.category] || ''}`)))));
    if (!found.length) results.append(h('p', { class: 'small muted' }, L('No match. Check the spelling, choose a company, or add your car below.', 'कुछ नहीं मिला। स्पेलिंग देखें, कंपनी चुनें या नीचे अपनी गाड़ी जोड़ें।')));
  }
  function pick(m, variantId = null) {
    st.model = m; st.manual = false; manualBox.hidden = true; search.value = '';
    const vs = cat.variants.filter((x) => x.model_id === m.id).sort((a, b) => a.seats_total - b.seats_total);
    st.variant = vs.find((x) => x.id === variantId) || (vs.length === 1 ? vs[0] : null);
    clear(chosen).append(vehicleVisual(m.label, { model: m, variantId: st.variant?.id }),
      h('div', { class: 'vh-chosen-txt' }, h('strong', {}, m.label), h('span', { class: 'small muted' }, CAT_LABEL[m.category] || ''),
        h('button', { type: 'button', class: 'link-btn small', onclick: () => { st.model = null; st.variant = null; clear(chosen); clear(variants); seatsNote.textContent = ''; list(); search.focus(); } }, L('Change', 'बदलें'))));
    clear(variants);
    if (vs.length > 1) {
      variants.append(h('span', { class: 'field-label' }, L('Seating layout', 'सीटों की व्यवस्था')));
      vs.forEach((x) => variants.append(h('button', { type: 'button', class: `chip-btn${st.variant?.id === x.id ? ' on' : ''}`, 'aria-pressed': String(st.variant?.id === x.id),
        onclick: () => pick(m, x.id) }, `${x.variant}${x.model_year ? ` · ${x.model_year}` : ''}`)));
    }
    seatsNote.textContent = st.variant
      ? L(`${st.variant.passenger_seats} passenger seats (${st.variant.seats_total}-seater, driver not counted)${st.variant.is_verified ? '' : ' · to be confirmed by our team'}`,
          `${st.variant.passenger_seats} यात्री सीटें (${st.variant.seats_total}-सीटर, ड्राइवर शामिल नहीं)${st.variant.is_verified ? '' : ' · हमारी टीम पुष्टि करेगी'}`)
      : L('Choose the seating layout of your car.', 'अपनी गाड़ी की सीट व्यवस्था चुनें।');
    list();
  }
  toggleManual.addEventListener('click', () => { st.manual = !st.manual; manualBox.hidden = !st.manual; if (st.manual) { st.model = null; st.variant = null; clear(chosen); clear(variants); seatsNote.textContent = ''; manualModel.focus(); } });
  search.addEventListener('input', list);
  makeSel.addEventListener('change', list);

  catalog().then((c) => {
    c.makes.forEach((m) => makeSel.append(h('option', { value: m.id }, m.name)));
    const vv = v.variant_id && c.variants.find((x) => x.id === v.variant_id);
    const mm = vv ? c.models.find((m) => m.id === vv.model_id) : null;
    if (mm) pick(mm, vv.id); else if (v.model) { st.manual = true; manualBox.hidden = false; manualModel.value = v.model; manualSeats.value = v.seats || 4; } else list();
  });

  return {
    el: h('div', { class: 'stack vh-picker' },
      h('div', { class: 'row2' },
        h('label', { class: 'field', for: 'vh-search' }, h('span', { class: 'field-label' }, L('Find your car', 'अपनी गाड़ी खोजें')), search),
        h('label', { class: 'field', for: 'vh-make' }, h('span', { class: 'field-label' }, L('Company', 'कंपनी')), makeSel)),
      results, chosen, variants, seatsNote, toggleManual, manualBox),
    value() {
      if (st.manual) {
        const seats = Number(manualSeats.value);
        if (manualModel.value.trim().length < 2) return { error: L('Please enter the car company and model.', 'गाड़ी की कंपनी और मॉडल लिखें।') };
        if (!(seats >= 1 && seats <= 12)) return { error: L('Seats must be between 1 and 12.', 'सीटें 1 से 12 के बीच हों।') };
        return { row: { vehicle_type: 'other', model: manualModel.value.trim(), seats, variant_id: null } };
      }
      if (!st.model) return { error: L('Please choose your car from the list.', 'सूची से अपनी गाड़ी चुनें।') };
      if (!st.variant) return { error: L('Please choose the seating layout.', 'सीटों की व्यवस्था चुनें।') };
      return { row: { vehicle_type: TYPE_SLUG[st.model.name.toLowerCase()] || 'other', model: st.model.label.slice(0, 80), seats: st.variant.passenger_seats, variant_id: st.variant.id } };
    },
  };
}
