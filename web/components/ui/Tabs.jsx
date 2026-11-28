'use client';
import { useId, useRef, useState } from 'react';
import { cx } from './cx';

/**
 * Accessible tabs: roving tabindex, Arrow/Home/End keys, only the active panel is rendered.
 * tabs: [{ id, label, content, count?, disabled? }]. Controlled with `value`/`onChange`, or uncontrolled.
 */
export function Tabs({ tabs, value, defaultValue, onChange, label, className }) {
  const base = useId();
  const [inner, setInner] = useState(defaultValue ?? tabs.find((t) => !t.disabled)?.id);
  const active = value ?? inner;
  const refs = useRef({});
  const enabled = tabs.filter((t) => !t.disabled);

  function select(id) {
    if (value === undefined) setInner(id);
    onChange?.(id);
  }

  function onKeyDown(event) {
    const idx = enabled.findIndex((t) => t.id === active);
    let next = null;
    if (event.key === 'ArrowRight') next = enabled[(idx + 1) % enabled.length];
    else if (event.key === 'ArrowLeft') next = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    event.preventDefault();
    select(next.id);
    refs.current[next.id]?.focus();
  }

  const current = tabs.find((t) => t.id === active);
  return (
    <div className={cx('ui-tabs', className)}>
      <div role="tablist" aria-label={label} className="ui-tablist" onKeyDown={onKeyDown}>
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            id={`${base}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={t.id === active}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={t.id === active ? 0 : -1}
            disabled={t.disabled}
            className="ui-tab"
            onClick={() => select(t.id)}
          >
            {t.label}{t.count != null ? <span className="ui-tab-count">{t.count}</span> : null}
          </button>
        ))}
      </div>
      {current ? (
        <div id={`${base}-panel-${current.id}`} role="tabpanel" aria-labelledby={`${base}-tab-${current.id}`} tabIndex={0} className="ui-tabpanel">
          {current.content}
        </div>
      ) : null}
    </div>
  );
}
