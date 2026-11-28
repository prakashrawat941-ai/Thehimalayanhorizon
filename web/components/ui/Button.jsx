import Link from 'next/link';
import { cx } from './cx';
import { UiIcon } from './icons';

/**
 * Button. variant: primary | secondary | ghost | danger. size: sm | md.
 * `loading` disables the button, sets aria-busy and shows a spinner. The label stays in the DOM.
 */
export function Button({
  variant = 'primary', size = 'md', loading = false, disabled = false, iconLeft, iconRight,
  className, children, type = 'button', ...rest
}) {
  return (
    <button
      type={type}
      className={cx('ui-btn', `ui-btn-${variant}`, `ui-btn-${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <UiIcon name="loader" size={16} className="ui-spin" /> : iconLeft ? <UiIcon name={iconLeft} size={16} /> : null}
      <span>{children}</span>
      {!loading && iconRight ? <UiIcon name={iconRight} size={16} /> : null}
    </button>
  );
}

/** Same look, rendered as a link (navigation). */
export function ButtonLink({ href, variant = 'primary', size = 'md', iconLeft, iconRight, className, children, ...rest }) {
  return (
    <Link href={href} className={cx('ui-btn', `ui-btn-${variant}`, `ui-btn-${size}`, className)} {...rest}>
      {iconLeft ? <UiIcon name={iconLeft} size={16} /> : null}
      <span>{children}</span>
      {iconRight ? <UiIcon name={iconRight} size={16} /> : null}
    </Link>
  );
}

/** Icon-only button. `label` is required: it is the accessible name and the tooltip. */
export function IconButton({ icon, label, variant = 'ghost', size = 'md', className, type = 'button', ...rest }) {
  if (!label && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('IconButton needs a `label` for assistive technology.');
  }
  return (
    <button
      type={type}
      className={cx('ui-btn', 'ui-btn-icon', `ui-btn-${variant}`, `ui-btn-${size}`, className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <UiIcon name={icon} size={size === 'sm' ? 16 : 18} />
    </button>
  );
}
