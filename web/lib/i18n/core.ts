// Language helpers usable on server and client (no Next.js imports here).
import { baseDict, DISTRICT_HI, STATUS_WORDS } from './base';
import { extraDict } from './extra';

import { LANG_COOKIE, type Lang } from './constants';
export { LANG_COOKIE };
export type { Lang };
export const DEFAULT_LANG: Lang = 'hi';
export const isLang = (v: unknown): v is Lang => v === 'hi' || v === 'en';

const merged: Record<Lang, Record<string, string>> = {
  en: { ...baseDict.en, ...extraDict.en },
  hi: { ...baseDict.en, ...extraDict.en, ...baseDict.hi, ...extraDict.hi },
};

export function makeT(lang: Lang) {
  const dict = merged[lang];
  const t = (key: string) => dict[key] ?? merged.en[key] ?? key;
  /** Pick the Hindi column (`field_hi`) when the site is in Hindi and it is filled. */
  const pick = (row: Record<string, unknown> | null | undefined, field: string): string => {
    if (!row) return '';
    const hi = row[`${field}_hi`];
    if (lang === 'hi' && typeof hi === 'string' && hi) return hi;
    const v = row[field];
    return v == null ? '' : String(v);
  };
  const L = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const district = (d?: string | null) => (d ? (lang === 'hi' ? DISTRICT_HI[d] || d : d) : '');
  const status = (s: string) => (lang === 'hi' && STATUS_WORDS.hi?.[s]) || STATUS_WORDS.en?.[s] || s;
  return { lang, t, pick, L, district, status };
}
export type T = ReturnType<typeof makeT>;
