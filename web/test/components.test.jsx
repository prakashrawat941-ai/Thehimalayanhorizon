import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { sortRows, compareValues, DataTable } from '@/components/ui/DataTable';
import { pageRange, Pagination } from '@/components/ui/Pagination';
import { activeFilterCount } from '@/components/ui/FilterBar';
import { niceMax, formatCompact, Chart } from '@/components/ui/Chart';
import { timeLeft, DiffView, ApprovalCard } from '@/components/ui/Approvals';
import { Stat } from '@/components/ui/Card';
import { StatusBadge, statusTone, Badge } from '@/components/ui/Primitives';
import { EmptyState, ErrorState, AsyncView } from '@/components/ui/States';
import { Stepper } from '@/components/ui/Stepper';
import { Button, IconButton } from '@/components/ui/Button';
import { ICONS, ICON_NAMES, UiIcon } from '@/components/ui/icons';

const html = (el) => renderToStaticMarkup(el);

describe('table sorting', () => {
  const cols = [{ key: 'n', header: 'N', sortable: true }];
  it('sorts numbers numerically and text naturally', () => {
    expect(compareValues(2, 10)).toBeLessThan(0);
    expect(compareValues('item 2', 'item 10')).toBeLessThan(0);
  });
  it('keeps empty values last when ascending and is stable', () => {
    const rows = [{ id: 1, n: null }, { id: 2, n: 5 }, { id: 3, n: 1 }, { id: 4, n: 5 }];
    expect(sortRows(rows, cols, { key: 'n', dir: 'asc' }).map((r) => r.id)).toEqual([3, 2, 4, 1]);
  });
  it('does not mutate the input', () => {
    const rows = [{ n: 2 }, { n: 1 }];
    sortRows(rows, cols, { key: 'n', dir: 'asc' });
    expect(rows[0].n).toBe(2);
  });
});

describe('DataTable rendering', () => {
  const columns = [{ key: 'name', header: 'Name', sortable: true, primary: true }, { key: 'v', header: 'Visits' }];
  it('renders caption, scoped headers and aria-sort', () => {
    const out = html(<DataTable caption="Things" columns={columns} rows={[{ id: 1, name: 'A', v: 1 }]} defaultSort={{ key: 'name', dir: 'asc' }} />);
    expect(out).toContain('<caption');
    expect(out).toContain('scope="col"');
    expect(out).toContain('aria-sort="ascending"');
  });
  it('shows the empty state instead of an empty table', () => {
    const out = html(<DataTable caption="Things" columns={columns} rows={[]} empty={<EmptyState title="Nothing here" />} />);
    expect(out).toContain('Nothing here');
    expect(out).not.toContain('<table');
  });
  it('shows an error state with role=alert', () => {
    expect(html(<DataTable caption="Things" columns={columns} status="error" />)).toContain('role="alert"');
  });
  it('marks loading with aria-busy and skeletons, not rows', () => {
    const out = html(<DataTable caption="Things" columns={columns} status="loading" />);
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('ui-skel');
  });
});

describe('pagination and filters', () => {
  it('computes ranges', () => {
    expect(pageRange(2, 10, 25, 10)).toEqual({ from: 11, to: 20 });
    expect(pageRange(3, 10, 25, 5)).toEqual({ from: 21, to: 25 });
    expect(pageRange(1, 10, 0, 0)).toEqual({ from: 0, to: 0 });
  });
  it('disables Previous on page 1 and Next on the last page', () => {
    const first = html(<Pagination page={1} pageSize={10} total={25} itemCount={10} />);
    expect(first.match(/disabled/g)?.length).toBe(1);
    const last = html(<Pagination page={3} pageSize={10} total={25} itemCount={5} />);
    expect(last.match(/disabled/g)?.length).toBe(1);
  });
  it('counts active filters', () => {
    expect(activeFilterCount({}, [{ key: 's' }])).toBe(0);
    expect(activeFilterCount({ q: 'x', s: 'a' }, [{ key: 's' }])).toBe(2);
  });
});

describe('chart', () => {
  it('rounds axis maxima up', () => {
    expect(niceMax(7)).toBe(10);
    expect(niceMax(130)).toBe(200);
    expect(niceMax(0)).toBe(1);
  });
  it('formats Indian compact numbers', () => {
    expect(formatCompact(1500)).toBe('1.5k');
    expect(formatCompact(250000)).toBe('2.5L');
    expect(formatCompact(20000000)).toBe('2Cr');
  });
  it('draws only given data and includes an accessible table', () => {
    const out = html(<Chart title="T" data={[{ label: 'a', value: 1 }, { label: 'b', value: 3 }]} />);
    expect(out).toContain('role="img"');
    expect(out).toContain('<table');
    expect(out.match(/ui-chart-bar/g)?.length).toBe(2);
  });
  it('renders an empty state, not a flat chart, when there is no data', () => {
    const out = html(<Chart title="T" data={[{ label: 'a', value: null }]} />);
    expect(out).not.toContain('role="img"');
    expect(out).not.toContain('ui-chart-bar');
    expect(out).toContain('No data to chart yet');
  });
});

