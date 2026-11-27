import { cx } from './cx';
import { UiIcon } from './icons';
import { Skeleton, SrOnly } from './Primitives';

export function Card({ as: Tag = 'section', padded = true, className, children, ...rest }) {
  return <Tag className={cx('ui-card', padded && 'ui-card-pad', className)} {...rest}>{children}</Tag>;
}

export function CardHeader({ title, description, actions, level = 2 }) {
  const H = `h${level}`;
  return (
    <div className="ui-card-head">
      <div className="ui-card-head-text">
        <H className="ui-card-title">{title}</H>
        {description ? <p className="ui-card-desc">{description}</p> : null}
      </div>
      {actions ? <div className="ui-card-actions">{actions}</div> : null}
    </div>
  );
}

/**
 * KPI tile. It only ever shows a value it was given: no value renders an em dash with a
 * screen-reader note, never an invented number. `delta` = { text, direction: 'up' | 'down' | 'flat', good?: boolean }.
 */
export function Stat({ label, value, hint, delta, loading = false, icon, noDataLabel = 'No data' }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="ui-stat" aria-busy={loading || undefined}>
      <div className="ui-stat-top">
        <span className="ui-stat-label">{label}</span>
        {icon ? <span className="ui-stat-icon"><UiIcon name={icon} size={16} /></span> : null}
      </div>
      {loading ? (
        <Skeleton width="60%" height={28} />
      ) : (
        <div className="ui-stat-value">
          {empty ? <><span aria-hidden="true">—</span><SrOnly>{noDataLabel}</SrOnly></> : value}
        </div>
      )}
      {!loading && delta ? (
        <div className={cx('ui-stat-delta', delta.good === true && 'is-good', delta.good === false && 'is-bad')}>
          {delta.direction === 'up' ? <UiIcon name="trend-up" size={14} /> : delta.direction === 'down' ? <UiIcon name="trend-down" size={14} /> : null}
          <span>{delta.text}</span>
        </div>
      ) : null}
      {hint ? <div className="ui-stat-hint">{hint}</div> : null}
    </div>
  );
}

export function StatGrid({ children }) {
  return <div className="ui-stat-grid">{children}</div>;
}
