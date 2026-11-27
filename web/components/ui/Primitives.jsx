import { cx } from './cx';
import { UiIcon } from './icons';

export const TONES = Object.freeze(['neutral', 'info', 'success', 'warning', 'danger', 'teal']);

/** Visually hidden text for screen readers. */
export function SrOnly({ children }) {
  return <span className="ui-sr-only">{children}</span>;
}

/** Small status pill. Colour is never the only signal: pass text (and optionally an icon). */
export function Badge({ tone = 'neutral', icon, children, className }) {
  const t = TONES.includes(tone) ? tone : 'neutral';
  return (
    <span className={cx('ui-badge', `ui-badge-${t}`, className)}>
      {icon ? <UiIcon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

export function Avatar({ name = '', src, size = 36, className }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cx('ui-avatar', className)} style={style} src={src} alt={name} width={size} height={size} />;
  }
  return <span className={cx('ui-avatar', className)} style={style} role="img" aria-label={name || undefined}>{initials}</span>;
}

/** Placeholder block shown while data loads. Decorative; the surrounding region announces loading. */
export function Skeleton({ width, height = 16, radius, className, style }) {
  return <span className={cx('ui-skel', className)} aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function Spinner({ size = 18, label }) {
  return (
    <span className="ui-spinner" role={label ? 'status' : undefined} aria-label={label || undefined}>
      <UiIcon name="loader" size={size} className="ui-spin" />
    </span>
  );
}

/**
 * Generic status to tone + icon. Callers pass a translated label; unknown statuses render neutral.
 */
const STATUS_TONE = {
  draft: 'neutral', pending: 'warning', pending_ceo: 'warning', pending_founder: 'warning', under_review: 'info',
  approved: 'success', applying: 'info', applied: 'success', revision_required: 'warning', rejected: 'danger',
  withdrawn: 'neutral', failed: 'danger', rolled_back: 'neutral', active: 'success', inactive: 'neutral',
  blocked: 'danger', overdue: 'danger', completed: 'success', in_progress: 'info', on_hold: 'neutral', cancelled: 'neutral',
};
const STATUS_ICON = { success: 'circle-check', danger: 'circle-alert', warning: 'clock', info: 'info', neutral: null, teal: null };

export function statusTone(status) {
  return STATUS_TONE[status] || 'neutral';
}

export function StatusBadge({ status, label }) {
  const tone = statusTone(status);
  return <Badge tone={tone} icon={STATUS_ICON[tone] || undefined}>{label ?? String(status).replace(/_/g, ' ')}</Badge>;
}
