'use client';

import { useEffect, useState } from 'react';
import { ApprovalCard, RiskBadge } from '@/components/ui/Approvals';
import { Button, StatusBadge } from '@/components/ui/workspace';
import { listApprovals, reviewApproval } from '@/app/(management)/management/approval-actions';
import { canReview, formatPaise, pick, requestActions, ROLE_NAME, STATUS_LABEL } from '@/lib/management/approval-requests.mjs';
import { ApprovalCountsStrip, ApprovalDetailDialog, NewRequestDialog, RequestActions, useApprovalOverview } from './ApprovalWorkflow';

const pageSize = 20;
const RISK_LABEL = { low: ['Low risk', 'कम जोखिम'], medium: ['Medium risk', 'मध्यम जोखिम'], high: ['High risk', 'ऊँचा जोखिम'], critical: ['Critical risk', 'गंभीर जोखिम'] };

/**
 * One approval-center tab, backed by the central approval engine (approval_list / approval_get / …).
 *
 *   scope:    inbox | mine | history | all (server scopes)
 *   statuses: optional status filter chips (the "Ready to apply" tab uses approved + failed)
 *   create:   show "New request" (approval_submit)
 *
 * Every action button comes from the row's server-side `allowedActions`.
 */
export function ApprovalSection({ role, scope, lang, create = false, statuses = null, showCounts = false }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(undefined);
  const [status, setStatus] = useState(statuses?.[0] || null);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');
  const overview = useApprovalOverview(role, revision);

  useEffect(() => {
    let current = true;
    setPage(undefined);
    listApprovals(role, scope, offset, status).then(
      (data) => { if (current) setPage(data); },
      () => { if (current) setPage(null); },
    );
    return () => { current = false; };
  }, [role, scope, offset, status, revision]);

  const refresh = () => setRevision((value) => value + 1);

  async function decide(row, input) {
    const result = await reviewApproval(role, row.uuid, input);
    if (result.ok) {
      refresh();
      return result;
    }
    return {
      ok: false,
      message: result.code === 'STALE_VERSION'
        ? L('This request changed. Reopen the approval tab to review the latest version.', 'अनुरोध बदल गया है। नया संस्करण देखने के लिए मंज़ूरी टैब दोबारा खोलें।')
        : L('The decision could not be saved.', 'फ़ैसला सहेजा नहीं जा सका।'),
    };
  }

  const head = (
    <div className="ui-apr-head">
      {showCounts && overview.status === 'ready' ? <ApprovalCountsStrip counts={overview.counts} lang={lang} /> : null}
      {statuses?.length > 1 ? (
        <div className="ui-apr-filters" role="group" aria-label={L('Filter by status', 'स्थिति से छाँटें')}>
          {statuses.map((s) => (
            <Button key={s} size="sm" variant={status === s ? 'primary' : 'secondary'} aria-pressed={status === s}
              onClick={() => { setOffset(0); setStatus(s); }}>{pick(STATUS_LABEL[s] || s, lang)}</Button>
          ))}
        </div>
      ) : null}
      {create ? (
        <Button iconLeft="plus" onClick={() => { setNotice(''); setCreating(true); }} disabled={overview.status !== 'ready'}>
          {L('New request', 'नया अनुरोध')}
        </Button>
      ) : null}
      {notice ? <p className="ui-inline-note" role="status">{notice}</p> : null}
    </div>
  );

  let body;
  if (page === undefined) body = <p role="status">{L('Loading approvals…', 'मंज़ूरियाँ लोड हो रही हैं…')}</p>;
  else if (!page) body = <p role="alert">{L('Approvals are unavailable.', 'मंज़ूरियाँ उपलब्ध नहीं हैं।')}</p>;
  else {
    body = <div className="ui-apr-list">
      {page.items.length === 0 && <p>{L('No requests in this view.', 'इस सूची में कोई अनुरोध नहीं है।')}</p>}
      {page.items.map((row) => (scope === 'inbox' && canReview(row)
        ? <div key={row.uuid} className="ui-apr-item">
          <ApprovalCard
            request={{
              ...row,
              type: row.category.replaceAll('_', ' '),
              statusLabel: pick(STATUS_LABEL[row.status] || row.status, lang),
              riskLabel: pick(RISK_LABEL[row.risk] || row.risk, lang),
              requester: { name: row.requesterName || pick(ROLE_NAME[row.requesterRole] || row.requesterRole, lang) },
              changes: (row.changes || []).map((change, index) => ({
                ...change,
                field: change.field || String(index),
                label: change.label || change.field || L('Change', 'बदलाव'),
              })),
            }}
            showProposedSla={false}
            canDecide
            summary={<ReviewSummary row={row} lang={lang} />}
            extraActions={<>
              <Button variant="ghost" onClick={() => setOpenId(row.uuid)}>{L('Details and history', 'विवरण और इतिहास')}</Button>
              <RequestActions role={role} request={row} lang={lang} onChanged={refresh} inline />
            </>}
            onDecide={(input) => decide(row, input)}
            labels={{
              approve: L('Approve', 'मंज़ूर करें'),
              revise: L('Request revision', 'संशोधन माँगें'),
              reject: L('Reject', 'अस्वीकार करें'),
              cancel: L('Cancel', 'रद्द करें'),
              note: L('Note', 'टिप्पणी'),
              requester: L('Requested by', 'अनुरोधकर्ता'),
              risk: L('Risk', 'जोखिम'),
              changes: L('Changes', 'बदलाव'),
              noChanges: L('No field changes', 'कोई फ़ील्ड बदलाव नहीं'),
            }}
          />
        </div>
        : <RequestRow key={row.uuid} row={row} role={role} lang={lang} onOpen={() => setOpenId(row.uuid)} onChanged={refresh} />))}
      {page.total > pageSize || offset > 0 ? <div className="ui-actions-row">
        <button type="button" disabled={offset === 0} onClick={() => setOffset(offset - pageSize)}>{L('Previous', 'पिछला')}</button>
        <button type="button" disabled={offset + pageSize >= page.total} onClick={() => setOffset(offset + pageSize)}>{L('Next', 'अगला')}</button>
      </div> : null}
    </div>;
  }

  return <div>
    {head}
    {body}
    {creating ? (
      <NewRequestDialog
        open
        role={role}
        lang={lang}
        policies={overview.policies || []}
        onClose={() => setCreating(false)}
        onCreated={(request) => {
          setNotice(`${L('Request submitted', 'अनुरोध भेजा गया')}: ${request?.id || ''} · ${pick(STATUS_LABEL[request?.status] || request?.status, lang)}`);
          setOffset(0);
          refresh();
        }}
      />
    ) : null}
    {openId ? <ApprovalDetailDialog role={role} id={openId} lang={lang} onClose={() => setOpenId(null)} onChanged={refresh} /> : null}
  </div>;
}

