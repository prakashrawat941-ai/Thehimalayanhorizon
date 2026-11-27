// Theme preference store (light | dark | system). Client-side only; the preference is not private data.
// The <html data-theme> attribute is set before first paint by THEME_INIT_SCRIPT (rendered in the root layout).

export const THEME_KEY = 'thh.theme';
export const THEME_PREFS = Object.freeze(['light', 'dark', 'system']);

export function normalizePref(value) {
  return THEME_PREFS.includes(value) ? value : 'system';
}

/** Resolve a stored preference to the theme that is actually shown. */
export function resolveTheme(pref, systemDark) {
  const p = normalizePref(pref);
  if (p === 'system') return systemDark ? 'dark' : 'light';
  return p;
}

/**
 * Inline script for <head>. Keep it tiny and dependency free: it runs before React.
 * Any storage or matchMedia failure falls back to the light theme.
 */
export const THEME_INIT_SCRIPT =
  "(function(){var root=document.documentElement;try{var p=localStorage.getItem('" + THEME_KEY + "');" +
  "if(p!=='light'&&p!=='dark')p='system';" +
  "var dark=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);" +
  "root.setAttribute('data-theme',dark?'dark':'light');root.setAttribute('data-theme-pref',p);}" +
  "catch(err){root.setAttribute('data-theme','light');root.setAttribute('data-theme-pref','system');}})();";

const listeners = new Set();

function systemPrefersDark() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function getPref() {
  try {
    return normalizePref(window.localStorage.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

/** Write the resolved theme to <html>. Returns the resolved theme. */
export function applyTheme(pref) {
  const resolved = resolveTheme(pref, systemPrefersDark());
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-pref', normalizePref(pref));
  return resolved;
}

export function setPref(pref) {
  const p = normalizePref(pref);
  try {
    if (p === 'system') window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, p);
  } catch {
    /* private mode: the choice still applies for this page view */
  }
  applyTheme(p);
  listeners.forEach((fn) => fn());
}

/** useSyncExternalStore subscribe: preference changes in this tab, other tabs and the OS setting. */
export function subscribe(onChange) {
  listeners.add(onChange);
  let mq = null;
  const onMq = () => {
    if (getPref() === 'system') applyTheme('system');
    onChange();
  };
  const onStorage = (event) => {
    if (event.key === THEME_KEY || event.key === null) {
      applyTheme(getPref());
      onChange();
    }
  };
  try {
    mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', onMq);
  } catch {
    mq = null;
  }
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    if (mq) mq.removeEventListener('change', onMq);
    window.removeEventListener('storage', onStorage);
  };
}

export const getServerPref = () => 'system';
