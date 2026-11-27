'use client';
// Live trip data the planner shows but does not compute itself. CODEX owns these (handoff T1–T3):
// the owner chose a paid fuel-price API (option B, 27 Nov 2026); its key must stay on the server.
// Until a server route exists, every function resolves to { status: 'not_connected' } and the UI
// says so — it never shows a guessed price, pump or toll.

const NOT_CONNECTED = Object.freeze({ status: 'not_connected' });

/**
 * Fuel prices for the area where the trip starts.
 * Expected server route: GET /api/trip/fuel-price?lat=..&lng=..
 * → { status: 'ok', area: 'Haldwani', source: 'Provider name', prices: {
 *       petrol: { price: 0, date: 'YYYY-MM-DD' }, diesel: {...}, cng: { price, date, unit: 'kg' } } }
 */
export async function fetchFuelPrices(/* place */) {
  return NOT_CONNECTED;
}

/**
 * Fuel pumps and toll plazas along each chosen leg.
 * Expected server route: POST /api/trip/route-pois { legs: [{ key, coords }] , vehicle }
 * → { status: 'ok', legs: { [legKey]: [{ kind: 'fuel'|'toll', km, name, lat, lng,
 *       brand?, rate?, rateDate?, rateSource? }] }, gaps: { [legKey]: [{ fromKm, toKm }] } }
 * `km` is the distance from the start of that leg. Toll `rate` is for the chosen vehicle, one way.
 */
export async function fetchRoutePois(/* route, vehicle */) {
  return NOT_CONNECTED;
}
