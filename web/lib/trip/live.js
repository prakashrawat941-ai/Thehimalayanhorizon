'use client';
import { pickLeg } from './engine';

async function request(url, options) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return { status: 'error' };
    return await res.json();
  } catch {
    return { status: 'error' };
  }
}

export function fetchFuelPrices(place) {
  if (!Number.isFinite(place?.lat) || !Number.isFinite(place?.lng)) return Promise.resolve({ status: 'unavailable' });
  return request('/api/trip/fuel-price?' + new URLSearchParams({ lat: place.lat, lng: place.lng }));
}

/**
 * Key for one leg's POIs. Usually the endpoint key; when the same endpoints appear again with a
 * different chosen road (A → B → A → B), the later occurrence gets its own `key@index`.
 */
export function poiLegKey(route, i) {
  const legs = route?.legs || [];
  const leg = legs[i];
  if (!leg) return null;
  const sig = (l) => JSON.stringify(pickLeg(l).coords || []);
  const clash = legs.some((o, j) => j !== i && !o.error && o.key === leg.key && sig(o) !== sig(leg));
  return clash ? `${leg.key}@${i}` : leg.key;
}

const MAX_BATCH_COORDS = 2000; // server limit is 2300 points and 1900 km per request
const MAX_BATCH_LEGS = 3;

export async function fetchRoutePois(route, vehicle) {
  const items = (route?.legs || []).map((leg, i) => ({ leg, i })).filter(({ leg }) => !leg.error)
    .map(({ leg, i }) => ({ id: poiLegKey(route, i), key: leg.key, coords: pickLeg(leg).coords || [] }));
  if (!items.length) return { status: 'unavailable' };
  // One request may not hold two different geometries for the same endpoints, and must stay
  // within the server's size limits, so long or repeated itineraries are split into batches.
  const batches = [];
  for (const it of items) {
    if (batches.some((b) => b.some((x) => x.id === it.id))) continue; // identical repeat: look up once
    let b = batches.find((x) => x.length < MAX_BATCH_LEGS && !x.some((y) => y.key === it.key)
      && x.reduce((n, y) => n + y.coords.length, 0) + it.coords.length <= MAX_BATCH_COORDS);
    if (!b) { b = []; batches.push(b); }
    b.push(it);
  }
  const replies = await Promise.all(batches.map((b) => request('/api/trip/route-pois', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ legs: b.map(({ key, coords }) => ({ key, coords })), vehicle }),
  })));
  // A missing batch would hide tolls on part of the route, so any failure fails the whole lookup.
  const bad = replies.findIndex((r) => r?.status !== 'ok');
  if (bad !== -1) return replies[bad] || { status: 'error' };
  const out = { status: 'ok', source: replies[0].source, legs: {}, gaps: {} };
  batches.forEach((b, bi) => b.forEach((it) => {
    out.legs[it.id] = replies[bi].legs?.[it.key] || [];
    out.gaps[it.id] = replies[bi].gaps?.[it.key] || [];
  }));
  return out;
}
