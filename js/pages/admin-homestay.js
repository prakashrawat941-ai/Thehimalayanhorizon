// Admin: homestay business — platform numbers, property & KYC approval queue, bookings, payouts, support tickets.
// All lists update live when partners change something.
import { h, clear, toast, busy, inr, fmtDate, icon, empty } from '../ui.js';
import { getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
import { statCard } from '../shell.js';
import { live, refresh } from '../live.js';
import { pill, ticketThread } from './host.js';

const L = (en, hi) => (getLang() === 'hi' ? hi : en);
const watch = (name, tables) => live(name, tables.map((table) => ({ table })), () => { toast(L('Updated just now', 'अभी अपडेट हुआ')); refresh(); });

// ---------- Overview ----------
export async function business() {
  const s = await q(sb.rpc('admin_homestay_stats'));
  watch('adm-biz', ['booking_requests', 'homestays', 'partner_kyc', 'payout_requests', 'support_tickets', 'partners']);
  const pend = (s.pending_properties || 0) + (s.pending_kyc || 0) + (s.pending_payouts || 0) + (s.open_tickets || 0) + (s.pending_partners || 0);
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 11 + i); return d.toISOString().slice(0, 7); });
  const by = Object.fromEntries((s.by_month || []).map((x) => [x.m, x]));
  const max = Math.max(1, ...months.map((m) => by[m]?.gmv || 0));
  const out = h('p', { class: 'chart-read small', 'aria-live': 'polite' }, L('Tap a month', 'महीना चुनें'));
  const lbl = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString(getLang() === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short' });
  const bars = h('div', { class: 'bars' }, months.map((m) => {
    const b = h('button', { type: 'button', class: 'bar', style: `--h:${Math.max(2, Math.round(((by[m]?.gmv || 0) / max) * 100))}%`, 'aria-label': `${lbl(m)}: GMV ${inr(by[m]?.gmv || 0)}` }, h('span', { class: 'bar-fill' }), h('span', { class: 'bar-l' }, lbl(m)));
    b.addEventListener('click', () => { bars.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); b.classList.add('on'); out.textContent = `${lbl(m)} ${m.slice(0, 4)}: GMV ${inr(by[m]?.gmv || 0)} · ${L('commission', 'कमीशन')} ${inr(by[m]?.commission || 0)}`; });
    return b;
  }));
  const q2 = (n, label, href) => (n ? h('a', { class: 'soft-note warn ds-alert', href }, icon('alert', 18), `${n} ${label}`) : null);
  return h('div', { class: 'stack' },
    pend ? null : h('p', { class: 'soft-note ok' }, L('Nothing waiting for approval.', 'मंज़ूरी के लिए कुछ बाकी नहीं।')),
    q2(s.pending_properties, L('properties waiting for review', 'प्रॉपर्टी जाँच के लिए'), '#/admin/queue'),
    q2(s.pending_kyc, L('KYC submissions to verify', 'KYC वेरिफ़ाई करने हैं'), '#/admin/queue?tab=kyc'),
    q2(s.pending_payouts, L('payout requests', 'पेआउट रिक्वेस्ट'), '#/admin/payouts'),
    q2(s.open_tickets, L('open support tickets', 'खुले सपोर्ट टिकट'), '#/admin/tickets'),
    q2(s.pending_partners, L('partner applications', 'पार्टनर आवेदन'), '#/admin/partners'),
    h('div', { class: 'ds-stats' },
      statCard('chart', L('GMV (booking value)', 'GMV (बुकिंग रकम)'), inr(s.gmv), '#/admin/hs-bookings'),
      statCard('layers', L('Platform commission', 'प्लेटफ़ॉर्म कमीशन'), inr(s.commission), '#/admin/hs-bookings'),
      statCard('users', L('Active partners', 'सक्रिय पार्टनर'), s.active_partners, '#/admin/partners'),
      statCard('bell', L('Pending approvals', 'बाकी मंज़ूरी'), pend, '#/admin/queue', pend ? 'warn' : '')),
    h('p', { class: 'small muted' }, `${s.live_homestays} ${L('homestays live', 'होमस्टे लाइव')} · ${L('paid out to hosts', 'होस्ट को भुगतान')} ${inr(s.paid_out)} · ${L('amounts are records; money moves outside the site', 'रकम रिकॉर्ड है; पैसा वेबसाइट के बाहर चलता है')}`),
    h('section', { class: 'panel stack' }, h('h2', {}, L('GMV by month', 'महीने के हिसाब से GMV')), h('div', { class: 'chart' }, bars, out)));
}