function ReviewSummary({ row, lang }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  return (
    <div className="ui-apr-summary">
      <dl className="ui-meta">
        {Number.isSafeInteger(row.amountPaise) ? <div><dt>{L('Amount', 'राशि')}</dt><dd><strong>{formatPaise(row.amountPaise)}</strong> <span className="ui-muted">{L('(approval does not pay)', '(मंज़ूरी भुगतान नहीं करती)')}</span></dd></div> : null}
        <div><dt>{L('Stage', 'चरण')}</dt><dd>{pick(STATUS_LABEL[row.status] || row.status, lang)}{row.requiresFounder ? L(' · Founder approval required', ' · संस्थापक मंज़ूरी ज़रूरी') : ''}</dd></div>
      </dl>
      <p className="ui-apr-reason">{row.reason}</p>
    </div>
  );
}

function RequestRow({ row, role, lang, onOpen, onChanged }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  return (
    <article className="ui-apr-row" aria-labelledby={`apr-row-${row.uuid}`}>
      <div className="ui-apr-row-main">
        <h3 id={`apr-row-${row.uuid}`}>{row.title}</h3>
        <p className="ui-muted">
          {row.id} · {row.category.replaceAll('_', ' ')}
          {row.requesterIsMe ? '' : ` · ${row.requesterName || pick(ROLE_NAME[row.requesterRole] || row.requesterRole, lang)}`}
          {Number.isSafeInteger(row.amountPaise) ? ` · ${formatPaise(row.amountPaise)}` : ''}
        </p>
        <div className="ui-apr-row-badges">
          <StatusBadge status={row.status} label={pick(STATUS_LABEL[row.status] || row.status, lang)} />
          <RiskBadge risk={row.risk} label={pick(RISK_LABEL[row.risk] || row.risk, lang)} />
        </div>
      </div>
      <div className="ui-apr-row-side">
        <Button size="sm" variant="secondary" onClick={onOpen}>{L('Details and history', 'विवरण और इतिहास')}</Button>
        {requestActions(row).length ? <RequestActions role={role} request={row} lang={lang} onChanged={onChanged} /> : null}
      </div>
    </article>
  );
}
