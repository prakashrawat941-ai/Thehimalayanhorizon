// Admin → Trip Planner: real analytics, review moderation, planner cost defaults,
// and quick links to the destination / homestay / itinerary managers.
import { h, toast, empty, inr, fmtDate, busy } from '../ui.js';
import { getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
import { resetCache, locations } from '../store.js';
import { buildForm } from '../forms.js';
import { PREFS, PACES, MODES } from './common.js';

const L = (en, hi) => (getLang() === 'hi' ? hi : en);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function bars(rows, label = (r) => r.label) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return h('p', { class: 'muted small' }, L('No data yet.', 'अभी कोई डेटा नहीं।'));
  return h('ul', { class: 'ad-bars' }, rows.map((r) => h('li', {}, h('span', { class: 'ad-bar-l' }, label(r)),
    h('span', { class: 'ad-bar' }, h('i', { style: { width: `${Math.round((r.n / max) * 100)}%` } })), h('strong', {}, String(r.n)))));
}
const nameOf = (list, k) => { const x = list.find((p) => p[0] === k); return x ? L(x[1], x[2]) : k; };

export async function tripAdmin() {
  const statsRes = await sb.rpc('admin_trip_stats');
  const page = h('div', { class: 'stack' });
  if (statsRes.error) {
    page.append(h('div', { class: 'soft-note warn' }, L('Trip analytics need the Trip Planner database update. Once it is applied, real numbers show here.', 'ट्रिप एनालिटिक्स के लिए ट्रिप प्लानर का डेटाबेस अपडेट चाहिए। लगते ही असली आँकड़े यहाँ दिखेंगे।')));
  } else {
    const s = statsRes.data;
    const card = (label, value) => h('div', { class: 'stat' }, h('strong', {}, value), h('span', {}, label));
    page.append(
      h('div', { class: 'panel' }, h('h2', {}, L('Trip planning at a glance', 'ट्रिप प्लानिंग एक नज़र में')),
        h('div', { class: 'stat-grid' },
          card(L('Trips created', 'बनी ट्रिप'), String(s.total_trips)), card(L('Last 30 days', 'पिछले 30 दिन'), String(s.trips_last_30_days)),
          card(L('Average days', 'औसत दिन'), s.avg_days == null ? '—' : String(s.avg_days)), card(L('Average budget', 'औसत बजट'), s.avg_budget == null ? '—' : inr(s.avg_budget)),
          card(L('Average travellers', 'औसत यात्री'), s.avg_travellers == null ? '—' : String(s.avg_travellers)), card(L('Saved destinations', 'सेव जगहें'), String(s.saved_destinations)))),
      h('div', { class: 'ad-cols' },
        h('div', { class: 'panel' }, h('h3', {}, L('Most planned destinations', 'सबसे ज़्यादा प्लान की गई जगहें')), bars((s.top_destinations || []).map((x) => ({ label: x.name, n: Number(x.n) })))),
        h('div', { class: 'panel' }, h('h3', {}, L('Most chosen preferences', 'सबसे ज़्यादा चुनी पसंद')), bars((s.top_preferences || []).map((x) => ({ label: nameOf(PREFS, x.pref), n: Number(x.n) })))),
        h('div', { class: 'panel' }, h('h3', {}, L('Travel season (start month)', 'यात्रा का मौसम (शुरुआती महीना)')), bars((s.by_start_month || []).map((x) => ({ label: MONTHS[x.month - 1], n: Number(x.n) })))),
        h('div', { class: 'panel' }, h('h3', {}, L('Trips created per month', 'हर महीने बनी ट्रिप')), bars((s.created_by_month || []).map((x) => ({ label: x.month, n: Number(x.n) })))),
        h('div', { class: 'panel' }, h('h3', {}, L('Travel mode', 'साधन')), bars(Object.entries(s.by_mode || {}).map(([k, n]) => ({ label: nameOf(MODES, k), n })))),
        h('div', { class: 'panel' }, h('h3', {}, L('Pace', 'रफ़्तार')), bars(Object.entries(s.by_pace || {}).map(([k, n]) => ({ label: nameOf(PACES, k), n }))))),
      h('p', { class: 'muted small' }, L('All numbers come straight from saved trips. Searches are not tracked, so "most planned destinations" is used instead of "most searched".',
        'सारे आँकड़े सेव ट्रिप से हैं। खोज ट्रैक नहीं होती, इसलिए "सबसे ज़्यादा खोजी गई" की जगह "सबसे ज़्यादा प्लान की गई जगहें" दिखाई गई हैं।')));
  }

  // Review moderation
  const revBox = h('div', { class: 'panel' }, h('h2', {}, L('Destination reviews', 'जगहों के रिव्यू')));
  const revs = await sb.from('destination_reviews').select('*').order('created_at', { ascending: false }).limit(50);
  if (revs.error) revBox.append(h('p', { class: 'muted small' }, L('Available after the database update.', 'डेटाबेस अपडेट के बाद उपलब्ध।')));
  else if (!revs.data.length) revBox.append(empty(L('No reviews yet.', 'अभी कोई रिव्यू नहीं।')));
  else {
    const locs = await locations();
    revs.data.forEach((r) => {
      const loc = locs.find((l) => l.id === r.location_id);
      const status = h('span', { class: `pill ${r.status === 'approved' ? 'pill-ok' : r.status === 'rejected' ? 'pill-bad' : 'pill-warn'}` }, r.status);
      const act = (to, label) => { const b = h('button', { type: 'button', class: 'btn btn-sm btn-ghost', onclick: () => busy(b, async () => { await q(sb.from('destination_reviews').update({ status: to }).eq('id', r.id)); status.textContent = to; status.className = `pill ${to === 'approved' ? 'pill-ok' : 'pill-bad'}`; toast(L('Updated', 'अपडेट हुआ')); }) }, label); return b; };
      revBox.append(h('div', { class: 'ad-review' },
        h('div', { class: 'grow' }, h('strong', {}, `${loc?.name || '—'} · ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}`), h('p', {}, r.body || '—'), h('span', { class: 'muted small' }, fmtDate(r.created_at))),
        status, act('approved', L('Approve', 'मंज़ूर')), act('rejected', L('Reject', 'नामंज़ूर'))));
    });
  }

  // Planner cost defaults (shown to travellers as editable starting values)
  const set = await q(sb.from('site_settings').select('*').eq('key', 'trip_defaults')).catch(() => []);
  const vals = set?.[0]?.value || {};
  const form = buildForm([
    { name: 'fuel_price', label: L('Petrol price (₹/litre)', 'पेट्रोल रेट (₹/लीटर)'), type: 'number', step: 0.01, nullable: true },
    { name: 'diesel_price', label: L('Diesel price (₹/litre)', 'डीज़ल रेट (₹/लीटर)'), type: 'number', step: 0.01, nullable: true },
    { name: 'taxi_per_km', label: L('Typical taxi rate (₹/km)', 'आम टैक्सी रेट (₹/किमी)'), type: 'number', nullable: true },
    { name: 'food_per_person_day', label: L('Typical food cost per person per day (₹)', 'प्रति व्यक्ति प्रति दिन खाना (₹)'), type: 'number', nullable: true },
    { name: 'stay_per_night', label: L('Typical homestay room per night (₹)', 'आम होमस्टे कमरा प्रति रात (₹)'), type: 'number', nullable: true },
    { name: 'updated_on', label: L('Rates checked on (date)', 'रेट कब जाँचे (तारीख़)'), max: 20 },
  ], vals, { onSubmit: async (data) => { await q(sb.from('site_settings').upsert({ key: 'trip_defaults', value: { ...vals, ...data } })); resetCache(); toast(L('Saved', 'सेव हुआ')); } });

  page.append(revBox,
    h('div', { class: 'panel' }, h('h2', {}, L('Planner cost defaults', 'प्लानर के ख़र्च के डिफ़ॉल्ट')),
      h('p', { class: 'muted small' }, L('Travellers see these as starting values in the budget (marked as your estimate) and can change them. Leave empty to ask travellers to fill them in.',
        'यात्रियों को बजट में ये शुरुआती रक़म दिखेंगी (आपके अनुमान के रूप में) और वे बदल सकते हैं। ख़ाली छोड़ें तो यात्री ख़ुद भरेंगे।')), form),
    h('div', { class: 'panel' }, h('h2', {}, L('Destinations and content', 'जगहें और कंटेंट')),
      h('p', { class: 'muted small' }, L('The planner uses your published locations (with best season and how to reach), homestays and itineraries.', 'प्लानर आपकी पब्लिश की गई लोकेशन (सबसे अच्छा मौसम, कैसे पहुँचें), होमस्टे और आइटिनरेरी इस्तेमाल करता है।')),
      h('div', { class: 'actions' },
        h('a', { class: 'btn btn-ghost btn-sm', href: '#/admin/locations' }, L('Destinations & villages', 'जगहें और गाँव')),
        h('a', { class: 'btn btn-ghost btn-sm', href: '#/admin/homestay' }, L('Homestays', 'होमस्टे')),
        h('a', { class: 'btn btn-ghost btn-sm', href: '#/admin/itineraries' }, L('Itineraries', 'आइटिनरेरी')),
        h('a', { class: 'btn btn-ghost btn-sm', href: '#/admin/themes' }, L('Experiences (themes)', 'अनुभव (थीम)')))));
  return page;
}