// ---------- Approval queue: properties and KYC ----------
export async function queue(query = {}) {
  const tab = query.tab === 'kyc' ? 'kyc' : 'properties';
  const [props, kycs, partners] = await Promise.all([
    q(sb.from('homestays').select('*').eq('status', 'pending').order('updated_at')),
    q(sb.from('partner_kyc').select('*').eq('status', 'pending').order('updated_at')),
    q(sb.from('partners').select('id,business_name,contact_name,phone,email,status').limit(1000)),
  ]);
  const pName = (id) => partners.find((p) => p.id === id);
  const rooms = props.length ? await q(sb.from('homestay_rooms').select('*').in('homestay_id', props.map((x) => x.id))) : [];
  watch('adm-queue', ['homestays', 'partner_kyc']);
  const remarkBox = (ph) => h('textarea', { class: 'input', rows: 2, maxlength: 1000, placeholder: ph });

  const propCard = (x) => {
    const p = pName(x.partner_id); const rs = rooms.filter((r) => r.homestay_id === x.id && r.is_active);
    const rate = h('input', { class: 'input', type: 'number', min: 0, max: 50, step: 0.5, value: Number(x.commission_rate ?? 12), 'aria-label': L('Commission %', 'कमीशन %') });
    const note = remarkBox(L('Remarks for the host (required to reject)', 'होस्ट के लिए टिप्पणी (अस्वीकार के लिए ज़रूरी)'));
    const decide = (status, btn) => busy(btn, async () => {
      if (status === 'rejected' && note.value.trim().length < 5) throw new Error(L('Write what needs to change.', 'लिखें क्या बदलना है।'));
      const cr = Number(rate.value); if (!(cr >= 0 && cr <= 50)) throw new Error(L('Commission must be 0–50%', 'कमीशन 0–50% हो'));
      await q(sb.from('homestays').update({ status, admin_note: note.value.trim(), commission_rate: cr }).eq('id', x.id));
      toast(status === 'approved' ? L('Approved. The host was notified.', 'मंज़ूर। होस्ट को सूचना गई।') : L('Sent back to the host.', 'होस्ट को वापस भेजा।')); refresh();
    }).catch((e) => toast(e.message, 'err'));
    const ok = h('button', { type: 'button', class: 'btn' }, L('Approve', 'मंज़ूर करें')); ok.addEventListener('click', () => decide('approved', ok));
    const no = h('button', { type: 'button', class: 'btn btn-danger-ghost' }, L('Reject with remarks', 'टिप्पणी के साथ अस्वीकार')); no.addEventListener('click', () => decide('rejected', no));
    return h('article', { class: 'panel stack aq-card' },
      h('div', { class: 'aq-photos' }, (x.images || []).slice(0, 6).map((u) => h('a', { href: u, target: '_blank', rel: 'noopener' }, h('img', { src: u, alt: '', loading: 'lazy' }))),
        !(x.images || []).length ? h('p', { class: 'small muted' }, L('No photos', 'कोई फ़ोटो नहीं')) : null),
      h('div', {}, h('h3', {}, x.name), h('p', { class: 'small muted' }, [x.village, x.district, x.state].filter(Boolean).join(', ')),
        p ? h('p', { class: 'small' }, `${p.business_name} · ${p.contact_name} · `, h('span', { class: 'selectable' }, p.phone)) : null),
      h('p', { class: 'small' }, x.summary), x.description && x.description !== x.summary ? h('details', {}, h('summary', { class: 'small' }, L('Full description', 'पूरा विवरण')), h('p', { class: 'small prose' }, x.description)) : null,
      (x.amenities || []).length ? h('p', { class: 'small muted' }, x.amenities.join(' · ')) : null,
      rs.length ? h('table', { class: 'table small' }, h('tbody', {}, rs.map((r) => h('tr', {}, h('td', {}, r.room_type), h('td', {}, `× ${r.total_inventory}`), h('td', {}, `${r.max_guests} ${L('guests', 'मेहमान')}`),
        h('td', { class: 'num' }, inr(r.base_price)), h('td', { class: 'num muted' }, r.weekend_price ? `${L('wknd', 'वीकेंड')} ${inr(r.weekend_price)}` : ''))))) : h('p', { class: 'small bad-t' }, L('No room types added', 'कोई रूम टाइप नहीं')),
      h('label', { class: 'field aq-rate' }, h('span', { class: 'field-label' }, L('THH commission %', 'THH कमीशन %')), rate), note,
      h('div', { class: 'row-actions' }, ok, no));
  };
  const kycCard = (k) => {
    const p = pName(k.partner_id);
    const note = remarkBox(L('Remark for the host (required to reject)', 'होस्ट के लिए टिप्पणी (अस्वीकार के लिए ज़रूरी)'));
    const view = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, L('View ID file', 'आईडी फ़ाइल देखें'));
    view.addEventListener('click', () => busy(view, async () => { const { data, error } = await sb.storage.from('partner-docs').createSignedUrl(k.id_file, 300); if (error) throw error; window.open(data.signedUrl, '_blank', 'noopener'); }).catch((e) => toast(e.message, 'err')));
    const decide = (status, btn) => busy(btn, async () => {
      if (status === 'rejected' && note.value.trim().length < 5) throw new Error(L('Write what is wrong.', 'लिखें क्या ग़लत है।'));
      await q(sb.from('partner_kyc').update({ status, admin_remark: note.value.trim() }).eq('partner_id', k.partner_id));
      toast(L('Saved. The host was notified.', 'सेव हुआ। होस्ट को सूचना गई।')); refresh();
    }).catch((e) => toast(e.message, 'err'));
    const ok = h('button', { type: 'button', class: 'btn' }, L('Verify', 'वेरिफ़ाई करें')); ok.addEventListener('click', () => decide('verified', ok));
    const no = h('button', { type: 'button', class: 'btn btn-danger-ghost' }, L('Reject', 'अस्वीकार')); no.addEventListener('click', () => decide('rejected', no));
    const row = (a, b) => (b ? h('div', { class: 'kv-row' }, h('dt', {}, a), h('dd', { class: 'selectable' }, b)) : null);
    return h('article', { class: 'panel stack aq-card' },
      h('h3', {}, p?.business_name || '—'), p ? h('p', { class: 'small muted' }, `${p.contact_name} · ${p.phone}`) : null,
      h('dl', { class: 'kv-rows' }, row(L('ID type', 'आईडी'), k.id_type.toUpperCase()), row(L('ID number', 'नंबर'), k.id_number), row('GST', k.gst_number),
        row('UPI', k.upi_id), row(L('Account name', 'खाताधारक'), k.bank_account_name), row(L('Account no.', 'खाता नं.'), k.bank_account_number), row('IFSC', k.bank_ifsc)),
      k.id_file ? view : h('p', { class: 'small bad-t' }, L('No ID file uploaded', 'आईडी फ़ाइल नहीं')),
      p && p.contact_name && k.bank_account_name && k.bank_account_name.toLowerCase() !== p.contact_name.toLowerCase() ? h('p', { class: 'small soft-note warn' }, L('Account name differs from the partner contact name — check before verifying.', 'खाताधारक का नाम पार्टनर के नाम से अलग है — वेरिफ़ाई करने से पहले जाँचें।')) : null,
      note, h('div', { class: 'row-actions' }, ok, no));
  };
  return h('div', { class: 'stack' },
    h('nav', { class: 'seg-tabs' }, h('a', { href: '#/admin/queue', class: tab === 'properties' ? 'on' : '' }, `${L('Properties', 'प्रॉपर्टी')} (${props.length})`),
      h('a', { href: '#/admin/queue?tab=kyc', class: tab === 'kyc' ? 'on' : '' }, `KYC (${kycs.length})`)),
    tab === 'properties' ? (props.length ? h('div', { class: 'aq-grid' }, props.map(propCard)) : empty(L('No properties waiting.', 'कोई प्रॉपर्टी बाकी नहीं।'), null, 'check'))
      : (kycs.length ? h('div', { class: 'aq-grid' }, kycs.map(kycCard)) : empty(L('No KYC waiting.', 'कोई KYC बाकी नहीं।'), null, 'check')));
}

