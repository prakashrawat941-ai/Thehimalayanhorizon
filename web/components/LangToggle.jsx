'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LANG_COOKIE } from '@/lib/i18n/constants';
import { browserDb } from '@/lib/supabase/client';
/** Switch Hindi ⇄ English. Choice is kept in a cookie (and in the profile when signed in). */
export function LangToggle({ lang, signedIn = false }) {
    const router = useRouter();
    const [pending, start] = useTransition();
    const next = lang === 'hi' ? 'en' : 'hi';
    return (<button type="button" className="lang-btn" disabled={pending} lang={next} aria-label={next === 'hi' ? 'हिंदी में देखें' : 'View in English'} onClick={() => {
            document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
            try {
                localStorage.setItem('hh_lang', next);
            }
            catch { /* ignore */ }
            if (signedIn) {
                const db = browserDb();
                db.auth.getUser().then(({ data }) => { if (data.user)
                    db.from('profiles').update({ lang: next }).eq('id', data.user.id).then(() => { }); });
            }
            start(() => router.refresh());
        }}>
      {next === 'hi' ? 'हिंदी' : 'English'}
    </button>);
}
