// Admin portal: approvals, partners, listings, rides, requests, home page,
// locations, themes, itineraries, users and site settings.
import { h, toast, empty, badge, fmtDate, inr, modal, busy, lazy, field, input, select } from '../ui.js';
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
  const tabs = [
    ['overview', L('Overview', 'सारांश')], ['partners', L('Partners', 'पार्टनर')],
    ['homestay', t('stays')], ['workspace', t('workspaces')], ['village_tour', L('Village tours', 'गाँव के टूर')],
    ['rides', L('Cab rides', 'कैब राइड')], ['requests', L('Requests', 'रिक्वेस्ट')],
    ['home', L('Home page', 'होम पेज')], ['locations', L('Locations', 'लोकेशन')], ['themes', L('Themes', 'थीम')],
    ['itineraries', t('itineraries')], ['users', L('Users', 'यूज़र')], ['settings', L('Settings', 'सेटिंग्स')],
  ];
  const views = {
    overview: () => overview(), partners: () => partners(ctx, query), rides: () => rides(), requests: () => requests(),
    home: () => crud('home_sections', SCHEMAS.home_section(), ctx, { order: 'position', title: (r) => `${r.position}. ${r.kind} — ${pick(r, 'title') || '…'}`, flag: 'enabled' }),
    locations: () => crud('locations', SCHEMAS.location(), ctx, { order: 'position', title: (r) => `${pick(r, 'name')} · ${r.kind} · ${r.district}`, flag: 'is_published', slugFrom: 'name' }),
    themes: () => crud('themes', SCHEMAS.theme(), ctx, { order: 'position', title: (r) => `${r.icon} ${pick(r, 'name')}`, flag: 'is_published', slugFrom: 'name' }),
    itineraries: () => crud('itineraries', SCHEMAS.itinerary(), ctx, { order: 'position', title: (r) => `${pick(r, 'title')} · ${r.days_count || r.days?.length} ${t('days')}`, flag: 'is_published', slugFrom: 'title',
      beforeSave: (d) => ({ ...d, days_count: Math.max(1, (d.days || []).length) }) }),
    users: () => users(), settings: () => settingsTab(),
  };
  const body = KINDS[tab] ? lazy(() => listingsAdmin(tab, ctx, query)) : lazy(views[tab] || (() => empty()));

  return h('div', { class: 'page admin' },
    h('h1', {}, t('admin')),
    h('nav', { class: 'tabs tabs-scroll' }, tabs.map(([k, label]) => h('a', { href: `#/admin/${k}`, class: tab === k ? 'active' : '' }, label))),
    body);
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
  const stat = (n, label, href, urgent) => h('a', { class: `panel stat${urgent && n ? ' urgent' : ''}`, href }, h('strong', { class: 'stat-n' }, n), h('span', {}, label));
  return h('div', {},
    h('div', { class: 'grid grid-4' },
      stat(pp, L('Partners waiting for approval', 'मंज़ूरी के इंतज़ार में पार्टनर'), '#/admin/partners?status=pending', true),
      stat(ph, L('Homestays to approve', 'मंज़ूरी बाकी होमस्टे'), '#/admin/homestay?status=pending', true),
      stat(pw, L('Workspaces to approve', 'मंज़ूरी बाकी वर्कस्पेस'), '#/admin/workspace?status=pending', true),
      stat(pt, L('Village tours to approve', 'मंज़ूरी बाकी गाँव के टूर'), '#/admin/village_tour?status=pending', true),
      stat(rq, L('Open booking requests', 'खुली बुकिंग रिक्वेस्ट'), '#/admin/requests'),
      stat(rides, L('Open cab rides', 'खुली कैब राइड'), '#/admin/rides'),
      stat(users, L('Registered users', 'रजिस्टर्ड यूज़र'), '#/admin/users')),
    h('div', { class: 'soft-note' }, L('Tip: everything on the home page — text, order, which blocks show — is under “Home page”. Places are under “Locations”.',
      'सुझाव: होम पेज का सब कुछ — टेक्स्ट, क्रम, कौन सा हिस्सा दिखे — "होम पेज" में है। जगहें "लोकेशन" में हैं।')));
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
