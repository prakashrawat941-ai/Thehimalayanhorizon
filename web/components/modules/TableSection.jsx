'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, ConfirmDialog, DataTable, Dialog, DiffView, EmptyState, ErrorState, FilterBar, NotConnectedState, Pagination,
  StatusBadge, UiIcon, useToast,
} from '@/components/ui/workspace';
import { newIdempotencyKey, toCsv, validateForm } from '@/lib/modules/core';
import { ENTITIES, optionsOf } from '@/lib/modules/entities';
import { API_ERRORS, COMMON, STATUS, tr } from '@/lib/modules/labels';
import { DRAFT_PREFIX } from '@/lib/privacy/clear-private-caches';
import { cellText, detailText, fieldLabel } from './format';
import { FormFields, serialisable } from './FormFields';

const PAGE_SIZE = 10;

/** Downloads text as a file in the browser (CSV of the rows currently loaded). */
export function downloadText(name, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    update();
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}

function readDraft(entity) {
  try { const raw = localStorage.getItem(DRAFT_PREFIX + entity); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeDraft(entity, values) {
  try { localStorage.setItem(DRAFT_PREFIX + entity, JSON.stringify({ values, savedAt: new Date().toISOString() })); return true; } catch { return false; }
}
function dropDraft(entity) { try { localStorage.removeItem(DRAFT_PREFIX + entity); } catch { /* ignore */ } }

/**
 * One list section: filters, sortable table (cards on phones), pagination, detail dialog with server-provided
 * actions, create dialog and CSV export. All reads and writes go through `adapter`.
 */
export function TableSection({ section, adapter, lang = 'en', actorName, role }) {
  const t = tr(lang);
  const toast = useToast();
  const entity = ENTITIES[section.entity];
  const online = useOnline();
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ status: 'loading', items: [], total: 0, error: null });
  const [openId, setOpenId] = useState(null);
  const [pending, setPending] = useState(null); // action key
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    const { q, ...rest } = filters;
    const res = await adapter.list(section.entity, { scope: section.scope, actorName, role, filters: rest, q, page, pageSize: PAGE_SIZE, searchKeys: entity.searchKeys });
    if (res.success) setState({ status: 'ready', items: res.data.items, total: res.data.total, error: null });
    else setState({ status: 'error', items: [], total: 0, error: res.error?.code || 'INTERNAL_ERROR' });
  }, [adapter, section.entity, section.scope, actorName, role, filters, page, entity.searchKeys]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const open = state.items.find((r) => r.id === openId) || null;
  const filterDefs = (entity.filters || []).map((key) => {
    const c = entity.columns.find((x) => x.key === key);
    const toOpt = (o) => ({ value: o.value, label: t(o.label) });
    let options;
    if (c?.kind === 'option') options = optionsOf(c.options).map(toOpt);
    else if (key === 'read') options = optionsOf('readState').map(toOpt);
    else if (entity.statusOptions) options = optionsOf(entity.statusOptions).map(toOpt);
    else options = statusOptionsFor(entity).map((v) => ({ value: v, label: t(STATUS[v] || [v]) }));
    return { key, label: c ? t(c.label) : t(COMMON.status), options, allLabel: t(COMMON.all) };
  });

  const columns = entity.columns.map((c) => ({
    key: c.key, header: t(c.label), primary: !!c.primary, sortable: true,
    align: ['money', 'number', 'percent'].includes(c.kind) ? 'end' : undefined,
    render: (row) => (c.kind === 'status'
      ? <StatusBadge status={row[c.key]} label={cellText(c, row, lang)} />
      : c.kind === 'id' ? <code className="ui-code">{cellText(c, row, lang)}</code> : cellText(c, row, lang)),
  })).concat([{
    key: '_open', header: <span className="ui-sr-only">{t(COMMON.actions)}</span>, sortable: false,
    render: (row) => <Button size="sm" variant="secondary" onClick={() => setOpenId(row.id)} aria-label={`${t(COMMON.open)} ${row.id || ''}`}>{t(COMMON.open)}</Button>,
  }]);

  function exportCsv() {
    const cols = entity.columns.map((c) => ({ key: c.key, label: t(c.label) }));
    const rows = state.items.map((r) => Object.fromEntries(entity.columns.map((c) => [c.key, cellText(c, r, lang)])));
    downloadText(`thh-${section.entity}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(cols, rows));
  }

  async function runAction(row, key, note) {
    const res = await adapter.act(section.entity, row.id, key, { note }, { expectedVersion: row.version, idempotencyKey: newIdempotencyKey() });
    if (!res.success) {
      if (res.error?.code === 'STALE_VERSION') setReloadKey((k) => k + 1);
      return { ok: false, message: t(API_ERRORS[res.error?.code] || API_ERRORS.INTERNAL_ERROR) };
    }
    setState((s) => ({ ...s, items: s.items.map((r) => (r.id === row.id ? res.data : r)) }));
    toast.success(entity.actions[key]?.viaApproval ? t(['Sent for approval. Nothing changes until it is approved.', 'मंज़ूरी के लिए भेजा गया। मंज़ूरी तक कुछ नहीं बदलेगा।']) : t(COMMON.done));
    return { ok: true };
  }

  const allowed = open ? (open.allowedActions || []).filter((k) => entity.actions?.[k]) : [];
  const canCreate = section.create && entity.form;

  return (
    <div className="ui-mod-section">
      <div className="ui-mod-toolbar">
        {filterDefs.length || entity.searchKeys ? (
          <FilterBar value={filters} onChange={(v) => { setFilters(v); setPage(1); }} filters={filterDefs}
            search={{ label: t(COMMON.search), placeholder: t(COMMON.search) }} labels={{ clear: t(COMMON.clear), search: t(COMMON.search), all: t(COMMON.all) }} />
        ) : null}
        <div className="ui-mod-toolbar-actions">
          <Button variant="secondary" size="sm" iconLeft="doc" onClick={exportCsv} disabled={state.status !== 'ready' || !state.items.length} title={t(COMMON.csvNote)}>{t(COMMON.exportCsv)}</Button>
          {canCreate ? <Button size="sm" iconLeft="plus" onClick={() => setCreating(true)}>{t(entity.createLabel || COMMON.new)}</Button> : null}
        </div>
      </div>

      {state.status === 'error' && state.error === 'INTEGRATION_UNAVAILABLE' ? (
        <NotConnectedState title={t(COMMON.notConnected)} description={t(COMMON.notConnectedText)} />
      ) : state.status === 'error' ? (
        <ErrorState code={state.error} lang={lang} retryLabel={t(['Try again', 'फिर कोशिश करें'])} title={t(API_ERRORS[state.error] || API_ERRORS.INTERNAL_ERROR)} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : (
        <>
          <DataTable caption={t(section.title)} hideCaption columns={columns} rows={state.items} status={state.status === 'loading' ? 'loading' : 'ready'}
            empty={<EmptyState title={Object.keys(filters).some((k) => filters[k]) ? t(COMMON.emptyFiltered) : t(COMMON.empty)} />} />
          {state.total > PAGE_SIZE ? (
            <Pagination page={page} pageSize={PAGE_SIZE} total={state.total} itemCount={state.items.length} onPageChange={setPage}
              labels={{ prev: t(COMMON.prev), next: t(COMMON.next), of: t(COMMON.of) }} />
          ) : null}
        </>
      )}
      {entity.footnote ? <p className="ui-inline-note" role="note"><UiIcon name="info" size={14} /> {t(entity.footnote)}</p> : null}

      <Dialog open={!!open} onClose={() => setOpenId(null)} title={open ? `${open.id && entity.idKind ? `${open.id} · ` : ''}${cellText(entity.columns.find((c) => c.primary) || entity.columns[0], open, lang)}` : ''} closeLabel={t(COMMON.close)} size="lg">
        {open ? (
          <div className="ui-record">
            <div className="ui-record-status"><StatusBadge status={open.status} label={cellText({ key: 'status', kind: 'status' }, open, lang)} />
              {open.pendingApproval ? <span className="ui-muted"> · {t(['Waiting for approval', 'मंज़ूरी का इंतज़ार'])}</span> : null}</div>
            <dl className="ui-meta">
              {(entity.detail || entity.columns.map((c) => c.key)).map((k) => (
                <div key={k}><dt>{fieldLabel(entity, k, lang)}</dt><dd>{detailText(entity, k, open, lang)}</dd></div>
              ))}
            </dl>
            {entity.diff && open.changes?.length ? (
              <>
                <h3 className="ui-subhead">{t(['Version comparison', 'संस्करण तुलना'])}</h3>
                <DiffView changes={open.changes} labels={{ field: t(['Field', 'फ़ील्ड']), before: t(['Before', 'पहले']), after: t(['After', 'बाद में']) }} />
              </>
            ) : null}
            {open.history?.length ? (
              <>
                <h3 className="ui-subhead">{t(COMMON.history)}</h3>
                <ol className="ui-history">
                  {open.history.map((h, i) => (
                    <li key={i}><strong>{h.action === 'create' ? t(['Created', 'बनाया']) : t(entity.actions?.[h.action]?.label || [h.action])}</strong>
                      {h.at ? <span className="ui-muted"> · {cellText({ key: 'at', kind: 'datetime' }, h, lang)}</span> : null}
                      {h.note ? <p>{h.note}</p> : null}</li>
                  ))}
                </ol>
              </>
            ) : null}
            <h3 className="ui-subhead">{t(COMMON.actions)}</h3>
            {allowed.length ? (
              <div className="ui-actions-row">
                {allowed.map((k) => {
                  const a = entity.actions[k];
                  return <Button key={k} variant={a.tone === 'danger' ? 'danger' : a.tone === 'primary' ? 'primary' : 'secondary'} onClick={() => setPending(k)}>{t(a.label)}</Button>;
                })}
              </div>
            ) : <p className="ui-muted">{t(COMMON.noActions)}</p>}
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={!!(open && pending)}
        onClose={() => setPending(null)}
        title={open && pending ? `${t(entity.actions[pending].label)} · ${open.id}` : ''}
        description={pending && entity.actions[pending].viaApproval ? t(COMMON.viaApproval) : undefined}
        confirmLabel={pending ? t(entity.actions[pending].label) : ''}
        cancelLabel={t(COMMON.cancel)}
        tone={pending && entity.actions[pending].tone === 'danger' ? 'danger' : 'primary'}
        requireReason={!!(pending && entity.actions[pending].needsNote)}
        reasonLabel={t(COMMON.note)}
        genericError={t(API_ERRORS.INTERNAL_ERROR)}
        onConfirm={({ reason }) => runAction(open, pending, reason)}
      />

      {canCreate ? (
        <CreateDialog open={creating} onClose={() => setCreating(false)} entity={entity} lang={lang} online={online}
          onCreate={async (values) => {
            const res = await adapter.create(section.entity, serialisable(values), { idempotencyKey: newIdempotencyKey() });
            if (!res.success) return { ok: false, code: res.error?.code, fields: res.error?.fields };
            setReloadKey((k) => k + 1);
            toast.success(entity.createViaApproval ? t(['Request created and sent for approval.', 'अनुरोध बना और मंज़ूरी के लिए भेजा गया।']) : t(['Created.', 'बनाया गया।']) + (res.data?.id ? ` ${res.data.id}` : ''));
            return { ok: true };
          }} />
      ) : null}
    </div>
  );
}

function statusOptionsFor(entity) {
  const fromActions = Object.values(entity.actions || {}).flatMap((a) => [...(a.from || []), a.to]).filter(Boolean);
  return [...new Set([entity.initialStatus, ...fromActions, ...(entity.extraStatuses || [])].filter(Boolean))];
}

function CreateDialog({ open, onClose, entity, lang, online, onCreate }) {
  const t = tr(lang);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const offline = entity.offlineDraft;

  useEffect(() => {
    if (!open) return;
    setErrors({}); setMessage(''); setBusy(false);
    const d = offline ? readDraft(entity.name) : null;
    setValues(d?.values || {});
    setDraftNote(d ? t(COMMON.draftRestored) : '');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const formId = useMemo(() => `create-${entity.name}`, [entity.name]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const v = validateForm(entity.form, values);
    setErrors(v.errors);
    if (!v.ok) { setMessage(t(API_ERRORS.VALIDATION_FAILED)); return; }
    if (offline && !online) { writeDraft(entity.name, serialisable(values)); setMessage(t(COMMON.offline)); return; }
    setBusy(true); setMessage('');
    const res = await onCreate(values);
    setBusy(false);
    if (res.ok) { if (offline) dropDraft(entity.name); onClose(); return; }
    if (res.fields) setErrors(res.fields);
    if (offline && res.code === 'INTEGRATION_UNAVAILABLE') writeDraft(entity.name, serialisable(values));
    setMessage(t(API_ERRORS[res.code] || API_ERRORS.INTERNAL_ERROR) + (offline && res.code === 'INTEGRATION_UNAVAILABLE' ? ` ${t(COMMON.draftSaved)}` : ''));
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} dismissible={!busy} size="lg" title={t(entity.createLabel || COMMON.new)}
      description={entity.createViaApproval ? t(COMMON.viaApproval) : undefined} closeLabel={t(COMMON.close)}
      footer={(
        <>
          {offline ? <Button variant="ghost" onClick={() => { writeDraft(entity.name, serialisable(values)); setDraftNote(t(COMMON.draftSaved)); }} disabled={busy}>{t(COMMON.saveDraft)}</Button> : null}
          {offline && draftNote ? <Button variant="ghost" onClick={() => { dropDraft(entity.name); setValues({}); setDraftNote(''); }} disabled={busy}>{t(COMMON.discardDraft)}</Button> : null}
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t(COMMON.cancel)}</Button>
          <Button type="submit" form={formId} loading={busy}>{t(COMMON.submit)}</Button>
        </>
      )}>
      <form id={formId} onSubmit={submit} noValidate>
        {offline && !online ? <p className="ui-inline-note ui-warn" role="status"><UiIcon name="wifi" size={14} /> {t(COMMON.offline)}</p> : null}
        {draftNote ? <p className="ui-inline-note" role="status"><UiIcon name="info" size={14} /> {draftNote}</p> : null}
        <FormFields fields={entity.form.fields} values={values} errors={errors} onChange={setValues} lang={lang} disabled={busy} />
        {message ? <p className="ui-error ui-form-error" role="alert">{message}</p> : null}
      </form>
    </Dialog>
  );
}
