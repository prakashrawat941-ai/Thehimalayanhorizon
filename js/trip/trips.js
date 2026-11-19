// My Trips dashboard, a saved trip, and a shared (read-only) trip link.
import { h, clear, toast, icon, inr, empty } from '../ui.js';
import { sb, q } from '../sb.js';
import { user } from '../store.js';
import { L, fmtD, loadDraft, hasContent, pName } from './common.js';
import { tripReport } from './summary.js';
import { openTrip, draftFromRow, editInPlanner, duplicateTrip, deleteTrip, shareTrip, stopSharing } from './save.js';
import { istToday, isoAdd } from './engine.js';

export function tripStage(t) {
  if (t.status === 'cancelled') return 'cancelled';
  if (t.status === 'draft') return 'draft';
  if (!t.start_date) return 'saved';
  const end = t.end_date || isoAdd(t.start_date, (t.days_count || 1) - 1);
  const today = istToday();
  if (end < today) return 'completed';
  if (t.start_date <= today) return 'ongoing';
  return 'upcoming';
}
export const STAGES = [
  ['upcoming', 'Upcoming trips', 'आने वाली ट्रिप', 'pill-warn'], ['ongoing', 'Ongoing trips', 'चल रही ट्रिप', 'pill-ok'], ['draft', 'Draft trips', 'ड्राफ़्ट ट्रिप', 'pill-done'],
  ['saved', 'Saved itineraries', 'सेव किए प्लान', 'pill-done'], ['completed', 'Completed trips', 'पूरी हुई ट्रिप', 'pill-done'], ['cancelled', 'Cancelled', 'रद्द', 'pill-bad'],
];

export async function myTrips() {
  if (!user()) { location.hash = '#/login?next=trips'; return h('div'); }
  const rows = await q(sb.from('trips').select('*').order('start_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }));
  const draft = loadDraft();
  const page = h('div', { class: 'app-page tp-page' },
    h('div', { class: 'app-head' }, h('div', { class: 'grow' }, h('h1', {}, L('My trips', 'मेरी ट्रिप')),
      h('p', { class: 'muted' }, L('Open, edit, copy, share or delete your saved trips.', 'अपनी सेव ट्रिप खोलें, बदलें, कॉपी करें, शेयर करें या हटाएँ।'))),
      h('a', { class: 'btn btn-sm', href: '#/plan/new' }, '+ ', L('New trip', 'नई ट्रिप'))));
  if (hasContent(draft) && !draft.tripId) page.append(h('a', { class: 'tp-trip', href: '#/plan/summary' }, h('span', { class: 'grow' }, h('strong', {}, L('Unsaved plan on this device', 'इस फ़ोन में बिना सेव प्लान')),
    h('span', { class: 'muted small' }, [pName(draft.start), ...draft.dests.filter(Boolean).map(pName)].join(' → '))), h('span', { class: 'pill pill-done' }, L('Not saved', 'सेव नहीं'))));
  if (!rows.length) { page.append(empty(L('No saved trips yet.', 'अभी कोई सेव ट्रिप नहीं।'), h('a', { class: 'btn', href: '#/plan' }, L('Plan a trip', 'ट्रिप प्लान करें')))); return page; }
  const groups = {};
  rows.forEach((t) => (groups[tripStage(t)] ||= []).push(t));
  STAGES.forEach(([k, en, hiTxt, cls]) => {
    if (!groups[k]) return;
    page.append(h('section', { class: 'tp-group' }, h('h2', {}, `${L(en, hiTxt)} (${groups[k].length})`), h('div', { class: 'tp-trips' }, groups[k].map((t) => tripRow(t, cls, page)))));
  });
  return page;
}

function tripRow(t, cls, page) {
  const item = h('div', { class: 'tp-trip tp-trip-x' });
  const del = h('button', { type: 'button', class: 'tp-act tr-danger', onclick: async () => {
    if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = L('Tap again', 'फिर टैप करें'); return; }
    await deleteTrip(t.id); item.remove();
  } }, L('Delete', 'हटाएँ'));
  const v2 = !!(t.start_place && t.end_date);
  const withD = async (fn) => { const r = await openTrip(t.id); if (r?.d) fn(r.d); else toast(L('This older trip can only be opened, not edited here.', 'यह पुरानी ट्रिप सिर्फ़ खोली जा सकती है, यहाँ बदली नहीं जा सकती।'), 'warn'); };
  item.append(
    h('a', { class: 'grow tp-trip-main', href: `#/trip/${t.id}` }, h('strong', {}, t.title),
      h('span', { class: 'muted small' }, [t.start_date && `${fmtD(t.start_date)}${t.end_date ? ` – ${fmtD(t.end_date)}` : ''}`, `${t.days_count} ${L('days', 'दिन')}`, `${t.travellers} ${L('travellers', 'यात्री')}`, t.budget ? inr(t.budget) : null].filter(Boolean).join(' · '))),
    h('div', { class: 'tp-acts' },
      h('a', { class: 'tp-act', href: `#/trip/${t.id}` }, L('Open', 'खोलें')),
      v2 ? h('button', { type: 'button', class: 'tp-act', onclick: () => withD((d) => editInPlanner(d)) }, L('Edit', 'बदलें')) : null,
      v2 ? h('button', { type: 'button', class: 'tp-act', onclick: () => withD(async (d) => { const id = await duplicateTrip(d); if (id) location.reload(); }) }, L('Duplicate', 'कॉपी')) : null,
      v2 ? h('button', { type: 'button', class: 'tp-act', onclick: () => withD((d) => shareTrip(d, `${t.title} — The Himalayan Horizon`, 'saved')) }, L('Share', 'शेयर')) : null,
      v2 ? h('button', { type: 'button', class: 'tp-act', onclick: () => withD((d) => editInPlanner(d, 'plan/budget')) }, L('Expenses', 'ख़र्च')) : null,
      del));
  return item;
}

export async function tripView({ params }) {
  if (!user()) { location.hash = `#/login?next=trip/${params.id}`; return h('div'); }
  const r = await openTrip(params.id);
  if (!r) return empty(L('Trip not found.', 'ट्रिप नहीं मिली।'));
  if (r.legacy) { const m = await import('../pages/planner.js'); return m.trip({ params }); }
  const page = await tripReport(r.d, { mode: 'saved' });
  if (r.row.share_token) {
    page.insertBefore(h('div', { class: 'wrap no-print' }, h('p', { class: 'soft-note' }, L('Sharing is on — anyone with the link can view this trip.', 'शेयरिंग चालू है — लिंक वाला कोई भी यह ट्रिप देख सकता है।'), ' ',
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: async (e) => { await stopSharing(r.row.id); e.target.closest('.soft-note').remove(); toast(L('Sharing turned off', 'शेयरिंग बंद')); } }, L('Stop sharing', 'शेयरिंग बंद करें')))), page.children[1] || null);
  }
  return page;
}

export async function sharedView({ params }) {
  const res = await sb.rpc('get_shared_trip', { p_token: params.token });
  if (res.error || !res.data) return h('div', { class: 'app-page' }, empty(L('This trip link is not valid or sharing was turned off.', 'यह ट्रिप लिंक सही नहीं है या शेयरिंग बंद कर दी गई।'), h('a', { class: 'btn', href: '#/plan' }, L('Plan your own trip', 'अपनी ट्रिप प्लान करें'))));
  const t = res.data;
  const d = draftFromRow(t, t.destinations || []);
  d.tripId = null;
  return tripReport(d, { mode: 'shared' });
}
