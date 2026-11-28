'use client';
import { useState } from 'react';
import { Button } from './Button';
import { Badge, StatusBadge } from './Primitives';
import { Card, CardHeader } from './Card';
import { ConfirmDialog } from './Dialog';
import { UiIcon } from './icons';
import { isDecidable, isStale, PROPOSED_SLA_HOURS } from '@/lib/contracts/approvals';

const RISK_TONE = { low: 'success', medium: 'warning', high: 'danger', critical: 'danger' };

export function RiskBadge({ risk, label }) {
  return <Badge tone={RISK_TONE[risk] || 'neutral'} icon={risk === 'low' ? 'circle-check' : 'alert'}>{label ?? risk}</Badge>;
}

/** Whole hours/minutes left until `deadlineAt`, or null when unknown. Pure; `now` is injectable for tests. */
export function timeLeft(deadlineAt, now = Date.now()) {
  if (!deadlineAt) return null;
  const ms = Date.parse(deadlineAt) - now;
  if (!Number.isFinite(ms)) return null;
  const overdue = ms < 0;
  const mins = Math.floor(Math.abs(ms) / 60000);
  return { overdue, hours: Math.floor(mins / 60), minutes: mins % 60 };
}

function show(v) {
  if (v === null || v === undefined || v === '') return '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/** Before / after list. Each change is text-labelled (Changed / Added / Removed), not colour-only. */
export function DiffView({ changes = [], labels = {} }) {
  const l = { changed: 'Changed', added: 'Added', removed: 'Removed', before: 'Before', after: 'After', none: 'No field changes', ...labels };
  if (!changes.length) return <p className="ui-muted">{l.none}</p>;
  return (
    <ul className="ui-diff">
      {changes.map((c) => (
        <li key={c.field} className={`ui-diff-row is-${c.kind}`}>
          <div className="ui-diff-head"><strong>{c.label}</strong> <Badge tone={c.kind === 'removed' ? 'danger' : c.kind === 'added' ? 'success' : 'info'}>{l[c.kind]}</Badge></div>
          <dl className="ui-diff-vals">
            {c.kind !== 'added' ? <div><dt>{l.before}</dt><dd className="ui-diff-before">{show(c.before)}</dd></div> : null}
            {c.kind !== 'removed' ? <div><dt>{l.after}</dt><dd className="ui-diff-after">{show(c.after)}</dd></div> : null}
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function ApprovalTimeline({ history = [], labels = {} }) {
  if (!history.length) return <p className="ui-muted">{labels.none || 'No history yet'}</p>;
  return (
    <ol className="ui-timeline">
      {history.map((h, i) => (
        <li key={`${h.at}-${i}`}>
          <div><strong>{h.action}</strong> · {h.actor}</div>
          <time dateTime={h.at} className="ui-muted">{h.at.replace('T', ' ').slice(0, 16)} UTC</time>
          {h.note ? <p className="ui-timeline-note">{h.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * Review card for one approval request. It never decides anything itself:
 * each action opens a confirmation, calls `onDecide({ decision, note, expectedVersion })`, and only closes when the
 * server answers `{ ok: true }`. Revise and reject require a note. When the request is stale (a newer version
 * exists) or not decidable, the actions are disabled and the reason is shown.
 *
 * `canDecide` is a UI hint from the permissions view-model. The server still enforces it.
 * `summary` (optional) renders between the metadata and the changes, e.g. amount and reason.
 * `extraActions` (optional) renders after the three decision buttons, e.g. details or escalate.
 */
export function ApprovalCard({ request, canDecide = false, onDecide, labels = {}, now, showProposedSla = true, summary = null, extraActions = null }) {
  const l = {
    approve: 'Approve', revise: 'Request revision', reject: 'Reject', cancel: 'Cancel', note: 'Note', stale: 'This request changed after you opened it. Reload to review the latest version.',
    notDecidable: 'This request can no longer be decided.', noPermission: 'You can view this request but cannot decide it.', overdue: 'overdue', left: 'left', requester: 'Requested by', risk: 'Risk', deadline: 'Decision due',
    changes: 'Changes', history: 'History', sla: 'Proposed SLA', ...labels,
  };
  const [pending, setPending] = useState(null); // 'approve' | 'revise' | 'reject'
  const stale = isStale(request);
  const decidable = isDecidable(request.status);
  const blocked = stale ? l.stale : !decidable ? l.notDecidable : !canDecide ? l.noPermission : '';
  const tl = timeLeft(request.deadlineAt, now);

  const copy = {
    approve: { title: `${l.approve}: ${request.title}`, confirm: l.approve, tone: 'primary', reason: false },
    revise: { title: `${l.revise}: ${request.title}`, confirm: l.revise, tone: 'primary', reason: true },
    reject: { title: `${l.reject}: ${request.title}`, confirm: l.reject, tone: 'danger', reason: true },
  };

  return (
    <Card aria-labelledby={`apr-${request.id}`}>
      <CardHeader
        level={3}
        title={<span id={`apr-${request.id}`}>{request.title}</span>}
        description={`${request.id} · ${request.type}`}
        actions={<StatusBadge status={request.status} label={request.statusLabel ?? request.status.replace(/_/g, ' ')} />}
      />
      <dl className="ui-meta">
        <div><dt>{l.requester}</dt><dd>{request.requester.name}{request.requester.designation ? `, ${request.requester.designation}` : ''}</dd></div>
        <div><dt>{l.risk}</dt><dd><RiskBadge risk={request.risk} label={request.riskLabel} /> {showProposedSla ? <span className="ui-muted">{l.sla}: {PROPOSED_SLA_HOURS[request.risk]}h</span> : null}</dd></div>
        {tl ? <div><dt>{l.deadline}</dt><dd className={tl.overdue ? 'ui-danger-text' : undefined}>{tl.hours}h {tl.minutes}m {tl.overdue ? l.overdue : l.left}</dd></div> : null}
      </dl>
      {summary}
      <h4 className="ui-subhead">{l.changes}</h4>
      <DiffView changes={request.changes} labels={l.noChanges ? { none: l.noChanges } : undefined} />
      {blocked ? <p className="ui-inline-note" role="note"><UiIcon name="info" size={14} /> {blocked}</p> : null}
      <div className="ui-actions-row">
        <Button onClick={() => setPending('approve')} disabled={!!blocked} iconLeft="check">{l.approve}</Button>
        <Button variant="secondary" onClick={() => setPending('revise')} disabled={!!blocked}>{l.revise}</Button>
        <Button variant="danger" onClick={() => setPending('reject')} disabled={!!blocked}>{l.reject}</Button>
        {extraActions}
      </div>
      {pending ? (
        <ConfirmDialog
          open
          onClose={() => setPending(null)}
          title={copy[pending].title}
          description={copy[pending].reason ? undefined : request.title}
          confirmLabel={copy[pending].confirm}
          cancelLabel={l.cancel}
          tone={copy[pending].tone}
          requireReason={copy[pending].reason}
          reasonLabel={l.note}
          onConfirm={({ reason }) => onDecide?.({ decision: pending, note: reason || '', expectedVersion: request.version })}
        />
      ) : null}
    </Card>
  );
}
