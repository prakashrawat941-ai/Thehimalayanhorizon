// Saving, opening, sharing and duplicating trips (Supabase, protected by RLS).
import { toast } from '../ui.js';
import { sb, q } from '../sb.js';
import { user } from '../store.js';
import { L, PREFS, loadDraft, saveDraft, blank } from './common.js';
import { computeBudget, COST_CATS } from './engine.js';

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));
const missingColumn = (e) => e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|Could not find the '.*' column/i.test(e.message || ''));
let v2 = null; // do the new trip columns exist? (set after the first save/read)

// Route kept small enough to store: fewer points per line.
function storableRoute(route) {
  if (!route) return null;
  const thin = (c) => (c && c.length > 120 ? c.filter((_, i) => i % Math.ceil(c.length / 120) === 0 || i === c.length - 1) : c);
  return { ...route, legs: route.legs.map((l) => ({ ...l, coords: thin(l.coords), alts: (l.alts || []).map((a) => ({ ...a, coords: thin(a.coords) })) })) };
}
const themeSlugs = (d) => [...new Set(d.prefs.map((k) => PREFS.find((p) => p[0] === k)?.[3]).filter(Boolean))].slice(0, 12);
// Days in a shape the older trip view also understands (title / plan / location).
const storableDays = (d) => (d.days || []).map((x) => ({ ...x, title: x.title_en, title_hi: x.title_hi, plan: x.items.map((i) => i.text || i.en).join(' · '), plan_hi: x.items.map((i) => i.text || i.hi || i.en).join(' · '), location: null }));

export function rowFromDraft(d) {
  const nDays = Math.round((new Date(d.ret) - new Date(d.depart)) / 864e5) + 1;
  return {
    basic: { title: (d.title || 'My trip').slice(0, 160).padEnd(2, ' '), start_date: d.depart, days_count: Math.min(30, nDays), travellers: Math.min(50, d.adults + d.children),
      budget: d.budget === '' || d.budget == null ? null : Math.round(Number(d.budget)), theme_slugs: themeSlugs(d), days: storableDays(d) },
    extra: { end_date: d.ret, adults: d.adults, children: d.children, pace: d.pace, travel_mode: d.mode, preferences: d.prefs, round_trip: d.roundTrip !== false,
      start_place: d.start, route: storableRoute(d.route), assumptions: { ...(d.assumptions || {}), actuals: d.actuals || {}, daysKey: d.daysKey || null, daysEdited: !!d.daysEdited }, status: d.status || 'planning' },
  };
}

export async function saveTrip(d, btn) {
  if (!user()) { saveDraft(d); toast(L('Log in to save your trip. Your plan is kept on this device.', 'ट्रिप सेव करने के लिए लॉगिन करें। आपका प्लान इस फ़ोन में रखा है।')); location.hash = '#/login?next=plan/summary'; return null; }
  if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = L('Saving…', 'सेव हो रहा है…'); }
  try {
    d.clientId ||= uuid();
    const { basic, extra } = rowFromDraft(d);
    let id = d.tripId;
    let full = v2 !== false;
    const write = async (row) => {
      if (id) return sb.from('trips').update(row).eq('id', id).select('id').single();
      return sb.from('trips').insert(full ? { ...row, client_request_id: d.clientId } : row).select('id').single();
    };
    let res = await write(full ? { ...basic, ...extra } : basic);
    if (res.error && full && missingColumn(res.error)) { v2 = false; full = false; res = await write(basic); }
    if (res.error && res.error.code === '23505' && !id) {
      // Same plan sent twice (double tap / retry): update the one already saved.
      const ex = await sb.from('trips').select('id').eq('client_request_id', d.clientId).maybeSingle();
      if (ex.data) { id = ex.data.id; res = await write({ ...basic, ...extra }); }
    }
    if (res.error) throw res.error;
    if (full) v2 = true;
    id = res.data.id;
    d.tripId = id; saveDraft(d);
    if (full) await saveChildren(id, d);
    toast(L('Trip saved', 'ट्रिप सेव हो गई'));
    if (btn) btn.dataset.label = L('Save changes', 'बदलाव सेव करें');
    return id;
  } catch (e) {
    toast(L('Could not save: ', 'सेव नहीं हुआ: ') + (e.message || e), 'err');
    return null;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
  }
}

