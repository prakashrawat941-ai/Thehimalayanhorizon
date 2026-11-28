'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from './cx';
import { IconButton } from './Button';
import { UiIcon } from './icons';

const ToastContext = createContext(null);
const ICON = { success: 'circle-check', error: 'circle-alert', info: 'info' };

/**
 * Toasts. Success and info disappear after 5 s; errors stay until dismissed (people must be able to read them).
 * The region is a polite live region; errors use role=alert. Wrap the app area once in <ToastProvider>.
 */
export function ToastProvider({ children, dismissLabel = 'Dismiss', durationMs = 5000 }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
    setItems((list) => list.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((tone, text) => {
    seq.current += 1;
    const id = seq.current;
    setItems((list) => [...list, { id, tone, text }]);
    if (tone !== 'error') timers.current.set(id, setTimeout(() => dismiss(id), durationMs));
    return id;
  }, [dismiss, durationMs]);

  useEffect(() => () => { timers.current.forEach((t) => clearTimeout(t)); timers.current.clear(); }, []);

  const api = useMemo(() => ({
    push, dismiss,
    success: (text) => push('success', text),
    error: (text) => push('error', text),
    info: (text) => push('info', text),
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toasts" data-ui-root aria-live="polite" aria-relevant="additions">
        {items.map((it) => (
          <div key={it.id} className={cx('ui-toast', `ui-toast-${it.tone}`)} role={it.tone === 'error' ? 'alert' : 'status'}>
            <UiIcon name={ICON[it.tone]} size={18} />
            <span className="ui-toast-text">{it.text}</span>
            <IconButton icon="x" label={dismissLabel} size="sm" onClick={() => dismiss(it.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
