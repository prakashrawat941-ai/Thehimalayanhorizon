// Live updates (Supabase Realtime): call onChange when any watched table changes.
// Stops by itself when the page changes. Changes arriving close together are grouped.
import { sb } from './sb.js';

export function live(name, specs, onChange, { wait = 400 } = {}) {
  if (typeof sb.channel !== 'function' || !specs.length) return () => {};
  let ch = null; let timer = null; const changed = new Set();
  const fire = (table) => { changed.add(table); clearTimeout(timer); timer = setTimeout(() => { const t = [...changed]; changed.clear(); onChange(t); }, wait); };
  try {
    ch = sb.channel(`${name}-${Math.random().toString(36).slice(2)}`);
    specs.forEach(({ table, filter }) => ch.on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => fire(table)));
    ch.subscribe();
  } catch { return () => {}; }
  const stop = () => { clearTimeout(timer); try { sb.removeChannel(ch); } catch { /* ignore */ } window.removeEventListener('hashchange', stop); };
  window.addEventListener('hashchange', stop);
  return stop;
}

// Re-open the current page (keeps the URL) — used after a live change on list pages.
export const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
