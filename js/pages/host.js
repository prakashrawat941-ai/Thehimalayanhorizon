// Homestay partner portal: overview, properties (5-step form), rate calendar, bookings + voucher,
// earnings & payouts, KYC & bank, support. Money is recorded only; amounts come from the database.
import { h, clear, toast, busy, inr, fmtDate, icon, empty, modal, todayISO } from '../ui.js';
import { getLang, pick } from '../i18n.js';
import { sb, q, uploadImage } from '../sb.js';
import { state, user, locations } from '../store.js';
import { statCard } from '../shell.js';
import { live, refresh } from '../live.js';

const L = (en, hi) => (getLang() === 'hi' ? hi : en);
const IST_TODAY = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const nights = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 864e5));
const STATUS = () => ({
  draft: ['', L('Draft', 'ड्राफ़्ट')], pending: ['warn', L('Pending review', 'जाँच बाकी')], approved: ['ok', L('Approved', 'मंज़ूर')],
  rejected: ['bad', L('Rejected', 'अस्वीकार')], hidden: ['', L('Hidden', 'छिपी')],
  requested: ['warn', L('New request', 'नई रिक्वेस्ट')], confirmed: ['ok', L('Confirmed', 'कन्फ़र्म')], checked_in: ['ok', L('Checked in', 'चेक-इन')],
  completed: ['done', L('Completed', 'पूरी')], cancelled: ['bad', L('Cancelled', 'रद्द')], declined: ['bad', L('Declined', 'मना')],
  unpaid: ['', L('Unpaid', 'बाकी')], processing: ['warn', L('Payout requested', 'पेआउट माँगा')], paid: ['ok', L('Paid', 'भुगतान हुआ')],
  verified: ['ok', L('Verified', 'वेरिफ़ाइड')], open: ['warn', L('Open', 'खुला')], answered: ['ok', L('Answered', 'जवाब मिला')], closed: ['', L('Closed', 'बंद')],
});
export const pill = (s) => { const [tone, label] = STATUS()[s] || ['', s]; return h('span', { class: `pill ${tone ? `pill-${tone}` : ''}` }, label); };
const AMENITIES = () => [L('Hot water', 'गर्म पानी'), 'Wi-Fi', L('Parking', 'पार्किंग'), L('Home-cooked meals', 'घर का खाना'), L('Mountain view', 'पहाड़ का नज़ारा'),
  L('Bonfire', 'अलाव'), L('Power backup', 'पावर बैकअप'), L('Heater', 'हीटर'), L('Attached bathroom', 'अटैच बाथरूम'), L('Garden', 'बगीचा'), L('Pet friendly', 'पालतू जानवर ठीक'), L('Village walks', 'गाँव की सैर')];

// Data for the partner (RLS returns only their own rows).
async function load(partner) {
  const hs = await q(sb.from('homestays').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false }));
  const ids = hs.map((x) => x.id);
  const [rooms, bookings] = await Promise.all([
    ids.length ? q(sb.from('homestay_rooms').select('*').in('homestay_id', ids).order('sort')) : [],
    q(sb.from('booking_requests').select('*').eq('partner_id', partner.id).eq('kind', 'homestay').order('start_date', { ascending: false }).limit(1000)),
  ]);
  return { hs, rooms, bookings };
}
const hsName = (d, id) => d.hs.find((x) => x.id === id)?.name || '—';
const roomName = (d, id) => d.rooms.find((x) => x.id === id)?.room_type || '';

// ---------- 1. Overview ----------
export async function overview(partner) {
  const d = await load(partner);
  const today = IST_TODAY();
  const done = d.bookings.filter((b) => b.status === 'completed');
  const active = d.bookings.filter((b) => b.status === 'checked_in' || (b.status === 'confirmed' && b.end_date >= today));
  const reqs = d.bookings.filter((b) => b.status === 'requested');
  const pendingPay = d.bookings.filter((b) => b.status === 'completed' && b.payout_status !== 'paid').reduce((s, b) => s + (b.partner_payout_amount || 0), 0);
  // Occupancy, last 30 nights: booked room-nights ÷ rooms available in approved properties.
  const start = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const liveRooms = d.rooms.filter((r) => r.is_active && d.hs.find((x) => x.id === r.homestay_id)?.status === 'approved');
  const cap = liveRooms.reduce((s, r) => s + r.total_inventory, 0) * 30;
  const booked = d.bookings.filter((b) => ['confirmed', 'checked_in', 'completed'].includes(b.status)).reduce((s, b) => {
    const a = b.start_date > start ? b.start_date : start; const z = b.end_date < today ? b.end_date : today;
    return s + Math.max(0, nights(a, z)) * (b.rooms_booked || 1);
  }, 0);
  const occ = cap ? Math.round((booked / cap) * 100) : null;
  const kyc = await q(sb.from('partner_kyc').select('status').eq('partner_id', partner.id).maybeSingle()).catch(() => null);

  const alerts = [
    reqs.length ? h('a', { class: 'soft-note warn ds-alert', href: '#/partner/bookings?tab=requests' }, icon('bell', 18), `${reqs.length} ${L('new booking request(s) waiting for you', 'नई बुकिंग रिक्वेस्ट आपका इंतज़ार कर रही हैं')}`) : null,
    !d.hs.length ? h('a', { class: 'soft-note ds-alert', href: '#/partner/properties/new' }, icon('plus', 18), L('Add your first homestay to start getting bookings.', 'बुकिंग पाने के लिए अपना पहला होमस्टे जोड़ें।')) : null,
    d.hs.some((x) => x.status === 'rejected') ? h('a', { class: 'soft-note warn ds-alert', href: '#/partner/properties' }, icon('alert', 18), L('A property needs changes. See the admin remarks.', 'एक प्रॉपर्टी में बदलाव चाहिए। एडमिन की टिप्पणी देखें।')) : null,
    !kyc || kyc.status === 'rejected' ? h('a', { class: 'soft-note ds-alert', href: '#/partner/kyc' }, icon('doc', 18), L('Add your ID and bank / UPI details so payouts can be sent.', 'अपनी आईडी और बैंक / UPI जोड़ें ताकि पेआउट भेजा जा सके।')) : null,
  ];
  return h('div', { class: 'stack' },
    ...alerts.filter(Boolean),
    h('div', { class: 'ds-stats' },
      statCard('chart', L('Total earnings (your share)', 'कुल कमाई (आपका हिस्सा)'), inr(done.reduce((s, b) => s + (b.partner_payout_amount || 0), 0)), '#/partner/earnings'),
      statCard('calendar', L('Active bookings', 'चालू बुकिंग'), active.length, '#/partner/bookings?tab=upcoming'),
      statCard('layers', L('Occupancy (30 days)', 'भराव (30 दिन)'), occ == null ? '—' : `${occ}%`, '#/partner/calendar'),
      statCard('check', L('Pending payouts', 'बाकी पेआउट'), inr(pendingPay), '#/partner/earnings', pendingPay ? 'warn' : '')),
    h('section', { class: 'panel stack' }, h('h2', {}, L('Monthly earnings', 'महीने की कमाई')),
      h('p', { class: 'small muted' }, L('Your share of confirmed and completed stays, by check-in month. Tap a bar for details.', 'कन्फ़र्म और पूरी हुई बुकिंग में आपका हिस्सा, चेक-इन के महीने के हिसाब से। बार दबाकर देखें।')),
      earningsChart(d.bookings)),
    h('section', { class: 'stack' }, h('h2', {}, L('Next arrivals', 'अगले मेहमान')),
      (() => { const up = d.bookings.filter((b) => ['confirmed', 'checked_in'].includes(b.status) && b.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 4);
        return up.length ? h('div', { class: 'hb-list' }, up.map((b) => bookingCard(b, d, partner))) : empty(L('No upcoming guests yet.', 'अभी कोई आने वाला मेहमान नहीं।'), null, 'calendar'); })()));
}

