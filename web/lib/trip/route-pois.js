// Route coordinates are [latitude, longitude]. Distances are measured on the chosen polyline.
const classes = { car: 'car', hatch: 'car', sedan: 'car', suv: 'car', taxi: 'car', bus: 'bus', bike: 'motorcycle', shared: null, train: null };
const rad = Math.PI / 180;
const length = ([a, x], [b, y]) => 6371 * 2 * Math.asin(Math.min(1, Math.hypot(
  Math.sin((b - a) * rad / 2), Math.sqrt(Math.cos(a * rad) * Math.cos(b * rad)) * Math.sin((y - x) * rad / 2),
)));
const point = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
  && p[0] >= 6 && p[0] <= 38 && p[1] >= 67 && p[1] <= 98;

export function validateRoute(body) {
  if (!Array.isArray(body?.legs) || body.legs.length < 1 || body.legs.length > 20
    || !Object.hasOwn(classes, body.vehicle)) return null;
  const byKey = new Map();
  for (const leg of body.legs) {
    if (!leg || typeof leg.key !== 'string' || !/^-?[\d.]+,-?[\d.]+;-?[\d.]+,-?[\d.]+$/.test(leg.key)
      || leg.key.length > 90 || !Array.isArray(leg.coords) || leg.coords.length < 2 || leg.coords.length > 350
      || !leg.coords.every(point)) return null;
    // Repeated legs can share a lookup only when their selected geometry is the same.
    if (byKey.has(leg.key) && JSON.stringify(byKey.get(leg.key).coords) !== JSON.stringify(leg.coords)) return null;
    byKey.set(leg.key, leg);
  }
  const legs = [...byKey.values()];
  let total = 0;
  for (const leg of legs) {
    for (let i = 1; i < leg.coords.length; i++) {
      const km = length(leg.coords[i - 1], leg.coords[i]);
      if (km > 60) return null;
      total += km;
    }
  }
  return total <= 1900 && legs.reduce((n, leg) => n + leg.coords.length, 0) <= 2300
    ? { legs, vehicleClass: classes[body.vehicle] } : null;
}

export function overpassQuery(legs) {
  const clauses = legs.map(({ coords }) => {
    const path = coords.flat().map((n) => n.toFixed(5)).join(',');
    return `nwr(around:850,${path})["amenity"="fuel"];nwr(around:200,${path})["barrier"="toll_booth"];`;
  }).join('');
  return `[out:json][timeout:20];(${clauses});out center 4200;`;
}

function segments(coords) {
  let km = 0;
  const list = coords.slice(1).map((b, i) => {
    const a = coords[i];
    const dist = length(a, b);
    const segment = { a, b, km, dist };
    km += dist;
    return segment;
  });
  return { list, km };
}

function projection([lat, lng], { a, b, km, dist }) {
  const scale = Math.cos(lat * rad);
  const x = (b[1] - a[1]) * scale, y = b[0] - a[0];
  const px = (lng - a[1]) * scale, py = lat - a[0];
  const t = Math.min(1, Math.max(0, (px*x + py*y) / (x*x + y*y || 1)));
  return { km: km + dist*t, offRoute: Math.hypot(px-x*t, py-y*t)*111.2 };
}

export function snapRoutePois(legs, elements, vehicleClass, rates, today) {
  const result = { status: 'ok', source: 'OpenStreetMap contributors', legs: {}, gaps: {} };
  for (const { key, coords } of legs) {
    const geometry = segments(coords);
    const matches = [];
    for (const item of elements) {
      const { lat, lon: lng } = item.center || item;
      const tags = item.tags || {};
      const kind = tags.barrier === 'toll_booth' ? 'toll' : tags.amenity === 'fuel' ? 'fuel' : null;
      if (!kind || !point([lat, lng])) continue;
      let closest = { offRoute: Infinity };
      for (const segment of geometry.list) {
        const candidate = projection([lat, lng], segment);
        if (candidate.offRoute < closest.offRoute) closest = candidate;
      }
      if (closest.offRoute > (kind === 'toll' ? 0.12 : 0.8)) continue;
      const name = tags.name || tags.brand || (kind === 'toll' ? 'Toll booth' : 'Fuel pump');
      const tariff = rates[`${item.type}/${item.id}`];
      const rate = tariff?.classes?.[vehicleClass];
      const checked = typeof tariff?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tariff.date)
        && Number.isFinite(Date.parse(tariff.date)) && tariff.date <= today && typeof tariff.source === 'string';
      const hasRate = vehicleClass && checked && typeof rate === 'number' && Number.isFinite(rate) && rate >= 0;
      matches.push({ kind, name, lat, lng, km: closest.km, ...(tags.brand ? { brand: tags.brand } : {}),
        ...(kind === 'toll' ? { rate: hasRate ? rate : null, rateDate: hasRate ? tariff.date : null, rateSource: hasRate ? tariff.source : null } : {}) });
    }
    matches.sort((a, b) => a.km - b.km);
    const unique = [];
    for (const match of matches) {
      // OSM often maps multiple booth lanes separately. Count a toll crossing once.
      const duplicate = unique.findIndex((p) => p.kind === match.kind && Math.abs(match.km - p.km) <= (p.kind === 'toll' ? 0.25 : 0.06));
      if (duplicate === -1) unique.push(match);
      else if (match.kind === 'toll' && unique[duplicate].rate == null && match.rate != null) unique[duplicate] = match;
    }
    result.legs[key] = unique.map((item) => ({ ...item, km: Math.round(item.km * 10) / 10 }));
    const stops = [0, ...unique.filter((p) => p.kind === 'fuel').map((p) => p.km), geometry.km];
    result.gaps[key] = stops.slice(1).flatMap((toKm, index) => {
      const fromKm = stops[index];
      return toKm - fromKm > 50 ? [{ fromKm, toKm }] : [];
    });
  }
  return result;
}