async function saveChildren(id, d) {
  // Replace this trip's destinations and cost lines with the current ones.
  await q(sb.from('trip_destinations').delete().eq('trip_id', id));
  if (d.dests.length) await q(sb.from('trip_destinations').insert(d.dests.map((p, i) => ({ trip_id: id, position: i, place: p, place_id: p.id || null, location_id: p.location_id || null }))));
  const b = computeBudget(d, d.route, d.days);
  const rows = COST_CATS.map(([k]) => ({ trip_id: id, category: k, estimated: b.lines[k] && !b.lines[k].missing ? b.lines[k].est : null,
    actual: d.actuals?.[k] === '' || d.actuals?.[k] == null ? null : Math.round(Number(d.actuals[k])) }));
  await q(sb.from('trip_expenses').delete().eq('trip_id', id));
  await q(sb.from('trip_expenses').insert(rows));
}

// Saved row (+ destinations) → plan object used by the planner screens.
export function draftFromRow(t, dests = []) {
  const a = t.assumptions || {};
  const { actuals = {}, daysKey = null, daysEdited = false, ...assumptions } = a;
  return { ...blank(), title: t.title, start: t.start_place, dests: dests.sort((x, y) => x.position - y.position).map((x) => x.place),
    depart: t.start_date, ret: t.end_date, adults: t.adults ?? t.travellers ?? 2, children: t.children ?? 0, prefs: t.preferences || [],
    pace: t.pace || 'balanced', mode: t.travel_mode || 'car', roundTrip: t.round_trip !== false, budget: t.budget ?? '', route: t.route, days: t.days,
    daysKey, daysEdited: true, assumptions, actuals, status: t.status, tripId: t.id || null, clientId: null, updated: Date.now() };
}
export const isV2Row = (t) => !!(t && t.start_place && t.end_date);

export async function openTrip(id) {
  const t = await q(sb.from('trips').select('*').eq('id', id).maybeSingle());
  if (!t) return null;
  if (!isV2Row(t)) return { legacy: t };
  const dests = await q(sb.from('trip_destinations').select('position,place').eq('trip_id', id));
  return { row: t, d: draftFromRow(t, dests) };
}

export function editInPlanner(d, to = 'plan/summary') {
  const cur = loadDraft();
  saveDraft({ ...d, clientId: cur?.tripId === d.tripId ? cur.clientId : null });
  location.hash = `#/${to}`;
}

export async function duplicateTrip(d) {
  const copy = { ...d, title: `${d.title} (${L('copy', 'कॉपी')})`.slice(0, 160), tripId: null, clientId: null, status: 'draft' };
  return saveTrip(copy);
}

export async function shareTrip(d, text, mode) {
  let url = null;
  if (mode !== 'shared' && user()) {
    const id = d.tripId || await saveTrip(d);
    if (id && v2 !== false) {
      const r = await sb.rpc('set_trip_share', { p_trip: id, p_on: true });
      if (!r.error && r.data) url = `${location.origin}${location.pathname}#/t/${r.data}`;
    }
  } else if (mode === 'shared') url = location.href;
  const body = url ? `${text}\n${url}` : text;
  if (navigator.share) { navigator.share({ title: d.title || 'Trip', text: body, url: url || undefined }).catch(() => {}); return; }
  try { await navigator.clipboard.writeText(body); toast(url ? L('Share link copied', 'शेयर लिंक कॉपी हो गया') : L('Trip details copied', 'ट्रिप की जानकारी कॉपी हो गई')); }
  catch { window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, '_blank', 'noopener'); }
}
export async function stopSharing(id) { return q(sb.rpc('set_trip_share', { p_trip: id, p_on: false })); }

export async function deleteTrip(id) {
  await q(sb.from('trips').delete().eq('id', id));
  const cur = loadDraft();
  if (cur?.tripId === id) { cur.tripId = null; saveDraft(cur); }
  toast(L('Trip deleted', 'ट्रिप हटा दी गई'));
}
