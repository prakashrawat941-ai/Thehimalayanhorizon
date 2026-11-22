import { cookies } from 'next/headers';
import { DEFAULT_LANG, isLang, LANG_COOKIE, makeT } from './core';
export async function getLang() {
    const v = (await cookies()).get(LANG_COOKIE)?.value;
    return isLang(v) ? v : DEFAULT_LANG;
}
export async function getT() {
    return makeT(await getLang());
}
