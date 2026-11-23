// Trip Planner engine: real road routes (OSRM / OpenStreetMap), weather (Open-Meteo),
// a rules-based day-wise itinerary and the budget calculator.
// Rules: never invent road distances, prices, hotels or availability. Anything that
// is an estimate is labelled as one; anything we could not fetch is shown as missing.
// Kept free of browser imports so it can be tested on its own.
const toRad = (x) => (x * Math.PI) / 180;
export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}

export const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
export const METEO = 'https://api.open-meteo.com/v1/forecast';
export const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
export const BREAK_FACTOR = 1.2;           // drive time × 1.2 to allow for tea, meals and photo stops
export const DRIVE_LIMIT_H = { relaxed: 6, balanced: 8, adventure: 10 }; // driving hours per day (breaks come on top)
export const SIGHTS_PER_DAY = { relaxed: 1, balanced: 2, adventure: 3 };
export const START_HOUR = 7;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function getJSON(url, { timeout = 15000, retries = 1, ...opts } = {}) {
  let lastErr;
  for (let a = 0; a <= retries; a++) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { ...opts, signal: ctl.signal });
      if (r.status === 429 || r.status >= 500) throw Object.assign(new Error(`HTTP ${r.status}`), { retry: true });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      if (a < retries && (e.retry || e.name === 'AbortError' || e instanceof TypeError)) { await sleep(900 * (a + 1)); continue; }
      throw e;
    } finally { clearTimeout(t); }
  }
  throw lastErr;
}

// ---------- points and legs ----------
export const tripPoints = (d) => [d.start, ...d.dests].filter(Boolean);
export function legPairs(d) {
  const pts = tripPoints(d);
  const pairs = pts.slice(1).map((p, i) => ({ from: pts[i], to: p, ret: false }));
  if (d.roundTrip !== false && pts.length > 1) pairs.push({ from: pts[pts.length - 1], to: pts[0], ret: true });
  return pairs;
}
const ll = (p) => `${Number(p.lng).toFixed(5)},${Number(p.lat).toFixed(5)}`;
export const legKey = (a, b) => `${ll(a)};${ll(b)}`;
export const routeKey = (d) => legPairs(d).map((x) => legKey(x.from, x.to)).join('|');

function thin(coords, max = 350) {
  if (coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => coords[Math.round(i * step)]);
}

// One leg, calculated on its own. Returns { km, secs, coords, alts:[{km,secs,coords}], error }
export async function fetchLeg(a, b) {
  try {
    const data = await getJSON(`${OSRM}${legKey(a, b)}?overview=full&geometries=geojson&alternatives=true&steps=false`, { timeout: 20000, retries: 2 });
    if (data.code !== 'Ok' || !data.routes?.length) return { error: data.code === 'NoRoute' ? 'no_route' : 'failed' };
    const routes = data.routes.map((r) => ({ km: r.distance / 1000, secs: r.duration, coords: thin(r.geometry.coordinates.map(([x, y]) => [+y.toFixed(5), +x.toFixed(5)])) }));
    return { ...routes[0], alts: routes.slice(1), chosen: 0 };
  } catch (e) {
    return { error: navigator.onLine === false ? 'offline' : 'failed' };
  }
}

// All legs, one after another (the public OSRM server allows about one request a second).
export async function fetchRoute(d, { onProgress = () => {}, previous = null } = {}) {
  const pairs = legPairs(d);
  const legs = [];
  for (let i = 0; i < pairs.length; i++) {
    const key = legKey(pairs[i].from, pairs[i].to);
    const old = previous?.legs?.find((l) => l.key === key && !l.error);
    let leg = old;
    if (!leg) { if (i) await sleep(350); leg = { key, ...(await fetchLeg(pairs[i].from, pairs[i].to)) }; }
    legs.push({ ...leg, key, ret: pairs[i].ret });
    onProgress(i + 1, pairs.length);
  }
  return summarise({ key: routeKey(d), at: Date.now(), legs });
}
// Use the alternative the traveller picked for each leg.
export const pickLeg = (leg) => (leg.error ? leg : leg.chosen > 0 && leg.alts?.[leg.chosen - 1] ? { ...leg, ...leg.alts[leg.chosen - 1] } : leg);
export function summarise(route) {
  const ok = route.legs.filter((l) => !l.error).map(pickLeg);
  route.total_km = ok.reduce((s, l) => s + l.km, 0);
  route.total_secs = ok.reduce((s, l) => s + l.secs, 0);
  route.missing = route.legs.filter((l) => l.error).length;
  return route;
}
export const routeIsFresh = (d) => d.route && d.route.key === routeKey(d);

