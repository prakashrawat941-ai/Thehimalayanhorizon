'use client';
import { useEffect, useState } from 'react';

export default function LaunchScreen() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (location.pathname === '/' && location.hash.startsWith('#/')) {
      const [path, ...query] = location.hash.slice(2).split('?');
      const [section, ...parts] = path.split('/');
      const aliases = { explore: 'destinations', place: 'destinations', itinerary: 'itineraries',
        stays: 'homestays', stay: 'homestays', tour: 'village-tours', tours: 'village-tours',
        workspace: 'workspaces', cabs: 'cab/find', trip: 'trips', voucher: 'account/bookings' };
      const same = ['cab', 'drive', 'plan', 'account', 'partner', 'admin', 't', 'workspaces', 'villages', 'itineraries', 'login', 'trips'];
      if (Object.hasOwn(aliases, section) || same.includes(section)) {
        let target = [aliases[section] || section, ...parts].join('/');
        if (section === 'plan') target = 'plan';
        if (section === 'trips' && !parts.length) target = 'account/trips';
        if (section === 'admin' && ['drivers', 'vehicles', 'rides'].includes(parts[0])) {
          const params = new URLSearchParams(query.join('?'));
          params.set('tab', parts[0]);
          location.replace('/admin/cab?' + params);
          return;
        }
        const tabs = {
          'admin/home':'home_sections', 'admin/locations':'locations',
          'admin/itineraries':'itineraries', 'admin/themes':'themes'
        };
        if (Object.hasOwn(tabs,target)) {
          location.replace('/admin/cms?t=' + tabs[target]);
          return;
        }
        const renamed = {
          'partner/overview':'partner', 'account/overview':'account', 'admin/overview':'admin',
          'partner/homestay':'partner/properties', 'partner/village_tour':'partner/services',
          'partner/workspace':'partner/services', 'admin/business':'admin/homestays',
          'admin/queue':'admin/approvals', 'admin/hs-bookings':'admin/homestays'
        };
        target = renamed[target] || target;
        location.replace('/' + target + (query.length ? '?' + query.join('?') : ''));
        return;
      }
    }
    if (location.pathname !== '/' || !['', '?source=pwa'].includes(location.search) || location.hash) return;
    if (!matchMedia('(display-mode: standalone)').matches && !navigator.standalone) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || performance.getEntriesByType('navigation')[0]?.type !== 'navigate') return;
    try {
      if (sessionStorage.getItem('thh-launched')) return;
      sessionStorage.setItem('thh-launched', '1');
    } catch { return; }
    setVisible(true);
    const dismiss = () => setVisible(false);
    const timer = setTimeout(dismiss, 850);
    window.addEventListener('pagehide', dismiss);
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', dismiss); };
  }, []);
  return visible && <div id="thh-launch" aria-hidden="true"><div className="mark"><img src="/icons/signature-ridge.png" alt=""/><img src="/icons/signature-hill.png" alt=""/></div><span>The Himalayan Horizon</span></div>;
}
