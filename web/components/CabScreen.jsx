'use client';
import { useEffect, useRef, useState } from 'react';

const modules = {
  operations: () => import('@/lib/operations/admin'),
  partner: () => import('@/lib/operations/partner'),
  cab: () => import('@/lib/cab/pages/cab'),
  drive: () => import('@/lib/cab/pages/drive'),
  admin: () => import('@/lib/cab/pages/admin-cab'),
};

export default function CabScreen({ area, screen, id = '', query }) {
  const root = useRef(null);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let active = true;
    const container = root.current;
    setStatus('loading');
    async function open() {
      const [{ sb }, { state, loadProfile }, views] = await Promise.all([
        import('@/lib/cab/sb'), import('@/lib/cab/store'), modules[area](),
      ]);
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      if (!active) return;
      state.session = data.session;
      await loadProfile();
      if (!active) return;
      const view = area === 'admin' ? await views[screen](query) : await views[screen]({ params: { id }, query });
      if (active) { container.replaceChildren(view); setStatus('ready'); }
    }
    open().catch(() => { if (active) setStatus('error'); });
    return () => {
      active = false;
      window.dispatchEvent(new Event('cabviewleave'));
      container.replaceChildren();
    };
  }, [area, screen, id, query]);
  return <>{status === 'loading' && <p role="status">Loading…</p>}
    {status === 'error' && <p role="alert">Could not load this page. <button onClick={() => location.reload()}>Try again</button></p>}
    <div ref={root} /><div id="toasts" aria-live="polite" /></>;
}