export const fmtKm = (km) => `${Math.round(km).toLocaleString('en-IN')} km`;
export function fmtDur(secs, hi = false) {
  const m = Math.round(secs / 60); const hh = Math.floor(m / 60); const mm = m % 60;
  if (hi) return hh ? `${hh} घं ${mm ? `${mm} मि` : ''}`.trim() : `${mm} मि`;
  return hh ? `${hh} h ${mm ? `${mm} min` : ''}`.trim() : `${mm} min`;
}

// Point on a leg at a fraction of its length.
function pointAt(coords, f) {
  const seg = []; let total = 0;
  for (let i = 1; i < coords.length; i++) { const d = distanceKm({ lat: coords[i - 1][0], lng: coords[i - 1][1] }, { lat: coords[i][0], lng: coords[i][1] }); seg.push(d); total += d; }
  let goal = total * f;
  for (let i = 0; i < seg.length; i++) { if (goal <= seg[i]) return { lat: coords[i][0], lng: coords[i][1], km: total * f }; goal -= seg[i]; }
  const last = coords[coords.length - 1]; return { lat: last[0], lng: last[1], km: total };
}
// Listed places close to the leg line, in travel order.
export function placesAlong(coords, places, exclude = [], maxKm = 5) {
  if (!coords?.length) return [];
  const pts = coords.filter((_, i) => i % 3 === 0);
  const hits = [];
  for (const p of places) {
    if (exclude.some((x) => x && (x.id ? x.id === p.id : distanceKm(x, p) < 1))) continue;
    let best = Infinity; let idx = -1;
    pts.forEach(([lat, lng], i) => { const dd = distanceKm({ lat, lng }, p); if (dd < best) { best = dd; idx = i; } });
    if (best <= maxKm) hits.push({ p, idx });
  }
  return hits.sort((a, b) => a.idx - b.idx).map((x) => x.p);
}

// ---------- weather ----------
export const WMO = {
  0: ['Clear', 'साफ़'], 1: ['Mostly clear', 'ज़्यादातर साफ़'], 2: ['Partly cloudy', 'आंशिक बादल'], 3: ['Cloudy', 'बादल'],
  45: ['Fog', 'कोहरा'], 48: ['Fog', 'कोहरा'], 51: ['Light drizzle', 'हल्की फुहार'], 53: ['Drizzle', 'फुहार'], 55: ['Heavy drizzle', 'तेज़ फुहार'],
  61: ['Light rain', 'हल्की बारिश'], 63: ['Rain', 'बारिश'], 65: ['Heavy rain', 'तेज़ बारिश'], 71: ['Light snow', 'हल्की बर्फ़'], 73: ['Snow', 'बर्फ़'], 75: ['Heavy snow', 'भारी बर्फ़'],
  77: ['Snow grains', 'बर्फ़'], 80: ['Showers', 'बौछारें'], 81: ['Showers', 'बौछारें'], 82: ['Heavy showers', 'तेज़ बौछारें'], 85: ['Snow showers', 'बर्फ़ की बौछारें'], 86: ['Snow showers', 'बर्फ़ की बौछारें'],
  95: ['Thunderstorm', 'आंधी-तूफ़ान'], 96: ['Thunderstorm, hail', 'तूफ़ान, ओले'], 99: ['Thunderstorm, hail', 'तूफ़ान, ओले'],
};
export const FORECAST_DAYS = 16;
const addDays = (iso, n) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);
export const isoAdd = addDays;
export const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

