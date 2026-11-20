// Admin portal: approvals, partners, listings, rides, requests, home page,
// locations, themes, itineraries, users and site settings.
import { h, toast, empty, badge, fmtDate, inr, modal, busy, lazy, field, input, select, icon } from '../ui.js';
import { dashShell, statCard } from '../shell.js';
import { t, pick, getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
import { state, user, isAdmin, resetCache, locations, themes, locationById } from '../store.js';
import { buildForm, slugify } from '../forms.js';
import { SCHEMAS, partnerSchema, CATEGORY_LABELS } from '../schemas.js';
import { KINDS } from './listings.js';

const hi = () => getLang() === 'hi';
const L = (en, h2) => (hi() ? h2 : en);
const refresh = () => { resetCache(); location.reload(); };

export async function admin({ params, query }) {
  if (!user()) { location.hash = '#/login?next=admin'; return h('div'); }
  if (!isAdmin()) return h('div', { class: 'page narrow' }, h('h1', {}, t('admin')), h('p', {}, L('This area is for admins only.', 'यह हिस्सा सिर्फ़ एडमिन के लिए है।')));
  await Promise.all([locations(), themes()]);
  // Admin needs unpublished locations too
  const allLocs = await q(sb.from('locations').select('*').order('position'));
  const ctx = { locations: allLocs, themes: await q(sb.from('themes').select('*').order('position')) };
  const tab = params.tab || 'overview';
  const views = {
    overview: () => overview(), partners: () => partners(ctx, query), rides: () => rides(), requests: () => requests(),
    home: () => crud('home_sections', SCHEMAS.home_section(), ctx, { order: 'position', title: (r) => `${r.position}. ${r.kind} — ${pick(r, 'title') || '…'}`, flag: 'enabled' }),
    locations: () => crud('locations', SCHEMAS.location(), ctx, { order: 'position', title: (r) => `${pick(r, 'name')} · ${r.kind} · ${r.district}`, flag: 'is_published', slugFrom: 'name' }),
    themes: () => crud('themes', SCHEMAS.theme(), ctx, { order: 'position', title: (r) => `${r.icon} ${pick(r, 'name')}`, flag: 'is_published', slugFrom: 'name' }),
    itineraries: () => crud('itineraries', SCHEMAS.itinerary(), ctx, { order: 'position', title: (r) => `${pick(r, 'title')} · ${r.days_count || r.days?.length} ${t('days')}`, flag: 'is_published', slugFrom: 'title',
      beforeSave: (d) => ({ ...d, days_count: Math.max(1, (d.days || []).length) }) }),
    users: () => users(), settings: () => settingsTab(),
    trips: () => import('../trip/admin.js').then((m) => m.tripAdmin()),
  };
  const body = KINDS[tab] ? lazy(() => listingsAdmin(tab, ctx, query)) : lazy(views[tab] || (() => empty()));

  // Counters for items waiting for the admin (real counts; 0 hides the badge).
  const safeCount = (table, f) => count(table, f).catch(() => 0);
  const [pp, ph, pw, pt, rq, rv] = await Promise.all([
    safeCount('partners', (x) => x.eq('status', 'pending')), safeCount('homestays', (x) => x.eq('status', 'pending')),
    safeCount('workspaces', (x) => x.eq('status', 'pending')), safeCount('village_tours', (x) => x.eq('status', 'pending')),
    safeCount('booking_requests', (x) => x.eq('status', 'requested')), safeCount('destination_reviews', (x) => x.eq('status', 'pending'))]);
  const it = (key, ic, label, count) => ({ key, href: `#/admin/${key}`, icon: ic, label, count });
  const groups = [
    { items: [it('overview', 'grid', L('Dashboard', 'डैशबोर्ड'))] },
    { label: L('People', 'लोग'), items: [it('users', 'users', L('Users', 'यूज़र')), it('partners', 'shield', L('Partners', 'पार्टनर'), pp)] },
    { label: L('Listings', 'लिस्टिंग'), items: [it('homestay', 'house', t('stays'), ph), it('workspace', 'desk', t('workspaces'), pw), it('village_tour', 'people', L('Village tours', 'गाँव के टूर'), pt)] },
    { label: L('Bookings', 'बुकिंग'), items: [it('requests', 'calendar', L('Booking requests', 'बुकिंग रिक्वेस्ट'), rq), it('rides', 'car', L('Cab journeys', 'कैब यात्राएँ'))] },
    { label: L('Content', 'कंटेंट'), items: [it('home', 'home', L('Home page', 'होम पेज')), it('locations', 'mountain', L('Locations', 'लोकेशन')), it('themes', 'layers', L('Experiences', 'अनुभव')), it('itineraries', 'route', t('itineraries'))] },
    { label: L('Insights', 'जानकारी'), items: [it('trips', 'chart', L('Trip Planner', 'ट्रिप प्लानर'), rv)] },
    { label: L('System', 'सिस्टम'), items: [it('settings', 'settings', L('Settings', 'सेटिंग्स'))] },
  ];
  const name = state.profile?.full_name?.split(' ')[0] || '';
  return dashShell({
    title: tab === 'overview' ? (L(`Namaste${name ? `, ${name}` : ''}`, `नमस्ते${name ? ` ${name}` : ''}`)) : (groups.flatMap((g) => g.items).find((x) => x.key === tab)?.label || t('admin')),
    eyebrow: L('Admin', 'एडमिन'),
    subtitle: tab === 'overview' ? L('What needs your attention today.', 'आज किस पर ध्यान देना है।') : null,
    groups, active: tab, body, brand: L('Admin', 'एडमिन'),
  });
}

async function count(table, filter) {
  let qy = sb.from(table).select('id', { count: 'exact', head: true });
  if (filter) qy = filter(qy);
  const { count: c, error } = await qy;
  if (error) throw error;
  return c || 0;
}

async function overview() {
  const [pp, ph, pw, pt, rq, rides, users] = await Promise.all([
    count('partners', (x) => x.eq('status', 'pending')), count('homestays', (x) => x.eq('status', 'pending')),
    count('workspaces', (x) => x.eq('status', 'pending')), count('village_tours', (x) => x.eq('status', 'pending')),
    count('booking_requests', (x) => x.eq('status', 'requested')), count('cab_rides', (x) => x.eq('status', 'open')), count('profiles')]);
  const waiting = pp + ph + pw + pt;
  // Latest items waiting for approval (real rows).
  const [wp, wh, ww, wt] = await Promise.all([
    q(sb.from('partners').select('id,business_name,created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5)).catch(() => []),
    q(sb.from('homestays').select('id,name,created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5)).catch(() => []),
    q(sb.from('workspaces').select('id,name,created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5)).catch(() => []),
    q(sb.from('village_tours').select('id,name,created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5)).catch(() => [])]);
  const rows = [
    ...wp.map((r) => ({ name: r.business_name, kind: L('Partner', 'पार्टनर'), ic: 'shield', at: r.created_at, href: '#/admin/partners?status=pending' })),
    ...wh.map((r) => ({ name: r.name, kind: t('stays'), ic: 'house', at: r.created_at, href: '#/admin/homestay?status=pending' })),
    ...ww.map((r) => ({ name: r.name, kind: t('workspaces'), ic: 'desk', at: r.created_at, href: '#/admin/workspace?status=pending' })),
    ...wt.map((r) => ({ name: r.name, kind: L('Village tour', 'गाँव टूर'), ic: 'people', at: r.created_at, href: '#/admin/village_tour?status=pending' })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 8);
  return h('div', { class: 'ds-body' },
    h('div', { class: 'ds-stats' },
      statCard('shield', L('Waiting for approval', 'मंज़ूरी बाकी'), waiting, '#/admin/partners?status=pending', waiting ? 'urgent' : ''),
      statCard('calendar', L('Open booking requests', 'खुली बुकिंग रिक्वेस्ट'), rq, '#/admin/requests', rq ? 'urgent' : ''),
      statCard('car', L('Open cab journeys', 'खुली कैब यात्राएँ'), rides, '#/admin/rides'),
      statCard('users', L('Registered users', 'रजिस्टर्ड यूज़र'), users, '#/admin/users')),
    h('div', { class: 'ds-cols' },
      h('section', { class: 'ds-panel' }, h('h2', {}, L('Waiting for your approval', 'आपकी मंज़ूरी का इंतज़ार')),
        rows.length ? h('div', { class: 'ds-rows' }, rows.map((r) => h('a', { class: 'ds-row', href: r.href },
          h('span', { class: 'ds-row-ico' }, icon(r.ic, 20)), h('span', { class: 'grow' }, h('strong', {}, r.name), h('span', {}, `${r.kind} · ${fmtDate(r.at)}`)),
          h('span', { class: 'pill pill-warn' }, L('Pending', 'बाकी')))))
          : empty(L('Nothing waiting. New partners and listings will show here.', 'कुछ बाकी नहीं। नए पार्टनर और लिस्टिंग यहाँ दिखेंगे।'), null, 'check')),
      h('section', { class: 'ds-panel' }, h('h2', {}, L('Quick links', 'जल्दी पहुँचें')),
        h('div', { class: 'ds-rows' },
          [['home', 'home', L('Edit the home page', 'होम पेज बदलें'), L('Text, order and which blocks show', 'टेक्स्ट, क्रम और कौन से हिस्से दिखें')],
            ['locations', 'mountain', L('Places and photos', 'जगहें और फ़ोटो'), L('Add photos, best season, how to reach', 'फ़ोटो, सबसे अच्छा मौसम, कैसे पहुँचें')],
            ['trips', 'chart', L('Trip Planner insights', 'ट्रिप प्लानर जानकारी'), L('Trips, popular places, reviews', 'ट्रिप, लोकप्रिय जगहें, रिव्यू')],
            ['settings', 'settings', L('Contact and social links', 'संपर्क और सोशल लिंक'), L('Phone, WhatsApp, email', 'फ़ोन, व्हाट्सऐप, ईमेल')]]
            .map(([k, ic, a, b2]) => h('a', { class: 'ds-row', href: `#/admin/${k}` }, h('span', { class: 'ds-row-ico' }, icon(ic, 20)), h('span', { class: 'grow' }, h('strong', {}, a), h('span', {}, b2))))))));
}

const statusFilter = (cur, base, opts) => h('div', { class: 'filters' },
  [['', t('all')], ...opts].map(([v, label]) => h('a', { class: `pill${(cur || '') === v ? ' active' : ''}`, href: `#/admin/${base}${v ? `?status=${v}` : ''}` }, label)));

// ---------- Partners ----------
async function partners(ctx, query) {
  let qy = sb.from('partners').select('*').order('created_at', { ascending: false });
  if (query.status) qy = qy.eq('status', query.status);
  const rows = await q(qy);
  const C = CATEGORY_LABELS();
  const add = h('button', { class: 'btn', onclick: () => editPartner(ctx, null) }, `+ ${L('Add partner', 'पार्टनर जोड़ें')}`);
  return h('div', {},
    h('div', { class: 'toolbar' }, add, statusFilter(query.status, 'partners', [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['suspended', 'Suspended']])),
    rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('tbody', {}, rows.map((p) => h('tr', {},
        h('td', {}, h('strong', {}, p.business_name), h('div', { class: 'muted small' }, `${p.contact_name} · `, h('a', { href: `tel:${p.phone}` }, p.phone), p.owner_id ? '' : ` · ${L('added by admin', 'एडमिन ने जोड़ा')}`)),
        h('td', {}, p.categories.map((c) => C[c]).join(', '), h('div', { class: 'muted small' }, p.village)),
        h('td', {}, badge(p.status), h('div', { class: 'muted small' }, fmtDate(p.created_at))),
        h('td', { class: 'right' },
          p.status !== 'approved' ? h('button', { class: 'btn btn-sm', onclick: (e) => setStatus(e.target, 'partners', p.id, 'approved') }, t('approve')) : null,
          p.status === 'pending' ? h('button', { class: 'btn btn-ghost btn-sm', onclick: (e) => setStatus(e.target, 'partners', p.id, 'rejected', true) }, t('reject')) : null,
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => editPartner(ctx, p) }, t('edit')))))))) : empty());
}

async function setStatus(btn, table, id, status, askNote) {
  const patch = { status };
  if (askNote) { const n = prompt(L('Reason (the partner will see it, optional)', 'कारण (पार्टनर देखेगा, ज़रूरी नहीं)')); if (n) patch.admin_note = n; }
  await busy(btn, async () => { await q(sb.from(table).update(patch).eq('id', id)); toast(t('saved')); location.reload(); });
}

function editPartner(ctx, row) {
  const form = buildForm(partnerSchema(true), row || { status: 'approved', categories: ['homestay'] }, {
    ctx,
    onSubmit: async (data) => {
      if (!data.categories.length) throw new Error('Pick at least one category');
      if (row) await q(sb.from('partners').update(data).eq('id', row.id));
      else await q(sb.from('partners').insert({ ...data, owner_id: null }));
      dlg.close(); toast(t('saved')); location.reload();
    },
  });
  const dlg = modal(row ? row.business_name : L('Add partner', 'पार्टनर जोड़ें'), h('div', {},
    row ? null : h('p', { class: 'muted' }, L('Add a partner who does not use the website themselves. You can then add their homestays, tours or rides.',
      'ऐसा पार्टनर जोड़ें जो ख़ुद वेबसाइट इस्तेमाल नहीं करता। फिर आप उनकी तरफ़ से होमस्टे, टूर या राइड जोड़ सकते हैं।')), form), { wide: true });
}

// ---------- Listings (homestays, workspaces, village tours) ----------
async function listingsAdmin(kind, ctx, query) {
  const k = KINDS[kind];
  let qy = sb.from(k.table).select('*, partners(business_name, phone)').order('created_at', { ascending: false });
  if (query.status) qy = qy.eq('status', query.status);
  const rows = await q(qy);
  const add = h('button', { class: 'btn', onclick: () => editListing(kind, ctx, null) }, `+ ${t('add')}`);
  return h('div', {},
    h('div', { class: 'toolbar' }, add, statusFilter(query.status, kind, [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['hidden', 'Hidden']])),
    rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('tbody', {}, rows.map((r) => h('tr', {},
        h('td', {}, h('strong', {}, r[k.nameField]), h('div', { class: 'muted small' }, [r.partners?.business_name, r.village].filter(Boolean).join(' · '))),
        h('td', {}, k.price(r)),
        h('td', {}, badge(r.status), r.is_featured ? ' ⭐' : ''),
        h('td', { class: 'right' },
          r.status !== 'approved' ? h('button', { class: 'btn btn-sm', onclick: (e) => setStatus(e.target, k.table, r.id, 'approved') }, t('approve')) : null,
          r.status === 'pending' ? h('button', { class: 'btn btn-ghost btn-sm', onclick: (e) => setStatus(e.target, k.table, r.id, 'rejected', true) }, t('reject')) : null,
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => editListing(kind, ctx, r) }, t('edit')),
          h('button', { class: 'btn btn-ghost btn-sm', onclick: (e) => del(e.target, k.table, r.id) }, '🗑'))))))) : empty());
}

async function editListing(kind, ctx, row) {
  const k = KINDS[kind];
  const cat = kind;
  const partnersList = await q(sb.from('partners').select('id,business_name,categories').eq('status', 'approved').order('business_name'));
  const eligible = partnersList.filter((p) => p.categories.includes(cat));
  const schema = [
    { name: 'partner_id', label: L('Partner', 'पार्टनर'), type: 'select', required: true, options: [['', '—'], ...eligible.map((p) => [p.id, p.business_name])] },
    ...SCHEMAS[kind](true),
  ];
  const form = buildForm(schema, row || { status: 'approved' }, {
    ctx,
    onSubmit: async (data) => {
      if (!data.partner_id) throw new Error(L('Choose a partner (add one under Partners first)', 'पार्टनर चुनें (पहले "पार्टनर" में जोड़ें)'));
      const clean = { ...data }; delete clean.partners;
      if (row) await q(sb.from(k.table).update(clean).eq('id', row.id));
      else await q(sb.from(k.table).insert(clean));
      dlg.close(); toast(t('saved')); location.reload();
    },
  });
  const dlg = modal(row ? row[k.nameField] : t('add'), form, { wide: true });
}

async function del(btn, table, id) {
  if (!confirm(L('Delete permanently?', 'हमेशा के लिए हटाएँ?'))) return;
  await busy(btn, async () => { await q(sb.from(table).delete().eq('id', id)); toast(t('deleted')); location.reload(); });
}

// ---------- Cab rides ----------
async function rides() {
  const rows = await q(sb.from('cab_rides').select('*, partners(business_name, phone), cab_bookings(id,status,seats,passenger_name,phone)').order('departure_at', { ascending: false }).limit(200));
  if (!rows.length) return empty();
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('tbody', {}, rows.map((r) => {
      const f = locationById(r.from_location_id); const to = locationById(r.to_location_id);
      return h('tr', {},
        h('td', {}, h('strong', {}, `${f ? pick(f, 'name') : '?'} → ${to ? pick(to, 'name') : '?'}`), h('div', { class: 'muted small' }, fmtDate(r.departure_at, true))),
        h('td', {}, r.partners?.business_name, h('div', { class: 'muted small' }, r.vehicle_model)),
        h('td', {}, `${r.seats_booked}/${r.seats_total}`, h('div', { class: 'muted small' }, `${inr(r.price_per_seat)} ${t('per_seat')}`)),
        h('td', {}, badge(r.status)),
        h('td', { class: 'right' }, r.status === 'open' || r.status === 'full'
          ? h('button', { class: 'btn btn-ghost btn-sm', onclick: (e) => setStatus(e.target, 'cab_rides', r.id, 'cancelled') }, t('cancel')) : null));
    }))));
}

// ---------- Booking requests ----------
async function requests() {
  const rows = await q(sb.from('booking_requests').select('*, homestays(name), village_tours(title), workspaces(name), partners(business_name)').order('created_at', { ascending: false }).limit(300));
  if (!rows.length) return empty();
  const statuses = ['requested', 'confirmed', 'declined', 'cancelled', 'completed'];
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('tbody', {}, rows.map((r) => {
      const sel = select(statuses.map((s) => [s, s]), r.status, { 'aria-label': t('status') });
      sel.addEventListener('change', async () => {
        try { await q(sb.rpc('set_booking_status', { p_id: r.id, p_status: sel.value, p_note: '' })); toast(t('saved')); }
        catch (e) { toast(e.message, 'err'); sel.value = r.status; }
      });
      return h('tr', {},
        h('td', {}, h('strong', {}, r.homestays?.name || r.village_tours?.title || r.workspaces?.name), h('div', { class: 'muted small' }, r.partners?.business_name)),
        h('td', {}, r.guest_name, h('div', {}, h('a', { href: `tel:${r.guest_phone}` }, r.guest_phone))),
        h('td', {}, fmtDate(r.start_date), h('div', { class: 'muted small' }, `${r.guests} ${t('guests')}`)),
        h('td', {}, sel));
    }))));
}

