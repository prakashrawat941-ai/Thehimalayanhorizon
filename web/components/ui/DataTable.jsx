'use client';
import { useMemo, useState } from 'react';
import { cx } from './cx';
import { UiIcon } from './icons';
import { Skeleton } from './Primitives';
import { EmptyState, ErrorState } from './States';
import { Pagination } from './Pagination';

/** Compare two cell values: numbers numerically, everything else with locale-aware, numeric-aware text compare. */
export function compareValues(a, b) {
  const an = a === null || a === undefined || a === '';
  const bn = b === null || b === undefined || b === '';
  if (an || bn) return an === bn ? 0 : an ? 1 : -1; // empty values always last when ascending
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function sortRows(rows, columns, sort) {
  if (!sort) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (!col) return rows;
  const get = col.sortValue || ((row) => row[col.key]);
  const dir = sort.dir === 'desc' ? -1 : 1;
  return rows
    .map((row, i) => ({ row, i }))
    .sort((x, y) => (compareValues(get(x.row), get(y.row)) * dir) || x.i - y.i)
    .map((x) => x.row);
}

/**
 * Data table with sorting, loading / empty / error states, pagination and a card layout on phones.
 *
 * columns: [{ key, header, render?(row), sortable?, sortValue?(row), align?, primary?, hideOnMobile? }]
 * `primary` marks the column used as the card title on phones.
 * Sorting is client-side unless `onSortChange` is given (then `sort` is controlled, e.g. server sorting).
 * `caption` is required for accessibility; `hideCaption` keeps it for screen readers only.
 */
export function DataTable({
  columns, rows = [], rowKey = 'id', caption, hideCaption = false,
  status = 'ready', error, empty, sort: sortProp, defaultSort, onSortChange,
  pagination, skeletonRows = 5, labels = {}, className,
}) {
  const l = { loading: 'Loading', sortedAsc: 'sorted ascending', sortedDesc: 'sorted descending', sortBy: 'Sort by', ...labels };
  const [inner, setInner] = useState(defaultSort || null);
  const controlled = typeof onSortChange === 'function';
  const sort = controlled ? sortProp : inner;
  const keyOf = (row, i) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey] ?? i);
  const shown = useMemo(() => (controlled ? rows : sortRows(rows, columns, sort)), [controlled, rows, columns, sort]);

  function toggle(col) {
    const next = !sort || sort.key !== col.key ? { key: col.key, dir: 'asc' } : { key: col.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
    if (controlled) onSortChange(next);
    else setInner(next);
  }

  if (status === 'error') return error ?? <ErrorState code="INTERNAL_ERROR" />;
  const isEmpty = status === 'ready' && rows.length === 0;
  if (isEmpty) return empty ?? <EmptyState title="Nothing here yet" />;

  const loading = status === 'loading';
  const primary = columns.find((c) => c.primary) || columns[0];
  const cell = (col, row) => (col.render ? col.render(row) : row[col.key] ?? <span className="ui-muted">—</span>);

  return (
    <div className={cx('ui-table-block', className)} aria-busy={loading || undefined}>
      <div className="ui-table-wrap ui-only-wide">
        <table className="ui-table">
          <caption className={hideCaption ? 'ui-sr-only' : 'ui-table-caption'}>{caption}</caption>
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort && sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.align ? { textAlign: col.align } : undefined}
                    aria-sort={col.sortable ? (active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                  >
                    {col.sortable ? (
                      <button type="button" className="ui-th-btn" onClick={() => toggle(col)} aria-label={`${l.sortBy} ${typeof col.header === 'string' ? col.header : col.key}${active ? `, ${sort.dir === 'asc' ? l.sortedAsc : l.sortedDesc}` : ''}`}>
                        <span>{col.header}</span>
                        <UiIcon name={active ? (sort.dir === 'asc' ? 'sort-asc' : 'sort-desc') : 'sort'} size={14} />
                      </button>
                    ) : col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={`s${i}`}>{columns.map((col) => <td key={col.key}><Skeleton height={14} width="70%" /></td>)}</tr>
              ))
              : shown.map((row, i) => (
                <tr key={keyOf(row, i)}>
                  {columns.map((col) => <td key={col.key} style={col.align ? { textAlign: col.align } : undefined}>{cell(col, row)}</td>)}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <ul className="ui-cards ui-only-narrow" aria-label={caption}>
        {loading
          ? Array.from({ length: Math.min(skeletonRows, 3) }, (_, i) => <li key={`m${i}`} className="ui-mcard"><Skeleton height={18} width="55%" /><Skeleton height={14} width="80%" style={{ marginTop: 10 }} /></li>)
          : shown.map((row, i) => (
            <li key={keyOf(row, i)} className="ui-mcard">
              <div className="ui-mcard-title">{cell(primary, row)}</div>
              <dl>
                {columns.filter((c) => c !== primary && !c.hideOnMobile).map((col) => (
                  <div key={col.key} className="ui-mcard-row"><dt>{col.header}</dt><dd>{cell(col, row)}</dd></div>
                ))}
              </dl>
            </li>
          ))}
      </ul>
      {loading ? <span className="ui-sr-only" role="status">{l.loading}</span> : null}
      {pagination && !loading ? <Pagination itemCount={rows.length} {...pagination} /> : null}
    </div>
  );
}