function earningsChart(bookings) {
  const months = Array.from({ length: 12 }, (_, i) => { const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - 11 + i); return dt.toISOString().slice(0, 7); });
  const val = Object.fromEntries(months.map((m) => [m, 0]));
  bookings.filter((b) => ['confirmed', 'checked_in', 'completed'].includes(b.status)).forEach((b) => { const m = b.start_date.slice(0, 7); if (m in val) val[m] += b.partner_payout_amount || 0; });
  const max = Math.max(1, ...Object.values(val));
  const out = h('p', { class: 'chart-read small', 'aria-live': 'polite' }, L('Tap a month', 'महीना चुनें'));
  const label = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString(getLang() === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short' });
  const bars = h('div', { class: 'bars', role: 'list' }, months.map((m) => {
    const b = h('button', { type: 'button', class: 'bar', role: 'listitem', style: `--h:${Math.max(2, Math.round((val[m] / max) * 100))}%`,
      'aria-label': `${label(m)} ${m.slice(0, 4)}: ${inr(val[m])}` }, h('span', { class: 'bar-fill' }), h('span', { class: 'bar-l' }, label(m)));
    b.addEventListener('click', () => { bars.querySelectorAll('.bar.on').forEach((x) => x.classList.remove('on')); b.classList.add('on'); out.textContent = `${label(m)} ${m.slice(0, 4)}: ${inr(val[m])}`; });
    return b;
  }));
  return h('div', { class: 'chart' }, bars, out);
}

// ---------- 2. Properties ----------
export async function properties(partner) {
  const d = await load(partner);
  const canAdd = partner.status === 'approved' && partner.categories.includes('homestay');
  live('host-props', [{ table: 'homestays', filter: `partner_id=eq.${partner.id}` }], () => { toast(L('Property status updated', 'प्रॉपर्टी की स्थिति बदली')); refresh(); });
  return h('div', { class: 'stack' },
    h('div', { class: 'toolbar' },
      canAdd ? h('a', { class: 'btn', href: '#/partner/properties/new' }, icon('plus', 16), L('Add homestay', 'होमस्टे जोड़ें'))
        : h('p', { class: 'soft-note' }, L('You can add homestays after your partner account is approved for homestays.', 'होमस्टे के लिए पार्टनर अकाउंट मंज़ूर होने के बाद आप होमस्टे जोड़ सकेंगे।'))),
    d.hs.length ? h('div', { class: 'hp-grid' }, d.hs.map((x) => {
      const rs = d.rooms.filter((r) => r.homestay_id === x.id && r.is_active);
      const from = rs.length ? Math.min(...rs.map((r) => r.base_price)) : x.price_per_night;
      return h('article', { class: 'hp-card' },
        h('div', { class: 'hp-photo' }, x.images?.[0] ? h('img', { src: x.images[0], alt: '', loading: 'lazy' }) : icon('camera', 28), h('span', { class: 'hp-badge' }, pill(x.status))),
        h('div', { class: 'hp-body' },
          h('h3', {}, x.name), h('p', { class: 'small muted' }, [x.village, x.district, x.state].filter(Boolean).join(', ')),
          h('p', { class: 'small' }, `${rs.length} ${L('room type(s)', 'रूम टाइप')} · ${rs.reduce((s, r) => s + r.total_inventory, 0)} ${L('rooms', 'कमरे')} · ${L('from', 'से')} ${inr(from || 0)}${L('/night', '/रात')}`),
          x.admin_note ? h('p', { class: `small ${x.status === 'rejected' ? 'hp-remark bad' : 'hp-remark'}` }, h('strong', {}, L('Admin: ', 'एडमिन: ')), x.admin_note) : null,
          x.status === 'pending' ? h('p', { class: 'small muted' }, L('Our team checks new and edited properties, usually within a day.', 'हमारी टीम नई और बदली प्रॉपर्टी आमतौर पर एक दिन में जाँचती है।')) : null,
          h('div', { class: 'row-actions' },
            h('a', { class: 'btn btn-ghost btn-sm', href: `#/partner/properties/${x.id}` }, L('Edit', 'बदलें')),
            rs.length ? h('a', { class: 'btn btn-ghost btn-sm', href: `#/partner/calendar?h=${x.id}` }, L('Rate calendar', 'रेट कैलेंडर')) : null,
            x.status === 'approved' ? h('a', { class: 'btn btn-ghost btn-sm', href: `#/stay/${x.id}` }, L('View live', 'लाइव देखें')) : null)));
    })) : empty(L('No homestays yet.', 'अभी कोई होमस्टे नहीं।'), null, 'layers'));
}

