'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, ConfirmDialog, Dialog, Field, Input, Select, StatusBadge, Textarea, UiIcon } from '@/components/ui/workspace';
import { ApprovalTimeline, DiffView, RiskBadge } from '@/components/ui/Approvals';
import {
  actOnApproval, applyApproval, approvalOverview, getApproval, resubmitApproval, submitApproval,
} from '@/app/(management)/management/approval-actions';
import {
  engineMessage, formatPaise, needsFounder, pick, requestActions, RISKS, ROLE_NAME, rupeesToPaise, STATUS_LABEL,
  toTimeline,
} from '@/lib/management/approval-requests.mjs';

const RISK_LABEL = { low: ['Low', 'कम'], medium: ['Medium', 'मध्यम'], high: ['High', 'ऊँचा'], critical: ['Critical', 'गंभीर'] };
const OFFICE_FIELDS = [
  ['name', ['Office name', 'कार्यालय का नाम'], true], ['village', ['Village', 'गाँव'], true], ['post', ['Post office', 'डाकघर'], false],
  ['block', ['Block', 'ब्लॉक'], false], ['district', ['District', 'ज़िला'], true], ['state', ['State', 'राज्य'], true],
  ['country', ['Country', 'देश'], false],
];
const FIELD_ERROR = {
  required: ['Required', 'ज़रूरी'], too_long: ['Too long', 'बहुत लंबा'], invalid: ['Enter a valid amount in rupees', 'रुपये में सही राशि लिखें'],
  length_5_160: ['5 to 160 characters', '5 से 160 अक्षर'], length_10_3000: ['10 to 3000 characters', '10 से 3000 अक्षर'],
  length_3_1000: ['3 to 1000 characters', '3 से 1000 अक्षर'],
};

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function newKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `submit:${crypto.randomUUID()}`;
  return `submit:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function resultMessage(res, lang) {
  if (res?.code === 'APPLY_FAILED') {
    const detail = res.request?.executionError ? ` (${res.request.executionError})` : '';
    return (lang === 'hi' ? 'लागू नहीं हो सका। विफलता दर्ज है और फिर कोशिश की जा सकती है।' : 'Could not apply. The failure is recorded and can be retried.') + detail;
  }
  return engineMessage(res?.code, lang);
}

/** Live counts from approval_counts. Each figure is the server's count for the signed-in person. */
export function ApprovalCountsStrip({ counts, lang }) {
  if (!counts) return null;
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const items = [
    ['waitingForMe', L('Waiting for my decision', 'मेरे फ़ैसले के लिए'), 'approvals'],
    ['toApply', L('Approved, ready to apply', 'मंज़ूर, लागू करने को तैयार'), 'check'],
    ['mineOpen', L('My open requests', 'मेरे खुले अनुरोध'), 'clock'],
    ['mineNeedsRevision', L('My requests needing revision', 'संशोधन वाले मेरे अनुरोध'), 'alert'],
  ];
  return (
    <ul className="ui-apr-counts" aria-label={L('Approval summary', 'मंज़ूरी सारांश')}>
      {items.map(([key, label, icon]) => (
        <li key={key} className={counts[key] > 0 ? 'has-items' : undefined}>
          <UiIcon name={icon} size={16} />
          <strong>{Number.isSafeInteger(counts[key]) ? counts[key] : '—'}</strong>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Loads counts + policies once per module view. `revision` bumps it after any change. */
export function useApprovalOverview(role, revision) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let live = true;
    approvalOverview(role).then(
      (res) => { if (live) setState(res?.ok ? { status: 'ready', ...res } : { status: 'error', code: res?.code }); },
      () => { if (live) setState({ status: 'error', code: 'SERVER_ERROR' }); },
    );
    return () => { live = false; };
  }, [role, revision]);
  return state;
}

function OfficeFields({ value, onChange, errors, lang }) {
  return (
    <fieldset className="ui-apr-fieldset">
      <legend>{lang === 'hi' ? 'कार्यालय विवरण' : 'Office details'}</legend>
      <div className="ui-form-grid">
        {OFFICE_FIELDS.map(([field, label, required]) => (
          <Field key={field} label={pick(label, lang)} required={required} error={errors?.[`office.${field}`] ? pick(FIELD_ERROR[errors[`office.${field}`]], lang) : ''}>
            <Input value={value?.[field] || ''} maxLength={field === 'name' ? 120 : 80} onChange={(e) => onChange({ ...value, [field]: e.target.value })} />
          </Field>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * New approval request. Routing is decided by the engine; the form only shows where it will go.
 * Success is shown only after the server returns the new request (with its THH-APR id).
 */
export function NewRequestDialog({ open, onClose, role, policies = [], lang, onCreated }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const blank = { category: '', title: '', reason: '', risk: 'low', amount: '', office: {} };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');

  useEffect(() => {
    if (open) { setForm(blank); setErrors({}); setMessage(''); setBusy(false); setKey(newKey()); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const policy = policies.find((p) => p.category === form.category);
  const paise = rupeesToPaise(form.amount);
  const founder = needsFounder(policy, Number.isNaN(paise) ? null : paise);
  const route = role === 'ceo'
    ? L('Goes to the Founder for approval.', 'मंज़ूरी के लिए संस्थापक को जाएगा।')
    : role === 'founder'
      ? L('Goes to the CEO for countersignature.', 'प्रतिहस्ताक्षर के लिए CEO को जाएगा।')
      : founder
        ? L('Goes to the CEO, then the Founder for final approval.', 'पहले CEO, फिर अंतिम मंज़ूरी के लिए संस्थापक को जाएगा।')
        : L('Goes to the CEO for approval.', 'मंज़ूरी के लिए CEO को जाएगा।');
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      if (patch.office) for (const k of Object.keys(next)) if (k.startsWith('office.') && str(patch.office[k.slice(7)])) delete next[k];
      return next;
    });
  };
  const err = (k) => (errors[k] ? pick(FIELD_ERROR[errors[k]] || FIELD_ERROR.required, lang) : '');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await submitApproval(role, form, key);
      if (res?.ok) { onCreated?.(res.request); onClose(); return; }
      setErrors(res?.errors || (res?.field ? { [res.field.split(':')[0].trim()]: 'required' } : {}));
      setMessage(engineMessage(res?.code, lang));
    } catch {
      setMessage(engineMessage('SERVER_ERROR', lang));
    }
    setBusy(false);
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      dismissible={!busy}
      size="lg"
      title={L('New approval request', 'नया मंज़ूरी अनुरोध')}
      description={L('Nothing changes until the request is approved and then applied by an authorised person.', 'अनुरोध मंज़ूर होकर किसी अधिकृत व्यक्ति द्वारा लागू होने तक कुछ नहीं बदलता।')}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>{L('Cancel', 'रद्द करें')}</Button>
        <Button type="submit" form="apr-new-form" loading={busy} iconLeft="check">{L('Submit request', 'अनुरोध भेजें')}</Button>
      </>}
    >
      <form id="apr-new-form" onSubmit={submit} noValidate>
        <Field label={L('Category', 'श्रेणी')} required error={err('category')}>
          <Select value={form.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">{L('Choose a category', 'श्रेणी चुनें')}</option>
            {policies.map((p) => <option key={p.category} value={p.category}>{lang === 'hi' && p.labelHi ? p.labelHi : p.label}{p.requiresFounder ? L(' · Founder approval', ' · संस्थापक मंज़ूरी') : ''}</option>)}
          </Select>
        </Field>
        <Field label={L('Title', 'शीर्षक')} required hint={L('5 to 160 characters', '5 से 160 अक्षर')} error={err('title')}>
          <Input value={form.title} maxLength={160} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label={L('Reason and details', 'कारण और विवरण')} required hint={L('What should change and why (10 to 3000 characters)', 'क्या बदलना है और क्यों (10 से 3000 अक्षर)')} error={err('reason')}>
          <Textarea rows={4} value={form.reason} maxLength={3000} onChange={(e) => set({ reason: e.target.value })} />
        </Field>
        <div className="ui-form-grid">
          <Field label={L('Risk', 'जोखिम')} required error={err('risk')}>
            <Select value={form.risk} onChange={(e) => set({ risk: e.target.value })}>
              {RISKS.map((r) => <option key={r} value={r}>{pick(RISK_LABEL[r], lang)}</option>)}
            </Select>
          </Field>
          <Field label={L('Amount (₹, optional)', 'राशि (₹, वैकल्पिक)')} hint={L('Any amount needs Founder approval. Approval never makes a payment.', 'किसी भी राशि पर संस्थापक मंज़ूरी चाहिए। मंज़ूरी से भुगतान नहीं होता।')} error={err('amount')}>
            <Input inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0.00" />
          </Field>
        </div>
        {form.category === 'office' ? <OfficeFields value={form.office} onChange={(office) => set({ office })} errors={errors} lang={lang} /> : null}
        <p className="ui-inline-note" role="note"><UiIcon name="info" size={14} /> {route}</p>
        {message ? <p className="ui-error ui-form-error" role="alert">{message}</p> : null}
      </form>
    </Dialog>
  );
}

/** Resubmission after "revision required": edit title / reason / amount / office details, note required. */
function ResubmitDialog({ open, onClose, role, request, lang, onDone }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const initial = useMemo(() => ({
    title: request?.title || '', reason: request?.reason || '', note: '',
    amount: Number.isSafeInteger(request?.amountPaise) ? (request.amountPaise / 100).toFixed(2) : '',
    office: request?.category === 'office' ? { ...(request.payload || {}) } : undefined,
  }), [request]);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setForm(initial); setErrors({}); setMessage(''); setBusy(false); } }, [open, initial]);
  if (!request) return null;
  const edit = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      if (patch.office) for (const k of Object.keys(next)) if (k.startsWith('office.') && str(patch.office[k.slice(7)])) delete next[k];
      return next;
    });
  };
  const err = (k) => (errors[k] ? pick(FIELD_ERROR[errors[k]] || FIELD_ERROR.required, lang) : '');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await resubmitApproval(role, request.uuid, { ...form, expectedVersion: request.version },
        { title: request.title, reason: request.reason, amountPaise: request.amountPaise, category: request.category, payload: request.payload });
      if (res?.ok) { onDone(res.request); onClose(); return; }
      setErrors(res?.errors || {});
      setMessage(engineMessage(res?.code, lang));
    } catch {
      setMessage(engineMessage('SERVER_ERROR', lang));
    }
    setBusy(false);
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      dismissible={!busy}
      size="lg"
      title={`${L('Resubmit', 'दोबारा भेजें')}: ${request.id}`}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>{L('Cancel', 'रद्द करें')}</Button>
        <Button type="submit" form="apr-resubmit-form" loading={busy}>{L('Resubmit', 'दोबारा भेजें')}</Button>
      </>}
    >
      <form id="apr-resubmit-form" onSubmit={submit} noValidate>
        <Field label={L('Title', 'शीर्षक')} error={err('title')}><Input value={form.title} maxLength={160} onChange={(e) => edit({ title: e.target.value })} /></Field>
        <Field label={L('Reason and details', 'कारण और विवरण')} error={err('reason')}><Textarea rows={4} value={form.reason} maxLength={3000} onChange={(e) => edit({ reason: e.target.value })} /></Field>
        <Field label={L('Amount (₹, optional)', 'राशि (₹, वैकल्पिक)')} error={err('amount')}><Input inputMode="decimal" value={form.amount} onChange={(e) => edit({ amount: e.target.value })} /></Field>
        {request.category === 'office' ? <OfficeFields value={form.office} onChange={(office) => edit({ office })} errors={errors} lang={lang} /> : null}
        <Field label={L('What did you change?', 'आपने क्या बदला?')} required error={err('note')}><Textarea rows={2} value={form.note} maxLength={1000} onChange={(e) => edit({ note: e.target.value })} /></Field>
        {message ? <p className="ui-error ui-form-error" role="alert">{message}</p> : null}
      </form>
    </Dialog>
  );
}

/** Buttons for withdraw / escalate / resubmit / apply. Only what the server lists in allowedActions is shown. */
export function RequestActions({ role, request, lang, onChanged, inline = false }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const [pending, setPending] = useState(null);
  const actions = requestActions(request);
  if (!actions.length) return null;
  const copy = {
    withdraw: { label: L('Withdraw', 'वापस लें'), tone: 'danger', reason: true, desc: L('The request is closed and nothing is changed.', 'अनुरोध बंद होगा और कुछ नहीं बदलेगा।') },
    escalate: { label: L('Send to Founder', 'संस्थापक को भेजें'), tone: 'primary', reason: true, desc: L('The Founder makes the final decision.', 'अंतिम फ़ैसला संस्थापक करेंगे।') },
    apply: {
      label: request.status === 'failed' ? L('Retry apply', 'फिर से लागू करें') : L('Apply now', 'अभी लागू करें'), tone: 'primary', reason: false,
      desc: request.category === 'office'
        ? L('Creates the approved village office record.', 'मंज़ूर ग्राम कार्यालय का रिकॉर्ड बनाएगा।')
        : L('Records the approved decision as executed. No payment or external change is made by this step.', 'मंज़ूर फ़ैसले को लागू दर्ज करेगा। इस चरण से कोई भुगतान या बाहरी बदलाव नहीं होता।'),
    },
  };
  async function run({ reason }) {
    const res = pending === 'apply'
      ? await applyApproval(role, request.uuid, request.version)
      : await actOnApproval(role, request.uuid, { action: pending, note: reason, expectedVersion: request.version });
    if (res?.ok) { onChanged?.(res.request); return res; }
    if (res?.code === 'APPLY_FAILED') onChanged?.(res.request);
    return { ok: false, message: resultMessage(res, lang) };
  }
  const Wrap = inline ? 'span' : 'div';
  return (
    <Wrap className={inline ? 'ui-apr-inline-actions' : 'ui-actions-row'}>
      {actions.map((a) => (
        <Button key={a} size={inline ? 'md' : 'sm'} variant={a === 'withdraw' ? 'ghost' : a === 'apply' ? 'primary' : 'secondary'} onClick={() => setPending(a)}>
          {a === 'resubmit' ? L('Edit and resubmit', 'बदलकर दोबारा भेजें') : copy[a].label}
        </Button>
      ))}
      {pending && pending !== 'resubmit' ? (
        <ConfirmDialog
          open
          onClose={() => setPending(null)}
          title={`${copy[pending].label}: ${request.id}`}
          description={copy[pending].desc}
          confirmLabel={copy[pending].label}
          cancelLabel={L('Cancel', 'रद्द करें')}
          tone={copy[pending].tone}
          requireReason={copy[pending].reason}
          reasonLabel={L('Note', 'टिप्पणी')}
          onConfirm={run}
        />
      ) : null}
      {pending === 'resubmit' ? <ResubmitDialogLoader role={role} id={request.uuid} lang={lang} onClose={() => setPending(null)} onDone={onChanged} /> : null}
    </Wrap>
  );
}

/** Resubmit needs the full payload, which the list rows do not carry. */
function ResubmitDialogLoader({ role, id, lang, onClose, onDone }) {
  const [request, setRequest] = useState(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    getApproval(role, id).then((res) => (res?.ok ? setRequest(res.request) : setMessage(engineMessage(res?.code, lang))),
      () => setMessage(engineMessage('SERVER_ERROR', lang)));
  }, [role, id, lang]);
  if (message) return <p className="ui-error" role="alert">{message}</p>;
  if (!request) return <p role="status">{lang === 'hi' ? 'लोड हो रहा है…' : 'Loading…'}</p>;
  return <ResubmitDialog open role={role} request={request} lang={lang} onClose={onClose} onDone={onDone} />;
}

/** Full request: details, office payload, changes, execution result and the append-only history. */
export function ApprovalDetailDialog({ role, id, lang, onClose, onChanged }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const [state, setState] = useState({ status: 'loading' });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    getApproval(role, id).then(
      (res) => { if (live) setState(res?.ok ? { status: 'ready', request: res.request } : { status: 'error', code: res?.code }); },
      () => { if (live) setState({ status: 'error', code: 'SERVER_ERROR' }); },
    );
    return () => { live = false; };
  }, [role, id, reload]);

  const r = state.request;
  return (
    <Dialog open onClose={onClose} size="lg" title={r ? `${r.id} · ${r.title}` : L('Request details', 'अनुरोध विवरण')} closeLabel={L('Close', 'बंद करें')}>
      {state.status === 'loading' ? <p role="status">{L('Loading request…', 'अनुरोध लोड हो रहा है…')}</p> : null}
      {state.status === 'error' ? <p role="alert" className="ui-error">{engineMessage(state.code, lang)}</p> : null}
      {r ? <div className="ui-apr-detail">
        <dl className="ui-meta">
          <div><dt>{L('Status', 'स्थिति')}</dt><dd><StatusBadge status={r.status} label={pick(STATUS_LABEL[r.status] || r.status, lang)} /></dd></div>
          <div><dt>{L('Category', 'श्रेणी')}</dt><dd>{r.category.replaceAll('_', ' ')}{r.requiresFounder ? <> <Badge tone="info">{L('Founder approval', 'संस्थापक मंज़ूरी')}</Badge></> : null}</dd></div>
          <div><dt>{L('Requested by', 'अनुरोधकर्ता')}</dt><dd>{[r.requesterName, pick(ROLE_NAME[r.requesterRole] || r.requesterRole, lang)].filter(Boolean).join(' · ')}{r.requesterIsMe ? L(' (you)', ' (आप)') : ''}</dd></div>
          <div><dt>{L('Risk', 'जोखिम')}</dt><dd><RiskBadge risk={r.risk} label={pick(RISK_LABEL[r.risk], lang)} /></dd></div>
          {Number.isSafeInteger(r.amountPaise) ? <div><dt>{L('Amount', 'राशि')}</dt><dd>{formatPaise(r.amountPaise)} <span className="ui-muted">{L('(approval does not pay)', '(मंज़ूरी भुगतान नहीं करती)')}</span></dd></div> : null}
          <div><dt>{L('Version', 'संस्करण')}</dt><dd>{r.version}</dd></div>
        </dl>
        <h3 className="ui-subhead">{L('Reason', 'कारण')}</h3>
        <p className="ui-apr-reason">{r.reason}</p>
        {r.category === 'office' && r.payload ? <>
          <h3 className="ui-subhead">{L('Office details', 'कार्यालय विवरण')}</h3>
          <dl className="ui-meta">{OFFICE_FIELDS.filter(([f]) => r.payload[f]).map(([f, label]) => <div key={f}><dt>{pick(label, lang)}</dt><dd>{r.payload[f]}</dd></div>)}</dl>
        </> : null}
        {Array.isArray(r.changes) && r.changes.length ? <>
          <h3 className="ui-subhead">{L('Changes', 'बदलाव')}</h3>
          <DiffView changes={r.changes.map((c, i) => ({ ...c, field: c.field || String(i), label: c.label || c.field || L('Change', 'बदलाव'), kind: c.kind || 'changed' }))} />
        </> : null}
        {r.executionResult ? <p className="ui-inline-note" role="note"><UiIcon name="circle-check" size={14} /> {r.executionResult.officePublicId
          ? `${L('Office created', 'कार्यालय बना')}: ${r.executionResult.officePublicId}`
          : (r.executionResult.note || L('Applied', 'लागू हुआ'))}</p> : null}
        {r.executionError ? <p className="ui-error" role="alert">{L('Last apply failed', 'पिछली बार लागू करना विफल')}: {r.executionError}</p> : null}
        <h3 className="ui-subhead">{L('History', 'इतिहास')}</h3>
        <ApprovalTimeline history={toTimeline(r.history, lang)} labels={{ none: L('No history yet', 'अभी कोई इतिहास नहीं') }} />
        <RequestActions role={role} request={r} lang={lang} onChanged={(next) => { setReload((n) => n + 1); onChanged?.(next); }} />
      </div> : null}
    </Dialog>
  );
}
