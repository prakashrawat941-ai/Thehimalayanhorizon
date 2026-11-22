// Partner portal: registration, listings, cab rides and incoming requests.
import { h, toast, empty, badge, fmtDate, inr, modal, busy, lazy, section, clear } from '../ui.js';
import { t, pick, getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
import { state, user, loadProfile, locations, themes, locationById } from '../store.js';
import { buildForm } from '../forms.js';
import { SCHEMAS, partnerSchema, CATEGORY_LABELS } from '../schemas.js';
import { KINDS } from './listings.js';

const hi = () => getLang() === 'hi';

export async function join() {
  if (!user()) { location.hash = '#/login?next=partner/join&mode=signup'; return h('div'); }
  await locations();
  const page = h('div', { class: 'page narrow' },
    h('h1', {}, t('become_partner')),
    h('p', { class: 'lead' }, hi()
      ? 'होमस्टे, कैब, वर्कस्पेस या गाँव का टूर: अपनी जानकारी भरिए। एडमिन जाँच कर मंज़ूरी देंगे, फिर आप अपनी लिस्टिंग और राइड डाल सकेंगे।'
      : 'Homestay, cab, workspace or village tour: fill in your details. The admin checks and approves, then you can add listings and rides.'));
  if (state.partners.length) {
    page.append(h('div', { class: 'soft-note' }, hi() ? 'आपका पार्टनर आवेदन पहले से है। ' : 'You already have a partner application. ',
      h('a', { href: '#/partner' }, hi() ? 'डैशबोर्ड देखें' : 'Open dashboard')));
  }
  const form = buildForm(partnerSchema(false), {
    contact_name: state.profile?.full_name || '', phone: state.profile?.phone || '', email: user().email, categories: ['homestay'],
  }, {
    ctx: { locations: state.locations },
    submitLabel: hi() ? 'आवेदन भेजें' : 'Submit application',
    onSubmit: async (data) => {
      if (!data.categories.length) throw new Error(hi() ? 'कम से कम एक कैटेगरी चुनें' : 'Pick at least one category');
      await q(sb.from('partners').insert({ ...data, owner_id: user().id }));
      await loadProfile();
      toast(hi() ? 'आवेदन भेज दिया! मंज़ूरी के बाद सूचना मिलेगी।' : 'Application sent! You will be notified after approval.');
      location.hash = '#/partner';
    },
  });
  page.append(h('div', { class: 'panel' }, form));
  return page;
}

export async function dashboard({ params, query = {} }) {
  if (!user()) { location.hash = '#/login?next=partner'; return h('div'); }
  await Promise.all([locations(), themes()]);
  if (!state.partners.length) { location.hash = '#/partner/join'; return h('div'); }
  const partner = state.partners.find((p) => p.status === 'approved') || state.partners[0];
  const cats = partner.categories;
  const tab = params.tab || 'overview';
  const host = await import('./host.js');
  const isHost = cats.includes('homestay');
  const [newReq, kycRow] = await Promise.all([
    q(sb.from('booking_requests').select('id').eq('partner_id', partner.id).eq('status', 'requested')).then((r) => r.length).catch(() => 0),
    isHost ? q(sb.from('partner_kyc').select('status').eq('partner_id', partner.id).maybeSingle()).catch(() => null) : null,
  ]);
  const L2 = (en, hiTxt) => (hi() ? hiTxt : en);
  const it = (key, ic, label, count) => ({ key, icon: ic, label, href: `#/partner/${key}`, count });
  const groups = [
    isHost ? { label: L2('Homestay', 'होमस्टे'), items: [
      it('overview', 'grid', L2('Overview', 'सारांश')), it('properties', 'layers', L2('My properties', 'मेरी प्रॉपर्टी')),
      it('calendar', 'calendar', L2('Rate calendar', 'रेट कैलेंडर')), it('bookings', 'users', L2('Bookings', 'बुकिंग'), newReq),
      it('earnings', 'chart', L2('Earnings & payouts', 'कमाई और पेआउट')), it('kyc', 'doc', L2('KYC & bank', 'KYC और बैंक'), !kycRow || kycRow.status === 'rejected' ? 1 : 0),
      it('support', 'support', L2('Support', 'सपोर्ट'))] } : { label: '', items: [it('overview', 'grid', L2('Overview', 'सारांश')), it('support', 'support', L2('Support', 'सपोर्ट'))] },
    { label: L2('Other services', 'अन्य सेवाएँ'), items: [
      ...(cats.includes('workspace') ? [it('workspace', 'layers', t('workspaces'))] : []),
      ...(cats.includes('village_tour') ? [it('village_tour', 'pin', hi() ? 'गाँव के टूर' : 'Village tours')] : []),
      ...(cats.includes('cab') ? [it('rides', 'route', hi() ? 'कैब राइड' : 'Cab rides')] : []),
      ...(cats.some((c) => c === 'workspace' || c === 'village_tour') ? [it('requests', 'bell', hi() ? 'टूर / वर्कस्पेस रिक्वेस्ट' : 'Tour & workspace requests')] : []),
      it('profile', 'settings', t('profile'))] },
  ];
  const sub = params.id;
  const body = tab === 'overview' ? (isHost ? lazy(() => host.overview(partner)) : overview(partner))
    : tab === 'properties' ? lazy(() => (sub ? host.propertyForm(partner, sub) : host.properties(partner)))
    : tab === 'calendar' ? lazy(() => host.calendar(partner, query))
    : tab === 'bookings' ? lazy(() => host.bookings(partner, query))
    : tab === 'earnings' ? lazy(() => host.earnings(partner))
    : tab === 'kyc' ? lazy(() => host.kyc(partner))
    : tab === 'support' ? lazy(() => host.support(partner, query))
    : tab === 'requests' ? lazy(() => requests(partner))
    : tab === 'rides' ? lazy(() => rides(partner))
    : tab === 'profile' ? profileTab(partner)
    : tab === 'homestay' ? (location.hash = '#/partner/properties', h('div'))
    : KINDS[tab] ? lazy(() => listings(partner, tab)) : empty();
  const titles = { overview: L2('Overview', 'सारांश'), properties: sub ? (sub === 'new' ? L2('Add homestay', 'होमस्टे जोड़ें') : L2('Edit homestay', 'होमस्टे बदलें')) : L2('My properties', 'मेरी प्रॉपर्टी'),
    calendar: L2('Rate calendar', 'रेट कैलेंडर'), bookings: L2('Bookings', 'बुकिंग'), earnings: L2('Earnings & payouts', 'कमाई और पेआउट'), kyc: L2('KYC & bank details', 'KYC और बैंक'), support: L2('Support', 'सपोर्ट'),
    requests: L2('Requests', 'रिक्वेस्ट'), rides: L2('Cab rides', 'कैब राइड'), profile: t('profile') };
  const { dashShell } = await import('../shell.js');
  return dashShell({
    title: titles[tab] || partner.business_name, eyebrow: partner.business_name,
    subtitle: partner.status !== 'approved' ? (partner.status === 'pending' ? t('partner_pending') : L2('Your partner account is not approved.', 'आपका पार्टनर अकाउंट मंज़ूर नहीं है।')) + (partner.admin_note ? ` · Admin: ${partner.admin_note}` : '') : null,
    avatar: h('span', { class: 'avatar', 'aria-hidden': 'true' }, partner.business_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()),
    groups: groups.filter((g) => g.items.length), active: tab, body, brand: L2('Partner portal', 'पार्टनर पोर्टल'),
    actions: badge(partner.status),
  });
}

function overview(partner) {
  const L = CATEGORY_LABELS();
  return h('div', { class: 'grid grid-3' },
    partner.categories.map((c) => h('a', { class: 'panel stat', href: `#/partner/${c === 'cab' ? 'rides' : c}` },
      h('strong', {}, L[c]), h('span', { class: 'muted' }, hi() ? 'खोलें →' : 'Open →'))),
    h('a', { class: 'panel stat', href: '#/partner/requests' }, h('strong', {}, hi() ? 'नई रिक्वेस्ट' : 'Requests'), h('span', { class: 'muted' }, hi() ? 'देखें →' : 'View →')));
}

function profileTab(partner) {
  const form = buildForm(partnerSchema(false).filter((f) => f.name !== 'categories'), partner, {
    ctx: { locations: state.locations },
    onSubmit: async (data) => {
      await q(sb.from('partners').update(data).eq('id', partner.id));
      await loadProfile(); toast(t('saved'));
    },
  });
  return h('div', { class: 'panel' }, form);
}

async function listings(partner, kind) {
  const k = KINDS[kind];
  const rows = await q(sb.from(k.table).select('*').eq('partner_id', partner.id).order('created_at', { ascending: false }));
  const canAdd = partner.status === 'approved';
  const add = canAdd ? h('button', { class: 'btn', onclick: () => editListing(partner, kind, null) }, `+ ${t('add')}`) : null;
  return h('div', {},
    h('div', { class: 'toolbar' }, add,
      h('small', { class: 'muted' }, hi() ? 'नई या बदली गई लिस्टिंग एडमिन की मंज़ूरी के बाद वेबसाइट पर दिखेगी।' : 'New or edited listings appear on the website after admin approval.')),
    rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('tbody', {}, rows.map((r) => h('tr', {},
        h('td', {}, h('strong', {}, r[k.nameField]), h('div', { class: 'muted small' }, r.village || '')),
        h('td', {}, k.price(r)),
        h('td', {}, badge(r.status), r.admin_note ? h('div', { class: 'muted small' }, r.admin_note) : null),
        h('td', { class: 'right' },
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => editListing(partner, kind, r) }, t('edit')),
          r.status === 'approved' ? h('a', { class: 'btn btn-ghost btn-sm', href: `#/${k.route}/${r.id}` }, '👁') : null)))))) : empty());
}