// 5-step form: Basic → Amenities → Rooms → Pricing → Photos.
export async function propertyForm(partner, id) {
  await locations();
  const d = await load(partner);
  const x = id && id !== 'new' ? d.hs.find((r) => r.id === id) : null;
  if (id && id !== 'new' && !x) return empty(L('Property not found.', 'प्रॉपर्टी नहीं मिली।'));
  if (!x && !(partner.status === 'approved' && partner.categories.includes('homestay'))) return h('p', { class: 'soft-note warn' }, L('Your partner account must be approved for homestays first.', 'पहले होमस्टे के लिए पार्टनर अकाउंट मंज़ूर होना चाहिए।'));
  const st = {
    step: 0,
    name: x?.name || '', village: x?.village || '', district: x?.district || '', state: x?.state || 'Uttarakhand', location_id: x?.location_id || '',
    summary: x?.summary || '', description: x?.description || '', amenities: [...(x?.amenities || [])], meals: x?.meals || '', house_rules: x?.house_rules || '',
    rooms: (x ? d.rooms.filter((r) => r.homestay_id === x.id && r.is_active) : []).map((r) => ({ ...r })),
    images: [...(x?.images || [])],
  };
  if (!st.rooms.length) st.rooms.push({ room_type: L('Double room', 'डबल रूम'), max_guests: 2, total_inventory: 1, base_price: '', weekend_price: '' });
  const removed = [];
  const STEPS = [L('Basic info', 'जानकारी'), L('Amenities', 'सुविधाएँ'), L('Room types', 'रूम टाइप'), L('Pricing', 'किराया'), L('Photos', 'फ़ोटो')];
  const wrap = h('div', { class: 'stack hw' });
  const err = h('p', { class: 'form-err', role: 'alert' });
  const fieldI = (label, el, hint) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), el, hint ? h('small', { class: 'muted' }, hint) : null);
  const inp = (k, attrs = {}) => { const el = h('input', { class: 'input', value: st[k] ?? '', ...attrs }); el.addEventListener('input', () => { st[k] = el.value; }); return el; };
  const area = (k, attrs = {}) => { const el = h('textarea', { class: 'input', rows: 3, ...attrs }); el.value = st[k] || ''; el.addEventListener('input', () => { st[k] = el.value; }); return el; };

  function check(step) {
    if (step === 0) {
      if (st.name.trim().length < 3) return L('Enter the homestay name.', 'होमस्टे का नाम लिखें।');
      if (st.village.trim().length < 2) return L('Enter the village or town.', 'गाँव या कस्बा लिखें।');
      if (st.summary.trim().length < 10) return L('Write a one-line summary (at least 10 letters).', 'एक लाइन का परिचय लिखें (कम से कम 10 अक्षर)।');
    }
    if (step === 2) {
      if (!st.rooms.length) return L('Add at least one room type.', 'कम से कम एक रूम टाइप जोड़ें।');
      if (st.rooms.some((r) => String(r.room_type || '').trim().length < 2)) return L('Give each room type a name.', 'हर रूम टाइप का नाम लिखें।');
      if (st.rooms.some((r) => !(r.max_guests >= 1 && r.max_guests <= 20) || !(r.total_inventory >= 1 && r.total_inventory <= 50))) return L('Guests 1–20 and rooms 1–50 per type.', 'हर टाइप में मेहमान 1–20 और कमरे 1–50।');
    }
    if (step === 3 && st.rooms.some((r) => !(Number(r.base_price) > 0))) return L('Set a price per night for each room type.', 'हर रूम टाइप का एक रात का किराया लिखें।');
    return '';
  }
  async function save(submit, btn) {
    for (let i = 0; i < 4; i += 1) { const m = check(i); if (m) { st.step = i; paint(); err.textContent = m; return; } }
    if (submit && !st.images.length) { st.step = 4; paint(); err.textContent = L('Add at least one photo before sending for review.', 'जाँच के लिए भेजने से पहले कम से कम एक फ़ोटो जोड़ें।'); return; }
    await busy(btn, async () => {
      const active = st.rooms;
      const row = {
        name: st.name.trim(), village: st.village.trim(), district: st.district.trim(), state: st.state.trim() || 'Uttarakhand', location_id: st.location_id || null,
        summary: st.summary.trim(), description: st.description.trim() || st.summary.trim(), amenities: st.amenities, meals: st.meals.trim(), house_rules: st.house_rules.trim(),
        images: st.images, rooms: active.reduce((s, r) => s + Number(r.total_inventory), 0), max_guests: active.reduce((s, r) => s + Number(r.max_guests) * Number(r.total_inventory), 0),
        price_per_night: Math.min(...active.map((r) => Number(r.base_price))), status: submit ? 'pending' : 'draft',
      };
      let hid = x?.id;
      if (hid) await q(sb.from('homestays').update(row).eq('id', hid));
      else hid = (await q(sb.from('homestays').insert({ ...row, partner_id: partner.id }).select('id').single())).id;
      for (const [i, r] of active.entries()) {
        const rr = { room_type: String(r.room_type).trim(), max_guests: Number(r.max_guests), total_inventory: Number(r.total_inventory), base_price: Math.round(Number(r.base_price)),
          weekend_price: r.weekend_price === '' || r.weekend_price == null ? null : Math.round(Number(r.weekend_price)), sort: i, is_active: true };
        if (r.id) await q(sb.from('homestay_rooms').update(rr).eq('id', r.id)); else await q(sb.from('homestay_rooms').insert({ ...rr, homestay_id: hid }));
      }
      for (const r of removed) await q(sb.from('homestay_rooms').update({ is_active: false }).eq('id', r));  // kept for past bookings
      toast(submit ? L('Sent for review. We will notify you.', 'जाँच के लिए भेज दिया। हम आपको बताएँगे।') : L('Draft saved', 'ड्राफ़्ट सेव हुआ'));
      location.hash = '#/partner/properties';
    }).catch((e) => { err.textContent = e.message; });
  }

  function stepBody() {
    if (st.step === 0) {
      const locSel = h('select', { class: 'input' }, h('option', { value: '' }, L('Choose nearest place', 'पास की जगह चुनें')),
        state.locations.map((l) => h('option', { value: l.id, selected: l.id === st.location_id }, pick(l, 'name'))));
      locSel.addEventListener('change', () => { st.location_id = locSel.value; });
      return [fieldI(L('Homestay name', 'होमस्टे का नाम'), inp('name', { maxlength: 160, placeholder: 'e.g. Pine View Homestay' })),
        h('div', { class: 'row2' }, fieldI(L('Village / town', 'गाँव / कस्बा'), inp('village', { maxlength: 120 })), fieldI(L('District', 'ज़िला'), inp('district', { maxlength: 80, placeholder: 'Almora' }))),
        h('div', { class: 'row2' }, fieldI(L('State', 'राज्य'), inp('state', { maxlength: 80 })), fieldI(L('Nearest listed place', 'सूची में पास की जगह'), locSel)),
        fieldI(L('One-line summary', 'एक लाइन का परिचय'), inp('summary', { maxlength: 300, placeholder: L('Stone house with apple orchard and Himalayan view', 'सेब के बगीचे और हिमालय के नज़ारे वाला पत्थर का घर') })),
        fieldI(L('Description', 'विवरण'), area('description', { rows: 5, maxlength: 4000 }))];
    }
    if (st.step === 1) {
      const chips = h('div', { class: 'chips-wrap' });
      const paintChips = () => { clear(chips); [...new Set([...AMENITIES(), ...st.amenities])].forEach((a) => {
        const on = st.amenities.includes(a);
        chips.append(h('button', { type: 'button', class: `chip-btn${on ? ' on' : ''}`, 'aria-pressed': String(on), onclick: () => { st.amenities = on ? st.amenities.filter((z) => z !== a) : [...st.amenities, a]; paintChips(); } }, on ? `✓ ${a}` : a)); }); };
      paintChips();
      const own = h('input', { class: 'input', placeholder: L('Add your own and press Enter', 'अपनी सुविधा लिखें और Enter दबाएँ'), maxlength: 40 });
      own.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const v = own.value.trim(); if (v && !st.amenities.includes(v)) st.amenities.push(v); own.value = ''; paintChips(); } });
      return [h('span', { class: 'field-label' }, L('Tap what you offer', 'जो सुविधाएँ हैं उन्हें दबाएँ')), chips, own,
        fieldI(L('Meals', 'खाना'), inp('meals', { maxlength: 300, placeholder: L('Breakfast + dinner, Pahadi thali', 'नाश्ता + रात का खाना, पहाड़ी थाली') })),
        fieldI(L('House rules', 'घर के नियम'), area('house_rules', { maxlength: 2000 }))];
    }
    if (st.step === 2 || st.step === 3) {
      const list = h('div', { class: 'stack' });
      st.rooms.forEach((r, i) => {
        const num = (k, attrs) => { const el = h('input', { class: 'input', type: 'number', inputmode: 'numeric', value: r[k] ?? '', ...attrs }); el.addEventListener('input', () => { r[k] = el.value === '' ? '' : Number(el.value); }); return el; };
        const name = h('input', { class: 'input', value: r.room_type || '', maxlength: 60 }); name.addEventListener('input', () => { r.room_type = name.value; });
        const del = st.rooms.length > 1 ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { if (r.id) removed.push(r.id); st.rooms.splice(i, 1); paint(); } }, L('Remove', 'हटाएँ')) : null;
        list.append(h('div', { class: 'panel stack hw-room' },
          st.step === 2
            ? [fieldI(L('Room type', 'रूम टाइप'), name), h('div', { class: 'row2' }, fieldI(L('Guests per room', 'प्रति कमरा मेहमान'), num('max_guests', { min: 1, max: 20 })), fieldI(L('Number of such rooms', 'ऐसे कितने कमरे'), num('total_inventory', { min: 1, max: 50 }))), del]
            : [h('strong', {}, r.room_type || '—'), h('div', { class: 'row2' },
                fieldI(L('Price per night (₹)', 'एक रात का किराया (₹)'), num('base_price', { min: 1, max: 1000000, step: 50 })),
                fieldI(L('Weekend price (Fri, Sat nights)', 'वीकेंड किराया (शुक्र, शनि रात)'), num('weekend_price', { min: 1, max: 1000000, step: 50, placeholder: L('Same as normal', 'सामान्य जैसा') })))]));
      });
      return [st.step === 2 ? h('p', { class: 'small muted' }, L('Group identical rooms into one type, e.g. “Double room × 3”.', 'एक जैसे कमरों को एक टाइप में रखें, जैसे “डबल रूम × 3”।'))
        : h('p', { class: 'small muted' }, L('Seasonal prices and closed dates can be set later in the Rate calendar. THH commission is deducted from the booking value.', 'मौसम के हिसाब से किराया और बंद तारीख़ें बाद में रेट कैलेंडर में। THH कमीशन बुकिंग की रकम से कटता है।')),
        list, st.step === 2 ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { st.rooms.push({ room_type: '', max_guests: 2, total_inventory: 1, base_price: '', weekend_price: '' }); paint(); } }, icon('plus', 16), L('Add room type', 'रूम टाइप जोड़ें')) : null];
    }
    const grid = h('div', { class: 'hw-photos' });
    const paintPhotos = () => { clear(grid); st.images.forEach((u, i) => grid.append(h('figure', { class: 'hw-ph' }, h('img', { src: u, alt: '' }),
      i === 0 ? h('span', { class: 'hw-cover' }, L('Cover', 'कवर')) : h('button', { type: 'button', class: 'hw-ph-btn', title: L('Make cover', 'कवर बनाएँ'), onclick: () => { st.images.unshift(...st.images.splice(i, 1)); paintPhotos(); } }, '★'),
      h('button', { type: 'button', class: 'hw-ph-btn del', 'aria-label': L('Remove photo', 'फ़ोटो हटाएँ'), onclick: () => { st.images.splice(i, 1); paintPhotos(); } }, '✕')))); };
    paintPhotos();
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, class: 'input', id: 'hw-file' });
    const status = h('p', { class: 'small muted', 'aria-live': 'polite' });
    file.addEventListener('change', async () => {
      const files = [...file.files].slice(0, 12 - st.images.length);
      for (const [i, f] of files.entries()) {
        status.textContent = `${L('Uploading', 'अपलोड हो रहा है')} ${i + 1}/${files.length}…`;
        try { st.images.push(await uploadImage(f, user().id)); paintPhotos(); } catch (e) { toast(e.message, 'err'); }
      }
      status.textContent = ''; file.value = '';
    });
    return [h('p', { class: 'small muted' }, L('Add 3–12 bright photos: outside, rooms, bathroom, view, food. The first photo is the cover.', '3–12 साफ़ फ़ोटो जोड़ें: बाहर, कमरे, बाथरूम, नज़ारा, खाना। पहली फ़ोटो कवर होगी।')),
      fieldI(L('Upload photos (JPG, PNG, WebP, under 5 MB)', 'फ़ोटो अपलोड करें (JPG, PNG, WebP, 5 MB से कम)'), file), status, grid];
  }
  function paint() {
    clear(wrap); err.textContent = '';
    const next = h('button', { type: 'button', class: 'btn' }, L('Next', 'आगे'));
    next.addEventListener('click', () => { const m = check(st.step); if (m) { err.textContent = m; return; } st.step += 1; paint(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    const draft = h('button', { type: 'button', class: 'btn btn-ghost' }, L('Save draft', 'ड्राफ़्ट सेव करें')); draft.addEventListener('click', () => save(false, draft));
    const submit = h('button', { type: 'button', class: 'btn' }, x?.status === 'approved' ? L('Save and send for review', 'सेव करें और जाँच के लिए भेजें') : L('Send for review', 'जाँच के लिए भेजें'));
    submit.addEventListener('click', () => save(true, submit));
    wrap.append(
      h('ol', { class: 'hw-steps' }, STEPS.map((s, i) => h('li', { class: i === st.step ? 'on' : i < st.step ? 'done' : '' },
        h('button', { type: 'button', onclick: () => { if (i <= st.step || !check(st.step)) { st.step = i; paint(); } }, 'aria-current': i === st.step ? 'step' : null }, h('span', {}, String(i + 1)), s)))),
      x?.status === 'approved' ? h('p', { class: 'soft-note' }, L('Changes to an approved homestay are checked again by our team. Room prices and the calendar change straight away.', 'मंज़ूर होमस्टे में बदलाव हमारी टीम फिर जाँचेगी। रूम का किराया और कैलेंडर तुरंत बदलते हैं।')) : null,
      x?.admin_note ? h('p', { class: 'soft-note warn' }, h('strong', {}, L('Admin: ', 'एडमिन: ')), x.admin_note) : null,
      h('section', { class: 'panel stack' }, h('h2', {}, `${st.step + 1}. ${STEPS[st.step]}`), ...stepBody().flat().filter(Boolean)),
      err,
      h('div', { class: 'row-actions hw-nav' },
        st.step ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { st.step -= 1; paint(); } }, L('Back', 'पीछे')) : h('a', { class: 'btn btn-ghost', href: '#/partner/properties' }, L('Cancel', 'रद्द')),
        draft, st.step < 4 ? next : submit));
  }
  paint();
  return wrap;
}

