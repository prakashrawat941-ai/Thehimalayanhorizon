'use client';
import { Button } from './Button';

export function pageRange(page, pageSize, total, itemCount) {
  if (!itemCount && !total) return { from: 0, to: 0 };
  const from = (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + (itemCount ?? pageSize);
  return { from, to: total != null ? Math.min(to, total) : to };
}

/**
 * Previous / next with a status line. `total` may be null (unknown): then `hasMore` decides whether Next is enabled.
 * Works with server pagination: it only reports the wanted page through onPageChange.
 */
export function Pagination({ page, pageSize, total = null, hasMore = false, itemCount, onPageChange, labels = {} }) {
  const l = { prev: 'Previous', next: 'Next', nav: 'Pagination', of: 'of', ...labels };
  const { from, to } = pageRange(page, pageSize, total, itemCount);
  const last = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const canPrev = page > 1;
  const canNext = last != null ? page < last : hasMore;
  return (
    <nav className="ui-pager" aria-label={l.nav}>
      <span className="ui-pager-status" aria-live="polite">
        {to === 0 ? '0' : `${from}–${to}`}{total != null ? ` ${l.of} ${total}` : ''}
      </span>
      <span className="ui-pager-btns">
        <Button variant="secondary" size="sm" iconLeft="chevron-left" disabled={!canPrev} onClick={() => onPageChange?.(page - 1)}>{l.prev}</Button>
        <Button variant="secondary" size="sm" iconRight="chevron-right" disabled={!canNext} onClick={() => onPageChange?.(page + 1)}>{l.next}</Button>
      </span>
    </nav>
  );
}
