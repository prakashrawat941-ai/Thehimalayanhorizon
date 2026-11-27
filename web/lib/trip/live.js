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

export function fetchRoutePois(route, vehicle) {
  const legs = (route?.legs || []).filter((leg) => !leg.error).map(pickLeg)
    .map(({ key, coords }) => ({ key, coords }));
  if (!legs.length) return Promise.resolve({ status: 'unavailable' });
  return request('/api/trip/route-pois', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ legs, vehicle }),
  });
}
