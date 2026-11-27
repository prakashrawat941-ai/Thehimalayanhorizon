'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../Icon';
import { ThemeToggle } from '../ui/ThemeToggle';

// Sidebar on laptops, scrollable chips on phones (same design-system shell as the current app).
export function AccountNav({ items, title }) {
  const path = usePathname() || '/account';
  const on = (href, exact) => (exact || href === '/account' ? path === href : path === href || path.startsWith(href + '/'));
  const link = (it, cls) => (
    <Link key={it.href} href={it.href} className={`${cls}${on(it.href, it.exact) ? ' on' : ''}`} aria-current={on(it.href, it.exact) ? 'page' : undefined}>
      <Icon name={it.icon} size={18} /><span>{it.label}</span>
      {it.count ? <span className="ds-count" aria-label={`${it.count}`}>{it.count}</span> : null}
    </Link>
  );
  return (
    <>
      <aside className="ds-side" aria-label={title}>
        <div className="ds-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/brand/mark.png" alt="" width={34} height={32} />
          <span>{title}</span>
        </div>
        <div className="ds-group">{items.map((it) => link(it, 'ds-link'))}</div>
        <div style={{ marginTop: 16 }}><ThemeToggle /></div>
      </aside>
      <nav className="ds-strip" aria-label={title}>{items.map((it) => link(it, 'ds-chip'))}</nav>
    </>
  );
}