// ---------- 3. Rate calendar ----------
export async function calendar(partner, query) {
  const d = await load(partner);
  const rooms = d.rooms.filter((r) => r.is_active);
  if (!rooms.length) return empty(L('Add a homestay with room types first.', 'पहले रूम टाइप के साथ होमस्टे जोड़ें।'), h('a', { class: 'btn', href: '#/partner/properties/new' }, L('Add homestay', 'होमस्टे जोड़ें')), 'calendar');
  const room = rooms.find((r) => r.id === query.r) || rooms.find((r) => r.homestay_id === query.h) || rooms[0];
  const month = /^\d{4}-\d{2}$/.test(query.m || '') ? query.m : IST_TODAY().slice(0, 7);
  const first = new Date(`${month}-01T00:00:00Z`);
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const end = `${month}-${String(days).padStart(2, '0')}`;
  const rates = await q(sb.from('room_rates').select('*').eq('room_id', room.id).gte('date', `${month}-01`).lte('date', end));
  const rateOf = Object.fromEntries(rates.map((x) => [x.date, x]));
  const books = d.bookings.filter((b) => b.room_id === room.id && ['confirmed', 'checked_in'].includes(b.status) && b.start_date <= end && b.end_date > `${month}-01`);
  const today = IST_TODAY();
  const sel = new Set();
  const priceOf = (iso) => { const rr = rateOf[iso]; if (rr?.custom_price != null) return [rr.custom_price, 'custom']; const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); return (dow === 5 || dow === 6) && room.weekend_price ? [room.weekend_price, 'weekend'] : [room.base_price, '']; };
  const bookedOn = (iso) => books.filter((b) => b.start_date <= iso && b.end_date > iso).reduce((s, b) => s + (b.rooms_booked || 1), 0);
  const nav = (m) => { const dt = new Date(`${month}-01T00:00:00Z`); dt.setUTCMonth(dt.getUTCMonth() + m); return `#/partner/calendar?r=${room.id}&m=${dt.toISOString().slice(0, 7)}`; };

  const bar = h('div', { class: 'cal-bar', hidden: true });
  const grid = h('div', { class: 'cal-grid', role: 'grid', 'aria-label': L('Rate calendar', 'रेट कैलेंडर') });
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((w, i) => grid.append(h('span', { class: 'cal-wd' }, getLang() === 'hi' ? ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'][i] : w)));
  const lead = (first.getUTCDay() + 6) % 7;
  for (let i = 0; i < lead; i += 1) grid.append(h('span', { class: 'cal-pad' }));
  for (let day = 1; day <= days; day += 1) {
    const iso = `${month}-${String(day).padStart(2, '0')}`;
    const [p, kind] = priceOf(iso); const bk = bookedOn(iso); const bl = rateOf[iso]?.blocked_units || 0;
    const left = room.total_inventory - bk - bl; const past = iso < today;
    const cell = h('button', { type: 'button', class: `cal-day${past ? ' past' : ''}${left <= 0 ? ' full' : ''}${bl ? ' blocked' : ''}${kind ? ` ${kind}` : ''}${iso === today ? ' today' : ''}`, disabled: past,
      'aria-pressed': 'false', 'aria-label': `${iso}: ${inr(p)}, ${left > 0 ? `${left} ${L('free', 'खाली')}` : L('no rooms free', 'कोई कमरा खाली नहीं')}${bl ? `, ${bl} ${L('blocked', 'बंद')}` : ''}${bk ? `, ${bk} ${L('booked', 'बुक')}` : ''}` },
      h('span', { class: 'cal-n' }, String(day)), h('span', { class: 'cal-p' }, inr(p)),
      h('span', { class: 'cal-s' }, bl >= room.total_inventory ? L('Closed', 'बंद') : `${Math.max(0, left)}/${room.total_inventory}`));
    cell.addEventListener('click', () => { if (sel.has(iso)) sel.delete(iso); else sel.add(iso); cell.classList.toggle('sel'); cell.setAttribute('aria-pressed', String(sel.has(iso))); paintBar(); });
    grid.append(cell);
  }
  const priceI = h('input', { class: 'input', type: 'number', min: 1, step: 50, placeholder: '₹', 'aria-label': L('Price for selected dates', 'चुनी तारीख़ों का किराया') });
  async function apply(patch, btn) {
    await busy(btn, async () => {
      const rows = [...sel].map((date) => ({ room_id: room.id, date, custom_price: rateOf[date]?.custom_price ?? null, blocked_units: rateOf[date]?.blocked_units ?? 0, ...patch }));
      await q(sb.from('room_rates').upsert(rows, { onConflict: 'room_id,date' }));
      toast(L('Calendar updated', 'कैलेंडर अपडेट हुआ')); refresh();
    }).catch((e) => toast(e.message, 'err'));
  }
  function paintBar() {
    clear(bar); bar.hidden = !sel.size; if (!sel.size) return;
    const mk = (label, patch, cls = 'btn btn-sm') => { const b = h('button', { type: 'button', class: cls }, label); b.addEventListener('click', () => apply(typeof patch === 'function' ? patch() : patch, b)); return b; };
    const setP = h('button', { type: 'button', class: 'btn btn-sm' }, L('Set price', 'किराया रखें'));
    setP.addEventListener('click', () => { const v = Math.round(Number(priceI.value)); if (!(v > 0)) { toast(L('Enter a price', 'किराया लिखें'), 'err'); return; } apply({ custom_price: v }, setP); });
    bar.append(h('strong', {}, `${sel.size} ${L('date(s) selected', 'तारीख़ चुनी')}`),
      mk(L('Close (block all rooms)', 'बंद करें (सभी कमरे)'), { blocked_units: room.total_inventory }, 'btn btn-danger-ghost btn-sm'),
      room.total_inventory > 1 ? mk(L('Block 1 room', '1 कमरा बंद'), () => ({ blocked_units: Math.min(room.total_inventory, 1) })) : null,
      mk(L('Open', 'खोलें'), { blocked_units: 0 }, 'btn btn-ghost btn-sm'),
      h('span', { class: 'cal-price' }, priceI, setP),
      mk(L('Normal price', 'सामान्य किराया'), { custom_price: null }, 'btn btn-ghost btn-sm'),
      h('button', { type: 'button', class: 'link-btn small', onclick: () => { sel.clear(); grid.querySelectorAll('.sel').forEach((c) => { c.classList.remove('sel'); c.setAttribute('aria-pressed', 'false'); }); paintBar(); } }, L('Clear selection', 'चुनाव हटाएँ')));
  }
  const roomSel = h('select', { class: 'input', 'aria-label': L('Room type', 'रूम टाइप') }, rooms.map((r) => h('option', { value: r.id, selected: r.id === room.id }, `${hsName(d, r.homestay_id)} · ${r.room_type}`)));
  roomSel.addEventListener('change', () => { location.hash = `#/partner/calendar?r=${roomSel.value}&m=${month}`; });
  const monthLabel = first.toLocaleDateString(getLang() === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return h('div', { class: 'stack' },
    h('div', { class: 'cal-top' }, roomSel,
      h('div', { class: 'cal-month' }, h('a', { class: 'btn btn-ghost btn-sm', href: nav(-1), 'aria-label': L('Previous month', 'पिछला महीना') }, '‹'), h('strong', {}, monthLabel), h('a', { class: 'btn btn-ghost btn-sm', href: nav(1), 'aria-label': L('Next month', 'अगला महीना') }, '›'))),
    h('p', { class: 'small muted' }, `${L('Normal', 'सामान्य')} ${inr(room.base_price)}${room.weekend_price ? ` · ${L('Weekend', 'वीकेंड')} ${inr(room.weekend_price)}` : ''} · ${room.total_inventory} ${L('rooms', 'कमरे')}. ${L('Tap dates, then choose an action.', 'तारीख़ें दबाएँ, फिर काम चुनें।')}`),
    h('div', { class: 'cal-legend small' }, h('span', { class: 'lg custom' }, L('Custom price', 'ख़ास किराया')), h('span', { class: 'lg weekend' }, L('Weekend price', 'वीकेंड किराया')), h('span', { class: 'lg blocked' }, L('Blocked', 'बंद')), h('span', { class: 'lg full' }, L('Fully booked / closed', 'पूरा बुक / बंद'))),
    grid, bar);
}

// ---------- 4. Bookings ----------
export async function bookings(partner, query) {
  const d = await load(partner);
  const today = IST_TODAY();
  const groups = {
    requests: d.bookings.filter((b) => b.status === 'requested'),
    today: d.bookings.filter((b) => (b.status === 'confirmed' && b.start_date <= today && b.end_date >= today) || b.status === 'checked_in'),
    upcoming: d.bookings.filter((b) => b.status === 'confirmed' && b.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date)),
    completed: d.bookings.filter((b) => b.status === 'completed'),
    cancelled: d.bookings.filter((b) => ['cancelled', 'declined'].includes(b.status)),
  };
  const tab = groups[query.tab] ? query.tab : groups.requests.length ? 'requests' : 'upcoming';
  const label = { requests: L('Requests', 'रिक्वेस्ट'), today: L('Check-ins today', 'आज के चेक-इन'), upcoming: L('Upcoming', 'आने वाली'), completed: L('Completed', 'पूरी'), cancelled: L('Cancelled', 'रद्द') };
  const prop = query.p || '';
  const list = groups[tab].filter((b) => !prop || b.homestay_id === prop);
  live('host-bookings', [{ table: 'booking_requests', filter: `partner_id=eq.${partner.id}` }], () => { toast(L('Bookings updated', 'बुकिंग अपडेट हुई')); refresh(); });
  const propSel = d.hs.length > 1 ? h('select', { class: 'input', 'aria-label': L('Property', 'प्रॉपर्टी') }, h('option', { value: '' }, L('All properties', 'सभी प्रॉपर्टी')), d.hs.map((x) => h('option', { value: x.id, selected: x.id === prop }, x.name))) : null;
  propSel?.addEventListener('change', () => { location.hash = `#/partner/bookings?tab=${tab}&p=${propSel.value}`; });
  return h('div', { class: 'stack' },
    h('nav', { class: 'seg-tabs' }, Object.keys(groups).map((k) => h('a', { href: `#/partner/bookings?tab=${k}${prop ? `&p=${prop}` : ''}`, class: k === tab ? 'on' : '' }, `${label[k]} (${groups[k].length})`))),
    propSel,
    list.length ? h('div', { class: 'hb-list' }, list.map((b) => bookingCard(b, d, partner))) : empty(L('Nothing here.', 'यहाँ कुछ नहीं।'), null, 'calendar'));
}

function bookingCard(b, d, partner) {
  const today = IST_TODAY();
  const act = (status, text, cls = 'btn btn-sm', needNote = false) => {
    const btn = h('button', { type: 'button', class: cls }, text);
    btn.addEventListener('click', () => {
      if (!needNote && status !== 'cancelled') return go(btn, status, '');
      const note = h('textarea', { class: 'input', rows: 2, maxlength: 500, placeholder: L('Message for the guest (optional)', 'मेहमान के लिए संदेश (वैकल्पिक)') });
      const yes = h('button', { type: 'button', class: 'btn btn-danger' }, text);
      const dlg = modal(text, h('div', { class: 'stack' }, h('p', {}, `${b.guest_name} · ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}`), note,
        h('div', { class: 'row-actions' }, h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => dlg.close() }, L('Back', 'पीछे')), yes)));
      yes.addEventListener('click', () => go(yes, status, note.value).then(() => dlg.close()));
    });
    return btn;
  };
  const go = (btn, status, note) => busy(btn, async () => { await q(sb.rpc('set_booking_status', { p_id: b.id, p_status: status, p_note: note })); toast(L('Saved', 'सेव हुआ')); refresh(); }).catch((e) => toast(e.message, 'err'));
  const n = nights(b.start_date, b.end_date);
  return h('article', { class: 'hb-card' },
    h('div', { class: 'hb-top' }, h('strong', { class: 'mono' }, b.booking_code || '—'), pill(b.status)),
    h('div', { class: 'hb-main' },
      h('div', {}, h('strong', {}, b.guest_name), h('div', { class: 'small' }, h('a', { href: `tel:${b.guest_phone}` }, b.guest_phone))),
      h('div', { class: 'small' }, h('strong', {}, `${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}`), ` · ${n} ${L(n === 1 ? 'night' : 'nights', 'रात')}`),
      h('div', { class: 'small muted' }, `${hsName(d, b.homestay_id)}${b.room_id ? ` · ${roomName(d, b.room_id)} × ${b.rooms_booked}` : ''} · ${b.guests} ${L('guests', 'मेहमान')}`)),
    b.message ? h('p', { class: 'small' }, `“${b.message}”`) : null,
    b.total_amount != null ? h('div', { class: 'hb-money small' },
      h('span', {}, `${b.status === 'requested' ? L('Estimate', 'अनुमान') : L('Booking', 'बुकिंग')} ${inr(b.total_amount)}`),
      b.platform_commission != null ? h('span', { class: 'muted' }, `− ${L('THH', 'THH')} ${inr(b.platform_commission)} (${Number(b.commission_rate)}%)`) : null,
      b.partner_payout_amount != null ? h('strong', {}, `${L('You get', 'आपको')} ${inr(b.partner_payout_amount)}`) : null,
      b.status === 'completed' ? pill(b.payout_status) : null) : null,
    h('div', { class: 'row-actions' },
      b.status === 'requested' ? [act('confirmed', L('Confirm', 'कन्फ़र्म करें')), act('declined', L('Decline', 'मना करें'), 'btn btn-ghost btn-sm', true)] : null,
      b.status === 'confirmed' && b.start_date <= today ? act('checked_in', L('Mark checked in', 'चेक-इन करें')) : null,
      ['confirmed', 'checked_in'].includes(b.status) && b.start_date <= today ? act('completed', L('Mark completed', 'पूरा करें'), b.status === 'checked_in' ? 'btn btn-sm' : 'btn btn-ghost btn-sm') : null,
      b.status === 'confirmed' && b.start_date > today ? act('cancelled', L('Cancel booking', 'बुकिंग रद्द करें'), 'btn btn-danger-ghost btn-sm', true) : null,
      ['confirmed', 'checked_in', 'completed'].includes(b.status) ? h('a', { class: 'btn btn-ghost btn-sm', href: `#/voucher/${b.id}` }, icon('doc', 15), L('Voucher', 'वाउचर')) : null));
}

