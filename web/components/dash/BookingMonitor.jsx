import Link from 'next/link';
import { Tag } from './parts';
import { DashEmpty, DashError } from './DashStates';
import { Countdown } from '@/components/account/Countdown';
import '@/app/dash.css';

// Booking monitor list: table on laptops, cards on phones. Pure presentation — the page loads rows.
export function BookingMonitor({ rows, error, more, moreHref, tx }) {
  if (error) return <DashError title={tx.errorTitle} text={tx.errorText} retry={tx.retry} />;
  if (!rows.length) return <DashEmpty title={tx.emptyTitle} text={tx.emptyText} />;
  const status = (r) => (r.held
    ? <Countdown until={r.holdUntil} labels={{ held: tx.held, expired: tx.expired }} />
    : <Tag tone={r.tone}>{tx.status(r.status)}</Tag>);
  const code = (r) => <span className="dsx-mono">{r.code || tx.noCode}</span>;
  return (
    <section className="dsx-card">
      <div className="dsx-table-wrap dsx-only-d">
        <table className="dsx-table">
          <thead><tr><th>{tx.colId}</th><th>{tx.colType}</th><th>{tx.colWhat}</th><th>{tx.colWhen}</th><th>{tx.colQty}</th><th>{tx.colStatus}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{code(r)}</td><td>{tx.kind(r.kind)}</td><td>{r.title || '—'}</td><td>{r.when}</td><td>{r.qty}</td><td>{status(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dsx-cards dsx-only-m">
        {rows.map((r) => (
          <article key={r.key} className="dsx-mc">
            <div className="dsx-mc-h">{code(r)}{status(r)}</div>
            <dl>
              <dt>{tx.colType}</dt><dd>{tx.kind(r.kind)}</dd>
              <dt>{tx.colWhat}</dt><dd>{r.title || '—'}</dd>
              <dt>{tx.colWhen}</dt><dd>{r.when}</dd>
              <dt>{tx.colQty}</dt><dd>{r.qty}</dd>
            </dl>
          </article>
        ))}
      </div>
      {more ? <div className="dsx-pager"><span className="dsx-note">{tx.showing(rows.length)}</span><Link className="btn btn-ghost btn-sm" href={moreHref}>{tx.more}</Link></div> : null}
    </section>
  );
}
