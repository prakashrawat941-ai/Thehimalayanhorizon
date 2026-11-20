// Homestays, workspaces and village tours: lists, detail pages and booking requests.
import { h, card, grid, empty, inr, cover, chips, field, input, textarea, toast, busy, select, todayISO, whatsappLink, section } from '../ui.js';
import { t, pick, getLang, districtName } from '../i18n.js';
import { sb, q } from '../sb.js';
import { locations, locationById, user, state, settings } from '../store.js';

export const KINDS = {
  homestay: {
    table: 'homestays', route: 'stay', listRoute: 'stays', titleKey: 'stays', nameField: 'name',
    price: (x) => x.price_per_night ? `${inr(x.price_per_night)} ${t('per_night')}` : '',
  },
  workspace: {
    table: 'workspaces', route: 'workspace', listRoute: 'workspaces', titleKey: 'workspaces', nameField: 'name',
    price: (x) => x.price_per_day ? `${inr(x.price_per_day)} ${t('per_day')}` : '',
  },
  village_tour: {
    table: 'village_tours', route: 'tour', listRoute: 'tours', titleKey: 'villages', nameField: 'title',
    price: (x) => x.price_per_person ? `${inr(x.price_per_person)} ${t('per_person')}` : '',
  },
};

export async function fetchListings(kind, { location, limit } = {}) {
  const k = KINDS[kind];
  let query = sb.from(k.table).select('*').eq('status', 'approved')
    .order('is_featured', { ascending: false }).order('created_at', { ascending: false });
  if (location) query = query.eq('location_id', location);
  if (limit) query = query.limit(limit);
  return q(query);
}

export function listingCard(kind, x) {
  const k = KINDS[kind];
  const loc = locationById(x.location_id);
  return card({
    href: `#/${k.route}/${x.id}`, image: x.images?.[0], seed: x.id,
    title: x[k.nameField], subtitle: x.summary,
    meta: [x.village || (loc && pick(loc, 'name')), k.price(x)].filter(Boolean).join(' · '),
  });
}

export const list = (kind) => async ({ query }) => {
  const k = KINDS[kind];
  const locs = await locations();
  const rows = await fetchListings(kind, { location: query.location || undefined });
  const hi = getLang() === 'hi';
  const intro = {
    homestay: hi ? 'असली पहाड़ी घरों में ठहरिए। रिक्वेस्ट भेजिए, होस्ट कन्फर्म करेंगे।' : 'Stay in real mountain homes. Send a request and the host confirms.',
    workspace: hi ? 'तेज़ वाई-फ़ाई, पावर बैकअप और हिमालय का नज़ारा। दिन या महीने के हिसाब से।' : 'Fast Wi-Fi, power backup and a Himalayan view. By the day or the month.',
    village_tour: hi ? 'गाँव वालों के साथ गाँव घूमिए: खाना, खेती, हस्तकला और लोक परंपराएँ।' : 'Walk a village with the people who live there: food, farming, crafts and folk traditions.',
  }[kind];
  const locSel = select([['', t('all')], ...locs.filter((l) => l.kind !== 'transport_hub').map((l) => [l.id, pick(l, 'name')])],
    query.location || '', { onchange: (e) => { location.hash = `#/${k.listRoute}${e.target.value ? `?location=${e.target.value}` : ''}`; }, 'aria-label': t('explore') });
  return h('div', { class: 'page' },
    h('h1', {}, kind === 'village_tour' ? (hi ? 'गाँव के अनुभव' : 'Village experiences') : t(k.titleKey)),
    h('p', { class: 'lead' }, intro),
    h('div', { class: 'toolbar' }, locSel),
    rows.length ? grid(rows.map((x) => listingCard(kind, x)), 'grid grid-3')
      : empty(hi ? 'अभी यहाँ कोई लिस्टिंग नहीं है। होस्ट जुड़ रहे हैं।' : 'No listings here yet — hosts are joining.',
        h('a', { class: 'btn', href: '#/partner/join' }, t('become_partner'))));
};

