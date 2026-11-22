'use client';
// Saving, sharing, duplicating and deleting trips (database rules allow only the owner).
import { browserDb } from '@/lib/supabase/client';
import { PREFS, saveDraft } from './common';
import { computeBudget, COST_CATS } from './engine';

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));

function storableRoute(route) {
  if (!route) return null;
  const thin = (c) => (c && c.length > 120 ? c.filter((_, i) => i % Math.ceil(c.length / 120) === 0 || i === c.length - 1) : c);
  return { ...route, legs: route.legs.map((l) => ({ ...l, coords: thin(l.coords), alts: (l.alts || []).map((a) => ({ ...a, coords: thin(a.coords) })) })) };
}
const themeSlugs = (d) => [...new Set(d.prefs.map((k) => PREFS.find((p) => p[0] === k)?.[3]).filter(Boolean))].slice(0, 12);
const storableDays = (d) => (d.days || []).map((x) => ({ ...x, title: x.title_en, plan: x.items.map((i) => i.text || i.en).join(' · '), plan_hi: x.items.map((i) => i.text || i.hi || i.en).join(' · '), location: null }));

export function rowFromDraft(d) {
  const nDays = Math.round((new Date(d.ret) - new Date(d.depart)) / 864e5) + 1;
  return {
    title: (d.title || 'My trip').slice(0, 160).padEnd(2, ' '), start_date: d.depart, days_count: Math.min(30, nDays), travellers: Math.min(50, d.adults + d.children),
    budget: d.budget === '' || d.budget == null ? null : Math.round(Number(d.budget)), theme_slugs: themeSlugs(d), days: storableDays(d),
    end_date: d.ret, adults: d.adults, children: d.children, pace: d.pace, travel_mode: d.mode, preferences: d.prefs, round_trip: d.roundTrip !== false,
    start_place: d.start, route: storableRoute(d.route), assumptions: { ...(d.assumptions || {}), actuals: d.actuals || {}, daysKey: d.daysKey || null, daysEdited: !!d.daysEdited },
    status: d.status || 'planning',
  };
}

/** Returns the saved trip id. Double taps never create two trips (client_request_id is unique). */
export async function saveTrip(d) {
  const db = browserDb();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw Object.assign(new Error('login'), { code: 'login' });
  const clientId = d.clientId || uuid();
  const row = rowFromDraft(d);
  let id = d.tripId;
  let res = id
    ? await db.from('trips').update(row).eq('id', id).select('id').single()
    : await db.from('trips').insert({ ...row, user_id: user.id, client_request_id: clientId }).select('id').single();
  if (res.error && res.error.code === '23505' && !id) {
    const ex = await db.from('trips').select('id').eq('client_request_id', clientId).maybeSingle();
    if (ex.data) { id = ex.data.id; res = await db.from('trips').update(row).eq('id', id).select('id').single(); }
  }
  if (res.error) throw res.error;
  id = res.data.id;
  // Replace destinations and cost lines with the current ones.
  await db.from('trip_destinations').delete().eq('trip_id', id);
  const dests = d.dests.filter(Boolean);
  if (dests.length) await db.from('trip_destinations').insert(dests.map((p, i) => ({ trip_id: id, position: i, place: p, place_id: p.id || null, location_id: p.location_id || null })));
  const b = computeBudget(d, d.route, d.days);
  await db.from('trip_expenses').delete().eq('trip_id', id);
  await db.from('trip_expenses').insert(COST_CATS.map(([k]) => ({ trip_id: id, category: k, estimated: b.lines[k] && !b.lines[k].missing ? b.lines[k].est : null,
    actual: d.actuals?.[k] === '' || d.actuals?.[k] == null ? null : Math.round(Number(d.actuals[k])) })));
  saveDraft({ ...d, tripId: id, clientId });
  return id;
}

export async function shareLink(id) {
  const { data, error } = await browserDb().rpc('set_trip_share', { p_trip: id, p_on: true });
  if (error) throw error;
  return `${location.origin}/t/${data}`;
}
export async function stopSharing(id) {
  const { error } = await browserDb().rpc('set_trip_share', { p_trip: id, p_on: false });
  if (error) throw error;
}
export async function deleteTrip(id) {
  const { error } = await browserDb().from('trips').delete().eq('id', id);
  if (error) throw error;
}