// ---------- Homestay bookings ----------
export async function hsBookings(query = {}) {
  const rows = await q(sb.from('booking_requests').select('*, homestays(name), partners(business_name)').eq('kind', 'homestay').order('start_date', { ascending: false }).limit(500));
  const f = ['requested', 'confirmed', 'checked_in', 'completed', 'cancelled'].includes(query.s) ? query.s : 'all';
  const shown = rows.filter((b) => f === 'all' || b.status === f || (f === 'cancelled' && b.status === 'declined'));
  watch('adm-hsb', ['booking_requests']);
  const sum = (k) => shown.filter((b) => ['confirmed', 'checked_in', 'completed'].includes(b.status)).reduce((s, b) => s + (b[k] || 0), 0);
  return h('div', { class: 'stack' },
    h('nav', { class: 'seg-tabs' }, [['all', L('All', 'सभी')], ['requested', L('Requests', 'रिक्वेस्ट')], ['confirmed', L('Confirmed', 'कन्फ़र्म')], ['checked_in', L('Checked in', 'चेक-इन')], ['completed', L('Completed', 'पूरी')], ['cancelled', L('Cancelled', 'रद्द')]]
      .map(([k, l]) => h('a', { href: `#/admin/hs-bookings?s=${k}`, class: k === f ? 'on' : '' }, l))),
    h('p', { class: 'small' }, `${shown.length} ${L('bookings', 'बुकिंग')} · GMV ${inr(sum('total_amount'))} · ${L('commission', 'कमीशन')} ${inr(sum('platform_commission'))} · ${L('host share', 'होस्ट हिस्सा')} ${inr(sum('partner_payout_amount'))}`),
    shown.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, [L('Booking', 'बुकिंग'), L('Homestay', 'होमस्टे'), L('Stay', 'ठहराव'), L('Value', 'रकम'), L('Commission', 'कमीशन'), L('Status', 'स्थिति'), L('Payout', 'पेआउट')].map((t) => h('th', {}, t)))),
      h('tbody', {}, shown.map((b) => h('tr', {},
        h('td', {}, h('span', { class: 'mono small' }, b.booking_code || '—'), h('div', { class: 'small muted' }, b.guest_name)),
        h('td', { class: 'small' }, b.homestays?.name || '', h('div', { class: 'muted' }, b.partners?.business_name || '')),
        h('td', { class: 'small' }, `${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}`),
        h('td', { class: 'num' }, b.total_amount != null ? inr(b.total_amount) : '—'), h('td', { class: 'num muted' }, b.platform_commission != null ? inr(b.platform_commission) : '—'),
        h('td', {}, pill(b.status)), h('td', {}, b.status === 'completed' ? pill(b.payout_status) : ''))))))
      : empty(L('No bookings here.', 'यहाँ कोई बुकिंग नहीं।'), null, 'calendar'));
}