describe('Stat never invents a number', () => {
  it('shows a dash with a screen reader note when there is no value', () => {
    const out = html(<Stat label="Revenue" value={null} />);
    expect(out).toContain('—');
    expect(out).toContain('No data');
  });
  it('shows the given value', () => expect(html(<Stat label="X" value="42" />)).toContain('42'));
});

describe('status and badges', () => {
  it('maps statuses to tones with a neutral fallback', () => {
    expect(statusTone('approved')).toBe('success');
    expect(statusTone('rejected')).toBe('danger');
    expect(statusTone('whatever')).toBe('neutral');
  });
  it('status is text, not colour only', () => expect(html(<StatusBadge status="pending" label="Pending" />)).toContain('Pending'));
  it('falls back to neutral for unknown tones', () => expect(html(<Badge tone="nope">x</Badge>)).toContain('ui-badge-neutral'));
});

describe('states', () => {
  it('error state hides retry for non-retryable codes and shows request id', () => {
    const out = html(<ErrorState code="PERMISSION_DENIED" requestId="req-9" onRetry={() => {}} />);
    expect(out).not.toContain('Try again');
    expect(out).toContain('req-9');
  });
  it('error state offers retry for retryable codes', () => {
    expect(html(<ErrorState code="INTEGRATION_UNAVAILABLE" onRetry={() => {}} />)).toContain('Try again');
  });
  it('AsyncView renders exactly one branch', () => {
    expect(html(<AsyncView status="loading">ready</AsyncView>)).toContain('aria-busy');
    expect(html(<AsyncView status="ready" isEmpty empty={<p>empty</p>}>ready</AsyncView>)).toBe('<p>empty</p>');
    expect(html(<AsyncView status="ready">ready</AsyncView>)).toBe('ready');
  });
});

describe('approvals', () => {
  const base = {
    schemaVersion: 1, id: 'T-1', type: 'Type', title: 'Title', requester: { name: 'R' }, status: 'pending_ceo', risk: 'high',
    submittedAt: '2026-01-01T00:00:00Z', version: 1, changes: [{ field: 'f', label: 'F', kind: 'changed', before: 'a', after: 'b' }],
  };
  it('time left is calculated from the deadline', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(timeLeft('2026-01-01T02:30:00Z', now)).toEqual({ overdue: false, hours: 2, minutes: 30 });
    expect(timeLeft('2025-12-31T23:00:00Z', now)).toEqual({ overdue: true, hours: 1, minutes: 0 });
    expect(timeLeft(undefined, now)).toBeNull();
  });
  it('diff labels each change in text', () => {
    const out = html(<DiffView changes={[{ field: 'x', label: 'X', kind: 'added', after: 1 }]} />);
    expect(out).toContain('Added');
  });
  it('actions are enabled for a decidable, permitted, current request', () => {
    const out = html(<ApprovalCard request={base} canDecide onDecide={() => {}} />);
    expect(out).not.toContain('disabled');
  });
  it('disables actions and explains why when the user cannot decide', () => {
    const out = html(<ApprovalCard request={base} canDecide={false} />);
    expect(out.match(/disabled/g)?.length).toBe(3);
    expect(out).toContain('cannot decide');
  });
  it('disables actions when stale', () => {
    const out = html(<ApprovalCard request={{ ...base, currentVersion: 2 }} canDecide />);
    expect(out.match(/disabled/g)?.length).toBe(3);
    expect(out).toContain('changed after you opened it');
  });
  it('disables actions when already decided', () => {
    expect(html(<ApprovalCard request={{ ...base, status: 'approved' }} canDecide />).match(/disabled/g)?.length).toBe(3);
  });
});

describe('stepper', () => {
  it('marks the current step and writes state as text', () => {
    const out = html(<Stepper steps={[{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]} current="b" />);
    expect(out).toContain('aria-current="step"');
    expect(out).toContain('completed');
  });
});

describe('buttons and icons', () => {
  it('loading buttons are disabled and busy', () => {
    const out = html(<Button loading>Save</Button>);
    expect(out).toContain('disabled');
    expect(out).toContain('aria-busy="true"');
  });
  it('icon-only buttons carry an accessible name', () => expect(html(<IconButton icon="x" label="Close" />)).toContain('aria-label="Close"'));
  it('every registered icon renders and is decorative by default', () => {
    expect(ICON_NAMES.length).toBeGreaterThan(40);
    for (const name of ICON_NAMES) {
      expect(ICONS[name], name).toBeTruthy();
      expect(html(<UiIcon name={name} />), name).toContain('aria-hidden="true"');
    }
  });
  it('unknown icons render nothing', () => expect(html(<UiIcon name="nope" />)).toBe(''));
  it('icon with a title becomes an image', () => expect(html(<UiIcon name="info" title="Info" />)).toContain('role="img"'));
});