function editListing(partner, kind, row) {
  const k = KINDS[kind];
  const form = buildForm(SCHEMAS[kind](false), row || {}, {
    ctx: { locations: state.locations, themes: state.themes },
    onSubmit: async (data) => {
      if (row) await q(sb.from(k.table).update(data).eq('id', row.id));
      else await q(sb.from(k.table).insert({ ...data, partner_id: partner.id }));
      dlg.close(); toast(t('saved')); location.reload();
    },
  });
  const dlg = modal(row ? t('edit') : t('add'), form, { wide: true });
}

async function rides(partner) {
  const rows = await q(sb.from('cab_rides').select('*, cab_bookings(*)').eq('partner_id', partner.id).order('departure_at', { ascending: false }).limit(100));
  const add = partner.status === 'approved' ? h('button', { class: 'btn', onclick: () => editRide(partner, null) }, `+ ${hi() ? 'नई राइड डालें' : 'Publish a ride'}`) : null;
  return h('div', {},
    h('div', { class: 'toolbar' }, add,
      h('small', { class: 'muted' }, hi() ? 'राइड तुरंत वेबसाइट पर दिखती है। यात्री सीट बुक करेंगे।' : 'Rides show on the website immediately. Travellers book seats.')),
    rows.length ? h('div', { class: 'ride-list' }, rows.map((r) => {
      const f = locationById(r.from_location_id); const to = locationById(r.to_location_id);
      return h('article', { class: 'ride ride-partner' },
        h('div', { class: 'ride-route' },
          h('div', { class: 'ride-time' }, fmtDate(r.departure_at, true)),
          h('div', { class: 'ride-places' }, h('strong', {}, f ? pick(f, 'name') : '?'), h('span', { class: 'ride-arrow' }, '→'), h('strong', {}, to ? pick(to, 'name') : '?')),
          h('div', { class: 'muted small' }, `${r.vehicle_model} · ${r.seats_booked}/${r.seats_total} ${t('seats')} · ${inr(r.price_per_seat)} ${t('per_seat')}`)),
        h('div', {}, badge(r.status)),
        h('div', { class: 'ride-book' }, h('button', { class: 'btn btn-ghost btn-sm', onclick: () => editRide(partner, r) }, t('edit'))),
        r.cab_bookings?.length ? h('div', { class: 'ride-bookings' }, r.cab_bookings.map((b) => h('div', { class: 'booking-row' },
          h('span', {}, `${b.passenger_name} · ${b.seats} ${t('seats')} · `, h('a', { href: `tel:${b.phone}` }, b.phone), b.note ? ` · ${b.note}` : ''),
          badge(b.status),
          b.status === 'pending' ? [
            h('button', { class: 'btn btn-sm', onclick: (e) => cabStatus(e.target, b.id, 'confirmed') }, t('confirm')),
            h('button', { class: 'btn btn-ghost btn-sm', onclick: (e) => cabStatus(e.target, b.id, 'declined') }, t('decline'))] : null))) : null);
    })) : empty());
}

