'use client';
import { useEffect, useState } from 'react';

/**
 * Registers the service worker and checks for a new version on open, whenever the app
 * comes back to the screen, and every 30 minutes. When a new version is waiting, it
 * takes over and the page reloads once so all files come from the same version.
 */
export function PwaRegister({ labels }: { labels: { update_ready: string; reload: string } }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    const onController = () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      setReady(true);
      // Reload right away if the user isn't typing in a form; otherwise show the bar.
      const active = document.activeElement;
      if (!active || !['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onController);
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then((reg) => {
      const check = () => { reg.update().catch(() => {}); };
      check();
      const onVisible = () => { if (document.visibilityState === 'visible') check(); };
      document.addEventListener('visibilitychange', onVisible);
      interval = setInterval(check, 30 * 60 * 1000);
    }).catch((e) => console.error('SW', e));
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onController);
      if (interval) clearInterval(interval);
    };
  }, []);
  if (!ready) return null;
  return (
    <div className="update-bar" role="status">
      <span>{labels.update_ready}</span>
      <button type="button" className="btn btn-sm" onClick={() => location.reload()}>{labels.reload}</button>
    </div>
  );
}
