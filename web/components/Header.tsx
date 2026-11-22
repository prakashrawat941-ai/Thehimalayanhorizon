'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { LangToggle } from './LangToggle';
import type { Lang } from '@/lib/i18n/core';
import type { Roles } from '@/lib/auth';

type Labels = Record<string, string>;

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

export function Header({ lang, labels, roles, brandName, brandSub }: { lang: Lang; labels: Labels; roles: Roles | null; brandName: string; brandSub: string }) {
  const path = usePathname() || '/';
  const nav: [string, string, string | null][] = [
    ['/', labels.home, null],
    ['/cab', labels.nav_cab, 'car'],
    ['/plan', labels.nav_planner, 'map'],
    ['/villages', labels.nav_villages, 'mountain'],
  ];
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-mark" src="/img/brand/mark.png" alt="" width={44} height={42} />
        <span className="brand-text"><span className="brand-name">{brandName}</span><span className="brand-sub">{brandSub}</span></span>
      </Link>
      <nav className="topnav" aria-label="Main">
        {nav.map(([href, label, ic]) => (
          <Link key={href} href={href} className={isActive(path, href) ? 'active' : undefined} aria-current={isActive(path, href) ? 'page' : undefined}>
            {ic ? <Icon name={ic} size={19} /> : null}{label}
          </Link>
        ))}
      </nav>
      <div className="topbar-actions">
        <Link className="icon-link" href="/search" aria-label={labels.search}><Icon name="search" size={20} /></Link>
        <LangToggle lang={lang} signedIn={!!roles} />
        {roles?.admin ? <Link className="text-link hide-sm" href="/admin">{labels.admin}</Link> : null}
        {roles?.partner ? <Link className="text-link hide-sm" href="/partner">{labels.partner}</Link> : null}
        {roles ? <Link className="text-link hide-sm" href="/account">{labels.account}</Link>
          : <Link className="text-link" href={`/login?next=${encodeURIComponent(path)}`}>{labels.signin}</Link>}
        <Link className="btn btn-sm hide-sm" href="/plan">{labels.plan_your_trip}<Icon name="arrow" size={16} /></Link>
      </div>
    </header>
  );
}

export function TabBar({ labels }: { labels: Labels }) {
  const path = usePathname() || '/';
  const items: [string, string, string, string[]][] = [
    ['/', 'home', labels.home, []],
    ['/villages', 'mountain', labels.villages, ['/destinations']],
    ['/plan', 'map', labels.plan, []],
    ['/cab', 'car', labels.cabs, []],
    ['/account', 'user', labels.account, ['/login', '/partner', '/admin']],
  ];
  return (
    <nav className="tabbar" aria-label="App">
      {items.map(([href, ic, label, also]) => {
        const on = isActive(path, href) || also.some((a) => isActive(path, a));
        return (
          <Link key={href} href={href} className={on ? 'active' : undefined} aria-current={on ? 'page' : undefined}>
            <Icon name={ic} size={22} /><span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