async function cabStatus(btn, id, status) {
  await busy(btn, async () => { await q(sb.rpc('set_cab_booking_status', { p_booking: id, p_status: status })); toast(t('saved')); location.reload(); });
}

function editRide(partner, row) {
  const form = buildForm(SCHEMAS.cab_ride(), row || { auto_confirm: true, seats_total: 6 }, {
    ctx: { locations: state.locations },
    onSubmit: async (data) => {
      if (data.from_location_id === data.to_location_id) throw new Error(hi() ? 'शुरुआत और मंज़िल अलग होनी चाहिए' : 'From and To must be different');
      if (!row && new Date(data.departure_at) < new Date()) throw new Error(hi() ? 'समय आगे का होना चाहिए' : 'Departure must be in the future');
      if (row) await q(sb.from('cab_rides').update(data).eq('id', row.id));
      else await q(sb.from('cab_rides').insert({ ...data, partner_id: partner.id }));
      dlg.close(); toast(t('saved')); location.reload();
    },
  });
  const dlg = modal(row ? t('edit') : (hi() ? 'नई राइड' : 'New ride'), form, { wide: true });
}

async function requests(partner) {
  const rows = await q(sb.from('booking_requests').select('*, homestays(name), village_tours(title), workspaces(name)')
    .eq('partner_id', partner.id).order('created_at', { ascending: false }).limit(200));
  if (!rows.length) return empty();
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, ['', t('name'), t('date'), t('guests'), t('status'), ''].map((x) => h('th', {}, x)))),
    h('tbody', {}, rows.map((r) => h('tr', {},
      h('td', {}, h('strong', {}, r.homestays?.name || r.village_tours?.title || r.workspaces?.name), r.message ? h('div', { class: 'muted small' }, `“${r.message}”`) : null),
      h('td', {}, r.guest_name, h('div', {}, h('a', { href: `tel:${r.guest_phone}` }, r.guest_phone))),
      h('td', {}, fmtDate(r.start_date) + (r.end_date !== r.start_date ? ` → ${fmtDate(r.end_date)}` : '')),
      h('td', {}, r.guests),
      h('td', {}, badge(r.status)),
      h('td', { class: 'right' }, actionsFor(r)))))));
}

function actionsFor(r) {
  const act = (status, label, cls = 'btn btn-sm') => h('button', { class: cls, onclick: (e) => {
    const note = status === 'declined' ? (prompt(hi() ? 'यात्री के लिए संदेश (ज़रूरी नहीं)' : 'Message for the traveller (optional)') || '') : '';
    busy(e.target, async () => { await q(sb.rpc('set_booking_status', { p_id: r.id, p_status: status, p_note: note })); toast(t('saved')); location.reload(); });
  } }, label);
  if (r.status === 'requested') return [act('confirmed', t('confirm')), act('declined', t('decline'), 'btn btn-ghost btn-sm')];
  if (r.status === 'confirmed') return [act('completed', hi() ? 'पूरा' : 'Completed', 'btn btn-ghost btn-sm')];
  return null;
}

export { clear, section };
