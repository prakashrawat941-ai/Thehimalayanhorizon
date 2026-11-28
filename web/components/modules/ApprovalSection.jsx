'use client';

import { useEffect, useState } from 'react';
import { ApprovalCard } from '@/components/ui/Approvals';
import { listApprovals, reviewApproval } from '@/app/(management)/management/approval-actions';

const pageSize = 20;

export function ApprovalSection({ role, scope, lang }) {
  const L = (en, hi) => lang === 'hi' ? hi : en;
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(undefined);

  useEffect(() => {
    let current = true;
    setPage(undefined);
    listApprovals(role, scope, offset).then(
      (data) => { if (current) setPage(data); },
      () => { if (current) setPage(null); },
    );
    return () => { current = false; };
  }, [role, scope, offset, revision]);

  async function decide(row, input) {
    const result = await reviewApproval(role, row.uuid, input);
    if (result.ok) {
      setRevision((value) => value + 1);
      return result;
    }
    return {
      ok: false,
      message: result.code === 'STALE_VERSION'
        ? L('This request changed. Reopen the approval tab to review the latest version.', 'अनुरोध बदल गया है। नया संस्करण देखने के लिए मंज़ूरी टैब दोबारा खोलें।')
        : L('The decision could not be saved.', 'फ़ैसला सहेजा नहीं जा सका।'),
    };
  }

  if (page === undefined) return <p role="status">{L('Loading approvals…', 'मंज़ूरियाँ लोड हो रही हैं…')}</p>;
  if (!page) return <p role="alert">{L('Approvals are unavailable.', 'मंज़ूरियाँ उपलब्ध नहीं हैं।')}</p>;

  return <div>
    {page.items.length === 0 && <p>{L('No requests in this view.', 'इस सूची में कोई अनुरोध नहीं है।')}</p>}
    {page.items.map((row) => <ApprovalCard
      key={row.uuid}
      request={{
        ...row,
        type: row.category.replaceAll('_', ' '),
        requester: { name: row.requesterName || row.requesterRole },
        changes: (row.changes || []).map((change, index) => ({
          ...change,
          field: change.field || String(index),
          label: change.label || change.field || L('Change', 'बदलाव'),
        })),
      }}
      showProposedSla={false}
      canDecide={['approve', 'reject', 'request_revision'].every((action) => row.allowedActions.includes(action))}
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
      }}
    />)}
    {page.total > pageSize || offset > 0 ? <div className="ui-actions-row">
      <button type="button" disabled={offset === 0} onClick={() => setOffset(offset - pageSize)}>{L('Previous', 'पिछला')}</button>
      <button type="button" disabled={offset + pageSize >= page.total} onClick={() => setOffset(offset + pageSize)}>{L('Next', 'अगला')}</button>
    </div> : null}
  </div>;
}
