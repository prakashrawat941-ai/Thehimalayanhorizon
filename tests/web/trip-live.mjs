import assert from 'node:assert/strict';
import { datedPrices, istDate, readSsrDistrict } from '../../web/lib/trip/fuel-provider.js';
import { overpassQuery, snapRoutePois, validateRoute } from '../../web/lib/trip/route-pois.js';
import { computeBudget, defaultAssumptions } from '../../web/lib/trip/engine.js';

const today = '2026-11-27';
assert.equal(istDate(new Date('2026-11-26T20:00:00Z')), today);
assert.deepEqual(datedPrices({ fuel_prices: { petrol_price: 100 } }, today), {});
const state = { success: true, data: [{ state_name: 'Uttarakhand', districts: [
  { district_name: 'Almora', date: today, fuel_prices: { petrol_price: 100, diesel_price: 90, cng_price: 80 } },
] }] };
assert.equal(readSsrDistrict(state, 'Uttarakhand', 'Almora district', today).cng.unit, 'kg');
assert.deepEqual(readSsrDistrict(state, 'Uttarakhand', 'Nainital', today), {});
assert.deepEqual(datedPrices({ date: '2026-11-28', fuel_prices: { petrol_price: 100 } }, today), {});

const key = '79.00000,29.00000;80.00000,29.00000';
const input = { legs: [{ key, coords: [[29,79], [29,79.5], [29,80]] }], vehicle: 'suv' };
const parsed = validateRoute(input);
assert.equal(parsed.vehicleClass, 'car');
assert.match(overpassQuery(parsed.legs), /"barrier"="toll_booth"/);
assert.equal(validateRoute({ ...input, vehicle: 'constructor' }), null);
assert.equal(validateRoute({ ...input, legs: [{ key: '__proto__', coords: input.legs[0].coords }] }), null);
const items = [
  { id: 1, type: 'node', lat: 29, lon: 79.1, tags: { amenity: 'fuel' } },
  { id: 2, type: 'node', lat: 29, lon: 79.2, tags: { barrier: 'toll_booth' } },
  { id: 3, type: 'node', lat: 29, lon: 79.201, tags: { barrier: 'toll_booth' } },
  { id: 4, type: 'node', lat: 29, lon: 79.6, tags: { barrier: 'toll_booth' } },
  { id: 5, type: 'node', lat: 29.1, lon: 79.6, tags: { amenity: 'fuel' } },
];
const pois = snapRoutePois(parsed.legs, items, parsed.vehicleClass, { 'node/3': { date: today, source: 'Test fixture', classes: { car: 90, bus: 250 } } }, today);
assert.deepEqual(pois.legs[key].map(p => [p.kind,p.rate]), [['fuel',undefined],['toll',90],['toll',null]]);
assert.equal(pois.gaps[key].length, 1);
assert.ok(pois.gaps[key][0].toKm - pois.gaps[key][0].fromKm > 50);

const trip = { mode: 'car', adults: 2, children: 0, depart: today, ret: today, budget: 2000,
  assumptions: { vehicle: 'suv', fuel_type: 'cng', fuel_price: 80, tolls: 90, reserve_pct: 0, food_per_person_day: 0 } };
assert.equal(defaultAssumptions(trip).mileage, 16);
const b = computeBudget(trip, { total_km: 80, missing: 0 }, []);
assert.match(b.lines.fuel.how, /km\/kg/);
assert.equal(b.total, 490);
assert.equal(b.perPerson, 245);
assert.equal(b.remaining, 1510);
assert.equal(computeBudget(trip, { total_km: 80, missing: 1 }, []).lines.fuel.missing, true);
console.log('PASS: dated district pricing, POI matching, toll deduplication, fuel gaps, CNG budget and missing route.');