export const detail = (kind) => async ({ params }) => {
  const k = KINDS[kind];
  await locations();
  const x = await q(sb.from(k.table).select('*').eq('id', params.id).maybeSingle());
  if (!x) return empty();
  const [hostRows, s] = await Promise.all([
    q(sb.rpc('partner_cards', { p_ids: [x.partner_id] })).catch(() => []), settings().catch(() => ({}))]);
  const host = hostRows?.[0];
  const loc = locationById(x.location_id);
  const images = (x.images || []).filter(Boolean);
  const facts = {
    homestay: [[t('rooms'), x.rooms], [t('max_guests'), x.max_guests], [t('meals'), x.meals]],
    workspace: [[t('desks'), x.desks], [t('wifi'), x.wifi_mbps ? `${x.wifi_mbps} Mbps` : ''], [t('power_backup'), x.power_backup ? '✓' : '—'],
      [t('stay_available'), x.stay_available ? '✓' : '—'], [getLang() === 'hi' ? 'महीने का' : 'Monthly', x.price_per_month ? inr(x.price_per_month) : '']],
    village_tour: [[t('duration'), `${x.duration_hours} ${t('hours')}`], [t('group_size'), x.max_group], [t('languages'), (x.languages || []).join(', ')],
      [t('best_season'), x.best_season]],
  }[kind].filter(([, v]) => v !== '' && v != null);
  const wa = whatsappLink(s?.contact?.whatsapp, `Hi! I'm interested in ${x[k.nameField]}.`);

  return h('div', { class: 'page' },
    h('div', { class: 'listing-gallery' },
      images.length ? images.slice(0, 5).map((src, i) => cover(src, x.id, i === 0 ? 'lg-main' : 'lg-thumb')) : cover(null, x.id, 'lg-main')),
    h('div', { class: 'detail-layout' },
      h('div', { class: 'detail-main' },
        h('p', { class: 'eyebrow' }, [x.village, loc && pick(loc, 'name'), districtName(loc?.district)].filter(Boolean).join(' · ')),
        h('h1', {}, x[k.nameField]),
        host ? h('p', { class: 'muted' }, `${t('hosted_by')} ${host.business_name}`) : null,
        h('p', { class: 'lead' }, x.summary),
        h('div', { class: 'facts' }, facts.map(([label, v]) => h('div', { class: 'fact' }, h('span', {}, label), h('strong', {}, String(v))))),
        x.description ? h('div', { class: 'prose' }, x.description.split(/\n{2,}/).map((p) => h('p', {}, p))) : null,
        x.culture_highlights?.length ? section(t('culture'), null, chips(x.culture_highlights)) : null,
        x.includes?.length ? section(t('includes'), null, chips(x.includes)) : null,
        x.amenities?.length ? section(t('amenities'), null, chips(x.amenities)) : null,
        x.house_rules ? section(t('house_rules'), null, h('p', { class: 'prose' }, x.house_rules)) : null),
      h('aside', { class: 'detail-side' },
        h('div', { class: 'panel sticky' },
          h('div', { class: 'price' }, k.price(x) || '—'),
          requestForm(kind, x),
          wa ? h('a', { class: 'btn btn-ghost btn-block', href: wa, target: '_blank', rel: 'noopener' }, 'WhatsApp') : null))));
};

function requestForm(kind, x) {
  const u = user();
  if (!u) {
    return h('div', {}, h('p', { class: 'muted' }, t('sign_in_needed')),
      h('a', { class: 'btn btn-block', href: `#/login?next=${encodeURIComponent(location.hash.slice(2))}` }, t('signin')));
  }
  const isTour = kind === 'village_tour';
  const start = input({ type: 'date', name: 'start_date', required: true, min: todayISO(), value: todayISO(7) });
  const end = input({ type: 'date', name: 'end_date', required: true, min: todayISO(), value: todayISO(isTour ? 7 : 9) });
  if (isTour) start.addEventListener('change', () => { end.value = start.value; });
  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form).entries());
    const row = {
      kind, guest_name: fd.guest_name, guest_phone: fd.guest_phone,
      start_date: fd.start_date, end_date: isTour ? fd.start_date : fd.end_date,
      guests: Number(fd.guests || 1), message: fd.message || '',
      [`${kind}_id`]: x.id,
    };
    if (row.end_date < row.start_date) { toast(getLang() === 'hi' ? 'आख़िरी तारीख़ शुरुआत से पहले नहीं हो सकती' : 'End date is before start date', 'err'); return; }
    await busy(form.querySelector('button[type=submit]'), async () => {
      await q(sb.from('booking_requests').insert(row));
      toast(t('request_sent'));
      form.reset();
      location.hash = '#/account';
    });
  } },
    field(t('name'), input({ name: 'guest_name', required: true, minlength: 2, value: state.profile?.full_name || '' })),
    field(t('phone'), input({ name: 'guest_phone', type: 'tel', required: true, minlength: 7, value: state.profile?.phone || '' })),
    h('div', { class: 'row2' },
      field(isTour ? t('date') : (kind === 'homestay' ? t('check_in') : t('start')), start),
      isTour ? null : field(kind === 'homestay' ? t('check_out') : t('end'), end)),
    field(t('guests'), input({ name: 'guests', type: 'number', min: 1, max: 50, value: 2, required: true })),
    field(t('message'), textarea({ name: 'message', rows: 3, maxlength: 1000 })),
    h('button', { class: 'btn btn-block', type: 'submit' }, t('request_booking')),
    h('small', { class: 'muted' }, getLang() === 'hi' ? 'अभी कोई पेमेंट नहीं। होस्ट कन्फर्म करेंगे।' : 'No payment now. The host will confirm.'));
  return form;
}