// Forecast for the dates we can, historical averages (clearly labelled) for the rest.
export async function weatherFor(p, dates) {
  const out = { current: null, days: {}, error: null };
  const last = addDays(istToday(), FORECAST_DAYS - 1);
  const inRange = dates.filter((x) => x <= last && x >= istToday());
  const beyond = dates.filter((x) => x > last);
  try {
    if (inRange.length || !beyond.length) {
      const f = await getJSON(`${METEO}?latitude=${p.lat}&longitude=${p.lng}&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max&timezone=Asia%2FKolkata&forecast_days=${FORECAST_DAYS}`);
      out.current = f.current ? { temp: f.current.temperature_2m, code: f.current.weather_code, wind: f.current.wind_speed_10m } : null;
      (f.daily?.time || []).forEach((t, i) => {
        if (!dates.includes(t)) return;
        out.days[t] = { kind: 'forecast', code: f.daily.weather_code[i], max: f.daily.temperature_2m_max[i], min: f.daily.temperature_2m_min[i],
          rainProb: f.daily.precipitation_probability_max?.[i], rain: f.daily.precipitation_sum?.[i], wind: f.daily.wind_speed_10m_max?.[i] };
      });
    }
  } catch { out.error = 'forecast'; }
  if (beyond.length) {
    try {
      // Same calendar dates over the last three years that are already in the archive.
      const lastArchive = addDays(istToday(), -7);
      const years = [1, 2, 3].map((y) => beyond.map((x) => `${Number(x.slice(0, 4)) - y}${x.slice(4)}`)).flat().filter((x) => x <= lastArchive).sort();
      if (years.length) {
        const a = await getJSON(`${ARCHIVE}?latitude=${p.lat}&longitude=${p.lng}&start_date=${years[0]}&end_date=${years[years.length - 1]}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia%2FKolkata`, { timeout: 20000 });
        const byMd = {};
        (a.daily?.time || []).forEach((t, i) => {
          const md = t.slice(5); if (!beyond.some((x) => x.slice(5) === md)) return;
          (byMd[md] ||= []).push({ max: a.daily.temperature_2m_max[i], min: a.daily.temperature_2m_min[i], rain: a.daily.precipitation_sum[i], year: t.slice(0, 4) });
        });
        beyond.forEach((x) => {
          const rows = (byMd[x.slice(5)] || []).filter((r) => r.max != null);
          if (!rows.length) return;
          const avg = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0) / rows.length;
          out.days[x] = { kind: 'history', max: avg('max'), min: avg('min'), rain: avg('rain'), rainyYears: rows.filter((r) => r.rain >= 1).length, years: rows.map((r) => r.year).sort() };
        });
      }
    } catch { out.error = out.error ? 'both' : 'history'; }
  }
  return out;
}
export function weatherWarnings(w) {
  const list = [];
  if (!w || w.kind !== 'forecast') return list;
  if (w.rainProb >= 70 || w.rain >= 20) list.push(['rain', 'Heavy rain likely — hill roads can be slippery or blocked', 'तेज़ बारिश की संभावना — पहाड़ी सड़कें फिसलन भरी या बंद हो सकती हैं']);
  if ([95, 96, 99].includes(w.code)) list.push(['storm', 'Thunderstorm forecast', 'आंधी-तूफ़ान का पूर्वानुमान']);
  if ([71, 73, 75, 77, 85, 86].includes(w.code)) list.push(['snow', 'Snow forecast — roads may close', 'बर्फ़ का पूर्वानुमान — सड़कें बंद हो सकती हैं']);
  if (w.min <= 0) list.push(['cold', 'Below freezing at night — carry warm layers', 'रात में तापमान शून्य से नीचे — गर्म कपड़े रखें']);
  if (w.wind >= 40) list.push(['wind', 'Strong wind', 'तेज़ हवा']);
  return list;
}
export function seasonNotes(depart, ret) {
  const notes = [];
  const months = new Set();
  for (let x = depart; x <= ret; x = addDays(x, 1)) months.add(Number(x.slice(5, 7)));
  if ([7, 8].some((m) => months.has(m)) || (months.has(9) && depart.slice(5) <= '09-15') || (months.has(6) && ret.slice(5) >= '06-20'))
    notes.push(['Monsoon season: landslides and road blocks are common. Check USDMA and local news each morning, and keep a spare day.', 'मानसून: भूस्खलन और रास्ते बंद होना आम है। रोज़ सुबह USDMA और स्थानीय ख़बरें देखें, और एक अतिरिक्त दिन रखें।']);
  if ([12, 1, 2].some((m) => months.has(m)))
    notes.push(['Winter: snow and ice are possible on higher roads; some high-altitude places and treks close. Confirm before you go.', 'सर्दी: ऊँची सड़कों पर बर्फ़ और पाला हो सकता है; कुछ ऊँची जगहें और ट्रेक बंद रहते हैं। जाने से पहले पता करें।']);
  return notes;
}

