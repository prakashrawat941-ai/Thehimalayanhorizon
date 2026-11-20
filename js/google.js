// One "Continue with Google" button for every login screen (customer, partner, admin all
// sign in through #/login). Uses the existing Supabase Google OAuth; the page to open
// afterwards is remembered in localStorage and handled by app.js on return.
import { h, toast } from './ui.js';
import { getLang } from './i18n.js';
import { sb } from './sb.js';

// Official multicolour Google "G" (Google brand asset, unmodified paths).
const G_LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20" focusable="false" aria-hidden="true">'
  + '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>'
  + '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>'
  + '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>'
  + '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>'
  + '<path fill="none" d="M0 0h48v48H0z"/></svg>';

export const GOOGLE_LABEL = 'Continue with Google';

export function googleButton(next = 'account', { disabled = false } = {}) {
  const btn = h('button', { type: 'button', class: 'gbtn', disabled, 'aria-label': GOOGLE_LABEL },
    h('span', { class: 'gbtn-logo', html: G_LOGO }),
    h('span', { class: 'gbtn-text' }, GOOGLE_LABEL),
    h('span', { class: 'gbtn-spin', 'aria-hidden': 'true' }));
  const setLoading = (on) => { btn.classList.toggle('is-loading', on); btn.disabled = on; btn.setAttribute('aria-busy', String(on)); };
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    try { localStorage.setItem('hh_next', next || 'account'); } catch { /* storage off */ }
    setLoading(true);
    try {
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
      if (error) throw error;
      // On success the browser leaves for Google; keep the loading state until then.
    } catch (error) {
      setLoading(false);
      const hi = getLang() === 'hi';
      const off = /not enabled|unsupported provider|provider is not/i.test(error.message || '');
      toast(off ? (hi ? 'Google लॉगिन अभी चालू नहीं है। अभी ईमेल से लॉगिन करें।' : 'Google sign-in is not switched on yet. Please use email for now.')
        : (hi ? 'Google लॉगिन नहीं हो पाया। फिर कोशिश करें।' : 'Google sign-in did not work. Please try again.'), 'err');
    }
  });
  return btn;
}
