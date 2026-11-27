'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListRow, Panel, Tag } from '../parts';
import { DashEmpty, DashNotConnected } from '../DashStates';
import { NoteDialog } from './NoteDialog';
import { KIND_ICON, KIND_LABELS, KIND_TONE, STATUS_LABELS, STATUS_TONE, rupees, tr } from './ui';

/**
 * A list of management_work items (Founder approvals, CEO reviews, team tasks, sent requests).
 * items: [{ id, kind, subject, from, amount, when, status, actions: ['approved','returned'] | ['completed'] | [] }]
 * `actions` must come from the server (catalog.decisions + RLS), never from the browser.
 * decide(formData{ id, decision, note }) → { ok } is Codex's server action; null = not connected.
 */
export function WorkQueue({ lang, title, items, decide = null, connected = true, empty }) {
  const L = tr(lang);
  const router = useRouter();
  const [open, setOpen] = useState(null);
  if (!connected) return <DashNotConnected title={L('Not connected yet', 'अभी जुड़ा नहीं')} text={L('This list fills in once the management records are live.', 'मैनेजमेंट रिकॉर्ड चालू होते ही यह सूची भर जाएगी।')} />;
  if (!items.length) return <DashEmpty title={empty?.title || L('All caught up', 'सब पूरा')} text={empty?.text} />;
  const item = items.find((x) => x.id === open);
  return (
    <Panel title={title} count={items.filter((x) => x.actions?.length).length}>
      {items.map((x) => {
        const sub = [L(...(KIND_LABELS[x.kind] || [x.kind, x.kind])), x.from, x.amount != null ? rupees(x.amount) : null, x.when].filter(Boolean).join(' · ');
        return (
          <ListRow key={x.id} icon={KIND_ICON[x.kind] || 'doc'} tone={KIND_TONE[x.kind] || 'gray'} title={x.subject} sub={sub}>
            {x.actions?.length && decide
              ? <button type="button" className="btn btn-sm" onClick={() => setOpen(x.id)}>{x.actions.includes('completed') ? L('Mark done', 'पूरा करें') : L('Review', 'देखें')}</button>
              : <Tag tone={STATUS_TONE[x.status] || 'gray'}>{L(...(STATUS_LABELS[x.status] || [x.status, x.status]))}</Tag>}
          </ListRow>
        );
      })}
      {item ? (
        <NoteDialog
          title={item.subject}
          subtitle={[L(...(KIND_LABELS[item.kind] || [item.kind, item.kind])), item.from, item.amount != null ? rupees(item.amount) : null].filter(Boolean).join(' · ')}
          hidden={{ id: item.id }}
          noteLabel={L('Decision note (required)', 'फ़ैसले का नोट (ज़रूरी)')}
          required={L('Write a note of 1–500 characters.', '1–500 अक्षरों का नोट लिखें।')}
          failed={L('Could not save. Nothing was changed — try again.', 'सहेज नहीं सके। कुछ नहीं बदला — फिर कोशिश करें।')}
          cancel={L('Cancel', 'रद्द करें')}
          buttons={item.actions.includes('completed')
            ? [{ value: 'completed', label: L('Mark done', 'पूरा करें') }]
            : [{ value: 'returned', label: L('Return', 'वापस भेजें'), tone: 'ghost' }, { value: 'approved', label: L('Approve', 'मंज़ूर करें') }]}
          action={decide}
          onClose={(saved) => { setOpen(null); if (saved) router.refresh(); }}
        />
      ) : null}
    </Panel>
  );
}
