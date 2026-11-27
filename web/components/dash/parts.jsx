import Link from 'next/link';
import { Icon } from '@/components/Icon';
import '@/app/dash.css';

// Small building blocks shared by the Founder, CEO, Co-founder and Admin screens.
export const TONES = ['green', 'blue', 'amber', 'red', 'gray', 'violet'];

export function Tag({ tone = 'gray', children }) {
  return <span className={`dsx-tag dsx-t-${TONES.includes(tone) ? tone : 'gray'}`}>{children}</span>;
}

export function Kpi({ label, value, hint, href }) {
  const body = <><small>{label}</small><b>{value}</b>{hint ? <span>{hint}</span> : null}</>;
  return href ? <Link className="dsx-kpi" href={href}>{body}</Link> : <div className="dsx-kpi">{body}</div>;
}

export function KpiRow({ children }) {
  return <div className="dsx-kpis">{children}</div>;
}

export function Panel({ title, count, action, children }) {
  return (
    <section className="dsx-card">
      {title ? <h2 className="dsx-card-h"><span>{title}</span>{count != null ? <Tag tone={count ? 'red' : 'gray'}>{count}</Tag> : null}{action}</h2> : null}
      {children}
    </section>
  );
}

/** One line in a list: icon, title, sub-line and optional actions. Wraps actions below on phones. */
export function ListRow({ icon = 'doc', tone = 'gray', title, sub, href, children }) {
  const text = <span className="dsx-row-tx"><b>{title}</b>{sub ? <small>{sub}</small> : null}</span>;
  return (
    <div className="dsx-row">
      <span className={`dsx-row-ic dsx-t-${tone}`}><Icon name={icon} size={18} /></span>
      {href ? <Link href={href} className="dsx-row-link">{text}</Link> : text}
      {children ? <span className="dsx-row-act">{children}</span> : null}
    </div>
  );
}

/** Filter chips that are plain links, so filters live in the URL and survive refresh. */
export function FilterChips({ items, label }) {
  return (
    <nav className="dsx-chips" aria-label={label}>
      {items.map((it) => <Link key={`${it.href}|${it.label}`} href={it.href} className="dsx-chip" aria-current={it.on ? 'page' : undefined}>{it.label}{it.count != null ? ` ${it.count}` : ''}</Link>)}
    </nav>
  );
}
