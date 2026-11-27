'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { Button, IconButton } from './Button';
import { Field, Textarea } from './Field';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: focus moves in, Tab is trapped, Esc and overlay click close it (unless `dismissible` is false),
 * focus returns to the opener, and the page behind does not scroll. `side` makes it a left drawer (mobile menu).
 * Bottom sheet on phones, centred card on larger screens. Renders nothing while closed.
 */
export function Dialog({
  open, onClose, title, description, children, footer, size = 'md', side = false,
  dismissible = true, closeLabel = 'Close', className,
}) {
  const ref = useRef(null);
  const opener = useRef(null);
  const titleId = useId();
  const descId = useId();
  const [mounted, setMounted] = useState(false);
  const [surface, setSurface] = useState(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open || !mounted) return undefined;
    opener.current = document.activeElement;
    // The dialog is portalled to <body>, outside the page's surface wrapper: carry the surface over so it keeps its palette.
    setSurface(opener.current?.closest?.('[data-surface]')?.getAttribute('data-surface') || null);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const node = ref.current;
    const first = node?.querySelector('[data-autofocus]') || node?.querySelector(FOCUSABLE) || node;
    first?.focus();
    return () => {
      document.body.style.overflow = previous;
      if (opener.current && typeof opener.current.focus === 'function') opener.current.focus();
    };
  }, [open, mounted]);

  if (!open || !mounted) return null;

  function onKeyDown(event) {
    if (event.key === 'Escape' && dismissible) {
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) {
      event.preventDefault();
      ref.current.focus();
      return;
    }
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === firstEl || document.activeElement === ref.current)) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && document.activeElement === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  }

  return createPortal(
    <div
      className={cx('ui-overlay', side && 'ui-overlay-side')}
      data-ui-root
      data-surface={surface || undefined}
      onMouseDown={(event) => { if (dismissible && event.target === event.currentTarget) onClose?.(); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx('ui-dialog', `ui-dialog-${size}`, side && 'ui-dialog-side', className)}
        onKeyDown={onKeyDown}
      >
        <div className="ui-dialog-head">
          {title ? <h2 id={titleId} className="ui-dialog-title">{title}</h2> : <span />}
          {dismissible ? <IconButton icon="x" label={closeLabel} size="sm" onClick={onClose} /> : null}
        </div>
        {description ? <p id={descId} className="ui-dialog-desc">{description}</p> : null}
        <div className="ui-dialog-body">{children}</div>
        {footer ? <div className="ui-dialog-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmation with optional required reason. `onConfirm({ reason })` may return a promise.
 * It closes ONLY when the result is not `{ ok: false }`; a failure keeps the dialog open and shows the message,
 * so success is never shown before the server confirmed it.
 */
export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'primary', requireReason = false, reasonLabel = 'Reason', minReason = 3,
  genericError = 'Could not complete this. Nothing was changed.', children,
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const formId = useId();

  useEffect(() => {
    if (open) { setReason(''); setError(''); setBusy(false); setTouched(false); }
  }, [open]);

  const reasonMissing = requireReason && reason.trim().length < minReason;

  async function submit(event) {
    event?.preventDefault();
    if (busy) return;
    setTouched(true);
    if (reasonMissing) return;
    setBusy(true);
    setError('');
    try {
      const res = await onConfirm?.({ reason: reason.trim() });
      if (res && res.ok === false) {
        setError(res.message || genericError);
        setBusy(false);
        return;
      }
      setBusy(false);
      onClose?.();
    } catch {
      setError(genericError);
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      dismissible={!busy}
      title={title}
      description={description}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} type="submit" form={formId} loading={busy}>{confirmLabel}</Button>
        </>
      )}
    >
      <form id={formId} onSubmit={submit} noValidate>
        {children}
        {requireReason ? (
          <Field label={reasonLabel} required error={touched && reasonMissing ? `${reasonLabel} (min ${minReason})` : ''}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} data-autofocus="" />
          </Field>
        ) : null}
        {error ? <p className="ui-error ui-form-error" role="alert">{error}</p> : null}
      </form>
    </Dialog>
  );
}
