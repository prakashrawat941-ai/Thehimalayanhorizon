'use client';
import { useState } from 'react';
import {
  AppShell, PageHeader, Card, CardHeader, Stat, StatGrid, Button, Badge, StatusBadge, Tabs, DataTable, FilterBar,
  Chart, Stepper, ApprovalCard, EmptyState, ErrorState, SuccessState, NotConnectedState, LoadingState, Field, Input,
  Select, Switch, ToastProvider, useToast, ConfirmDialog,
} from '@/components/ui';

// SAMPLE DATA ONLY. Fictional labels, no money or real operational figures.
const SAMPLE_ROWS = [
  { id: 'a', name: 'Sample village A', status: 'active', visits: 12 },
  { id: 'b', name: 'Sample village B', status: 'pending', visits: 4 },
  { id: 'c', name: 'Sample village C', status: 'blocked', visits: 9 },
  { id: 'd', name: 'Sample village D', status: 'completed', visits: 21 },
];
const SAMPLE_CHART = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((label, i) => ({ label, value: [3, 7, 4, 9, 6][i] }));
const SAMPLE_APPROVAL = {
  schemaVersion: 1, id: 'SAMPLE-0001', type: 'Sample change', title: 'Sample approval request', requester: { name: 'Sample requester', designation: 'Sample role' },
  status: 'pending_ceo', risk: 'medium', submittedAt: '2026-01-01T00:00:00Z', version: 2,
  changes: [
    { field: 'a', label: 'Sample field', kind: 'changed', before: 'Old value', after: 'New value' },
    { field: 'b', label: 'Sample added field', kind: 'added', after: 'Added value' },
  ],
};
const NAV = [
  { href: '#overview', label: 'Overview', icon: 'dashboard', current: true },
  { href: '#approvals', label: 'Approvals', icon: 'approvals', badge: '1' },
  { href: '#settings', label: 'Settings', icon: 'settings' },
];

function Inner() {
  const toast = useToast();
  const [filters, setFilters] = useState({});
  const [tab, setTab] = useState('tables');
  const [confirm, setConfirm] = useState(false);
  const [state, setState] = useState('ready');
  const rows = SAMPLE_ROWS.filter((r) => (!filters.q || r.name.toLowerCase().includes(filters.q.toLowerCase())) && (!filters.status || r.status === filters.status));
  return (
    <>
      <PageHeader title="UI kit" description="Sample data only. This page is hidden unless ENABLE_UI_KIT=1." breadcrumbs={[{ label: 'Developer', href: '#' }, { label: 'UI kit' }]}
        actions={<Button iconLeft="plus" onClick={() => toast.success('Saved (sample)')}>Show toast</Button>} />
      <StatGrid>
        <Stat label="Sample metric" value="42" icon="dashboard" delta={{ text: '3 vs last week', direction: 'up', good: true }} />
        <Stat label="No data yet" value={null} />
        <Stat label="Loading" loading />
      </StatGrid>
      <div style={{ height: 16 }} />
      <Tabs label="Sections" value={tab} onChange={setTab} tabs={[
        { id: 'tables', label: 'Tables', content: (
          <>
            <FilterBar value={filters} onChange={setFilters} filters={[{ key: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'pending', label: 'Pending' }, { value: 'blocked', label: 'Blocked' }] }]} />
            <DataTable caption="Sample villages" rows={rows} defaultSort={{ key: 'name', dir: 'asc' }}
              columns={[
                { key: 'name', header: 'Name', sortable: true, primary: true },
                { key: 'status', header: 'Status', sortable: true, render: (r) => <StatusBadge status={r.status} /> },
                { key: 'visits', header: 'Visits', sortable: true, align: 'right' },
              ]}
              empty={<EmptyState title="No matches" description="Try clearing the filters." />}
              pagination={{ page: 1, pageSize: 10, total: rows.length, onPageChange: () => {} }} />
          </>) },
        { id: 'charts', label: 'Charts', content: (
          <div style={{ display: 'grid', gap: 12 }}>
            <Chart type="bar" title="Sample bars" data={SAMPLE_CHART} />
            <Chart type="line" title="Sample line" data={SAMPLE_CHART} />
          </div>) },
        { id: 'forms', label: 'Forms', content: (
          <Card>
            <CardHeader title="Sample form" />
            <Field label="Name" required hint="Shown in lists."><Input defaultValue="" /></Field>
            <Field label="Type"><Select defaultValue="a"><option value="a">A</option><option value="b">B</option></Select></Field>
            <Switch label="Enabled" checked onCheckedChange={() => {}} />
            <div style={{ height: 12 }} />
            <Button variant="danger" onClick={() => setConfirm(true)}>Open confirm dialog</Button>
            <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Reject sample?" tone="danger" requireReason confirmLabel="Reject" onConfirm={async () => ({ ok: true })} />
          </Card>) },
        { id: 'states', label: 'States', content: (
          <div style={{ display: 'grid', gap: 12 }}>
            <div role="group" aria-label="Pick a state" style={{ display: 'flex', gap: 8 }}>
              {['ready', 'loading', 'error'].map((s) => <Button key={s} size="sm" variant={state === s ? 'primary' : 'secondary'} onClick={() => setState(s)}>{s}</Button>)}
            </div>
            {state === 'loading' ? <LoadingState /> : state === 'error' ? <ErrorState code="INTEGRATION_UNAVAILABLE" requestId="sample-req" onRetry={() => setState('ready')} /> : <SuccessState title="Everything saved" description="Shown only after the server confirms." />}
            <EmptyState title="Nothing here yet" description="Next step goes here." />
            <NotConnectedState title="Not connected yet" description="This screen has no live data source. No sample numbers are shown." />
          </div>) },
        { id: 'approvals', label: 'Approvals', content: (
          <div style={{ display: 'grid', gap: 12 }}>
            <Stepper steps={[{ key: 's', label: 'Submitted' }, { key: 'r', label: 'Review' }, { key: 'd', label: 'Decision' }]} current="r" />
            <ApprovalCard request={SAMPLE_APPROVAL} canDecide onDecide={async () => ({ ok: true })} />
            <ApprovalCard request={{ ...SAMPLE_APPROVAL, id: 'SAMPLE-0002', currentVersion: 3 }} canDecide onDecide={async () => ({ ok: true })} />
          </div>) },
      ]} />
      <p><Badge tone="teal">Teal accent</Badge></p>
    </>
  );
}

export function UiKitDemo() {
  return (
    <ToastProvider>
      <AppShell brand="THH UI kit" nav={NAV}><Inner /></AppShell>
    </ToastProvider>
  );
}