// ---------- itinerary ----------
// ctx: { d, route, places, locs, themes, listings, L } → { days, warnings, needDays }
export function buildItinerary({ d, route, places, locs, listings = [], prefThemes = [] }) {
  const pace = DRIVE_LIMIT_H[d.pace] ? d.pace : 'balanced';
  const limit = DRIVE_LIMIT_H[pace];
  const totalDays = Math.round((new Date(d.ret) - new Date(d.depart)) / 864e5) + 1;
  const pairs = legPairs(d);
  const legs = pairs.map((p, i) => ({ ...p, ...(route?.legs?.[i] ? pickLeg(route.legs[i]) : { error: 'missing' }) }));
  const used = new Set(); // attractions already planned
  const exclude = tripPoints(d);
  const placeLoc = (p) => (p?.location_id ? locs.find((l) => l.id === p.location_id) : null);

  // Travel days for each leg (long legs split with a halt on the way).
  const travel = legs.map((leg) => {
    if (leg.error) return [{ from: leg.from, to: leg.to, leg, part: 1, parts: 1, unknown: true }];
    const hrs = (leg.secs * BREAK_FACTOR) / 3600;
    const parts = Math.max(1, Math.ceil(leg.secs / 3600 / limit)); // limit counts driving hours
    const out = []; let prev = leg.from;
    for (let k = 1; k <= parts; k++) {
      let to = leg.to;
      if (k < parts) {
        const pt = pointAt(leg.coords, k / parts);
        const near = places.map((p) => ({ p, dd: distanceKm(pt, p) })).sort((a, b) => a.dd - b.dd)[0];
        to = near && near.dd <= 40 ? { ...near.p, halt: true } : { name: `Halt near km ${Math.round(pt.km)}`, name_hi: `किमी ${Math.round(pt.km)} के पास रुकें`, lat: pt.lat, lng: pt.lng, halt: true, custom: true };
      }
      out.push({ from: prev, to, leg, part: k, parts, km: leg.km / parts, secs: leg.secs / parts });
      prev = to;
    }
    return out;
  });
  const travelDays = travel.reduce((s, t) => s + t.length, 0);
  const needDays = travelDays;
  const warnings = [];
  if (needDays > totalDays) {
    return { days: [], needDays, totalDays, warnings: [['too_short', `The driving alone needs about ${needDays} days at a ${({ relaxed: 'relaxed', balanced: 'balanced', adventure: 'adventure-focused' })[pace]} pace, but the trip has ${totalDays}. Add days, remove a destination or choose a faster pace.`,
      `सिर्फ़ गाड़ी चलाने में ही ${({ relaxed: 'आराम वाली', balanced: 'संतुलित', adventure: 'एडवेंचर वाली' })[pace]} रफ़्तार पर लगभग ${needDays} दिन लगेंगे, पर ट्रिप ${totalDays} दिन की है। दिन बढ़ाएँ, कोई मंज़िल हटाएँ या तेज़ रफ़्तार चुनें।`]] };
  }
  // Spread the spare days over the destinations (main destinations first).
  const dests = d.dests;
  const extra = dests.map(() => 0);
  let spare = totalDays - travelDays;
  for (let i = 0; spare > 0; i = (i + 1) % dests.length) { extra[i]++; spare--; }

  const sightsFor = (dest) => {
    const pool = [
      // Every listed place has coordinates; use its linked destination page when there is one.
      ...places.filter((p) => p.kind !== 'hub' && p.kind !== 'city').map((p) => {
        const l = p.location_id ? locs.find((x) => x.id === p.location_id) : null;
        return { name: l?.name || p.name, name_hi: l?.name_hi || p.name_hi, lat: p.lat, lng: p.lng, loc: l, key: `p${p.id}` };
      }),
    ].filter((x) => !exclude.some((e) => distanceKm(e, x) < 2));
    return pool.map((x) => ({ ...x, km: distanceKm(dest, x) })).filter((x) => x.km <= 45 && !used.has(x.key))
      .map((x) => ({ ...x, score: (x.loc?.theme_slugs || []).filter((t) => prefThemes.includes(t)).length * 20 + (x.loc ? 8 : 0) - x.km }))
      .sort((a, b) => b.score - a.score);
  };
  const stayFor = (p) => {
    const loc = placeLoc(p);
    const near = listings.filter((s) => s.location_id && (loc ? s.location_id === loc.id : false));
    return { place: p, options: near.map((s) => ({ id: s.id, name: s.name, price: s.price_per_night || null })) };
  };
  const evening = () => {
    if (d.prefs.includes('workation')) return ['work', 'Work block in the day (check mobile signal and Wi-Fi with your host)', 'दिन में काम का समय (मेज़बान से मोबाइल सिग्नल और वाई-फ़ाई पता करें)'];
    if (d.prefs.some((p) => ['villages', 'culture', 'homestays'].includes(p))) return ['evening', 'Evening: village walk and local food with your hosts', 'शाम: गाँव की सैर और मेज़बानों के साथ स्थानीय खाना'];
    if (d.prefs.includes('photography')) return ['evening', 'Sunset at a nearby viewpoint for photos', 'फ़ोटो के लिए पास के व्यूपॉइंट पर सूर्यास्त'];
    return ['evening', 'Evening at leisure', 'शाम आराम से'];
  };
  const days = [];
  const push = (day) => { day.day = days.length + 1; day.date = addDays(d.depart, days.length); days.push(day); };
  const nSights = SIGHTS_PER_DAY[pace];

  travel.forEach((parts, li) => {
    parts.forEach((t) => {
      const items = [];
      if (t.unknown) {
        items.push({ kind: 'warn', en: 'Road route could not be calculated for this stretch — check it before you travel.', hi: 'इस हिस्से का सड़क रास्ता नहीं निकल पाया — यात्रा से पहले जाँच लें।' });
      } else {
        const hrs = (t.secs * BREAK_FACTOR) / 3600;
        const lunch = hrs > 4 ? 1 : 0;
        const start = hrs <= 3 ? 9 : START_HOUR;
        const arrive = start + hrs + lunch;
        const hh = (x) => `${String(Math.floor(x)).padStart(2, '0')}:${String(Math.round((x % 1) * 60)).padStart(2, '0')}`.replace(':60', ':59');
        items.push({ kind: 'drive', time: hh(start), en: `Leave ${nm(t.from, 'en')} · ${fmtKm(t.km)}, about ${fmtDur(t.secs)} driving (route from OpenStreetMap)`, hi: `${nm(t.from, 'hi')} से निकलें · ${fmtKm(t.km)}, लगभग ${fmtDur(t.secs, true)} ड्राइव (OpenStreetMap रूट)` });
        const along = placesAlong(t.part === 1 && t.parts === 1 ? t.leg.coords : sliceCoords(t.leg.coords, t.part, t.parts), places, [t.from, t.to]);
        if (along.length) {
          const mid = along[Math.floor(along.length / 2)];
          items.push({ kind: 'stop', en: `Tea and rest breaks every ~2 hours. On the way: ${along.slice(0, 5).map((p) => p.name).join(', ')}`, hi: `हर ~2 घंटे में चाय और आराम। रास्ते में: ${along.slice(0, 5).map((p) => p.name_hi || p.name).join(', ')}` });
          if (lunch) items.push({ kind: 'meal', en: `Lunch around ${mid.name}`, hi: `${mid.name_hi || mid.name} के आसपास दोपहर का खाना` });
        } else if (lunch) items.push({ kind: 'meal', en: 'Lunch break on the way', hi: 'रास्ते में दोपहर का खाना' });
        items.push({ kind: 'arrive', time: hh(arrive), en: `Reach ${nm(t.to, 'en')} (estimate incl. breaks)`, hi: `${nm(t.to, 'hi')} पहुँचें (आराम सहित अनुमान)` });
        if (arrive > 18) items.push({ kind: 'warn', en: 'Arrives after dark — avoid night driving on hill roads; leave earlier or add a halt.', hi: 'अँधेरे के बाद पहुँचेंगे — पहाड़ी सड़कों पर रात में गाड़ी न चलाएँ; जल्दी निकलें या बीच में रुकें।' });
        else if (hrs <= 4 && !t.leg.ret && t.part === t.parts) {
          const s = sightsFor(t.to)[0];
          if (s) { used.add(s.key); items.push({ kind: 'see', en: `Afternoon: ${s.name} (~${Math.round(s.km)} km away, straight line)`, hi: `दोपहर: ${s.name_hi || s.name} (~${Math.round(s.km)} किमी, सीधी दूरी)`, loc: s.loc?.slug || null }); }
        }
      }
      const isHome = t.leg.ret && t.part === t.parts;
      push({ type: 'travel', title_en: `${nm(t.from, 'en')} → ${nm(t.to, 'en')}`, title_hi: `${nm(t.from, 'hi')} → ${nm(t.to, 'hi')}`,
        km: t.unknown ? null : t.km, secs: t.unknown ? null : t.secs, night: isHome ? null : t.to, stay: isHome ? null : stayFor(t.to), items, notes: '' });
    });
    // Stay days at this destination.
    if (li < dests.length) {
      for (let k = 0; k < extra[li]; k++) {
        const dest = dests[li];
        const sights = sightsFor(dest).slice(0, nSights);
        sights.forEach((s) => used.add(s.key));
        const items = sights.length ? sights.map((s) => ({ kind: 'see', en: `${s.name} — ~${Math.round(s.km)} km away (straight line)${s.loc?.best_season ? ` · best: ${s.loc.best_season}` : ''}${(s.loc?.theme_slugs || []).includes('treks-nature') ? ' · trek/walk: ask locally about the trail and conditions' : ''}`,
          hi: `${s.name_hi || s.name} — ~${Math.round(s.km)} किमी (सीधी दूरी)${(s.loc?.theme_slugs || []).includes('treks-nature') ? ' · ट्रेक/पैदल: रास्ते और हालात के बारे में स्थानीय लोगों से पूछें' : ''}`, loc: s.loc?.slug || null }))
          : [{ kind: 'see', en: `Explore ${nm(dest, 'en')} at your own pace`, hi: `${nm(dest, 'hi')} आराम से घूमें` }];
        const ev = evening();
        items.push({ kind: ev[0], en: ev[1], hi: ev[2] });
        push({ type: 'stay', title_en: `${nm(dest, 'en')}${sights.length ? ' & around' : ''}`, title_hi: `${nm(dest, 'hi')}${sights.length ? ' और आसपास' : ''}`,
          km: null, secs: null, night: dest, stay: stayFor(dest), items, notes: '' });
      }
    }
  });
  // No return leg: the final day ends the trip at the last destination.
  if (days.length && d.roundTrip === false) { const lastD = days[days.length - 1]; lastD.night = null; lastD.stay = null; lastD.items.push({ kind: 'note', en: 'Trip ends here', hi: 'यात्रा यहीं समाप्त' }); }
  if (legs.some((l) => l.error)) warnings.push(['route_missing', 'Some stretches have no calculated road route, so their days are rough.', 'कुछ हिस्सों का सड़क रास्ता नहीं निकला, इसलिए उन दिनों का प्लान अंदाज़न है।']);
  return { days, needDays, totalDays, warnings };
}
const nm = (p, lang) => (!p ? '' : lang === 'hi' && p.name_hi ? p.name_hi : p.custom && p.near ? `Pin near ${p.near.replace(/ \(.*/, '')}` : p.name);
function sliceCoords(coords, part, parts) {
  const n = coords.length; const a = Math.floor(((part - 1) / parts) * n); const b = Math.ceil((part / parts) * n);
  return coords.slice(a, b);
}

