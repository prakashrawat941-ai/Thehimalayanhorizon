'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar, Badge, Button, Card, CardHeader, DataTable, EmptyState, ErrorState, NotConnectedState, Select, Stat, StatGrid,
  StatusBadge, Switch, Textarea, UiIcon, useToast,
} from '@/components/ui/workspace';
import { newIdempotencyKey, toCsv, validateForm } from '@/lib/modules/core';
import { ENTITIES, OPTIONS, optionsOf } from '@/lib/modules/entities';
import { FORMS, MODULES, PROVIDERS, moduleHref, modulesFor, NAV_LABEL_OVERRIDE } from '@/lib/modules/modules';
import { API_ERRORS, COMMON, ROLE_LABEL, STATUS, tr } from '@/lib/modules/labels';
import { cellText } from './format';
import { FormFields, serialisable } from './FormFields';
import { downloadText } from './TableSection';

const notConnected = (t) => <NotConnectedState title={t(COMMON.notConnected)} description={t(COMMON.notConnectedText)} />;
const errText = (t, code) => t(API_ERRORS[code] || API_ERRORS.INTERNAL_ERROR);

function useList(adapter, entity, query = {}) {
  const [state, setState] = useState({ status: 'loading', items: [], error: null });
  const key = JSON.stringify(query);
  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    const res = await adapter.list(entity, { pageSize: 50, ...JSON.parse(key) });
    setState(res.success ? { status: 'ready', items: res.data.items, error: null } : { status: 'error', items: [], error: res.error?.code || 'INTERNAL_ERROR' });
  }, [adapter, entity, key]);
  useEffect(() => { load(); }, [load]);
  return [state, setState, load];
}

function ListState({ state, t, lang, children, empty }) {
  if (state.status === 'error') return state.error === 'INTEGRATION_UNAVAILABLE' ? notConnected(t) : <ErrorState code={state.error} lang={lang} title={errText(t, state.error)} />;
  if (state.status === 'loading') return <p className="ui-muted" role="status">{t(['Loading…', 'लोड हो रहा है…'])}</p>;
  if (!state.items.length) return empty || <EmptyState title={t(COMMON.empty)} />;
  return children;
}

/* ───────────── Welcome ───────────── */
export function WelcomeSection({ role, me, lang }) {
  const t = tr(lang);
  const hour = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }));
  const greet = hour < 12 ? ['Good morning', 'सुप्रभात'] : hour < 17 ? ['Good afternoon', 'नमस्कार'] : ['Good evening', 'शुभ संध्या'];
  const label = (k) => t(NAV_LABEL_OVERRIDE[role]?.[k] || MODULES[k].title);
  return (
    <div className="ui-welcome">
      <div className="ui-welcome-cover" aria-hidden="true" />
      <div className="ui-welcome-body">
        <Avatar name={me?.name || '?'} size={64} />
        <div>
          <h2 className="ui-welcome-title">{t(greet)}{me?.name ? `, ${me.name}` : ''}</h2>
          <p className="ui-muted">{t(ROLE_LABEL[role])}{me?.office ? ` · ${me.office}` : ''}</p>
        </div>
      </div>
      <nav aria-label={t(['Your tools', 'आपके टूल'])} className="ui-welcome-grid">
        {modulesFor(role).filter((k) => k !== 'profile').map((k) => (
          <a key={k} href={moduleHref(role, k)} className="ui-welcome-tile">
            <UiIcon name={MODULES[k].icon} size={20} />
            <span><strong>{label(k)}</strong><small>{t(MODULES[k].scope?.[role] || MODULES[k].summary).split(/[.।]/)[0]}.</small></span>
          </a>
        ))}
      </nav>
    </div>
  );
}

/* ───────────── Digital ID ───────────── */
export function IdCardSection({ role, me, adapter, lang }) {
  const t = tr(lang);
  const [qr, setQr] = useState({ status: 'loading' });
  useEffect(() => {
    let live = true;
    adapter.get('id_verification', 'me').then((res) => { if (live) setQr(res.success ? { status: 'ready', ...res.data } : { status: 'error', code: res.error?.code }); });
    return () => { live = false; };
  }, [adapter]);
  return (
    <div className="ui-idcard-wrap">
      <article className="ui-idcard" aria-label={t(['Digital employee ID card', 'डिजिटल कर्मचारी आईडी कार्ड'])}>
        <header className="ui-idcard-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/brand/mark.png" alt="" width={28} height={26} />
          <span>The Himalayan Horizon</span>
        </header>
        <div className="ui-idcard-body">
          <Avatar name={me?.name || '?'} size={72} />
          <div>
            <p className="ui-idcard-name">{me?.name || '—'}</p>
            <p className="ui-idcard-role">{me?.designation || t(ROLE_LABEL[role])}</p>
            <dl className="ui-idcard-meta">
              <div><dt>{t(['Employee ID', 'कर्मचारी आईडी'])}</dt><dd><code>{me?.employeeId || t(['Not issued yet', 'अभी जारी नहीं'])}</code></dd></div>
              <div><dt>{t(['Office', 'कार्यालय'])}</dt><dd>{me?.office || '—'}</dd></div>
              {me?.joined ? <div><dt>{t(['Since', 'से'])}</dt><dd>{cellText({ key: 'joined', kind: 'date' }, me, lang)}</dd></div> : null}
            </dl>
          </div>
        </div>
        <div className="ui-idcard-qr">
          {qr.status === 'ready' && qr.svg ? (
            // Server returns an SVG for a signed, expiring token. Rendered as an image so no script can run.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(qr.svg)}`} alt={t(['Verification QR code', 'सत्यापन QR कोड'])} width={96} height={96} />
          ) : (
            <div className="ui-idcard-qr-empty" role="note">
              <UiIcon name="shield" size={18} />
              <span>{t(['QR verification appears when the verification service is live. It will show only name, role and whether the ID is valid.', 'सत्यापन सेवा चालू होने पर QR दिखेगा। इसमें सिर्फ़ नाम, भूमिका और आईडी वैध है या नहीं, दिखेगा।'])}</span>
            </div>
          )}
        </div>
      </article>
      {!me?.employeeId ? <p className="ui-inline-note" role="note"><UiIcon name="info" size={14} /> {t(['Permanent employee IDs are issued by the server. Yours will appear here once issued.', 'स्थायी कर्मचारी आईडी सर्वर जारी करता है। जारी होते ही आपकी आईडी यहाँ दिखेगी।'])}</p> : null}
    </div>
  );
}