// ---------- Generic table editor ----------
async function crud(table, schema, ctx, { order, title, flag, slugFrom, beforeSave } = {}) {
  const rows = await q(sb.from(table).select('*').order(order || 'created_at'));
  const open = (row) => {
    const form = buildForm(schema, row || { [flag]: true, position: (rows.length + 1) * 10 }, {
      ctx,
      onSubmit: async (data) => {
        let d = { ...data };
        if (slugFrom && 'slug' in d && !d.slug) d.slug = slugify(d[slugFrom]);
        if (beforeSave) d = beforeSave(d);
        if (row) await q(sb.from(table).update(d).eq(table === 'site_settings' ? 'key' : 'id', row.id));
        else await q(sb.from(table).insert(d));
        dlg.close(); toast(t('saved')); refresh();
      },
    });
    const dlg = modal(row ? t('edit') : t('add'), form, { wide: true });
  };
  return h('div', {},
    h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => open(null) }, `+ ${t('add')}`)),
    rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('tbody', {}, rows.map((r) => {
        const toggle = h('input', { type: 'checkbox', 'aria-label': flag });
        toggle.checked = !!r[flag];
        toggle.addEventListener('change', async () => {
          try { await q(sb.from(table).update({ [flag]: toggle.checked }).eq('id', r.id)); toast(t('saved')); resetCache(); }
          catch (e) { toast(e.message, 'err'); toggle.checked = !toggle.checked; }
        });
        return h('tr', {},
          h('td', {}, title(r)),
          h('td', {}, h('label', { class: 'check' }, toggle, h('span', {}, flag === 'enabled' ? L('Show', 'दिखाएँ') : t('publish')))),
          h('td', { class: 'right' },
            h('button', { class: 'btn btn-ghost btn-sm', onclick: () => open(r) }, t('edit')),
            h('button', { class: 'btn btn-ghost btn-sm', onclick: (e) => del(e.target, table, r.id) }, '🗑')));
      })))) : empty());
}

