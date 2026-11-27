'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Input, Select } from './Field';
import { UiIcon } from './icons';
import { Badge } from './Primitives';

/** Count how many filters (excluding an empty search) are set. */
export function activeFilterCount(value, filters = []) {
  let n = value.q ? 1 : 0;
  for (const f of filters) if (value[f.key]) n += 1;
  return n;
}

/**
 * Search + select filters. Controlled: `value` is a plain object ({ q, status, ... }), `onChange(next)` gets the full next object.
 * Search is debounced (default 300 ms). It does not talk to the URL or the server by itself:
 * the screen decides (for example by pushing the value into the query string, so filters survive a refresh).
 * filters: [{ key, label, options: [{ value, label }], allLabel? }]
 */
export function FilterBar({ value, onChange, filters = [], search = {}, debounceMs = 300, labels = {}, className }) {
  const l = { clear: 'Clear filters', search: 'Search', active: 'active', all: 'All', ...labels };
  const [q, setQ] = useState(value.q || '');
  const timer = useRef(null);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => { setQ(value.q || ''); }, [value.q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function onSearch(event) {
    const next = event.target.value;
    setQ(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ ...latest.current, q: next }), debounceMs);
  }

  const count = activeFilterCount(value, filters);
  return (
    <form className={`ui-filterbar ${className || ''}`} role="search" onSubmit={(e) => e.preventDefault()}>
      {search !== false ? (
        <label className="ui-filter-search">
          <span className="ui-sr-only">{search.label || l.search}</span>
          <UiIcon name="search" size={16} />
          <Input type="search" value={q} onChange={onSearch} placeholder={search.placeholder || l.search} autoComplete="off" />
        </label>
      ) : null}
      {filters.map((f) => (
        <label key={f.key} className="ui-filter-select">
          <span className="ui-filter-label">{f.label}</span>
          <Select value={value[f.key] || ''} onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}>
            <option value="">{f.allLabel || l.all}</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </label>
      ))}
      {count > 0 ? (
        <span className="ui-filter-clear">
          <Badge tone="info">{count} {l.active}</Badge>
          <Button variant="ghost" size="sm" onClick={() => { clearTimeout(timer.current); setQ(''); onChange({}); }}>{l.clear}</Button>
        </span>
      ) : null}
    </form>
  );
}