/* ───────────── Standalone form ───────────── */
export function FormSection({ section, adapter, lang, me }) {
  const t = tr(lang);
  const toast = useToast();
  const spec = FORMS[section.form];
  const initial = section.form === 'profile' ? { displayName: me?.name || '', designation: me?.designation || '' } : {};
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const v = validateForm(spec, values);
    setErrors(v.errors);
    if (!v.ok) { setMsg(errText(t, 'VALIDATION_FAILED')); return; }
    if (section.danger && !confirm) { setMsg(t(['Tick the confirmation box first.', 'पहले पुष्टि बॉक्स चुनें।'])); return; }
    setBusy(true); setMsg('');
    const res = await adapter.create(`form:${section.form}`, serialisable(values), { idempotencyKey: newIdempotencyKey() });
    setBusy(false);
    if (!res.success) { setMsg(errText(t, res.error?.code)); return; }
    toast.success(t(COMMON.saved));
    if (section.danger) { setValues({}); setConfirm(false); }
  }

  return (
    <form onSubmit={submit} noValidate className="ui-mod-form">
      {section.danger ? <p className="ui-inline-note ui-warn" role="note"><UiIcon name="alert" size={14} /> {t(['Founder only. Requires two-step verification again on the server, signs the person out everywhere and is written to the audit log. Only the Founder can reverse it.', 'सिर्फ़ संस्थापक। सर्वर पर दोबारा दो-चरण सत्यापन चाहिए, व्यक्ति हर जगह से साइन आउट होगा और ऑडिट लॉग में दर्ज होगा। सिर्फ़ संस्थापक इसे वापस ले सकते हैं।'])}</p> : null}
      <FormFields fields={spec.fields} values={values} errors={errors} onChange={setValues} lang={lang} disabled={busy} />
      {section.danger ? (
        <label className="ui-check"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> {t(['I understand this takes effect immediately.', 'मैं समझता/समझती हूँ कि यह तुरंत लागू होगा।'])}</label>
      ) : null}
      {msg ? <p className="ui-error ui-form-error" role="alert">{msg}</p> : null}
      <div className="ui-actions-row"><Button type="submit" variant={section.danger ? 'danger' : 'primary'} loading={busy}>{t(section.submit || COMMON.save)}</Button></div>
    </form>
  );
}

/* ───────────── Stats (server-computed) ───────────── */
export function StatsSection({ section, adapter, lang }) {
  const t = tr(lang);
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let live = true;
    adapter.get(section.entity, 'summary').then((res) => { if (live) setState(res.success ? { status: 'ready', data: res.data } : { status: 'error', code: res.error?.code }); });
    return () => { live = false; };
  }, [adapter, section.entity]);
  if (state.status === 'error') return state.code === 'INTEGRATION_UNAVAILABLE' ? notConnected(t) : <ErrorState code={state.code} lang={lang} />;
  return (
    <StatGrid>
      {section.items.map(([k, en, hi]) => <Stat key={k} label={t([en, hi])} value={state.data?.[k] ?? '—'} loading={state.status === 'loading'} noDataLabel={t(['No data', 'डेटा नहीं'])} />)}
    </StatGrid>
  );
}

