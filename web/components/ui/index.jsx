'use client';

import { cloneElement, isValidElement, useId, useState } from 'react';
import './ui.css';

/** Shared presentation primitives. Callers supply authorized, real data and actions. */
const cx = (...names) => names.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size = 'md', busy = false, disabled, children, className, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cx('thh-ui-button', `thh-ui-button--${variant}`, `thh-ui-button--${size}`, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy && <span aria-hidden="true" className="thh-ui-spinner" />}
      {children}
    </button>
  );
}

export function Card({ as: Element = 'section', title, description, actions, children, className, ...props }) {
  return (
    <Element className={cx('thh-ui-card', className)} {...props}>
      {(title || description || actions) && (
        <div className="thh-ui-card__header">
          <div>{title && <h2 className="thh-ui-card__title">{title}</h2>}{description && <p className="thh-ui-muted">{description}</p>}</div>
          {actions && <div className="thh-ui-card__actions">{actions}</div>}
        </div>
      )}
      {children}
    </Element>
  );
}

export function StatusBadge({ status, tone = 'neutral', className }) {
  return <span className={cx('thh-ui-badge', `thh-ui-badge--${tone}`, className)}>{status}</span>;
}

/** State labels must describe the actual request result; no sample rows are inserted. */
export function FeedbackState({ kind = 'empty', title, description, action, className }) {
  const role = kind === 'error' ? 'alert' : kind === 'success' ? 'status' : undefined;
  return (
    <div role={role} aria-live={kind === 'loading' ? 'polite' : undefined} className={cx('thh-ui-state', `thh-ui-state--${kind}`, className)}>
      {kind === 'loading' && <span aria-hidden="true" className="thh-ui-spinner" />}
      <strong>{title || { loading: 'Loading…', error: 'Unable to load', empty: 'Nothing here yet', success: 'Saved' }[kind]}</strong>
      {description && <p>{description}</p>}
      {action && <div className="thh-ui-state__action">{action}</div>}
    </div>
  );
}

export function LoadingState(props) { return <FeedbackState kind="loading" {...props} />; }
export function ErrorState(props) { return <FeedbackState kind="error" {...props} />; }
export function EmptyState(props) { return <FeedbackState kind="empty" {...props} />; }
export function SuccessState(props) { return <FeedbackState kind="success" {...props} />; }

export function FormField({ label, hint, error, required, children, id, className }) {
  const generatedId = useId();
  const fieldId = id || (isValidElement(children) && children.props.id) || generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const control = isValidElement(children) ? cloneElement(children, {
    id: children.props.id || fieldId,
    'aria-describedby': [children.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined,
    'aria-invalid': error ? true : children.props['aria-invalid'],
    required: required || children.props.required,
  }) : children;
  return (
    <div className={cx('thh-ui-field', className)}>
      <label htmlFor={fieldId} className="thh-ui-field__label">{label}{required && <span aria-hidden="true"> *</span>}</label>
      <div className="thh-ui-field__control">{control}</div>
      {hint && <p id={hintId} className="thh-ui-muted">{hint}</p>}
      {error && <p id={errorId} className="thh-ui-field__error" role="alert">{error}</p>}
    </div>
  );
}

export function TextInput({ invalid, className, ...props }) {
  return <input className={cx('thh-ui-input', className)} aria-invalid={invalid || undefined} {...props} />;
}

export function SelectInput({ invalid, className, children, ...props }) {
  return <select className={cx('thh-ui-input', className)} aria-invalid={invalid || undefined} {...props}>{children}</select>;
}

export function FilterBar({ children, label = 'Filters', actions, className }) {
  return <div role="group" aria-label={label} className={cx('thh-ui-filters', className)}><div className="thh-ui-filters__fields">{children}</div>{actions && <div>{actions}</div>}</div>;
}

/** Columns use {key, label, align?}; cells are values or renderCell(row, column). */
export function DataTable({ columns = [], rows = [], getRowKey = (row) => row.id, renderCell, caption, empty, className }) {
  if (!rows.length) return empty || <EmptyState title="No records found" />;
  return (
    <div className={cx('thh-ui-table-wrap', className)} tabIndex={0} role="region" aria-label={caption || 'Data table'}>
      <table className="thh-ui-table">
        {caption && <caption>{caption}</caption>}
        <thead><tr>{columns.map(({ key, label, align }) => <th key={key} scope="col" className={align === 'right' ? 'thh-ui-right' : undefined}>{label}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={getRowKey(row) ?? index}>
          {columns.map((column) => <td key={column.key} className={column.align === 'right' ? 'thh-ui-right' : undefined}>{renderCell ? renderCell(row, column) : row[column.key]}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  );
}

/** Wraps a real chart with its text equivalent; children may be any chart library. */
export function ChartFrame({ title, description, summary, children, className }) {
  return <Card title={title} description={description} className={className}>
    <div className="thh-ui-chart" aria-hidden={summary ? 'true' : undefined}>{children}</div>
    {summary && <p className="thh-ui-muted thh-ui-chart__summary">{summary}</p>}
  </Card>;
}

/** Decision UI only: server actions still enforce role, version and MFA. */
export function ApprovalPanel({ title, current, proposed, version, busy = false, onDecision, disabled = false, className }) {
  const [note, setNote] = useState('');
  const inputId = useId();
  const canDecide = !disabled && !busy && note.trim().length > 0 && typeof onDecision === 'function';
  return <Card title={title} className={className}>
    <dl className="thh-ui-approval__diff">
      <div><dt>Current</dt><dd>{current}</dd></div>
      <div><dt>Proposed</dt><dd>{proposed}</dd></div>
    </dl>
    {version != null && <p className="thh-ui-muted">Version {version}</p>}
    <label htmlFor={inputId} className="thh-ui-field__label">Decision note</label>
    <textarea id={inputId} className="thh-ui-input" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} disabled={disabled || busy} />
    <div className="thh-ui-approval__actions">
      <Button disabled={!canDecide} busy={busy} onClick={() => onDecision('approved', note.trim())}>Approve</Button>
      <Button variant="secondary" disabled={!canDecide} onClick={() => onDecision('returned', note.trim())}>Request revision</Button>
      <Button variant="danger" disabled={!canDecide} onClick={() => onDecision('rejected', note.trim())}>Reject</Button>
    </div>
  </Card>;
}