// Voucher (host and guest): printable booking confirmation.
export async function voucher({ params }) {
  if (!user()) { location.hash = `#/login?next=voucher/${params.id}`; return h('div'); }
  const b = await q(sb.from('booking_requests').select('*').eq('id', params.id).maybeSingle());
  if (!b || b.kind !== 'homestay') return h('div', { class: 'page narrow' }, empty(L('Voucher not found.', 'वाउचर नहीं मिला।')));
  const [x, room, partner] = await Promise.all([
    q(sb.from('homestays').select('*').eq('id', b.homestay_id).maybeSingle()),
    b.room_id ? q(sb.from('homestay_rooms').select('*').eq('id', b.room_id).maybeSingle()).catch(() => null) : null,
    q(sb.rpc('partner_cards', { p_ids: [b.partner_id] })).then((r) => r?.[0]).catch(() => null),
  ]);
  const n = nights(b.start_date, b.end_date);
  const row = (k, v) => (v ? h('div', { class: 'kv-row' }, h('dt', {}, k), h('dd', {}, v)) : null);
  return h('div', { class: 'page narrow voucher' },
    h('div', { class: 'vc-actions no-print' }, h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, L('Print / save as PDF', 'प्रिंट / PDF सेव करें')),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => history.back() }, L('Back', 'पीछे'))),
    h('article', { class: 'vc-card' },
      h('header', { class: 'vc-head' }, h('img', { src: 'img/brand/mark.png', alt: '', width: 44, height: 42 }),
        h('div', {}, h('strong', {}, 'The Himalayan Horizon'), h('div', { class: 'small muted' }, L('Homestay booking voucher', 'होमस्टे बुकिंग वाउचर'))),
        h('div', { class: 'vc-code' }, h('span', { class: 'small muted' }, L('Booking ID', 'बुकिंग आईडी')), h('strong', { class: 'mono' }, b.booking_code))),
      h('h1', {}, x?.name || ''), h('p', { class: 'muted' }, [x?.village, x?.district, x?.state].filter(Boolean).join(', ')),
      h('dl', { class: 'kv-rows' },
        row(L('Guest', 'मेहमान'), `${b.guest_name} · ${b.guest_phone}`),
        row(L('Check-in', 'चेक-इन'), fmtDate(b.start_date)), row(L('Check-out', 'चेक-आउट'), fmtDate(b.end_date)),
        row(L('Nights', 'रातें'), String(n)), row(L('Room', 'कमरा'), room ? `${room.room_type} × ${b.rooms_booked}` : null), row(L('Guests', 'मेहमान'), String(b.guests)),
        row(L('Booking value', 'बुकिंग की रकम'), b.total_amount != null ? inr(b.total_amount) : null),
        row(L('Status', 'स्थिति'), STATUS()[b.status]?.[1] || b.status),
        row(L('Host', 'होस्ट'), partner?.business_name || null), row(L('Meals', 'खाना'), x?.meals || null)),
      h('p', { class: 'small muted' }, L('Payment is made directly to the host as agreed. Show this voucher at check-in.', 'भुगतान तय अनुसार सीधे होस्ट को। चेक-इन पर यह वाउचर दिखाएँ।'))));
}

