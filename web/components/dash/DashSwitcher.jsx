'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import '@/app/dash.css';

// Switch between the dashboards this user is authorised for. `items` is built on the server
// (lib/dashboards.js); the target route re-checks role and MFA, so this menu grants nothing.
export function DashSwitcher({ current, items, labels }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const me = items.find((i) => i.key === current) || items[0];
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!me) return null;
  const dot = (i, big) => <span className={`dsx-dot${big ? ' big' : ''}`} style={{ background: i.color }} aria-hidden="true">{i.initials}</span>;
  return (
    <div className="dsx-switch" ref={box}>
      <button type="button" className="dsx-switch-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {dot(me)}
        <span className="dsx-switch-nm"><b>{me.label}</b><small>{labels.switch}</small></span>
      </button>
      {open ? (
        <div className="dsx-menu" role="menu" aria-label={labels.yours}>
          <p className="dsx-menu-h">{labels.yours}</p>
          {items.map((i) => (
            <Link key={i.key} href={i.href} role="menuitem" className="dsx-menu-item" aria-current={i.key === current ? 'true' : undefined} onClick={() => setOpen(false)}>
              {dot(i, true)}<span><b>{i.label}</b><small>{i.sub}</small></span>
            </Link>
          ))}
          <p className="dsx-menu-note">{labels.note}</p>
        </div>
      ) : null}
    </div>
  );
}
