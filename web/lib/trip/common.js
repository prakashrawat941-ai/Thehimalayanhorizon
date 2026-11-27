// Trip Planner shared helpers: options, the draft kept on this device, validation.
// Same data shapes as the current app, so trips saved in either app open in both.
export const KEY = 'hh_plan_v2';
export const MAX_DESTS = 8;
export const MAX_DAYS = 30;

export const PREFS = [
  ['nature', 'Nature & peaceful places', 'प्रकृति और शांत जगहें', 'treks-nature'],
  ['villages', 'Mountain villages', 'पहाड़ी गाँव', 'village-life'],
  ['trekking', 'Trekking & hiking', 'ट्रेकिंग और हाइकिंग', 'treks-nature'],
  ['adventure', 'Adventure', 'एडवेंचर', 'treks-nature'],
  ['photography', 'Photography', 'फ़ोटोग्राफ़ी', 'wildlife-birding'],
  ['lakes', 'Lakes & waterfalls', 'झीलें और झरने', 'treks-nature'],
  ['culture', 'Cultural experiences', 'संस्कृति', 'spiritual'],
  ['homestays', 'Homestays', 'होमस्टे', 'village-life'],
  ['workation', 'Workation', 'वर्केशन', 'work-from-mountain'],
  ['family', 'Family travel', 'परिवार के साथ', null],
  ['couple', 'Couple travel', 'कपल ट्रिप', null],
  ['solo', 'Solo travel', 'अकेले यात्रा', null],
  ['friends', 'Friends trip', 'दोस्तों के साथ', null],
  ['group', 'Group trip', 'ग्रुप ट्रिप', null],
];
/** "Who's going" — one of these is kept in prefs (no new column). [key, en, hi, adults, children, icon] */
export const WHO = [
  ['solo', 'Solo', 'अकेले', 1, 0, '🧍'], ['couple', 'Couple', 'कपल', 2, 0, '💑'], ['family', 'Family', 'परिवार', 2, 1, '👨‍👩‍👧'],
  ['friends', 'Friends', 'दोस्त', 4, 0, '🧑‍🤝‍🧑'], ['group', 'Group', 'ग्रुप', 8, 0, '👥'],
];
export const WHO_KEYS = WHO.map((w) => w[0]);
export const whoOf = (d) => WHO_KEYS.find((k) => d.prefs?.includes(k)) || null;
/** Vehicle body type and fuel, stored in assumptions (no new column). */
export const VEHICLES = [['hatch', 'Hatchback', 'हैचबैक'], ['sedan', 'Sedan', 'सेडान'], ['suv', 'SUV', 'एसयूवी']];
export const FUELS = [['petrol', 'Petrol', 'पेट्रोल', 'l'], ['diesel', 'Diesel', 'डीज़ल', 'l'], ['cng', 'CNG', 'सीएनजी', 'kg']];
export const PACES = [
  ['relaxed', 'Relaxed', 'आराम से', 'Fewer places, more rest', 'कम जगहें, ज़्यादा आराम'],
  ['balanced', 'Normal', 'संतुलित', 'A mix of travel and rest', 'घूमना और आराम दोनों'],
  ['adventure', 'Packed', 'भरपूर', 'Long days, more activities', 'लंबे दिन, ज़्यादा गतिविधियाँ'],
];
export const MODES = [
  ['car', 'Own car / self-drive', 'अपनी कार / सेल्फ़-ड्राइव'],
  ['bike', 'Motorbike', 'मोटरबाइक'],
  ['taxi', 'Taxi / hired cab', 'टैक्सी / किराए की गाड़ी'],
  ['bus', 'Bus', 'बस'],
  ['train', 'Train + local cab', 'ट्रेन + लोकल गाड़ी'],
  ['shared', 'Shared ride (Instant Cab)', 'शेयर राइड (इंस्टेंट कैब)'],
];
export const STATUSES = [
  ['draft', 'Draft', 'ड्राफ़्ट'], ['planning', 'Planning', 'प्लानिंग'], ['ready', 'Ready', 'तैयार'], ['upcoming', 'Upcoming', 'आने वाली'],
  ['ongoing', 'On the way', 'चल रही'], ['completed', 'Completed', 'पूरी'], ['cancelled', 'Cancelled', 'रद्द'],
];

export const blank = () => ({ title: '', start: null, dests: [null], depart: '', ret: '', adults: 2, children: 0, prefs: [], pace: 'balanced', budget: '', mode: 'car', roundTrip: true, route: null, days: null, daysKey: null, assumptions: null, actuals: {}, tripId: null, status: 'planning', updated: 0 });

