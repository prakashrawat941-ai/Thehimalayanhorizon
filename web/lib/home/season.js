// Season helpers for the homepage "Go this season" block. Same five seasons as the site's
// Seasons section. best_season on destinations is free text written by the admin, so this
// reads month names (English / Hindi), ranges ("Oct–Mar", "March to June") and season words.

export const SEASONS = [
  ['spring', [3, 4]], ['summer', [5, 6]], ['monsoon', [7, 8, 9]], ['autumn', [10, 11]], ['winter', [12, 1, 2]],
];
export const seasonOf = (month) => SEASONS.find(([, ms]) => ms.includes(month))[0];
export const monthsOf = (season) => SEASONS.find(([k]) => k === season)?.[1] || [];
/** Month (1–12) in India right now. */
export const istMonth = (now = Date.now()) => new Date(now + 5.5 * 3600e3).getUTCMonth() + 1;

const MONTHS = [
  ['jan', 'january', 'जनवरी'], ['feb', 'february', 'फरवरी', 'फ़रवरी'], ['mar', 'march', 'मार्च'], ['apr', 'april', 'अप्रैल'],
  ['may', 'मई'], ['jun', 'june', 'जून'], ['jul', 'july', 'जुलाई'], ['aug', 'august', 'अगस्त'],
  ['sep', 'sept', 'september', 'सितंबर', 'सितम्बर'], ['oct', 'october', 'अक्टूबर'], ['nov', 'november', 'नवंबर', 'नवम्बर'], ['dec', 'december', 'दिसंबर', 'दिसम्बर'],
];
const WORDS = [
  [/\b(spring)\b|बसंत|वसंत/, [3, 4]], [/\b(summer)\b|गर्मी|गर्मियों/, [5, 6]], [/\b(monsoon|rain(?:s|y)?)\b|बरसात|मानसून/, [7, 8, 9]],
  [/\b(autumn|fall)\b|शरद/, [10, 11]], [/\b(winter)\b|सर्दी|सर्दियों|जाड़/, [12, 1, 2]],
];
const ALL_YEAR = /all[\s-]*(the\s+)?year|year[\s-]*round|any\s*time|throughout|साल\s*भर|पूरे\s*साल|बारहों\s*महीने/;
const range = (a, b) => { const out = []; let m = a; for (let i = 0; i < 12; i++) { out.push(m); if (m === b) break; m = (m % 12) + 1; } return out; };

/** Months (Set of 1–12) described by a free-text best_season. Empty set when nothing is recognised. */
export function parseBestSeason(text) {
  const s = String(text || '').toLowerCase();
  const out = new Set();
  if (!s.trim()) return out;
  if (ALL_YEAR.test(s)) { for (let m = 1; m <= 12; m++) out.add(m); return out; }
  const found = [];
  MONTHS.forEach((names, i) => names.forEach((n) => {
    const re = /^[a-z]/.test(n) ? new RegExp(`\\b${n}\\b`, 'g') : new RegExp(n, 'g');
    let mm; while ((mm = re.exec(s))) found.push({ m: i + 1, at: mm.index, end: mm.index + n.length });
  }));
  found.sort((a, b) => a.at - b.at);
  const dedup = found.filter((f, i) => !found.some((g, j) => j !== i && g.at <= f.at && g.end >= f.end && (g.end - g.at) > (f.end - f.at)));
  for (let i = 0; i < dedup.length; i++) {
    const a = dedup[i], b = dedup[i + 1];
    if (b && /^\s*(–|—|-|to|till|until|through|से|तक)\s*$/.test(s.slice(a.end, b.at).replace(/\s+(and)\s+/, ' '))) { range(a.m, b.m).forEach((m) => out.add(m)); i++; }
    else out.add(a.m);
  }
  WORDS.forEach(([re, ms]) => { if (re.test(s)) ms.forEach((m) => out.add(m)); });
  return out;
}

/** True when the destination's best season includes this month. */
export const goodIn = (text, month) => parseBestSeason(text).has(month);