// ---------- 5. Earnings & payouts ----------
export async function earnings(partner) {
  const d = await load(partner);
  const [payouts, kyc] = await Promise.all([
    q(sb.from('payout_requests').select('*').eq('partner_id', partner.id).order('requested_at', { ascending: false })),
    q(sb.from('partner_kyc').select('status,upi_id,bank_account_number,bank_ifsc').eq('partner_id', partner.id).maybeSingle()).catch(() => null),
  ]);
  const done = d.bookings.filter((b) => b.status === 'completed' && b.partner_payout_amount != null);
  const sum = (arr, k) => arr.reduce((s, b) => s + (b[k] || 0), 0);
  const payable = done.filter((b) => b.payout_status === 'unpaid');
  const kycOk = kyc?.status === 'verified' && (kyc.upi_id || (kyc.bank_account_number && kyc.bank_ifsc));
  const waiting = payouts.some((p) => p.status === 'pending');
  live('host-earn', [{ table: 'payout_requests', filter: `partner_id=eq.${partner.id}` }, { table: 'booking_requests', filter: `partner_id=eq.${partner.id}` }], () => refresh());
  const req = h('button', { type: 'button', class: 'btn', disabled: !kycOk || waiting || !sum(payable, 'partner_payout_amount') }, L('Request payout', 'पेआउट माँगें'), ` ${inr(sum(payable, 'partner_payout_amount'))}`);
  req.addEventListener('click', () => busy(req, async () => { await q(sb.rpc('request_payout', { p_partner: partner.id })); toast(L('Payout requested. Our team will send it and add the reference.', 'पेआउट माँगा गया। हमारी टीम भेजकर रेफ़रेंस जोड़ेगी।')); refresh(); }).catch((e) => toast(e.message, 'err')));
  return h('div', { class: 'stack' },
    h('div', { class: 'ds-stats' },
      statCard('chart', L('Gross booking value', 'कुल बुकिंग रकम'), inr(sum(done, 'total_amount'))),
      statCard('layers', L('THH commission', 'THH कमीशन'), inr(sum(done, 'platform_commission'))),
      statCard('check', L('Your net earnings', 'आपकी शुद्ध कमाई'), inr(sum(done, 'partner_payout_amount'))),
      statCard('bell', L('Payable now', 'अभी देय'), inr(sum(payable, 'partner_payout_amount')), null, payable.length ? 'warn' : '')),
    h('section', { class: 'panel stack' },
      h('div', { class: 'row-actions' }, req),
      !kycOk ? h('p', { class: 'small' }, L('Payouts open after your KYC and bank / UPI details are verified. ', 'KYC और बैंक / UPI वेरिफ़ाई होने के बाद पेआउट खुलेंगे। '), h('a', { href: '#/partner/kyc' }, L('Complete KYC', 'KYC पूरा करें')))
        : waiting ? h('p', { class: 'small' }, L('A payout request is waiting for our team.', 'एक पेआउट रिक्वेस्ट हमारी टीम के पास है।')) : null,
      h('p', { class: 'small muted' }, L('Only completed stays are paid out. Money is sent outside the website; you will see the transaction reference here.', 'सिर्फ़ पूरी हुई बुकिंग का पेआउट होता है। पैसा वेबसाइट के बाहर भेजा जाता है; ट्रांज़ैक्शन रेफ़रेंस यहाँ दिखेगा।'))),
    h('section', { class: 'stack' }, h('h2', {}, L('Ledger', 'हिसाब')),
      done.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table ledger' },
        h('thead', {}, h('tr', {}, [L('Booking', 'बुकिंग'), L('Stay', 'ठहराव'), L('Gross', 'कुल'), L('Commission', 'कमीशन'), L('Net', 'शुद्ध'), L('Payout', 'पेआउट')].map((t) => h('th', {}, t)))),
        h('tbody', {}, done.map((b) => h('tr', {},
          h('td', {}, h('span', { class: 'mono small' }, b.booking_code), h('div', { class: 'small muted' }, b.guest_name)),
          h('td', { class: 'small' }, `${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}`),
          h('td', { class: 'num' }, inr(b.total_amount)), h('td', { class: 'num muted' }, `− ${inr(b.platform_commission)}`), h('td', { class: 'num' }, h('strong', {}, inr(b.partner_payout_amount))),
          h('td', {}, pill(b.payout_status))))))) : empty(L('Completed stays will appear here.', 'पूरी हुई बुकिंग यहाँ दिखेंगी।'), null, 'chart')),
    h('section', { class: 'stack' }, h('h2', {}, L('Payout history', 'पेआउट इतिहास')),
      payouts.length ? h('div', { class: 'hb-list' }, payouts.map((p) => h('article', { class: 'hb-card' },
        h('div', { class: 'hb-top' }, h('strong', {}, inr(p.amount)), pill(p.status === 'approved' ? 'paid' : p.status === 'pending' ? 'processing' : 'rejected')),
        h('div', { class: 'small muted' }, `${fmtDate(p.requested_at)} · ${p.bookings_count} ${L('stay(s)', 'ठहराव')}`),
        p.transaction_ref ? h('div', { class: 'small' }, `${L('Reference', 'रेफ़रेंस')}: `, h('span', { class: 'mono selectable' }, p.transaction_ref)) : null,
        p.admin_note ? h('div', { class: 'small' }, `${L('Note', 'नोट')}: ${p.admin_note}`) : null))) : h('p', { class: 'small muted' }, L('No payouts yet.', 'अभी कोई पेआउट नहीं।'))));
}

