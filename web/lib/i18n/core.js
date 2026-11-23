// Language helpers usable on server and client (no Next.js imports here).
import { baseDict, DISTRICT_HI, STATUS_WORDS } from './base';
import { extraDict } from './extra';
import { LANG_COOKIE } from './constants';
export { LANG_COOKIE };
export const DEFAULT_LANG = 'hi';
export const isLang = (v) => v === 'hi' || v === 'en';
const merged = {
    en: { ...baseDict.en, ...extraDict.en },
    hi: { ...baseDict.en, ...extraDict.en, ...baseDict.hi, ...extraDict.hi },
};
export function makeT(lang) {
    const dict = merged[lang];
    const t = (key) => dict[key] ?? merged.en[key] ?? key;
    /** Pick the Hindi column (`field_hi`) when the site is in Hindi and it is filled. */
    const pick = (row, field) => {
        if (!row)
            return '';
        const hi = row[`${field}_hi`];
        if (lang === 'hi' && typeof hi === 'string' && hi)
            return hi;
        const v = row[field];
        return v == null ? '' : String(v);
    };
    const L = (en, hi) => (lang === 'hi' ? hi : en);
    const district = (d) => (d ? (lang === 'hi' ? DISTRICT_HI[d] || d : d) : '');
    const status = (s) => (lang === 'hi' && STATUS_WORDS.hi?.[s]) || STATUS_WORDS.en?.[s] || s;
    return { lang, t, pick, L, district, status };
}