/* ───────────── Timeline (activity, notifications) ───────────── */
export function TimelineSection({ section, adapter, lang }) {
  const t = tr(lang);
  const toast = useToast();
  const entity = ENTITIES[section.entity];
  const [cat, setCat] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [state, setState] = useList(adapter, section.entity, { filters: { category: cat || undefined } });
  const items = onlyUnread ? state.items.filter((i) => (i.read || i.status) === 'unread') : state.items;
  const unread = state.items.filter((i) => (i.read || i.status) === 'unread');

  async function markRead(row) {
    const res = await adapter.act(section.entity, row.id, 'mark_read', {}, { expectedVersion: row.version, idempotencyKey: newIdempotencyKey() });
    if (!res.success) { toast.error(errText(t, res.error?.code)); return; }
    setState((s) => ({ ...s, items: s.items.map((r) => (r.id === row.id ? { ...res.data, read: 'read' } : r)) }));
  }
  function exportCsv() {
    const cols = entity.columns.map((c) => ({ key: c.key, label: t(c.label) }));
    downloadText(`thh-${section.entity}.csv`, toCsv(cols, items.map((r) => Object.fromEntries(entity.columns.map((c) => [c.key, cellText(c, r, lang)])))));
  }

  return (
    <div className="ui-mod-section">
      <div className="ui-mod-toolbar">
        <label className="ui-inline-field"><span>{t(['Area', 'क्षेत्र'])}</span>
          <Select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">{t(COMMON.all)}</option>
            {OPTIONS.activityCat.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
          </Select>
        </label>
        <Switch checked={onlyUnread} onCheckedChange={setOnlyUnread} label={`${t(['Unread only', 'सिर्फ़ नहीं पढ़े'])} (${unread.length})`} />
        <div className="ui-mod-toolbar-actions">
          <Button size="sm" variant="secondary" iconLeft="check" disabled={!unread.length} onClick={() => unread.forEach(markRead)}>{t(['Mark all read', 'सब पढ़ा चिह्नित करें'])}</Button>
          <Button size="sm" variant="secondary" iconLeft="doc" disabled={!items.length} onClick={exportCsv}>{t(COMMON.exportCsv)}</Button>
        </div>
      </div>
      <ListState state={{ ...state, items }} t={t} lang={lang}>
        <ol className="ui-feed">
          {items.map((it) => {
            const isUnread = (it.read || it.status) === 'unread';
            const catLabel = optionsOf('activityCat').find((o) => o.value === it.category);
            return (
              <li key={it.id} className={isUnread ? 'is-unread' : undefined}>
                <span className="ui-feed-dot" aria-hidden="true" />
                <div className="ui-feed-body">
                  <p><strong>{it.summary || it.title}</strong>{isUnread ? <span className="ui-sr-only"> ({t(STATUS.unread)})</span> : null}</p>
                  <p className="ui-muted">{cellText({ key: 'at', kind: 'datetime' }, it, lang)}{it.actorName ? ` · ${it.actorName}` : ''}{catLabel ? ' · ' : ''}{catLabel ? <Badge tone="info">{t(catLabel.label)}</Badge> : null}</p>
                </div>
                {isUnread && (it.allowedActions || []).includes('mark_read') ? <Button size="sm" variant="ghost" onClick={() => markRead(it)}>{t(['Mark read', 'पढ़ा चिह्नित करें'])}</Button> : null}
              </li>
            );
          })}
        </ol>
      </ListState>
    </div>
  );
}

/* ───────────── Calendar ───────────── */
export function CalendarSection({ section, adapter, lang }) {
  const t = tr(lang);
  const [state] = useList(adapter, section.entity);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const byDay = useMemo(() => {
    const map = {};
    for (const r of state.items) { const d = r[section.dateKey]; if (d && d.startsWith(month)) (map[d] ||= []).push(r); }
    return map;
  }, [state.items, month, section.dateKey]);
  const shift = (n) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const title = first.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const week = lang === 'hi' ? ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const inMonth = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));

  return (
    <ListState state={{ ...state, items: state.status === 'ready' ? [1] : [] }} t={t} lang={lang}>
      <div className="ui-cal">
        <div className="ui-cal-head">
          <Button size="sm" variant="secondary" onClick={() => shift(-1)} aria-label={t(['Previous month', 'पिछला महीना'])}>‹</Button>
          <h3 aria-live="polite">{title}</h3>
          <Button size="sm" variant="secondary" onClick={() => shift(1)} aria-label={t(['Next month', 'अगला महीना'])}>›</Button>
        </div>
        <div className="ui-cal-grid" aria-hidden="true">
          {week.map((w) => <div key={w} className="ui-cal-wd">{w}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
          {Array.from({ length: days }, (_, i) => {
            const d = `${month}-${String(i + 1).padStart(2, '0')}`;
            const ev = byDay[d] || [];
            return <div key={d} className={`ui-cal-day${ev.length ? ' has-ev' : ''}`}><span>{i + 1}</span>{ev.slice(0, 2).map((e) => <small key={e.id}>{e[section.labelKey]}</small>)}</div>;
          })}
        </div>
        <h4 className="ui-subhead">{t(['This month', 'इस महीने'])}</h4>
        {inMonth.length ? (
          <ul className="ui-cal-list">{inMonth.flatMap(([d, evs]) => evs.map((e) => <li key={e.id}><strong>{cellText({ key: 'd', kind: 'date' }, { d }, lang)}</strong> — {e[section.labelKey]}{e.scope ? ` (${e.scope})` : ''}</li>))}</ul>
        ) : <p className="ui-muted">{t(['Nothing this month.', 'इस महीने कुछ नहीं।'])}</p>}
      </div>
    </ListState>
  );
}

/* ───────────── Chat (participant-only) ───────────── */
export function ChatSection({ adapter, lang, me }) {
  const t = tr(lang);
  const toast = useToast();
  const [state, setState] = useList(adapter, 'conversation');
  const [openId, setOpenId] = useState(null);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const open = state.items.find((c) => c.id === openId) || null;
  const kinds = { direct: ['Direct', 'सीधा'], leadership: ['Leadership', 'नेतृत्व'], department: ['Department', 'विभाग'] };
  const shown = state.items.filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase()) || (c.messages || []).some((m) => m.text.toLowerCase().includes(q.toLowerCase())));

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !open) return;
    if (body.length > 4000) { toast.error(t(['Message is too long.', 'संदेश बहुत लंबा है।'])); return; }
    const res = await adapter.act('conversation', open.id, 'send', { text: body, from: me?.name || t(['You', 'आप']), at: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) }, { expectedVersion: open.version, idempotencyKey: newIdempotencyKey() });
    if (!res.success) { toast.error(errText(t, res.error?.code)); return; }
    setState((s) => ({ ...s, items: s.items.map((c) => (c.id === open.id ? res.data : c)) }));
    setText('');
  }

  return (
    <div className="ui-mod-section">
      <p className="ui-inline-note" role="note"><UiIcon name="shield" size={14} /> {t(['Private conversations are visible only to their participants. The Founder role does not give access to other people’s private messages.', 'निजी बातचीत सिर्फ़ उसके प्रतिभागी देख सकते हैं। संस्थापक भूमिका से दूसरों के निजी संदेश देखने की अनुमति नहीं मिलती।'])}</p>
      <ListState state={state} t={t} lang={lang} empty={<EmptyState title={t(['No conversations yet', 'अभी कोई बातचीत नहीं'])} />}>
        <div className="ui-chat">
          <div className="ui-chat-list">
            <input className="ui-input" type="search" placeholder={t(COMMON.search)} aria-label={t(['Search conversations', 'बातचीत खोजें'])} value={q} onChange={(e) => setQ(e.target.value)} />
            <ul>
              {shown.map((c) => (
                <li key={c.id}>
                  <button type="button" className={`ui-chat-item${c.id === openId ? ' on' : ''}`} onClick={() => setOpenId(c.id)} aria-current={c.id === openId ? 'true' : undefined}>
                    <Avatar name={c.title} size={32} />
                    <span><strong>{c.title}</strong><small>{t(kinds[c.kind] || [c.kind])}</small></span>
                    {c.unread ? <span className="ds-count" aria-label={`${c.unread} ${t(STATUS.unread)}`}>{c.unread}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="ui-chat-pane">
            {open ? (
              <>
                <h3 className="ui-chat-title">{open.title}</h3>
                <ol className="ui-chat-msgs" aria-live="polite">
                  {(open.messages || []).length ? open.messages.map((m) => (
                    <li key={m.id} className={m.from === me?.name ? 'is-me' : undefined}><strong>{m.from}</strong><p>{m.text}</p><small>{m.at}</small></li>
                  )) : <li className="ui-muted">{t(['No messages yet.', 'अभी कोई संदेश नहीं।'])}</li>}
                </ol>
                <form className="ui-chat-compose" onSubmit={send}>
                  <label className="ui-sr-only" htmlFor="chat-text">{t(['Message', 'संदेश'])}</label>
                  <Textarea id="chat-text" rows={2} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder={t(['Write a message', 'संदेश लिखें'])} />
                  <Button variant="secondary" disabled title={t(['File sharing needs document storage. Not connected yet.', 'फ़ाइल साझा करने के लिए दस्तावेज़ भंडारण चाहिए। अभी जुड़ा नहीं।'])} aria-label={t(['Attach file (not available yet)', 'फ़ाइल जोड़ें (अभी उपलब्ध नहीं)'])}><UiIcon name="doc" size={16} /></Button>
                  <Button type="submit" disabled={!text.trim()}>{t(['Send', 'भेजें'])}</Button>
                </form>
              </>
            ) : <EmptyState title={t(['Choose a conversation', 'बातचीत चुनें'])} />}
          </div>
        </div>
      </ListState>
    </div>
  );
}

/* ───────────── Integrations status (never simulated) ───────────── */
export function IntegrationsSection({ section, adapter, lang }) {
  const t = tr(lang);
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let live = true;
    adapter.get('integration_status', 'all').then((res) => { if (live) setState(res.success ? { status: 'ready', data: res.data } : { status: 'error', code: res.error?.code }); });
    return () => { live = false; };
  }, [adapter]);
  const list = PROVIDERS.filter((p) => section.providers.includes(p.key));
  return (
    <div className="ui-mod-section">
      <ul className="ui-integrations">
        {list.map((p) => {
          const st = state.status === 'ready' ? state.data?.[p.key] || 'not_configured' : null;
          return (
            <li key={p.key}>
              <div><strong>{t(p.label)}</strong><p className="ui-muted">{t(p.purpose)}</p></div>
              {state.status === 'loading' ? <span className="ui-muted">…</span>
                : st ? <StatusBadge status={st === 'connected' ? 'approved' : st === 'failing' ? 'rejected' : 'pending'} label={t(STATUS[st] || [st])} />
                  : <Badge tone="neutral">{t(['Status unknown', 'स्थिति अज्ञात'])}</Badge>}
            </li>
          );
        })}
      </ul>
      <p className="ui-inline-note" role="note"><UiIcon name="info" size={14} /> {state.status === 'error'
        ? t(['The provider status service is not connected, so status is unknown. No external message is sent from this dashboard until a provider is configured on the server.', 'सेवा स्थिति सेवा जुड़ी नहीं है, इसलिए स्थिति अज्ञात है। सर्वर पर सेवा कॉन्फ़िगर होने तक यहाँ से कोई बाहरी संदेश नहीं भेजा जाता।'])
        : t(['Credentials are kept on the server only. Success is shown only when the server confirms a working provider.', 'क्रेडेंशियल सिर्फ़ सर्वर पर रहते हैं। सफलता तभी दिखती है जब सर्वर काम करती सेवा की पुष्टि करे।'])}</p>
    </div>
  );
}

/* ───────────── Notification preferences ───────────── */
export function PrefsSection({ adapter, lang }) {
  const t = tr(lang);
  const toast = useToast();
  const channels = [['in_app', 'In app', 'ऐप में', null], ['email', 'Email', 'ईमेल', 'email'], ['whatsapp', 'WhatsApp', 'WhatsApp', 'whatsapp'], ['push', 'Push', 'पुश', 'push']];
  const cats = [['task', 'Task assignments and deadlines', 'काम सौंपना और समय-सीमा'], ['approval', 'Approval requests', 'मंज़ूरी अनुरोध'], ['employee', 'Employee onboarding', 'कर्मचारी ऑनबोर्डिंग'], ['attendance', 'Attendance and leave', 'उपस्थिति और छुट्टी'], ['partner', 'Partner verification', 'पार्टनर सत्यापन'], ['booking', 'Booking events', 'बुकिंग घटनाएँ'], ['finance', 'Financial requests', 'वित्तीय अनुरोध'], ['security', 'Security alerts', 'सुरक्षा चेतावनियाँ'], ['announcement', 'Company announcements', 'कंपनी घोषणाएँ']];
  const [status, setStatus] = useState({});
  const [prefs, setPrefs] = useState(() => Object.fromEntries(cats.map(([c]) => [c, { in_app: true }])));
  const [busy, setBusy] = useState(false);
  useEffect(() => { adapter.get('integration_status', 'all').then((r) => setStatus(r.success ? r.data || {} : {})); }, [adapter]);
  const usable = (provider) => !provider || status[provider] === 'connected';
  async function save() {
    setBusy(true);
    const res = await adapter.create('notification_preferences', prefs, { idempotencyKey: newIdempotencyKey() });
    setBusy(false);
    if (res.success) toast.success(t(COMMON.saved)); else toast.error(errText(t, res.error?.code));
  }
  return (
    <div className="ui-mod-section">
      <div className="ui-table-wrap">
        <table className="ui-prefs">
          <caption className="ui-sr-only">{t(['Notification delivery preferences', 'सूचना डिलीवरी पसंद'])}</caption>
          <thead><tr><th scope="col">{t(['Notification', 'सूचना'])}</th>{channels.map(([k, en, hi]) => <th key={k} scope="col">{t([en, hi])}</th>)}</tr></thead>
          <tbody>
            {cats.map(([c, en, hi]) => (
              <tr key={c}>
                <th scope="row">{t([en, hi])}</th>
                {channels.map(([k, cen, chi, provider]) => (
                  <td key={k}>
                    <input type="checkbox" aria-label={`${t([en, hi])}: ${t([cen, chi])}`} disabled={!usable(provider) || (c === 'security' && k === 'in_app')}
                      checked={!!prefs[c]?.[k] && usable(provider)} onChange={(e) => setPrefs((p) => ({ ...p, [c]: { ...p[c], [k]: e.target.checked } }))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ui-inline-note" role="note"><UiIcon name="info" size={14} /> {t(['Channels stay off until their provider is configured on the server. Security alerts always appear in the app.', 'सर्वर पर सेवा कॉन्फ़िगर होने तक चैनल बंद रहते हैं। सुरक्षा चेतावनियाँ हमेशा ऐप में दिखती हैं।'])}</p>
      <div className="ui-actions-row"><Button onClick={save} loading={busy}>{t(['Save preferences', 'पसंद सहेजें'])}</Button></div>
    </div>
  );
}

/* ───────────── Permission matrix (read-only; changes go to approval) ───────────── */
export function MatrixSection({ adapter, lang }) {
  const t = tr(lang);
  const toast = useToast();
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    adapter.get('permissions', 'matrix').then((res) => setState(res.success ? { status: 'ready', ...res.data } : { status: 'error', code: res.error?.code }));
  }, [adapter]);
  if (state.status === 'error') return state.code === 'INTEGRATION_UNAVAILABLE' ? notConnected(t) : <ErrorState code={state.code} lang={lang} />;
  if (state.status === 'loading') return <p className="ui-muted" role="status">…</p>;
  async function requestChange() {
    const res = await adapter.create('approval', { category: 'security', title: 'Permission change request', reason: 'Requested from Control center', risk: 'high', after: 'See request' }, { idempotencyKey: newIdempotencyKey() });
    if (res.success) toast.success(t(['Permission change sent for Founder approval.', 'अनुमति बदलाव संस्थापक मंज़ूरी के लिए भेजा गया।'])); else toast.error(errText(t, res.error?.code));
  }
  return (
    <div className="ui-mod-section">
      <div className="ui-table-wrap">
        <table className="ui-prefs">
          <caption className="ui-sr-only">{t(['Permissions by role', 'भूमिका के अनुसार अनुमतियाँ'])}</caption>
          <thead><tr><th scope="col">{t(['Permission', 'अनुमति'])}</th>{state.roles.map((r) => <th key={r} scope="col">{t(ROLE_LABEL[r] || [r])}</th>)}</tr></thead>
          <tbody>{state.permissions.map((p) => (
            <tr key={p.key}><th scope="row">{p.label}</th>{state.roles.map((r) => <td key={r}>{p.roles.includes(r) ? <span aria-label={t(['Allowed', 'अनुमति है'])}><UiIcon name="check" size={16} /></span> : <span aria-label={t(['Not allowed', 'अनुमति नहीं'])}>—</span>}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      <p className="ui-inline-note" role="note"><UiIcon name="shield" size={14} /> {t(['This view is read-only. Permission changes are approval requests, enforced by Codex backend and Supabase RLS.', 'यह सिर्फ़ देखने के लिए है। अनुमति बदलाव मंज़ूरी अनुरोध हैं, जिन्हें Codex बैकएंड और Supabase RLS लागू करते हैं।'])}</p>
      <div className="ui-actions-row"><Button variant="secondary" onClick={requestChange}>{t(['Request a permission change', 'अनुमति बदलाव का अनुरोध'])}</Button></div>
    </div>
  );
}

/* ───────────── Reports & exports ───────────── */
export function ReportsSection({ section, adapter, lang }) {
  const t = tr(lang);
  const toast = useToast();
  const [period, setPeriod] = useState('monthly');
  const [busy, setBusy] = useState('');
  async function exportReport(key, fmt) {
    setBusy(`${key}:${fmt}`);
    const res = await adapter.get(fmt === 'pdf' ? 'report_pdf' : 'report', `${key}:${period}`);
    setBusy('');
    if (!res.success) { toast.error(fmt === 'pdf' && res.error?.code === 'INTEGRATION_UNAVAILABLE' ? t(COMMON.pdfUnavailable) : errText(t, res.error?.code)); return; }
    if (fmt === 'csv') downloadText(`thh-${key}-${period}.csv`, toCsv(res.data.columns, res.data.rows));
  }
  return (
    <div className="ui-mod-section">
      <label className="ui-inline-field"><span>{t(['Period', 'अवधि'])}</span>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)}>{OPTIONS.period.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}</Select>
      </label>
      <ul className="ui-reports">
        {section.reports.map(([key, en, hi]) => (
          <li key={key}>
            <span><UiIcon name="doc" size={18} /> {t([en, hi])}</span>
            <span className="ui-actions-row">
              <Button size="sm" variant="secondary" loading={busy === `${key}:csv`} onClick={() => exportReport(key, 'csv')}>{t(COMMON.exportCsv)}</Button>
              <Button size="sm" variant="secondary" loading={busy === `${key}:pdf`} onClick={() => exportReport(key, 'pdf')}>{t(COMMON.exportPdf)}</Button>
            </span>
          </li>
        ))}
      </ul>
      <p className="ui-inline-note" role="note"><UiIcon name="info" size={14} /> {t(['Reports are generated by the server from authorised data. This screen does not calculate figures.', 'रिपोर्ट सर्वर अधिकृत डेटा से बनाता है। यह स्क्रीन आँकड़ों की गणना नहीं करती।'])}</p>
    </div>
  );
}

/* ───────────── AI-assisted destination research (sourced, reviewed, approved) ───────────── */
export function ResearchSection({ adapter, lang }) {
  const t = tr(lang);
  const toast = useToast();
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const [checked, setChecked] = useState({});
  const spec = { fields: [
    { key: 'place', label: ['Place name', 'स्थान का नाम'], type: 'text', required: true, minLength: 2, maxLength: 80 },
    { key: 'district', label: ['District', 'ज़िला'], type: 'text', required: true, minLength: 2, maxLength: 80 },
  ] };
  async function run(e) {
    e.preventDefault();
    const v = validateForm(spec, values); setErrors(v.errors); if (!v.ok) return;
    setBusy(true);
    const res = await adapter.create('research_job', values, { idempotencyKey: newIdempotencyKey() });
    setBusy(false);
    if (!res.success) { toast.error(res.error?.code === 'INTEGRATION_UNAVAILABLE' ? t(['AI research is not connected yet. No AI provider is configured on the server.', 'AI शोध अभी जुड़ा नहीं। सर्वर पर कोई AI सेवा कॉन्फ़िगर नहीं है।']) : errText(t, res.error?.code)); return; }
    setDraft(res.data); setChecked({});
  }
  const facts = draft?.facts || [];
  const allChecked = facts.length > 0 && facts.every((f) => checked[f.id] && f.source);
  async function submitForApproval() {
    const res = await adapter.create('approval', { category: 'destination', title: `New destination: ${draft.place}`, reason: 'Sourced research reviewed by a person.', risk: 'medium', after: facts.map((f) => `${f.label}: ${f.value} (${f.source})`).join('\n') }, { idempotencyKey: newIdempotencyKey() });
    if (res.success) { toast.success(t(['Sent for CEO approval. Nothing is published until it is approved.', 'CEO मंज़ूरी के लिए भेजा गया। मंज़ूरी तक कुछ प्रकाशित नहीं होगा।'])); setDraft(null); } else toast.error(errText(t, res.error?.code));
  }
  return (
    <div className="ui-mod-section">
      <form onSubmit={run} noValidate className="ui-mod-form">
        <FormFields fields={spec.fields} values={values} errors={errors} onChange={setValues} lang={lang} disabled={busy} />
        <div className="ui-actions-row"><Button type="submit" iconLeft="search" loading={busy}>{t(['Research with AI', 'AI से शोध करें'])}</Button></div>
      </form>
      <p className="ui-inline-note" role="note"><UiIcon name="shield" size={14} /> {t(['Every fact must show its source. A person checks each one, then it goes to the CEO. AI never publishes.', 'हर तथ्य का स्रोत दिखना चाहिए। कोई व्यक्ति हर तथ्य जाँचता है, फिर यह CEO को जाता है। AI कभी प्रकाशित नहीं करता।'])}</p>
      {draft ? (
        <Card>
          <CardHeader level={3} title={`${draft.place}, ${draft.district}`} description={t(['AI draft — not reviewed', 'AI ड्राफ्ट — जाँचा नहीं गया'])} />
          <ul className="ui-facts">
            {facts.map((f) => (
              <li key={f.id}>
                <label className="ui-check"><input type="checkbox" disabled={!f.source} checked={!!checked[f.id]} onChange={(e) => setChecked((c) => ({ ...c, [f.id]: e.target.checked }))} />
                  <span><strong>{f.label}:</strong> {f.value}<br /><small className="ui-muted">{f.source ? <>{t(['Source', 'स्रोत'])}: <a href={f.source} target="_blank" rel="noopener noreferrer nofollow">{f.source}</a></> : t(['No source — cannot be used', 'कोई स्रोत नहीं — उपयोग नहीं हो सकता'])}</small></span>
                </label>
              </li>
            ))}
          </ul>
          <div className="ui-actions-row"><Button disabled={!allChecked} onClick={submitForApproval}>{t(['I checked every source — send for CEO approval', 'मैंने हर स्रोत जाँचा — CEO मंज़ूरी के लिए भेजें'])}</Button></div>
        </Card>
      ) : null}
    </div>
  );
}

/* ───────────── Attendance check-in / out ───────────── */
export function AttendanceSection({ adapter, lang }) {
  const t = tr(lang);
  const toast = useToast();
  const [mode, setMode] = useState('office');
  const [noteText, setNoteText] = useState('');
  const [last, setLast] = useState(null);
  const [busy, setBusy] = useState('');
  async function mark(kind) {
    if (['field', 'travel'].includes(mode) && noteText.trim().length < 3) { toast.error(t(['Add where you are working for field or travel attendance.', 'फ़ील्ड या यात्रा उपस्थिति के लिए बताएँ कि आप कहाँ काम कर रहे हैं।'])); return; }
    setBusy(kind);
    const res = await adapter.create('attendance_entry', { kind, mode, note: noteText.trim() }, { idempotencyKey: newIdempotencyKey() });
    setBusy('');
    if (!res.success) { toast.error(errText(t, res.error?.code)); return; }
    setLast({ kind, mode, at: res.data?.createdAt || null });
    toast.success(kind === 'in' ? t(['Checked in.', 'चेक-इन हुआ।']) : t(['Checked out.', 'चेक-आउट हुआ।']));
  }
  return (
    <Card>
      <div className="ui-attend">
        <label className="ui-inline-field"><span>{t(['Working from', 'कहाँ से काम'])}</span>
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>{OPTIONS.attMode.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}</Select>
        </label>
        <label className="ui-inline-field ui-grow"><span>{t(['Note (place, client or reason)', 'नोट (स्थान, ग्राहक या कारण)'])}</span>
          <input className="ui-input" value={noteText} maxLength={200} onChange={(e) => setNoteText(e.target.value)} />
        </label>
        <div className="ui-actions-row">
          <Button iconLeft="check" loading={busy === 'in'} onClick={() => mark('in')}>{t(['Check in', 'चेक-इन'])}</Button>
          <Button variant="secondary" loading={busy === 'out'} onClick={() => mark('out')}>{t(['Check out', 'चेक-आउट'])}</Button>
        </div>
      </div>
      {last ? <p className="ui-muted" role="status">{last.kind === 'in' ? t(['Last: checked in', 'पिछला: चेक-इन']) : t(['Last: checked out', 'पिछला: चेक-आउट'])} · {t(optionsOf('attMode').find((o) => o.value === last.mode)?.label)}{last.at ? ` · ${cellText({ key: 'at', kind: 'datetime' }, last, lang)}` : ''}</p> : null}
      <p className="ui-inline-note" role="note"><UiIcon name="clock" size={14} /> {t(['The time is recorded by the server, not by this device. Location is not collected.', 'समय सर्वर दर्ज करता है, यह डिवाइस नहीं। स्थान नहीं लिया जाता।'])}</p>
    </Card>
  );
}

/* ───────────── Emergency ───────────── */
export function EmergencySection({ adapter, lang }) {
  const t = tr(lang);
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function raise() {
    if (text.trim().length < 5) { toast.error(t(['Describe the emergency in a few words.', 'आपात स्थिति कुछ शब्दों में बताएँ।'])); return; }
    setBusy(true);
    const res = await adapter.create('emergency_alert', { text: text.trim() }, { idempotencyKey: newIdempotencyKey() });
    setBusy(false);
    if (res.success) { toast.success(t(['Alert sent to leadership.', 'चेतावनी नेतृत्व को भेजी गई।'])); setText(''); }
    else toast.error(t(['Alert could not be sent — the alert service is not connected. Call 112 now if anyone is in danger.', 'चेतावनी नहीं भेजी जा सकी — चेतावनी सेवा जुड़ी नहीं है। कोई ख़तरे में हो तो अभी 112 पर कॉल करें।']));
  }
  return (
    <div className="ui-mod-section">
      <div className="ui-emergency">
        <a className="ui-btn ui-btn-danger ui-btn-lg" href="tel:112"><UiIcon name="phone" size={18} /> {t(['Call 112 (emergency)', '112 पर कॉल करें (आपातकाल)'])}</a>
        <a className="ui-btn ui-btn-secondary ui-btn-lg" href="tel:108"><UiIcon name="phone" size={18} /> {t(['Call 108 (ambulance)', '108 पर कॉल करें (एम्बुलेंस)'])}</a>
      </div>
      <label className="ui-inline-field ui-grow"><span>{t(['Tell leadership what happened', 'नेतृत्व को बताएँ क्या हुआ'])}</span>
        <Textarea rows={3} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="ui-actions-row"><Button variant="danger" loading={busy} onClick={raise}>{t(['Send emergency alert', 'आपातकालीन चेतावनी भेजें'])}</Button></div>
      <p className="ui-inline-note" role="note"><UiIcon name="info" size={14} /> {t(['Calling 112 or 108 works without the internet. The alert to leadership needs the server.', '112 या 108 पर कॉल इंटरनेट के बिना भी होता है। नेतृत्व को चेतावनी के लिए सर्वर चाहिए।'])}</p>
    </div>
  );
}

/* ───────────── Reporting hierarchy ───────────── */
export function TreeSection({ section, adapter, lang }) {
  const t = tr(lang);
  const [state] = useList(adapter, section.entity);
  const tree = useMemo(() => {
    const kids = {};
    for (const e of state.items) (kids[e.reportsToName || '—'] ||= []).push(e);
    return kids;
  }, [state.items]);
  const roots = state.items.filter((e) => !e.reportsToName || e.reportsToName === '—' || !state.items.some((x) => x.name === e.reportsToName));
  const node = (e, depth = 0) => (
    <li key={e.id}>
      <span className="ui-tree-node"><Avatar name={e.name} size={28} /> <span><strong>{e.name}</strong> <small className="ui-muted">{e.designation}</small></span></span>
      {tree[e.name]?.length && depth < 8 ? <ul>{tree[e.name].map((c) => node(c, depth + 1))}</ul> : null}
    </li>
  );
  return <ListState state={state} t={t} lang={lang}><ul className="ui-tree" aria-label={t(section.title)}>{roots.map((r) => node(r))}</ul></ListState>;
}

/* ───────────── Live read-only data from existing management RPCs ───────────── */
const LIVE_COLUMNS = {
  people: [['name', 'Person', 'व्यक्ति'], ['role', 'Role', 'भूमिका'], ['office', 'Office', 'कार्यालय'], ['mfa', 'Two-step', 'दो-चरण'], ['lastActive', 'Last active', 'अंतिम सक्रिय']],
  events: [['created_at', 'When', 'कब', 'datetime'], ['action', 'Action', 'कार्रवाई'], ['subject', 'Item', 'विषय'], ['table_name', 'Area', 'क्षेत्र'], ['actorName', 'By', 'द्वारा']],
  offices: [['name', 'Staff', 'स्टाफ़'], ['sub', 'Office', 'कार्यालय'], ['status', 'Today', 'आज']],
};

export function LiveTableSection({ section, live, lang, WorkQueueComponent, decide }) {
  const t = tr(lang);
  const data = live?.[section.live];
  if (section.live === 'work' && WorkQueueComponent) {
    return <WorkQueueComponent lang={lang} title={t(section.title)} items={data?.rows || []} connected={!!data?.connected} decide={decide} />;
  }
  if (!data || !data.connected) return notConnected(t);
  const cols = (LIVE_COLUMNS[section.live] || []).map(([key, en, hi, kind]) => ({
    key, header: t([en, hi]), primary: key === LIVE_COLUMNS[section.live][0][0],
    render: (row) => (key === 'status' ? <StatusBadge status={row.status === 'in' ? 'approved' : 'pending'} label={row.status === 'in' ? t(['Checked in', 'चेक-इन']) : t(['Not checked in', 'चेक-इन नहीं'])} />
      : kind === 'datetime' ? cellText({ key, kind }, row, lang) : row[key] ?? '—'),
  }));
  return (
    <div className="ui-mod-section">
      <DataTable caption={t(section.title)} hideCaption columns={cols} rows={data.rows || []} rowKey={(r) => r.id || r.userId} empty={<EmptyState title={t(COMMON.empty)} />} />
    </div>
  );
}

export function LiveStatsSection({ section, live, lang }) {
  const t = tr(lang);
  const data = live?.[section.live];
  if (!data || !data.connected) return notConnected(t);
  const rupees = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`);
  return (
    <div className="ui-mod-section">
      <StatGrid>
        <Stat label={t(['Homestay booking value (confirmed records)', 'होमस्टे बुकिंग मूल्य (पुष्ट रिकॉर्ड)'])} value={rupees(data.rows?.booking_value)} />
        <Stat label={t(['Platform commission (records)', 'प्लेटफ़ॉर्म कमीशन (रिकॉर्ड)'])} value={rupees(data.rows?.commission)} />
      </StatGrid>
      <p className="ui-inline-note" role="note"><UiIcon name="info" size={14} /> {t(['Totals of booking records from the database, not an accounting ledger. Revenue, expenses and P&L appear when the accounting service is live.', 'डेटाबेस के बुकिंग रिकॉर्ड का जोड़, लेखा-बही नहीं। आय, खर्च और लाभ-हानि अकाउंटिंग सेवा चालू होने पर दिखेंगे।'])}</p>
    </div>
  );
}

export function LinksSection({ links = [], lang }) {
  const t = tr(lang);
  if (!links.length) return null;
  return (
    <nav className="ui-mod-links" aria-label={t(['Related approved screens', 'संबंधित स्वीकृत स्क्रीन'])}>
      {links.map((l) => <a key={l.href} href={l.href} className="ui-link-btn"><UiIcon name="arrow" size={14} /> {t(l.label)}</a>)}
    </nav>
  );
}