// ---------- 6. KYC & bank ----------
export async function kyc(partner) {
  const k = await q(sb.from('partner_kyc').select('*').eq('partner_id', partner.id).maybeSingle()).catch(() => null) || {};
  const v = { id_type: 'aadhaar', id_number: '', id_file: '', gst_number: '', bank_account_name: '', bank_account_number: '', bank_ifsc: '', upi_id: '', ...k };
  const field = (label, el, hint) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), el, hint ? h('small', { class: 'muted' }, hint) : null);
  const inp = (key, attrs = {}) => { const el = h('input', { class: 'input', value: v[key] || '', ...attrs }); el.addEventListener('input', () => { v[key] = el.value; }); return el; };
  const typeSel = h('select', { class: 'input' }, [['aadhaar', 'Aadhaar'], ['pan', 'PAN'], ['gst', 'GST'], ['passport', L('Passport', 'पासपोर्ट')], ['voter_id', L('Voter ID', 'वोटर आईडी')]].map(([x, t]) => h('option', { value: x, selected: x === v.id_type }, t)));
  typeSel.addEventListener('change', () => { v.id_type = typeSel.value; });
  const fileI = h('input', { type: 'file', class: 'input', accept: 'image/jpeg,image/png,image/webp,application/pdf' });
  const fileNote = h('p', { class: 'small muted' }, v.id_file ? L('A file is uploaded. Choose a new one to replace it.', 'फ़ाइल अपलोड है। बदलने के लिए नई चुनें।') : L('Photo or PDF of the ID, under 5 MB.', 'आईडी की फ़ोटो या PDF, 5 MB से कम।'));
  const viewBtn = v.id_file ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, L('View my file', 'मेरी फ़ाइल देखें')) : null;
  viewBtn?.addEventListener('click', () => busy(viewBtn, async () => { const { data, error } = await sb.storage.from('partner-docs').createSignedUrl(v.id_file, 300); if (error) throw error; window.open(data.signedUrl, '_blank', 'noopener'); }).catch((e) => toast(e.message, 'err')));
  const err = h('p', { class: 'form-err', role: 'alert' });
  const save = h('button', { type: 'submit', class: 'btn' }, L('Save and send for verification', 'सेव करें और वेरिफ़िकेशन के लिए भेजें'));
  const form = h('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); err.textContent = '';
    const ifsc = v.bank_ifsc.trim().toUpperCase();
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) { err.textContent = L('IFSC looks wrong (e.g. SBIN0001234).', 'IFSC ग़लत लगता है (जैसे SBIN0001234)।'); return; }
    if (v.upi_id && !/^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.]{1,40}$/.test(v.upi_id.trim())) { err.textContent = L('UPI ID looks wrong (e.g. name@okbank).', 'UPI आईडी ग़लत लगती है (जैसे name@okbank)।'); return; }
    if (!v.upi_id.trim() && !(v.bank_account_number.trim() && ifsc)) { err.textContent = L('Add a UPI ID or bank account number with IFSC.', 'UPI आईडी या बैंक खाता नंबर और IFSC जोड़ें।'); return; }
    busy(save, async () => {
      let path = v.id_file;
      const f = fileI.files[0];
      if (f) {
        if (f.size > 5 * 1024 * 1024) throw new Error(L('File must be under 5 MB', 'फ़ाइल 5 MB से कम हो'));
        path = `${user().id}/kyc-${Date.now()}.${(f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const { error } = await sb.storage.from('partner-docs').upload(path, f, { upsert: false });
        if (error) throw new Error(error.message);
      }
      if (!path) throw new Error(L('Please upload your ID proof.', 'अपना आईडी प्रूफ़ अपलोड करें।'));
      const row = { partner_id: partner.id, id_type: v.id_type, id_number: v.id_number.trim(), id_file: path, gst_number: v.gst_number.trim(),
        bank_account_name: v.bank_account_name.trim(), bank_account_number: v.bank_account_number.trim(), bank_ifsc: ifsc, upi_id: v.upi_id.trim() };
      await q(sb.from('partner_kyc').upsert(row, { onConflict: 'partner_id' }));
      toast(L('Sent for verification', 'वेरिफ़िकेशन के लिए भेजा')); refresh();
    }).catch((ex) => { err.textContent = ex.message; });
  } },
    h('section', { class: 'panel stack' }, h('h2', {}, L('ID proof', 'आईडी प्रूफ़')),
      h('div', { class: 'row2' }, field(L('ID type', 'आईडी का प्रकार'), typeSel), field(L('ID number', 'आईडी नंबर'), inp('id_number', { maxlength: 30, autocomplete: 'off' }))),
      field(L('Upload ID', 'आईडी अपलोड करें'), fileI), fileNote, viewBtn,
      field(L('GST number (if registered)', 'GST नंबर (अगर है)'), inp('gst_number', { maxlength: 20 }))),
    h('section', { class: 'panel stack' }, h('h2', {}, L('Where to send payouts', 'पेआउट कहाँ भेजें')),
      field(L('UPI ID', 'UPI आईडी'), inp('upi_id', { maxlength: 100, placeholder: 'name@okbank', autocomplete: 'off' })),
      h('p', { class: 'small muted center' }, L('or bank account', 'या बैंक खाता')),
      field(L('Account holder name', 'खाताधारक का नाम'), inp('bank_account_name', { maxlength: 120 })),
      h('div', { class: 'row2' }, field(L('Account number', 'खाता नंबर'), inp('bank_account_number', { maxlength: 30, inputmode: 'numeric', autocomplete: 'off' })), field('IFSC', inp('bank_ifsc', { maxlength: 11, autocapitalize: 'characters' })))),
    err, save,
    h('p', { class: 'small muted' }, L('Only you and The Himalayan Horizon team can see these details. Any change sends them for verification again.', 'ये जानकारी सिर्फ़ आप और द हिमालयन होराइज़न टीम देख सकती है। कोई भी बदलाव फिर से वेरिफ़िकेशन के लिए जाएगा।')));
  live('host-kyc', [{ table: 'partner_kyc', filter: `partner_id=eq.${partner.id}` }], () => refresh());
  return h('div', { class: 'stack' },
    k.status ? h('div', { class: `soft-note ${k.status === 'verified' ? 'ok' : k.status === 'rejected' ? 'warn' : ''}` }, h('strong', {}, L('KYC status: ', 'KYC स्थिति: ')), pill(k.status),
      k.admin_remark ? h('div', { class: 'small' }, `${L('Admin', 'एडमिन')}: ${k.admin_remark}`) : null) : null,
    form);
}

// ---------- 7. Support ----------
export async function support(partner, query) {
  const tickets = await q(sb.from('support_tickets').select('*').eq('created_by', user().id).order('last_message_at', { ascending: false }));
  if (query.t) return ticketThread(tickets.find((t) => t.id === query.t), '#/partner/support', false);
  const subj = h('input', { class: 'input', maxlength: 140, required: true, id: 'tk-subj' });
  const cat = h('select', { class: 'input', id: 'tk-cat' }, [['booking', L('Booking', 'बुकिंग')], ['payout', L('Payout', 'पेआउट')], ['kyc', 'KYC'], ['listing', L('Property', 'प्रॉपर्टी')], ['technical', L('Website / app', 'वेबसाइट / ऐप')], ['other', L('Other', 'अन्य')]].map(([v, t]) => h('option', { value: v }, t)));
  const body = h('textarea', { class: 'input', rows: 4, maxlength: 2000, required: true, id: 'tk-body' });
  const send = h('button', { type: 'submit', class: 'btn' }, L('Send to THH support', 'THH सपोर्ट को भेजें'));
  const form = h('form', { class: 'panel stack', onsubmit: (e) => { e.preventDefault(); busy(send, async () => {
    const t = await q(sb.rpc('open_ticket', { p_subject: subj.value, p_category: cat.value, p_body: body.value, p_partner: partner.id }));
    toast(L('Ticket sent', 'टिकट भेजा')); location.hash = `#/partner/support?t=${t.id}`;
  }).catch((ex) => toast(ex.message, 'err')); } },
    h('h2', {}, L('New ticket', 'नया टिकट')),
    h('div', { class: 'row2' }, h('label', { class: 'field', for: 'tk-subj' }, h('span', { class: 'field-label' }, L('Subject', 'विषय')), subj), h('label', { class: 'field', for: 'tk-cat' }, h('span', { class: 'field-label' }, L('About', 'किस बारे में')), cat)),
    h('label', { class: 'field', for: 'tk-body' }, h('span', { class: 'field-label' }, L('Message', 'संदेश')), body), send);
  live('host-tickets', [{ table: 'support_tickets', filter: `created_by=eq.${user().id}` }], () => refresh());
  return h('div', { class: 'stack' },
    tickets.length ? h('div', { class: 'hb-list' }, tickets.map((t) => h('a', { class: 'hb-card tk-row', href: `#/partner/support?t=${t.id}` },
      h('div', { class: 'hb-top' }, h('strong', {}, t.subject), pill(t.status)), h('div', { class: 'small muted' }, `${fmtDate(t.last_message_at, true)} · ${t.category}`)))) : null,
    form);
}

