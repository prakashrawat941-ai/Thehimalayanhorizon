import {h, toast, empty, badge, fmtDate, inr, modal, busy, select} from '@/lib/cab/ui';
import {t, pick, getLang} from '@/lib/cab/i18n';
import {sb,q} from '@/lib/cab/sb';
import { themes } from '@/lib/cab/store';
import {buildForm} from './forms';
import {SCHEMAS, partnerSchema, CATEGORY_LABELS} from './schemas';
const L = (en, hi) => getLang() === 'hi' ? hi : en;
const KINDS = {
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

const statusFilter = (cur, base, opts) => h('div', { class: 'filters' },
  [['', t('all')], ...opts].map(([v, label]) => h('a', { class: `pill${(cur || '') === v ? ' active' : ''}`, href: `/admin/${base}${v ? `?status=${v}` : ''}` }, label)));

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
          p.status === 'pending' ? h('a', { class: 'btn btn-sm', href: '/admin/approvals?tab=partners' }, L('Review', 'समीक्षा')) : null,
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => editPartner(ctx, p) }, t('edit')))))))) : empty());
}

function editPartner(ctx, row) {
  const form = buildForm(partnerSchema(true).filter(f => !['status','admin_note'].includes(f.name)), row || { status: 'pending', categories: ['homestay'] }, {
    ctx,
    onSubmit: async (data) => {
      if (!data.categories.length) throw new Error('Pick at least one category');
      if (row) await q(sb.from('partners').update(data).eq('id', row.id));
      else await q(sb.from('partners').insert({ ...data, status:'pending', owner_id: null }));
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
          r.status === 'pending' ? h('a', { class: 'btn btn-sm', href: '/admin/approvals?tab=' + ({homestay:'homestays',workspace:'workspaces',village_tour:'tours'})[kind] }, L('Review', 'समीक्षा')) : null,
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
    ...SCHEMAS[kind](true).filter(f => !['status','admin_note'].includes(f.name)),
  ];
  const form = buildForm(schema, row || { status: 'approved' }, {
    ctx,
    onSubmit: async (data) => {
      if (!data.partner_id) throw new Error(L('Choose a partner (add one under Partners first)', 'पार्टनर चुनें (पहले "पार्टनर" में जोड़ें)'));
      const clean = { ...data }; delete clean.partners;
      if (row) await q(sb.from(k.table).update(clean).eq('id', row.id));
      else await q(sb.from(k.table).insert({ ...clean, status:'pending' }));
      dlg.close(); toast(t('saved')); location.reload();
    },
  });
  const dlg = modal(row ? row[k.nameField] : t('add'), form, { wide: true });
}

async function del(btn, table, id) {
  if (!confirm(L('Delete permanently?', 'हमेशा के लिए हटाएँ?'))) return;
  await busy(btn, async () => { await q(sb.from(table).delete().eq('id', id)); toast(t('deleted')); location.reload(); });
}

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


export async function manage({params, query}) {
  const kind = params.id;
  if (kind === 'requests') return requests();
  const ctx = {locations: await q(sb.from('locations').select('*').order('position')), themes: await themes()};
  return kind === 'partners' ? partners(ctx,query) : listingsAdmin(kind,ctx,query);
}
