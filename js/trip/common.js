// Shared Trip Planner helpers: the draft kept on this device, options and validation.
import { h, todayISO } from '../ui.js';
import { getLang } from '../i18n.js';
import { placeName } from '../places.js';

export const L = (en, hi) => (getLang() === 'hi' ? hi : en);
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
];
export const PACES = [
  ['relaxed', 'Relaxed', 'आराम से', 'Fewer places, more rest', 'कम जगहें, ज़्यादा आराम'],
  ['balanced', 'Balanced', 'संतुलित', 'A mix of travel and rest', 'घूमना और आराम दोनों'],
  ['adventure', 'Adventure-focused', 'एडवेंचर वाला', 'Long days, more activities', 'लंबे दिन, ज़्यादा गतिविधियाँ'],
];
export const MODES = [
  ['car', 'Own car / self-drive', 'अपनी कार / सेल्फ़-ड्राइव', 'car'],
  ['bike', 'Motorbike', 'मोटरबाइक', 'car'],
  ['taxi', 'Taxi / hired cab', 'टैक्सी / किराए की गाड़ी', 'car'],
  ['bus', 'Bus', 'बस', 'people'],
  ['train', 'Train + local cab', 'ट्रेन + लोकल गाड़ी', 'map'],
  ['shared', 'Shared ride (Instant Cab)', 'शेयर राइड (इंस्टेंट कैब)', 'people'],
];

// ---------- draft ----------
export const blank = () => ({ title: '', start: null, dests: [null], depart: '', ret: '', adults: 2, children: 0, prefs: [], pace: 'balanced', budget: '', mode: 'car', roundTrip: true, route: null, days: null, daysKey: null, assumptions: null, actuals: {}, tripId: null, updated: 0 });
export function loadDraft() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && Array.isArray(d.dests) ? { ...blank(), ...d } : null; } catch { return null; }
}
export function saveDraft(d) { d.updated = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage off: keep in memory */ } }
export function dropDraft() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export const hasContent = (d) => d && (d.start || d.dests.some(Boolean) || d.depart);

// Keep a light copy of a place (custom map pins have no id).
export const slim = (p) => (p ? { id: p.id || null, name: p.name, name_hi: p.name_hi || null, district: p.district || null, region: p.region || null,
  lat: Number(p.lat), lng: Number(p.lng), location_id: p.location_id || null, custom: !!p.custom, near: p.near || null } : null);
export const pName = (p) => (!p ? '' : p.halt && p.custom ? L(p.name, p.name_hi || p.name) : p.custom ? `${L('Pin near', 'पिन:')} ${p.near || ''}`.trim() : placeName(p));

export const nights = (d) => (d.depart && d.ret ? Math.round((new Date(d.ret) - new Date(d.depart)) / 864e5) : null);
export const daysOf = (d) => { const n = nights(d); return n == null ? null : n + 1; };
export const fmtD = (iso) => (iso ? new Date(`${iso}T12:00:00+05:30`).toLocaleDateString(getLang() === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function validate(d) {
  const errs = {};
  if (!d.start) errs.start = L('Choose where you start from.', 'शुरुआत की जगह चुनें।');
  const dests = d.dests.filter(Boolean);
  if (!dests.length) errs.dests = L('Add at least one destination.', 'कम से कम एक मंज़िल जोड़ें।');
  else if (d.dests.some((x) => !x)) errs.dests = L('Choose a place for every destination row, or remove the empty one.', 'हर मंज़िल के लिए जगह चुनें, या ख़ाली पंक्ति हटाएँ।');
  else if (d.start && dests.length === 1 && same(dests[0], d.start)) errs.dests = L('Destination must be different from the start.', 'मंज़िल शुरुआत से अलग होनी चाहिए।');
  else if (dests.some((x, i) => i > 0 && same(x, dests[i - 1]))) errs.dests = L('The same place is listed twice in a row.', 'एक ही जगह लगातार दो बार है।');
  if (!d.depart) errs.depart = L('Choose a departure date.', 'जाने की तारीख़ चुनें।');
  else if (d.depart < todayISO()) errs.depart = L('Departure cannot be in the past.', 'जाने की तारीख़ बीती हुई नहीं हो सकती।');
  if (!d.ret) errs.ret = L('Choose a return date.', 'वापसी की तारीख़ चुनें।');
  else if (d.depart && d.ret < d.depart) errs.ret = L('Return must be on or after departure.', 'वापसी, जाने की तारीख़ या उसके बाद हो।');
  else if (daysOf(d) > MAX_DAYS) errs.ret = L(`Trips can be up to ${MAX_DAYS} days.`, `ट्रिप ज़्यादा से ज़्यादा ${MAX_DAYS} दिन की हो सकती है।`);
  if (!(d.adults >= 1)) errs.people = L('At least one adult is needed.', 'कम से कम एक वयस्क ज़रूरी है।');
  if (d.budget !== '' && !(Number(d.budget) >= 0)) errs.budget = L('Budget must be a positive amount.', 'बजट सही रक़म हो।');
  return errs;
}
export const same = (a, b) => a && b && (a.id && b.id ? a.id === b.id : Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4);

// Small shared bits
export const back = (href) => h('a', { class: 'icon-btn', href, 'aria-label': L('Back', 'वापस') }, h('span', { 'aria-hidden': 'true' }, '←'));
export function steps(active) {
  const list = [L('Details', 'जानकारी'), L('Map', 'मैप'), L('Route', 'रूट'), L('Plan', 'प्लान'), L('Budget', 'बजट'), L('Summary', 'सारांश')];
  return h('ol', { class: 'tp-steps', 'aria-label': L('Steps', 'चरण') }, list.map((s, i) =>
    h('li', { class: i < active ? 'done' : i === active ? 'on' : '', 'aria-current': i === active ? 'step' : null }, h('span', {}, String(i + 1)), s)));
}