export function loadDraft() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && Array.isArray(d.dests) ? { ...blank(), ...d } : null; } catch { return null; }
}
export function saveDraft(d) { try { localStorage.setItem(KEY, JSON.stringify({ ...d, updated: Date.now() })); } catch { /* storage off */ } }
export function dropDraft() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

/** Light copy of a place for storing in the trip. */
export const slim = (p) => (p ? { id: p.id || null, name: p.name, name_hi: p.name_hi || null, district: p.district || null, region: p.region || null,
  lat: Number(p.lat), lng: Number(p.lng), location_id: p.location_id || null, custom: !!p.custom, ext: !!p.ext, near: p.near || null,
  accuracy: p.accuracy ?? null, source: p.source || null } : null);

export const placeLabel = (p, lang) => (!p ? '' : lang === 'hi' && p.name_hi ? p.name_hi : p.custom && p.near ? `Pin near ${p.near}` : p.name);
export const tripDays = (d) => (d.depart && d.ret ? Math.round((new Date(d.ret) - new Date(d.depart)) / 864e5) + 1 : null);
export const same = (a, b) => a && b && (a.id && b.id ? a.id === b.id : Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4);
export const todayISO = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

export function validate(d, L) {
  const errs = {};
  if (!d.start) errs.start = L('Choose where you start from.', 'शुरुआत की जगह चुनें।');
  const dests = d.dests.filter(Boolean);
  if (!dests.length) errs.dests = L('Add at least one destination.', 'कम से कम एक मंज़िल जोड़ें।');
  else if (d.dests.some((x) => !x)) errs.dests = L('Choose a place for every destination row, or remove the empty one.', 'हर मंज़िल के लिए जगह चुनें, या ख़ाली पंक्ति हटाएँ।');
  else if (d.start && dests.length === 1 && same(dests[0], d.start)) errs.dests = L('Destination must be different from the start.', 'मंज़िल शुरुआत से अलग होनी चाहिए।');
  else if (dests.some((x, i) => i > 0 && same(x, dests[i - 1]))) errs.dests = L('The same place is listed twice in a row.', 'एक ही जगह लगातार दो बार है।');
  if (!d.depart) errs.depart = L('Choose a departure date.', 'जाने की तारीख़ चुनें।');
  else if (d.depart < todayISO() && !d.tripId) errs.depart = L('Departure cannot be in the past.', 'जाने की तारीख़ बीती हुई नहीं हो सकती।');
  if (!d.ret) errs.ret = L('Choose a return date.', 'वापसी की तारीख़ चुनें।');
  else if (d.depart && d.ret < d.depart) errs.ret = L('Return must be on or after departure.', 'वापसी, जाने की तारीख़ या उसके बाद हो।');
  else if (tripDays(d) > MAX_DAYS) errs.ret = L(`Trips can be up to ${MAX_DAYS} days.`, `ट्रिप ज़्यादा से ज़्यादा ${MAX_DAYS} दिन की हो सकती है।`);
  if (!(d.adults >= 1)) errs.people = L('At least one adult is needed.', 'कम से कम एक वयस्क ज़रूरी है।');
  if (d.budget !== '' && d.budget != null && !(Number(d.budget) >= 0)) errs.budget = L('Budget must be a positive amount.', 'बजट सही रक़म हो।');
  return errs;
}

export const prefThemes = (d) => [...new Set(d.prefs.map((k) => PREFS.find((p) => p[0] === k)?.[3]).filter(Boolean))];

/** Saved trip row (+ destinations) → planner draft. */
export function draftFromRow(t, dests = []) {
  const a = t.assumptions || {};
  const { actuals = {}, daysKey = null, daysEdited = false, ...assumptions } = a;
  return { ...blank(), title: t.title, start: t.start_place, dests: [...dests].sort((x, y) => x.position - y.position).map((x) => x.place),
    depart: t.start_date, ret: t.end_date, adults: t.adults ?? t.travellers ?? 2, children: t.children ?? 0, prefs: t.preferences || [],
    pace: t.pace || 'balanced', mode: t.travel_mode || 'car', roundTrip: t.round_trip !== false, budget: t.budget ?? '', route: t.route, days: t.days,
    daysKey, daysEdited, assumptions, actuals, status: t.status || 'planning', tripId: t.id || null, clientId: null, shareToken: t.share_token || null };
}
