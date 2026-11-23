import {h, empty, fmtDate, inr, badge, busy, modal, toast} from '@/lib/cab/ui';
import {getLang, pick, t} from '@/lib/cab/i18n';
import {sb,q} from '@/lib/cab/sb';
import {locations, locationById, state} from '@/lib/cab/store';
import {buildForm} from './forms';
import {SCHEMAS} from './schemas';
const hi = () => getLang() === 'hi';
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


export async function manage({params,query}) {
  await locations();
  const partner = state.partners.find(p => p.id === params.id);
  if (!partner) throw new Error('Partner account required');
  return query.section === 'rides' ? rides(partner) : requests(partner);
}
