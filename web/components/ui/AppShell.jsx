'use client';
import { useEffect, useRef, useState } from 'react';
import { cx } from './cx';
import { IconButton } from './Button';
import { UiIcon } from './icons';
import { ThemeToggle } from './ThemeToggle';

/** Wrapper that selects the token surface and enables theming. `enterprise` = navy/blue/teal, `brand` = forest green/gold. */
export function Surface({ surface = 'enterprise', className, children, ...rest }) {
  return <div data-ui-root="" data-surface={surface} className={cx('ui-surface', className)} {...rest}>{children}</div>;
}

export function Breadcrumbs({ items = [], label = 'Breadcrumb' }) {
  return (
    <nav aria-label={label} className="ui-crumbs">
      <ol>
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${it.label}-${i}`}>
              {last || !it.href ? <span aria-current={last ? 'page' : undefined}>{it.label}</span> : <a href={it.href}>{it.label}</a>}
              {!last ? <UiIcon name="chevron-right" size={12} /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, description, breadcrumbs, actions }) {
  return (
    <header className="ui-page-head">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="ui-page-head-row">
        <div>
          <h1 className="ui-page-title">{title}</h1>
          {description ? <p className="ui-page-desc">{description}</p> : null}
        </div>
        {actions ? <div className="ui-page-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

/**
 * Dashboard frame: skip link, top bar (menu button on phones, theme toggle, user slot), sidebar (drawer on phones).
 * nav: [{ href, label, icon, badge?, current? }]. `LinkComponent` lets callers pass next/link; defaults to <a>.
 * The sidebar is a landmark <nav>; the current item carries aria-current="page". Esc closes the drawer.
 * Navigation items are a UI affordance only: the server decides who may open each route.
 */
export function AppShell({ brand, nav = [], user, children, labels = {}, LinkComponent = 'a', surface = 'enterprise' }) {
  const l = { skip: 'Skip to main content', menu: 'Open menu', close: 'Close menu', navLabel: 'Main', ...labels };
  const [open, setOpen] = useState(false);
  const menuBtn = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); menuBtn.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const Link = LinkComponent;
  return (
    <Surface surface={surface} className="ui-shell">
      <a className="ui-skip" href="#ui-main">{l.skip}</a>
      <header className="ui-topbar">
        <span ref={menuBtn} className="ui-only-narrow-inline">
          <IconButton icon="menu" label={l.menu} onClick={() => setOpen(true)} aria-expanded={open} aria-controls="ui-sidebar" />
        </span>
        <div className="ui-topbar-brand">{brand}</div>
        <div className="ui-topbar-end"><ThemeToggle />{user}</div>
      </header>
      {open ? <div className="ui-scrim" onClick={() => setOpen(false)} aria-hidden="true" /> : null}
      <aside id="ui-sidebar" className={cx('ui-sidebar', open && 'is-open')}>
        <div className="ui-sidebar-close"><IconButton icon="x" label={l.close} onClick={() => { setOpen(false); menuBtn.current?.querySelector('button')?.focus(); }} /></div>
        <nav aria-label={l.navLabel}>
          <ul>
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className={cx('ui-nav-link', n.current && 'is-current')} aria-current={n.current ? 'page' : undefined} onClick={() => setOpen(false)}>
                  {n.icon ? <UiIcon name={n.icon} size={18} /> : null}
                  <span>{n.label}</span>
                  {n.badge ? <span className="ui-nav-badge">{n.badge}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main id="ui-main" className="ui-main" tabIndex={-1}>{children}</main>
    </Surface>
  );
}