// Shared ticket thread (partner and admin).
export async function ticketThread(t, backHref, asAdmin) {
  if (!t) return empty(L('Ticket not found.', 'टिकट नहीं मिला।'));
  const msgs = await q(sb.from('ticket_messages').select('*').eq('ticket_id', t.id).order('created_at'));
  const box = h('textarea', { class: 'input', rows: 3, maxlength: 2000, 'aria-label': L('Your reply', 'आपका जवाब') });
  const send = h('button', { type: 'button', class: 'btn' }, L('Send', 'भेजें'));
  const closeB = asAdmin ? h('button', { type: 'button', class: 'btn btn-ghost' }, L('Reply and close', 'जवाब दें और बंद करें')) : null;
  const post = (btn, close) => busy(btn, async () => { await q(sb.rpc('post_ticket_message', { p_ticket: t.id, p_body: box.value, p_close: !!close })); refresh(); }).catch((e) => toast(e.message, 'err'));
  send.addEventListener('click', () => post(send, false)); closeB?.addEventListener('click', () => post(closeB, true));
  live('ticket', [{ table: 'ticket_messages', filter: `ticket_id=eq.${t.id}` }], () => refresh());
  return h('div', { class: 'stack' },
    h('a', { class: 'link-btn', href: backHref }, '← ', L('All tickets', 'सभी टिकट')),
    h('div', { class: 'hb-top' }, h('h2', {}, t.subject), pill(t.status)),
    h('div', { class: 'tk-thread' }, msgs.map((m) => h('div', { class: `tk-msg${m.is_admin ? ' admin' : ''}${(m.is_admin === asAdmin) ? ' mine' : ''}` },
      h('div', { class: 'small muted' }, `${m.is_admin ? 'THH support' : L('Partner', 'पार्टनर')} · ${fmtDate(m.created_at, true)}`), h('p', {}, m.body)))),
    t.status === 'closed' && !asAdmin ? h('p', { class: 'soft-note' }, L('This ticket is closed. Open a new one if you still need help.', 'यह टिकट बंद है। मदद चाहिए तो नया खोलें।'))
      : h('div', { class: 'panel stack' }, box, h('div', { class: 'row-actions' }, send, closeB)));
}

export { todayISO };
