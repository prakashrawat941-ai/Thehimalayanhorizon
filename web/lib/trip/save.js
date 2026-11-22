'use client';
// Save / open / share / duplicate / delete trips (Supabase; RLS lets each user touch only their own trips).
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
// Days in a shape the current app's trip view also understands (title / plan / location).
const storableDays = (d) => (d.days || []).map((x) => ({ ...x, title: x.title_en, title_hi: x.title_hi,
  plan: x.items.map((i) => i.text || i.en).join(' · '), plan_hi: x.items.map((i) => i.text || i.hi || i.en).join(' · '), location: null }));

export function rowFromDraft(d) {
  const nDays = Math.round((new Date(d.ret) - new Date(d.depart)) / 864e5) + 1;
  return {
    title: (d.title || 'My trip').slice(0, 160).padEnd(2, ' '), start_date: d.depart, days_count: Math.min(30, nDays), travellers: Math.min(50, d.adults + d.children),
    budget: d.budget === '' || d.budget == null ? null : Math.round(Number(d.budget)), theme_slugs: themeSlugs(d), days: storableDays(d),
    end_date: d.ret, adults: d.adults, children: d.children, pace: d.pace, travel_mode: d.mode, preferences: d.prefs, round_trip: d.roundTrip !== false,
    start_place: d.start, route: storableRoute(d.route),
    assumptions: { ...(d.assumptions || {}), actuals: d.actuals || {}, daysKey: d.daysKey || null, daysEdited: !!d.daysEdited },
    status: d.status && d.status !== 'draft' ? d.status : 'planning',
  };
}

/** Returns the trip id, or throws. */
export async function saveTrip(d) {
  const db = browserDb();
  const { data: { user } } = await db.auth.getUser();
  if (!user) { saveDraft(d); const e = new Error('login'); e.login = true; throw e; }
  d.clientId ||= uuid();
  const row = rowFromDraft(d);
  let id = d.tripId;
  const write = (r) => (id ? db.from('trips').update(r).eq('id', id).select('id').single()
    : db.from('trips').insert({ ...r, user_id: user.id, client_request_id: d.clientId }).select('id').single());
  let res = await write(row);
  if (res.error && res.error.code === '23505' && !id) {
    // Same plan sent twice (double tap / retry): update the one already saved.
    const ex = await db.from('trips').select('id').eq('client_request_id', d.clientId).maybeSingle();
    if (ex.data) { id = ex.data.id; res = await write(row); }
  }
  if (res.error) throw res.error;
  id = res.data.id;
  // Replace destinations and cost lines with the current ones.
  await db.from('trip_destinations').delete().eq('trip_id', id);
  if (d.dests.length) {
    const r = await db.from('trip_destinations').insert(d.dests.map((p, i) => ({ trip_id: id, position: i, place: p, place_id: p.id || null, location_id: p.location_id || null })));
    if (r.error) throw r.error;
  }
  const b = computeBudget(d, d.route, d.days);
  await db.from('trip_expenses').delete().eq('trip_id', id);
  await db.from('trip_expenses').insert(COST_CATS.map(([k]) => ({ trip_id: id, category: k, estimated: b.lines[k] && !b.lines[k].missing ? b.lines[k].est : null,
    actual: d.actuals?.[k] === '' || d.actuals?.[k] == null ? null : Math.round(Number(d.actuals[k])) })));
  return id;
}

export { draftFromRow } from './common';

export async function shareLink(tripId, on = true) {
  const { data, error } = await browserDb().rpc('set_trip_share', { p_trip: tripId, p_on: on });
  if (error) throw error;
  return data ? `${location.origin}/t/${data}` : null;
}

export async function deleteTrip(id) {
  const { error } = await browserDb().from('trips').delete().eq('id', id);
  if (error) throw error;
}
