'use client';
import { cloneElement, isValidElement, useId } from 'react';
import { cx } from './cx';

/**
 * Field wires a label, hint and error to ONE control child (Input, Select, Textarea):
 * it sets id, aria-describedby, aria-invalid and required on it. The error is announced (role=alert).
 */
export function Field({ label, hint, error, required = false, children, className }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required: required || children.props.required || undefined,
      })
    : children;
  return (
    <div className={cx('ui-field', error && 'has-error', className)}>
      <label htmlFor={id} className="ui-label">
        {label}
        {required ? <span className="ui-req" aria-hidden="true"> *</span> : null}
      </label>
      {control}
      {hint ? <p id={hintId} className="ui-hint">{hint}</p> : null}
      {error ? <p id={errId} className="ui-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }) {
  return <input className={cx('ui-input', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return <select className={cx('ui-input', 'ui-select', className)} {...props}>{children}</select>;
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea className={cx('ui-input', 'ui-textarea', className)} rows={rows} {...props} />;
}

export function Checkbox({ label, className, id, ...props }) {
  const auto = useId();
  const cid = id || auto;
  return (
    <span className={cx('ui-check', className)}>
      <input id={cid} type="checkbox" {...props} />
      <label htmlFor={cid}>{label}</label>
    </span>
  );
}

/** On/off switch (role=switch). Controlled: pass `checked` and `onCheckedChange`. */
export function Switch({ checked, onCheckedChange, label, id, disabled = false, className }) {
  const auto = useId();
  const sid = id || auto;
  return (
    <span className={cx('ui-switch-row', className)}>
      <button
        id={sid}
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        className="ui-switch"
        onClick={() => onCheckedChange?.(!checked)}
      >
        <span className="ui-switch-knob" aria-hidden="true" />
      </button>
      <label htmlFor={sid}>{label}</label>
    </span>
  );
}