// ---------- Users ----------
async function users() {
  const rows = await q(sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(500));
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('tbody', {}, rows.map((p) => {
      const sel = select([['traveler', 'Traveller'], ['partner', 'Partner'], ['admin', 'Admin']], p.role, { 'aria-label': 'Role' });
      sel.disabled = p.id === user().id;
      sel.addEventListener('change', async () => {
        if (sel.value === 'admin' && !confirm(L('Give full admin rights to this user?', 'इस यूज़र को पूरे एडमिन अधिकार दें?'))) { sel.value = p.role; return; }
        try { await q(sb.from('profiles').update({ role: sel.value }).eq('id', p.id)); toast(t('saved')); }
        catch (e) { toast(e.message, 'err'); sel.value = p.role; }
      });
      return h('tr', {}, h('td', {}, h('strong', {}, p.full_name || '—'), h('div', { class: 'muted small' }, p.phone || '')),
        h('td', {}, fmtDate(p.created_at)), h('td', {}, sel));
    }))));
}

// ---------- Settings ----------
async function settingsTab() {
  const rows = await q(sb.from('site_settings').select('*'));
  const get = (k) => rows.find((r) => r.key === k)?.value || {};
  const brand = get('brand'); const contact = get('contact'); const social = get('social');
  const mk = (key, fields, values) => buildForm(fields, values, {
    onSubmit: async (data) => {
      await q(sb.from('site_settings').upsert({ key, value: { ...values, ...data } }));
      toast(t('saved')); resetCache();
    },
  });
  return h('div', { class: 'stack' },
    h('div', { class: 'panel' }, h('h2', {}, L('Brand', 'ब्रांड')), mk('brand', [
      { name: 'name', label: 'Site name (English)', max: 80 }, { name: 'name_hi', label: 'साइट का नाम (हिंदी)', max: 80 },
      { name: 'tagline', label: 'Tagline (English)', max: 200, wide: true }, { name: 'tagline_hi', label: 'टैगलाइन (हिंदी)', max: 200, wide: true }], brand)),
    h('div', { class: 'panel' }, h('h2', {}, L('Contact', 'संपर्क')), mk('contact', [
      { name: 'phone', label: L('Phone', 'फ़ोन'), inputType: 'tel' }, { name: 'whatsapp', label: 'WhatsApp (91XXXXXXXXXX)', inputType: 'tel' },
      { name: 'email', label: L('Email', 'ईमेल'), inputType: 'email' }, { name: 'address', label: L('Address', 'पता'), wide: true }], contact)),
    h('div', { class: 'panel' }, h('h2', {}, 'Social'), mk('social', [
      { name: 'instagram', label: 'Instagram URL', inputType: 'url' }, { name: 'facebook', label: 'Facebook URL', inputType: 'url' },
      { name: 'youtube', label: 'YouTube URL', inputType: 'url' }], social)));
}

export { field, input };