// ---------- Payouts ----------
export async function payouts() {
  const [rows, kycs, partners] = await Promise.all([
    q(sb.from('payout_requests').select('*').order('requested_at', { ascending: false }).limit(300)),
    q(sb.from('partner_kyc').select('partner_id,upi_id,bank_account_name,bank_account_number,bank_ifsc,status')),
    q(sb.from('partners').select('id,business_name,contact_name,phone')),
  ]);
  watch('adm-pay', ['payout_requests']);
  const pending = rows.filter((p) => p.status === 'pending');
  const card = (p) => {
    const k = kycs.find((x) => x.partner_id === p.partner_id); const pa = partners.find((x) => x.id === p.partner_id);
    const ref = h('input', { class: 'input', maxlength: 80, placeholder: L('UTR / UPI reference', 'UTR / UPI रेफ़रेंस'), 'aria-label': L('Transaction reference', 'ट्रांज़ैक्शन रेफ़रेंस') });
    const note = h('input', { class: 'input', maxlength: 500, placeholder: L('Note (reason if rejecting)', 'नोट (अस्वीकार का कारण)') });
    const act = (approve, btn) => busy(btn, async () => { await q(sb.rpc('admin_process_payout', { p_id: p.id, p_approve: approve, p_ref: ref.value, p_note: note.value })); toast(approve ? L('Marked paid. Host notified.', 'भुगतान दर्ज। होस्ट को सूचना गई।') : L('Rejected', 'अस्वीकार')); refresh(); }).catch((e) => toast(e.message, 'err'));
    const ok = h('button', { type: 'button', class: 'btn' }, L('Mark paid', 'भुगतान दर्ज करें')); ok.addEventListener('click', () => act(true, ok));
    const no = h('button', { type: 'button', class: 'btn btn-danger-ghost' }, L('Reject', 'अस्वीकार')); no.addEventListener('click', () => act(false, no));
    return h('article', { class: 'panel stack aq-card' },
      h('div', { class: 'hb-top' }, h('h3', {}, inr(p.amount)), pill('processing')),
      h('p', { class: 'small' }, `${pa?.business_name || '—'} · ${p.bookings_count} ${L('completed stay(s)', 'पूरी बुकिंग')} · ${fmtDate(p.requested_at, true)}`),
      k ? h('dl', { class: 'kv-rows' }, k.upi_id ? h('div', { class: 'kv-row' }, h('dt', {}, 'UPI'), h('dd', { class: 'selectable mono' }, k.upi_id)) : null,
        k.bank_account_number ? h('div', { class: 'kv-row' }, h('dt', {}, L('Bank', 'बैंक')), h('dd', { class: 'selectable mono' }, `${k.bank_account_name} · ${k.bank_account_number} · ${k.bank_ifsc}`)) : null) : h('p', { class: 'small bad-t' }, L('No bank details', 'बैंक जानकारी नहीं')),
      h('p', { class: 'small muted' }, L('Send the money from your bank or UPI app first, then enter its reference here.', 'पहले अपने बैंक या UPI ऐप से पैसा भेजें, फिर उसका रेफ़रेंस यहाँ डालें।')),
      ref, note, h('div', { class: 'row-actions' }, ok, no));
  };
  return h('div', { class: 'stack' },
    pending.length ? h('div', { class: 'aq-grid' }, pending.map(card)) : empty(L('No payout requests waiting.', 'कोई पेआउट रिक्वेस्ट बाकी नहीं।'), null, 'check'),
    history(rows.filter((p) => p.status !== 'pending'), partners));
}

