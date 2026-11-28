import { cx } from './cx';
import { Button } from './Button';
import { UiIcon } from './icons';
import { Skeleton } from './Primitives';
import { errorCopy } from '@/lib/contracts/errors';

function StateShell({ tone, icon, title, text, children, role, className }) {
  return (
    <div className={cx('ui-state', `ui-state-${tone}`, className)} role={role}>
      <span className="ui-state-icon"><UiIcon name={icon} size={26} /></span>
      <h3 className="ui-state-title">{title}</h3>
      {text ? <p className="ui-state-text">{text}</p> : null}
      {children}
    </div>
  );
}

/** Nothing to show yet. Offer the next step; never fill the space with sample rows. */
export function EmptyState({ icon = 'inbox', title, description, action }) {
  return <StateShell tone="neutral" icon={icon} title={title} text={description}>{action}</StateShell>;
}

/**
 * Error with retry. Pass a contract `code` to get a translated, honest message ("Nothing was changed"),
 * or title/description to override. `requestId` is shown so support can trace the failure.
 */
export function ErrorState({ code, lang = 'en', title, description, requestId, onRetry, retryLabel = 'Try again', retrying = false }) {
  const copy = errorCopy(code, lang);
  return (
    <StateShell tone="danger" icon="circle-alert" title={title || copy.title} text={description || copy.text} role="alert">
      {onRetry && (copy.retryable || !code) ? (
        <Button variant="secondary" iconLeft="refresh" onClick={onRetry} loading={retrying}>{retryLabel}</Button>
      ) : null}
      {requestId ? <p className="ui-state-ref">Reference: <code>{requestId}</code></p> : null}
    </StateShell>
  );
}

export function SuccessState({ title, description, action }) {
  return <StateShell tone="success" icon="circle-check" title={title} text={description} role="status">{action}</StateShell>;
}

/** The data source for this screen is not live yet. Never replaced by sample data. */
export function NotConnectedState({ title, description }) {
  return <StateShell tone="info" icon="layers" title={title} text={description} />;
}

export function LoadingState({ label = 'Loading', rows = 4 }) {
  return (
    <div className="ui-loading" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={52} radius={12} />)}
    </div>
  );
}

/**
 * Renders exactly one of loading / error / empty / content.
 *   status: 'loading' | 'error' | 'ready'. `isEmpty` only applies when status is 'ready'.
 */
export function AsyncView({ status, isEmpty = false, loading, error, empty, children }) {
  if (status === 'loading') return loading ?? <LoadingState />;
  if (status === 'error') return error ?? <ErrorState code="INTERNAL_ERROR" />;
  if (isEmpty) return empty ?? <EmptyState title="Nothing here yet" />;
  return children;
}