// ---------- budget ----------
export const COST_CATS = [
  ['transport', 'Transport fares (taxi / bus / train)', 'किराया (टैक्सी / बस / ट्रेन)'],
  ['fuel', 'Fuel', 'पेट्रोल / डीज़ल'],
  ['stay', 'Accommodation', 'रुकना'],
  ['food', 'Food', 'खाना'],
  ['activities', 'Activities', 'गतिविधियाँ'],
  ['permits', 'Trek permits & entry fees', 'परमिट और एंट्री फ़ीस'],
  ['local', 'Local transport', 'लोकल सफ़र'],
  ['tolls', 'Parking & tolls', 'पार्किंग और टोल'],
  ['other', 'Other expenses', 'अन्य ख़र्च'],
  ['reserve', 'Emergency reserve', 'आपात रिज़र्व'],
];
export const DEFAULT_MILEAGE = { car: 15, bike: 40, taxi: 15, bus: 0, train: 0, shared: 0 };
export const defaultAssumptions = (d) => ({
  fuel_price: '', mileage: DEFAULT_MILEAGE[d.mode] || 15, taxi_per_km: '', fare_per_person: '', rooms: Math.max(1, Math.ceil(d.adults / 2)),
  stay_per_night: '', food_per_person_day: '', activities: '', permits: '', local: '', tolls: '', other: '', reserve_pct: 10, local_km_per_day: 20,
});
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
// Returns { lines: {cat: {est, missing, how}}, total, perPerson, perDay, remaining, actualTotal }
export function computeBudget(d, route, days) {
  const a = { ...defaultAssumptions(d), ...(d.assumptions || {}) };
  const people = d.adults + d.children;
  const nDays = Math.round((new Date(d.ret) - new Date(d.depart)) / 864e5) + 1;
  const nights = Math.max(0, (days?.length ? days.filter((x) => x.night).length : nDays - 1));
  const sightKm = (num(a.local_km_per_day) || 0) * Math.max(0, (days || []).filter((x) => x.type === 'stay').length);
  const roadKm = route && !route.missing ? route.total_km : route ? route.total_km : null;
  const driveKm = roadKm == null ? null : roadKm + sightKm;
  const lines = {};
  const set = (k, est, how, missing = false) => { lines[k] = { est: est == null ? 0 : Math.round(est), how, missing: missing || est == null }; };
  const own = ['car', 'bike'].includes(d.mode);
  if (own) {
    const p = num(a.fuel_price); const m = num(a.mileage);
    set('fuel', driveKm != null && p && m ? (driveKm / m) * p : null, driveKm != null && m ? `${Math.round(driveKm)} km ÷ ${m} km/l × ₹${p ?? '?'}` : '', !p || driveKm == null);
    set('transport', 0, '');
  } else if (d.mode === 'taxi') {
    const r = num(a.taxi_per_km);
    set('transport', driveKm != null && r ? driveKm * r : null, driveKm != null ? `${Math.round(driveKm)} km × ₹${r ?? '?'}/km` : '', !r || driveKm == null);
    set('fuel', 0, '');
  } else {
    const f = num(a.fare_per_person);
    set('transport', f != null ? f * people : null, `₹${f ?? '?'} × ${people}`, f == null);
    set('fuel', 0, '');
  }
  const spn = num(a.stay_per_night); const rooms = num(a.rooms) || 1;
  set('stay', spn != null ? spn * rooms * nights : null, `${nights} × ${rooms} × ₹${spn ?? '?'}`, spn == null && nights > 0);
  if (!nights) lines.stay = { est: 0, how: '', missing: false };
  const fpd = num(a.food_per_person_day);
  set('food', fpd != null ? fpd * people * nDays : null, `${people} × ${nDays} × ₹${fpd ?? '?'}`, fpd == null);
  ['activities', 'permits', 'local', 'tolls', 'other'].forEach((k) => set(k, num(a[k]) ?? 0, '', false));
  const sub = Object.values(lines).reduce((s, l) => s + l.est, 0);
  const pct = num(a.reserve_pct) ?? 0;
  set('reserve', (sub * pct) / 100, `${pct}%`, false);
  const total = sub + lines.reserve.est;
  const actual = d.actuals || {};
  const actualTotal = Object.values(actual).reduce((s, v) => s + (num(v) || 0), 0);
  const budget = num(d.budget);
  return { a, mode: d.mode, lines, total, perPerson: people ? total / people : total, perDay: nDays ? total / nDays : total, nDays, nights, people, driveKm,
    remaining: budget != null ? budget - total : null, actualTotal, actualRemaining: budget != null ? budget - actualTotal : null,
    missing: Object.entries(lines).filter(([, l]) => l.missing).map(([k]) => k) };
}
// Rough spend for one day (only the parts we can work out).
export function daySpend(day, b) {
  const a = b.a; let s = 0; let any = false;
  if (day.km && ['car', 'bike'].includes(b.mode)) { const p = num(a.fuel_price); const m = num(a.mileage); if (p && m) { s += (day.km / m) * p; any = true; } }
  if (day.night && num(a.stay_per_night) != null) { s += num(a.stay_per_night) * (num(a.rooms) || 1); any = true; }
  if (num(a.food_per_person_day) != null) { s += num(a.food_per_person_day) * b.people; any = true; }
  return any ? Math.round(s) : null;
}