function history(done, partners) {
  const body = done.length
    ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('tbody', {}, done.map((p) => h('tr', {},
      h('td', {}, partners.find((x) => x.id === p.partner_id)?.business_name || '—'),
      h('td', { class: 'num' }, inr(p.amount)),
      h('td', {}, pill(p.status === 'approved' ? 'paid' : 'rejected')),
      h('td', { class: 'small mono' }, p.transaction_ref || p.admin_note || ''),
      h('td', { class: 'small muted' }, fmtDate(p.processed_at || p.requested_at)))))))
    : h('p', { class: 'small muted' }, L('None yet.', 'अभी कोई नहीं।'));
  return h('section', { class: 'stack' }, h('h2', {}, L('History', 'इतिहास')), body);
}

// ---------- Support tickets ----------
export async function tickets(query = {}) {
  const rows = await q(sb.from('support_tickets').select('*, partners(business_name)').order('last_message_at', { ascending: false }).limit(300));
  if (query.t) return ticketThread(rows.find((t) => t.id === query.t), '#/admin/tickets', true);
  watch('adm-tk', ['support_tickets']);
  const order = { open: 0, answered: 1, closed: 2 };
  const list = [...rows].sort((a, b) => order[a.status] - order[b.status]);
  return list.length ? h('div', { class: 'hb-list' }, list.map((t) => h('a', { class: 'hb-card tk-row', href: `#/admin/tickets?t=${t.id}` },
    h('div', { class: 'hb-top' }, h('strong', {}, t.subject), pill(t.status)),
    h('div', { class: 'small muted' }, `${t.partners?.business_name || L('Customer', 'ग्राहक')} · ${t.category} · ${fmtDate(t.last_message_at, true)}`))))
    : empty(L('No tickets yet.', 'अभी कोई टिकट नहीं।'), null, 'support');
}
