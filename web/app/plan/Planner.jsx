'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchRoute, routeIsFresh, routeKey, buildItinerary, computeBudget, COST_CATS, defaultAssumptions, pickLeg, tripPoints, legPairs } from '@/lib/trip/engine';
import { PREFS, PACES, MODES, STATUSES, MAX_DESTS, blank, loadDraft, saveDraft, dropDraft, slim, placeLabel, tripDays, validate, prefThemes, todayISO } from '@/lib/trip/common';
import { saveTrip, shareLink, deleteTrip } from '@/lib/trip/save';
import { inr } from '@/lib/format';
import { PlaceSearch } from '@/components/PlaceSearch';
import { Icon } from '@/components/Icon';
import { RouteMap } from '@/components/trip/RouteMap';
import { TripReport } from '@/components/trip/TripReport';
import { useWeather } from '@/components/trip/useWeather';
import { WeatherChip, DayItems, km, dur } from '@/components/trip/bits';

const STEPS = ['form', 'route', 'plan', 'budget', 'report'];
const itinKey = (d) => [routeKey(d), (d.route?.legs || []).map((l) => l.chosen || 0).join(''), d.depart, d.ret, d.pace, [...d.prefs].sort().join(','), d.roundTrip !== false, d.mode].join('#');

export function Planner({ lang, places, locations, listings, defaults, searchLabels, signedIn, initial }) {
  const router = useRouter();
  const L = useCallback((en, hi) => (lang === 'hi' ? hi : en), [lang]);
  const [d, setD] = useState(null);
  const [step, setStep] = useState('form');
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [progress, setProgress] = useState(null);
  const [editing, setEditing] = useState(null);
  const [pickFor, setPickFor] = useState(null); // 'start' | index of destination

  // Load: a trip opened for editing > a prefilled place > the draft on this device > blank.
  useEffect(() => {
    let start = initial?.draft || loadDraft() || blank();
    if (initial?.dest) {
      start = { ...start, dests: start.dests.filter(Boolean).some((p) => p.name === initial.dest.name) ? start.dests : [...start.dests.filter(Boolean), slim(initial.dest)] };
      if (!start.dests.length) start.dests = [null];
    }
    setD(start);
    if (initial?.draft && !initial.fresh) setStep('report');
  }, [initial]);

  const update = useCallback((patch) => setD((cur) => { const n = { ...cur, ...patch }; saveDraft(n); return n; }), []);
  const flash = (text, err = false) => { setMsg({ text, err }); setTimeout(() => setMsg(null), 4000); };

  // ---------- route ----------
  const runRoute = useCallback(async (cur) => {
    setBusy('route'); setProgress([0, legPairs(cur).length]);
    const route = await fetchRoute(cur, { previous: cur.route, onProgress: (a, b) => setProgress([a, b]) });
    setBusy(''); setProgress(null);
    update({ route });
  }, [update]);

  // ---------- itinerary ----------
  const generate = useCallback((cur, force = false) => {
    const key = itinKey(cur);
    if (!force && cur.days && (cur.daysKey === key || cur.daysEdited)) return;
    const res = buildItinerary({ d: cur, route: cur.route, places, locs: locations, listings, prefThemes: prefThemes(cur) });
    update({ days: res.days, daysKey: key, daysEdited: false, itinWarnings: res.warnings, needDays: res.needDays });
  }, [places, locations, listings, update]);

  useEffect(() => {
    if (!d) return;
    if (step === 'route' && !routeIsFresh(d) && busy !== 'route') runRoute(d);
    if ((step === 'plan' || step === 'budget' || step === 'report') && routeIsFresh(d)) generate(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, d?.route?.key]);

  const go = (s) => {
    if (s !== 'form') {
      const e = validate(d, L);
      setErrs(e);
      if (Object.keys(e).length) { setStep('form'); flash(L('Please fix the highlighted fields.', 'कृपया लाल निशान वाले खाने ठीक करें।'), true); return; }
      if (s !== 'route' && !routeIsFresh(d)) s = 'route';
    }
    setStep(s);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { byDay } = useWeather(step === 'plan' ? d?.days : null);
  const budget = useMemo(() => (d && d.depart && d.ret ? computeBudget({ ...d, assumptions: { ...defaultsFor(d, defaults), ...(d.assumptions || {}) } }, d.route, d.days) : null), [d, defaults]);

  if (!d) return <div className="loading"><span className="spinner" /> …</div>;
  const n = tripDays(d);

  async function onSave(extra = {}) {
    if (!signedIn) { saveDraft(d); router.push('/login?next=/plan'); return null; }
    setBusy('save');
    try {
      const id = await saveTrip({ ...d, ...extra, assumptions: { ...defaultsFor(d, defaults), ...(d.assumptions || {}) } });
      update({ ...extra, tripId: id });
      flash(L('Trip saved', 'ट्रिप सेव हो गई'));
      return id;
    } catch (e) { flash(`${L('Could not save', 'सेव नहीं हुआ')}: ${e.message}`, true); return null; }
    finally { setBusy(''); }
  }

  async function onShare() {
    const id = d.tripId || (await onSave());
    if (!id) return;
    try {
      const url = await shareLink(id);
      if (navigator.share) await navigator.share({ title: d.title || 'Trip', url }).catch(() => {});
      else { await navigator.clipboard.writeText(url); flash(L('Share link copied', 'शेयर लिंक कॉपी हो गया')); }
    } catch (e) { flash(e.message, true); }
  }

  const stepper = (
    <ol className="steps-bar" aria-label={L('Steps', 'चरण')}>
      {[[L('Trip', 'यात्रा')], [L('Route', 'रास्ता')], [L('Day plan', 'दिन-वार')], [L('Budget', 'बजट')], [L('Report', 'रिपोर्ट')]].map(([label], i) => (
        <li key={i} className={STEPS[i] === step ? 'on' : ''}><button type="button" onClick={() => go(STEPS[i])} aria-current={STEPS[i] === step ? 'step' : undefined}>{i + 1}. {label}</button></li>
      ))}
    </ol>
  );

  return (
    <div className="planner">
      <div className="ds-head">
        <div className="grow"><p className="eyebrow">{L('Trip Planner', 'ट्रिप प्लानर')}</p><h1>{d.title || L('Plan your trip', 'अपनी यात्रा प्लान करें')}</h1>
          <p className="muted small">{d.tripId ? L('Saved trip — changes are kept on this device until you save.', 'सेव ट्रिप — सेव करने तक बदलाव इसी फ़ोन में रहेंगे।') : L('Draft is saved on this device automatically.', 'ड्राफ़्ट अपने आप इस फ़ोन में सेव होता है।')}</p></div>
        <div className="ds-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm(L('Start a new empty trip?', 'नई ख़ाली यात्रा शुरू करें?'))) { dropDraft(); setD(blank()); setStep('form'); } }}><Icon name="plus" size={16} /> {L('New', 'नई')}</button>
        </div>
      </div>
      {stepper}
      {msg ? <p className={msg.err ? 'form-err' : 'form-ok'} role="status">{msg.text}</p> : null}

      {step === 'form' ? (
        <section className="ds-panel stack">
          <label className="field"><span className="field-label">{L('Trip name (optional)', 'यात्रा का नाम (वैकल्पिक)')}</span>
            <input className="input" value={d.title} maxLength={160} onChange={(e) => update({ title: e.target.value })} placeholder={L('e.g. Kumaon family trip', 'जैसे कुमाऊँ फ़ैमिली ट्रिप')} /></label>

          <div className="field"><span className="field-label">{L('Start from', 'कहाँ से शुरू')} *</span>
            {d.start ? <PlaceChosen p={d.start} lang={lang} onClear={() => update({ start: null, route: null })} />
              : <PlaceSearch lang={lang} labels={searchLabels} onPick={(p) => update({ start: slim(p) })} placeholder={L('City, town or village', 'शहर, कस्बा या गाँव')} />}
            <button type="button" className="link small" onClick={() => setPickFor('start')}>📍 {L('Pick on map', 'नक्शे पर चुनें')}</button>
            {errs.start ? <span className="form-err">{errs.start}</span> : null}</div>

          <div className="field"><span className="field-label">{L('Destinations (in order)', 'मंज़िलें (क्रम से)')} *</span>
            {d.dests.map((p, i) => (
              <div className="dest-row" key={i}>
                <span className="dest-num">{i + 1}</span>
                <div className="grow">
                  {p ? <PlaceChosen p={p} lang={lang} onClear={() => { const dd = [...d.dests]; dd[i] = null; update({ dests: dd }); }} />
                    : <PlaceSearch lang={lang} labels={searchLabels} onPick={(x) => { const dd = [...d.dests]; dd[i] = slim(x); update({ dests: dd }); }} placeholder={L('Add a place', 'जगह जोड़ें')} />}
                  {!p ? <button type="button" className="link small" onClick={() => setPickFor(i)}>📍 {L('Pick on map', 'नक्शे पर चुनें')}</button> : null}
                </div>
                <div className="dest-tools">
                  <button type="button" className="icon-btn" disabled={i === 0} aria-label={L('Move up', 'ऊपर')} onClick={() => { const dd = [...d.dests]; [dd[i - 1], dd[i]] = [dd[i], dd[i - 1]]; update({ dests: dd }); }}>↑</button>
                  <button type="button" className="icon-btn" disabled={i === d.dests.length - 1} aria-label={L('Move down', 'नीचे')} onClick={() => { const dd = [...d.dests]; [dd[i + 1], dd[i]] = [dd[i], dd[i + 1]]; update({ dests: dd }); }}>↓</button>
                  <button type="button" className="icon-btn" disabled={d.dests.length === 1} aria-label={L('Remove', 'हटाएँ')} onClick={() => update({ dests: d.dests.filter((_, k) => k !== i) })}>✕</button>
                </div>
              </div>
            ))}
            {d.dests.length < MAX_DESTS ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ dests: [...d.dests, null] })}><Icon name="plus" size={16} /> {L('Add destination', 'मंज़िल जोड़ें')}</button> : null}
            {errs.dests ? <span className="form-err">{errs.dests}</span> : null}
            <label className="check"><input type="checkbox" checked={d.roundTrip !== false} onChange={(e) => update({ roundTrip: e.target.checked })} /> {L('Return to the start (round trip)', 'शुरुआत पर वापस (आना-जाना)')}</label>
          </div>

          {pickFor !== null ? (
            <MapPicker lang={lang} onCancel={() => setPickFor(null)} onPick={(p) => {
              if (pickFor === 'start') update({ start: p }); else { const dd = [...d.dests]; dd[pickFor] = p; update({ dests: dd }); }
              setPickFor(null);
            }} />
          ) : null}

          <div className="form-grid">
            <label className="field"><span className="field-label">{L('Start date', 'जाने की तारीख़')} *</span>
              <input className="input" type="date" min={todayISO()} value={d.depart} onChange={(e) => update({ depart: e.target.value, ret: d.ret && d.ret < e.target.value ? e.target.value : d.ret })} />
              {errs.depart ? <span className="form-err">{errs.depart}</span> : null}</label>
            <label className="field"><span className="field-label">{L('Number of days', 'कितने दिन')} *</span>
              <input className="input" type="number" min={1} max={30} inputMode="numeric" value={n || ''} disabled={!d.depart}
                onChange={(e) => { const k = Math.max(1, Math.min(30, Number(e.target.value) || 1)); const r = new Date(`${d.depart}T12:00:00Z`); r.setUTCDate(r.getUTCDate() + k - 1); update({ ret: r.toISOString().slice(0, 10) }); }} />
              {errs.ret ? <span className="form-err">{errs.ret}</span> : null}</label>
            <label className="field"><span className="field-label">{L('Adults', 'वयस्क')}</span>
              <input className="input" type="number" min={1} max={40} inputMode="numeric" value={d.adults} onChange={(e) => update({ adults: Math.max(1, Math.min(40, Number(e.target.value) || 1)) })} /></label>
            <label className="field"><span className="field-label">{L('Children', 'बच्चे')}</span>
              <input className="input" type="number" min={0} max={20} inputMode="numeric" value={d.children} onChange={(e) => update({ children: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} /></label>
            <label className="field"><span className="field-label">{L('Travel mode', 'सवारी')}</span>
              <select className="input" value={d.mode} onChange={(e) => update({ mode: e.target.value })}>{MODES.map(([k, en, hi]) => <option key={k} value={k}>{lang === 'hi' ? hi : en}</option>)}</select></label>
            {['car', 'bike', 'taxi'].includes(d.mode) ? (
              <label className="field"><span className="field-label">{L('Vehicle mileage (km per litre)', 'गाड़ी का माइलेज (किमी/लीटर)')}</span>
                <input className="input" type="number" min={1} max={100} step={0.5} inputMode="decimal" value={d.assumptions?.mileage ?? defaultAssumptions(d).mileage}
                  onChange={(e) => update({ assumptions: { ...(d.assumptions || {}), mileage: e.target.value } })} /></label>
            ) : null}
            <label className="field"><span className="field-label">{L('Budget for the whole trip (₹, optional)', 'पूरी यात्रा का बजट (₹, वैकल्पिक)')}</span>
              <input className="input" type="number" min={0} step={500} inputMode="numeric" value={d.budget} onChange={(e) => update({ budget: e.target.value })} />
              {errs.budget ? <span className="form-err">{errs.budget}</span> : null}</label>
          </div>

          <div className="field"><span className="field-label">{L('Pace', 'रफ़्तार')}</span>
            <div className="seg" role="radiogroup">{PACES.map(([k, en, hi, sen, shi]) => (
              <button key={k} type="button" role="radio" aria-checked={d.pace === k} className={d.pace === k ? 'on' : ''} onClick={() => update({ pace: k })} title={lang === 'hi' ? shi : sen}>{lang === 'hi' ? hi : en}</button>
            ))}</div></div>

          <div className="field"><span className="field-label">{L('What do you like?', 'आपको क्या पसंद है?')}</span>
            <div className="chips">{PREFS.map(([k, en, hi]) => (
              <button key={k} type="button" className={`chip chip-toggle${d.prefs.includes(k) ? ' on' : ''}`} aria-pressed={d.prefs.includes(k)}
                onClick={() => update({ prefs: d.prefs.includes(k) ? d.prefs.filter((x) => x !== k) : [...d.prefs, k] })}>{lang === 'hi' ? hi : en}</button>
            ))}</div></div>

          <button type="button" className="btn btn-lg" onClick={() => go('route')}>{L('See the route', 'रास्ता देखें')} <Icon name="arrow" size={16} /></button>
        </section>
      ) : null}

      {step === 'route' ? (
        <section className="ds-panel stack">
          <h2>{L('Road route', 'सड़क का रास्ता')}</h2>
          {busy === 'route' ? <p className="loading"><span className="spinner" /> {L('Finding road routes…', 'सड़क रास्ते ढूँढ रहे हैं…')} {progress ? `${progress[0]}/${progress[1]}` : ''}</p> : null}
          {d.route ? (
            <>
              <RouteMap points={tripPoints(d)} legs={d.route.legs} />
              <ol className="leg-list">
                {d.route.legs.map((leg, i) => {
                  const pairs = legPairs(d); const pr = pairs[i] || {};
                  const l = pickLeg(leg);
                  return (
                    <li key={i}>
                      <strong>{placeLabel(pr.from, lang)} → {placeLabel(pr.to, lang)}</strong>{' '}
                      {leg.error ? <span className="warn-text">{leg.error === 'no_route' ? L('No road route found between these places.', 'इन जगहों के बीच सड़क रास्ता नहीं मिला।') : leg.error === 'offline' ? L('You are offline.', 'आप ऑफ़लाइन हैं।') : L('Route service did not answer. Try again.', 'रास्ता सेवा ने जवाब नहीं दिया। फिर कोशिश करें।')}</span>
                        : <span className="muted">{km(l.km)} · {dur(l.secs, lang)}</span>}
                      {leg.alts?.length ? (
                        <div className="chips">{[leg, ...leg.alts].map((a, k) => (
                          <button key={k} type="button" className={`chip chip-toggle${(leg.chosen || 0) === k ? ' on' : ''}`}
                            onClick={() => { const legs = [...d.route.legs]; legs[i] = { ...leg, chosen: k }; const r = { ...d.route, legs }; const ok = legs.filter((x) => !x.error).map(pickLeg); r.total_km = ok.reduce((s, x) => s + x.km, 0); r.total_secs = ok.reduce((s, x) => s + x.secs, 0); update({ route: r }); }}>
                            {k ? L(`Option ${k + 1}`, `विकल्प ${k + 1}`) : L('Fastest', 'सबसे तेज़')}: {km(a.km)}, {dur(a.secs, lang)}
                          </button>
                        ))}</div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <p><strong>{L('Total', 'कुल')}:</strong> {km(d.route.total_km)} · {dur(d.route.total_secs, lang)} {L('driving (without breaks)', 'ड्राइविंग (आराम के बिना)')}</p>
              {d.route.missing ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => runRoute({ ...d, route: { ...d.route, legs: d.route.legs.filter((x) => !x.error) } })}>{L('Try missing parts again', 'बाक़ी हिस्से फिर से')}</button> : null}
              <p className="small muted">{L('From OpenStreetMap (OSRM), without live traffic. Hill roads are often slower.', 'OpenStreetMap (OSRM) से, लाइव ट्रैफ़िक के बिना। पहाड़ी सड़कें अक्सर धीमी होती हैं।')}</p>
            </>
          ) : null}
          <div className="row-actions">
            <button type="button" className="btn btn-ghost" onClick={() => go('form')}>← {L('Edit trip', 'यात्रा बदलें')}</button>
            <button type="button" className="btn" disabled={!d.route || busy === 'route'} onClick={() => go('plan')}>{L('Day-wise plan', 'दिन-वार प्लान')} <Icon name="arrow" size={16} /></button>
          </div>
        </section>
      ) : null}

      {step === 'plan' ? (
        <section className="stack">
          {(d.itinWarnings || []).map(([k, en, hi]) => <p key={k} className="soft-note warn">{lang === 'hi' ? hi : en}</p>)}
          <div className="row-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (!d.daysEdited || window.confirm(L('Your edits to the days will be replaced. Continue?', 'दिनों में किए आपके बदलाव हट जाएँगे। आगे बढ़ें?'))) generate(d, true); }}>
              ↻ {L('Regenerate', 'फिर से बनाएँ')}</button>
            <span className="small muted">{L('Made from real drive times, your pace and listed places. Tap Edit on any day.', 'असली ड्राइव समय, आपकी रफ़्तार और लिस्टेड जगहों से बना। किसी भी दिन पर बदलें दबाएँ।')}</span>
          </div>
          {(d.days || []).map((x, idx) => (
            <div className="day-card" key={x.day}>
              <div className="day-head">
                <span className="day-num">{L('Day', 'दिन')} {x.day}</span>
                <span className="muted small">{x.date}</span>
                <WeatherChip w={byDay[x.date]} lang={lang} />
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditing(editing === idx ? null : idx)}>{editing === idx ? L('Done', 'हो गया') : L('Edit', 'बदलें')}</button>
              </div>
              {editing === idx ? (
                <div className="stack">
                  <label className="field"><span className="field-label">{L('Title', 'शीर्षक')}</span>
                    <input className="input" value={lang === 'hi' ? x.title_hi || x.title_en : x.title_en} maxLength={160}
                      onChange={(e) => { const days = [...d.days]; days[idx] = { ...x, [lang === 'hi' ? 'title_hi' : 'title_en']: e.target.value }; update({ days, daysEdited: true }); }} /></label>
                  <label className="field"><span className="field-label">{L('Plan (one line per item)', 'प्लान (हर लाइन एक काम)')}</span>
                    <textarea className="input" rows={6} defaultValue={(x.items || []).map((it) => it.text || (lang === 'hi' ? it.hi || it.en : it.en)).join('\n')}
                      onBlur={(e) => { const days = [...d.days]; days[idx] = { ...x, items: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 30).map((t) => ({ kind: 'note', text: t.slice(0, 300) })) }; update({ days, daysEdited: true }); }} /></label>
                  <label className="field"><span className="field-label">{L('Notes', 'नोट्स')}</span>
                    <textarea className="input" rows={2} maxLength={1000} defaultValue={x.notes || ''} onBlur={(e) => { const days = [...d.days]; days[idx] = { ...x, notes: e.target.value }; update({ days, daysEdited: true }); }} /></label>
                </div>
              ) : (
                <>
                  <h3>{lang === 'hi' ? x.title_hi || x.title_en : x.title_en}</h3>
                  <DayItems items={x.items || []} lang={lang} />
                  {x.notes ? <p className="small"><strong>{L('Notes', 'नोट्स')}:</strong> {x.notes}</p> : null}
                </>
              )}
            </div>
          ))}
          <div className="row-actions">
            <button type="button" className="btn btn-ghost" onClick={() => go('route')}>← {L('Route', 'रास्ता')}</button>
            <button type="button" className="btn" onClick={() => go('budget')}>{L('Budget', 'बजट')} <Icon name="arrow" size={16} /></button>
          </div>
        </section>
      ) : null}

      {step === 'budget' && budget ? (
        <BudgetStep d={d} b={budget} lang={lang} defaults={defaultsFor(d, defaults)} update={update} onBack={() => go('plan')} onNext={() => go('report')} />
      ) : null}

      {step === 'report' ? (
        <TripReport d={{ ...d, assumptions: { ...defaultsFor(d, defaults), ...(d.assumptions || {}) } }} places={places} locations={locations} listings={listings} lang={lang}
          actions={(
            <div className="row-actions no-print">
              <button type="button" className="btn" disabled={busy === 'save'} onClick={() => onSave()}>{busy === 'save' ? L('Saving…', 'सेव हो रहा है…') : d.tripId ? L('Save changes', 'बदलाव सेव करें') : L('Save trip', 'ट्रिप सेव करें')}</button>
              <button type="button" className="btn btn-ghost" onClick={onShare}><Icon name="globe" size={16} /> {L('Share', 'शेयर')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => window.print()}><Icon name="doc" size={16} /> {L('Download PDF', 'PDF डाउनलोड')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => go('form')}>{L('Edit', 'बदलें')}</button>
              {d.tripId ? (
                <>
                  <select className="input input-sm" aria-label={L('Trip status', 'ट्रिप की स्थिति')} value={d.status || 'planning'} onChange={(e) => onSave({ status: e.target.value })}>
                    {STATUSES.map(([k, en, hi]) => <option key={k} value={k}>{lang === 'hi' ? hi : en}</option>)}
                  </select>
                  <button type="button" className="btn btn-ghost" onClick={async () => { const copy = { ...d, tripId: null, clientId: null, status: 'draft', title: `${d.title || 'Trip'} (${L('copy', 'कॉपी')})`.slice(0, 160) }; setD(copy); saveDraft(copy); flash(L('Copy made — save it to keep it.', 'कॉपी बनी — रखने के लिए सेव करें।')); }}>{L('Duplicate', 'कॉपी बनाएँ')}</button>
                  <button type="button" className="btn btn-ghost" onClick={async () => { if (!window.confirm(L('Delete this trip?', 'यह ट्रिप हटाएँ?'))) return; try { await deleteTrip(d.tripId); dropDraft(); router.push('/account/trips'); } catch (e) { flash(e.message, true); } }}>{L('Delete', 'हटाएँ')}</button>
                </>
              ) : null}
            </div>
          )} />
      ) : null}
    </div>
  );
}

// Admin-set defaults (Admin → Trip Planner cost assumptions) fill empty rates.
function defaultsFor(d, defaults = {}) {
  const base = defaultAssumptions(d);
  ['fuel_price', 'taxi_per_km', 'food_per_person_day', 'stay_per_night'].forEach((k) => { if (defaults?.[k] != null && defaults[k] !== '') base[k] = defaults[k]; });
  return base;
}

function PlaceChosen({ p, lang, onClear }) {
  return (
    <div className="place-chosen">
      <Icon name="pin" size={18} /><span className="grow"><strong>{placeLabel(p, lang)}</strong>{p.district ? <small className="muted"> · {p.district}</small> : null}</span>
      <button type="button" className="icon-btn" aria-label={lang === 'hi' ? 'बदलें' : 'Change'} onClick={onClear}>✕</button>
    </div>
  );
}

function MapPicker({ lang, onPick, onCancel }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const [pt, setPt] = useState(null);
  const [near, setNear] = useState('');
  useEffect(() => {
    if (!pt) return;
    const ctl = new AbortController();
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&lat=${pt.lat}&lon=${pt.lng}&accept-language=${lang === 'hi' ? 'hi' : 'en'}`, { signal: ctl.signal })
      .then((r) => r.json()).then((j) => setNear(j?.address?.village || j?.address?.town || j?.address?.city || j?.address?.county || j?.name || '')).catch(() => {});
    return () => ctl.abort();
  }, [pt, lang]);
  const points = useMemo(() => (pt ? [{ ...pt, name: near || L('Chosen point', 'चुनी जगह') }] : []), [pt, near]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="panel stack">
      <RouteMap points={points} onPick={setPt} height={300} pickLabel={L('Tap the map to choose a point.', 'जगह चुनने के लिए नक्शे पर टैप करें।')} />
      {pt ? <p className="small">{near ? `${L('Near', 'पास')}: ${near}` : `${pt.lat}, ${pt.lng}`}</p> : null}
      <div className="row-actions">
        <button type="button" className="btn" disabled={!pt} onClick={() => onPick({ name: near || `${pt.lat}, ${pt.lng}`, lat: pt.lat, lng: pt.lng, custom: true, near: near || null })}>{L('Use this point', 'यह जगह लें')}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{L('Cancel', 'रद्द')}</button>
      </div>
    </div>
  );
}

function BudgetStep({ d, b, lang, defaults, update, onBack, onNext }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const a = { ...defaults, ...(d.assumptions || {}) };
  const own = ['car', 'bike'].includes(d.mode);
  const setA = (k, v) => update({ assumptions: { ...(d.assumptions || {}), [k]: v } });
  const field = (k, label, hint, props = {}) => (
    <label className="field" key={k}><span className="field-label">{label}</span>
      <input className="input" type="number" min={0} inputMode="decimal" value={a[k] ?? ''} onChange={(e) => setA(k, e.target.value)} {...props} />
      {hint ? <small className="muted">{hint}</small> : null}</label>
  );
  return (
    <section className="ds-panel stack">
      <h2>{L('Budget (approximate)', 'बजट (लगभग)')}</h2>
      <p className="small muted">{L('Fill in the rates you know. Empty rates are left out (and flagged), never guessed.', 'जो रेट पता हैं वो भरें। ख़ाली रेट छोड़ दिए जाते हैं (और बताए जाते हैं), अंदाज़ा नहीं लगाया जाता।')}</p>
      <div className="form-grid">
        {own ? field('fuel_price', L('Fuel price (₹/litre)', 'पेट्रोल/डीज़ल (₹/लीटर)'), defaults.fuel_price ? L('Admin-set default — change to your pump rate', 'एडमिन का डिफ़ॉल्ट — अपने पंप का रेट डालें') : L('Check your local pump rate', 'अपने पंप का रेट देखें'), { step: 0.01 }) : null}
        {own || d.mode === 'taxi' ? field('mileage', L('Mileage (km/l)', 'माइलेज (किमी/लीटर)'), '', { step: 0.5 }) : null}
        {d.mode === 'taxi' ? field('taxi_per_km', L('Taxi rate (₹/km)', 'टैक्सी रेट (₹/किमी)')) : null}
        {['bus', 'train', 'shared'].includes(d.mode) ? field('fare_per_person', L('Total fare per person (₹)', 'प्रति व्यक्ति कुल किराया (₹)')) : null}
        {field('rooms', L('Rooms per night', 'हर रात कमरे'), '', { min: 1, step: 1 })}
        {field('stay_per_night', L('Stay per room per night (₹)', 'प्रति कमरा प्रति रात (₹)'))}
        {field('food_per_person_day', L('Food per person per day (₹)', 'प्रति व्यक्ति प्रति दिन खाना (₹)'))}
        {field('activities', L('Activities (₹, total)', 'गतिविधियाँ (₹, कुल)'))}
        {field('permits', L('Permits & entry (₹)', 'परमिट और एंट्री (₹)'))}
        {field('local', L('Local transport (₹)', 'लोकल सफ़र (₹)'))}
        {field('tolls', L('Parking & tolls (₹)', 'पार्किंग और टोल (₹)'))}
        {field('other', L('Other (₹)', 'अन्य (₹)'))}
        {field('reserve_pct', L('Emergency reserve (%)', 'आपात रिज़र्व (%)'), '', { max: 50 })}
      </div>
      <table className="table budget-table">
        <thead><tr><th>{L('Category', 'श्रेणी')}</th><th className="right">{L('Estimate', 'अनुमान')}</th><th className="right">{L('Actual spent', 'असल ख़र्च')}</th></tr></thead>
        <tbody>
          {COST_CATS.map(([k, en, hi]) => {
            const line = b.lines[k];
            if (!line || (k === 'fuel' && !own) || (k === 'transport' && own)) return null;
            return (
              <tr key={k}>
                <td>{lang === 'hi' ? hi : en}{line.how ? <div className="small muted">{line.how}</div> : null}</td>
                <td className="right">{line.missing ? <span className="warn-text small">{L('rate missing', 'रेट नहीं')}</span> : inr(line.est)}</td>
                <td className="right"><input className="input input-sm" type="number" min={0} inputMode="numeric" aria-label={`${lang === 'hi' ? hi : en} — ${L('actual', 'असल')}`} value={d.actuals?.[k] ?? ''} onChange={(e) => update({ actuals: { ...(d.actuals || {}), [k]: e.target.value } })} /></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr><th>{L('Total', 'कुल')}</th><th className="right">{inr(b.total)}</th><th className="right">{b.actualTotal ? inr(b.actualTotal) : '—'}</th></tr>
        </tfoot>
      </table>
      <div className="ds-stats">
        <div className="ds-stat"><span className="ds-stat-l">{L('Per person', 'प्रति व्यक्ति')}</span><span className="ds-stat-n">{inr(Math.round(b.perPerson))}</span></div>
        <div className="ds-stat"><span className="ds-stat-l">{L('Per day', 'प्रति दिन')}</span><span className="ds-stat-n">{inr(Math.round(b.perDay))}</span></div>
        <div className="ds-stat"><span className="ds-stat-l">{L('Budget left (estimate)', 'बचा बजट (अनुमान)')}</span><span className="ds-stat-n">{b.remaining == null ? '—' : inr(Math.round(b.remaining))}</span></div>
        <div className="ds-stat"><span className="ds-stat-l">{L('Budget left (actual)', 'बचा बजट (असल)')}</span><span className="ds-stat-n">{b.actualRemaining == null || !b.actualTotal ? '—' : inr(Math.round(b.actualRemaining))}</span></div>
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← {L('Day plan', 'दिन-वार')}</button>
        <button type="button" className="btn" onClick={onNext}>{L('Trip report', 'ट्रिप रिपोर्ट')} <Icon name="arrow" size={16} /></button>
      </div>
    </section>
  );
}
