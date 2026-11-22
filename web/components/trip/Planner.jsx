'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchRoute, routeIsFresh, routeKey, pickLeg, legPairs, fmtKm, fmtDur, buildItinerary, weatherFor, weatherWarnings,
  computeBudget, COST_CATS, defaultAssumptions, DEFAULT_MILEAGE, isoAdd, istToday, seasonNotes,
} from '@/lib/trip/engine';
import { PREFS, PACES, MODES, MAX_DESTS, blank, loadDraft, saveDraft, dropDraft, validate, daysOf, fmtD, placeLabel, prefThemes, itinKey } from '@/lib/trip/common';
import { saveTrip } from '@/lib/trip/save';
import { inr } from '@/lib/format';
import { PlacePicker } from './PlacePicker';
import { RouteMap } from './RouteMap';
import { TripReport } from './TripReport';
import { Icon } from '../Icon';
import { WeatherChip } from './WeatherChip';

const STEPS = [['Details', 'जानकारी'], ['Route', 'रूट'], ['Day plan', 'दिन-वार प्लान'], ['Budget', 'बजट'], ['Summary', 'सारांश']];

export function Planner({ lang, places, locs, themes, listings, defaults, pickerLabels, start: startSlug, fromItinerary, signedIn }) {
  const L = useCallback((en, hi) => (lang === 'hi' ? hi : en), [lang]);
  const router = useRouter();
  const [d, setD] = useState(null);
  const [step, setStep] = useState(0);
  const [errs, setErrs] = useState({});
  const [msg, setMsg] = useState('');

  // Load the draft kept on this device (or start one from a place / ready-made itinerary).
  useEffect(() => {
    let x = loadDraft() || blank();
    const loc = startSlug && locs.find((l) => l.slug === startSlug);
    if (loc && loc.lat != null && !x.dests.some((p) => p?.location_id === loc.id)) {
      const pl = places.find((p) => p.location_id === loc.id) || { id: null, name: loc.name, name_hi: loc.name_hi, district: loc.district, lat: loc.lat, lng: loc.lng, location_id: loc.id };
      x = { ...blank(), dests: [{ ...pl, lat: Number(pl.lat), lng: Number(pl.lng) }] };
    }
    if (fromItinerary) {
      const stops = (fromItinerary.days || []).map((dd) => locs.find((l) => l.slug === dd.location)).filter((l, i, a) => l && l.lat != null && a.findIndex((y) => y?.id === l.id) === i);
      if (stops.length) x = { ...blank(), title: fromItinerary.title, dests: stops.map((l) => ({ id: null, name: l.name, name_hi: l.name_hi, district: l.district, lat: l.lat, lng: l.lng, location_id: l.id })) };
    }
    setD(x);
  }, [startSlug, fromItinerary, locs, places]);

  const update = useCallback((patch) => setD((cur) => { const n = { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) }; saveDraft(n); return n; }), []);

  if (!d) return <div className="loading"><span className="spinner" /> …</div>;

  const go = (n) => {
    if (n > 0) { const e = validate(d, L); setErrs(e); if (Object.keys(e).length) { setStep(0); setMsg(L('Please fix the marked fields.', 'कृपया लाल निशान वाली जानकारी ठीक करें।')); return; } }
    setMsg(''); setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="tp">
      <ol className="tp-steps" aria-label={L('Steps', 'चरण')}>
        {STEPS.map((s, i) => (
          <li key={i} className={i < step ? 'done' : i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined}>
            <button type="button" onClick={() => go(i)}><span>{i + 1}</span>{L(s[0], s[1])}</button>
          </li>
        ))}
      </ol>
      {msg ? <p className="form-err" role="alert">{msg}</p> : null}
      {step === 0 ? <Details d={d} update={update} errs={errs} L={L} lang={lang} places={places} pickerLabels={pickerLabels} defaults={defaults} /> : null}
      {step === 1 ? <RouteStep d={d} update={update} L={L} lang={lang} /> : null}
      {step === 2 ? <PlanStep d={d} update={update} L={L} lang={lang} places={places} locs={locs} listings={listings} /> : null}
      {step === 3 ? <BudgetStep d={d} update={update} L={L} defaults={defaults} /> : null}
      {step === 4 ? (
        <TripReport d={d} mode="draft" lang={lang} places={places} locs={locs} themes={themes} listings={listings}
          actions={<SaveBar d={d} update={update} L={L} signedIn={signedIn} router={router} />} />
      ) : null}
      <div className="tp-nav no-print">
        {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}>← {L('Back', 'पीछे')}</button> : <span />}
        {step < 4 ? <button type="button" className="btn" onClick={() => go(step + 1)}>{L('Next', 'आगे')} →</button> : null}
      </div>
      {step === 0 ? (
        <p className="small muted center">
          <button type="button" className="link" onClick={() => { if (window.confirm(L('Clear this plan and start again?', 'यह प्लान हटाकर नए से शुरू करें?'))) { dropDraft(); setD(blank()); setErrs({}); } }}>
            {L('Start a new plan', 'नया प्लान शुरू करें')}</button>
        </p>
      ) : null}
    </div>
  );
}

/* ---------------- Step 1: details ---------------- */
function Details({ d, update, errs, L, lang, places, pickerLabels, defaults }) {
  const days = daysOf(d) || '';
  const setDays = (n) => { const v = Math.max(1, Math.min(30, Number(n) || 1)); update({ ret: d.depart ? isoAdd(d.depart, v - 1) : '', _days: v }); };
  const setDepart = (v) => update((cur) => ({ depart: v, ret: v ? isoAdd(v, (daysOf(cur) || cur._days || 3) - 1) : '' }));
  const own = ['car', 'bike'].includes(d.mode);
  const a = { ...defaultAssumptions(d), ...(d.assumptions || {}) };
  const moveDest = (i, dir) => update((cur) => { const list = [...cur.dests]; const j = i + dir; if (j < 0 || j >= list.length) return {}; [list[i], list[j]] = [list[j], list[i]]; return { dests: list }; });
  const err = (k) => (errs[k] ? <p className="form-err" role="alert">{errs[k]}</p> : null);
  return (
    <section className="ds-panel tp-form">
      <h2>{L('Plan your trip', 'अपनी यात्रा प्लान करें')}</h2>
      <label className="field"><span className="field-label">{L('Trip name', 'यात्रा का नाम')}</span>
        <input className="input" value={d.title} maxLength={160} placeholder={L('e.g. Kumaon in autumn', 'जैसे शरद में कुमाऊँ')} onChange={(e) => update({ title: e.target.value })} /></label>

      <div className="field"><label className="field-label" htmlFor="tp-start">{L('Starting from', 'कहाँ से शुरू')} *</label>
        <PlacePicker id="tp-start" value={d.start} onChange={(p) => update({ start: p })} places={places} lang={lang} labels={pickerLabels} />{err('start')}</div>

      <div className="field"><span className="field-label">{L('Destinations (in order)', 'मंज़िलें (क्रम से)')} *</span>
        <ol className="tp-dests">
          {d.dests.map((p, i) => (
            <li key={i}>
              <span className="tp-num">{i + 1}</span>
              <div className="grow"><PlacePicker value={p} onChange={(v) => update((cur) => { const list = [...cur.dests]; list[i] = v; return { dests: list }; })} places={places} lang={lang} labels={pickerLabels} /></div>
              <div className="tp-dest-btns">
                <button type="button" className="icon-link" aria-label={L('Move up', 'ऊपर')} disabled={i === 0} onClick={() => moveDest(i, -1)}>↑</button>
                <button type="button" className="icon-link" aria-label={L('Move down', 'नीचे')} disabled={i === d.dests.length - 1} onClick={() => moveDest(i, 1)}>↓</button>
                <button type="button" className="icon-link" aria-label={L('Remove', 'हटाएँ')} disabled={d.dests.length === 1} onClick={() => update((cur) => ({ dests: cur.dests.filter((_, k) => k !== i) }))}>✕</button>
              </div>
            </li>
          ))}
        </ol>
        {d.dests.length < MAX_DESTS ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => update((cur) => ({ dests: [...cur.dests, null] }))}><Icon name="plus" size={16} /> {L('Add destination', 'मंज़िल जोड़ें')}</button> : null}
        {err('dests')}
        <label className="check"><input type="checkbox" checked={d.roundTrip !== false} onChange={(e) => update({ roundTrip: e.target.checked })} /> {L('Return to the start (round trip)', 'शुरुआत पर वापस (आना-जाना)')}</label>
      </div>

      <div className="tp-grid">
        <label className="field"><span className="field-label">{L('Start date', 'शुरुआत की तारीख़')} *</span>
          <input className="input" type="date" min={istToday()} value={d.depart} onChange={(e) => setDepart(e.target.value)} />{err('depart')}</label>
        <label className="field"><span className="field-label">{L('Number of days', 'कितने दिन')} *</span>
          <input className="input" type="number" min={1} max={30} inputMode="numeric" value={days || d._days || ''} onChange={(e) => setDays(e.target.value)} />
          {d.ret ? <small className="muted">{L('Return', 'वापसी')}: {fmtD(d.ret, lang)}</small> : null}{err('ret')}</label>
        <label className="field"><span className="field-label">{L('Adults', 'वयस्क')}</span>
          <input className="input" type="number" min={1} max={40} value={d.adults} onChange={(e) => update({ adults: Math.max(0, Number(e.target.value) || 0) })} />{err('people')}</label>
        <label className="field"><span className="field-label">{L('Children', 'बच्चे')}</span>
          <input className="input" type="number" min={0} max={20} value={d.children} onChange={(e) => update({ children: Math.max(0, Number(e.target.value) || 0) })} /></label>
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0 }}><legend className="field-label">{L('Pace', 'रफ़्तार')}</legend>
        <div className="tp-choices">
          {PACES.map(([k, en, hi, sen, shi]) => (
            <label key={k} className={`tp-choice${d.pace === k ? ' on' : ''}`}><input type="radio" name="pace" checked={d.pace === k} onChange={() => update({ pace: k })} />
              <strong>{L(en, hi)}</strong><small>{L(sen, shi)}</small></label>
          ))}
        </div>
      </fieldset>

      <div className="tp-grid">
        <label className="field"><span className="field-label">{L('Travel mode', 'कैसे जाएँगे')}</span>
          <select className="input" value={d.mode} onChange={(e) => update((cur) => ({ mode: e.target.value, assumptions: { ...(cur.assumptions || {}), mileage: DEFAULT_MILEAGE[e.target.value] || 15 } }))}>
            {MODES.map(([k, en, hi]) => <option key={k} value={k}>{L(en, hi)}</option>)}
          </select></label>
        {own ? (
          <label className="field"><span className="field-label">{L('Vehicle mileage (km/litre)', 'गाड़ी का माइलेज (किमी/लीटर)')}</span>
            <input className="input" type="number" min={1} max={120} step={0.5} value={a.mileage} onChange={(e) => update((cur) => ({ assumptions: { ...(cur.assumptions || {}), mileage: e.target.value } }))} /></label>
        ) : null}
        <label className="field"><span className="field-label">{L('Total budget (₹, optional)', 'कुल बजट (₹, वैकल्पिक)')}</span>
          <input className="input" type="number" min={0} step={500} inputMode="numeric" value={d.budget} onChange={(e) => update({ budget: e.target.value })} />{err('budget')}</label>
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0 }}><legend className="field-label">{L('What do you like?', 'आपको क्या पसंद है?')}</legend>
        <div className="chips">
          {PREFS.map(([k, en, hi]) => {
            const on = d.prefs.includes(k);
            return <button type="button" key={k} className={`chip chip-btn${on ? ' on' : ''}`} aria-pressed={on}
              onClick={() => update((cur) => ({ prefs: on ? cur.prefs.filter((x) => x !== k) : [...cur.prefs, k] }))}>{L(en, hi)}</button>;
          })}
        </div>
      </fieldset>
      {defaults?.fuel_price && own ? <p className="small muted">{L(`Fuel price used: ₹${defaults.fuel_price}/litre (set by admin${defaults.updated_on ? ` on ${defaults.updated_on}` : ''}). You can change it in Budget.`, `ईंधन रेट: ₹${defaults.fuel_price}/लीटर (एडमिन द्वारा${defaults.updated_on ? `, ${defaults.updated_on}` : ''})। बजट में बदल सकते हैं।`)}</p> : null}
    </section>
  );
}

/* ---------------- Step 2: route ---------------- */
function RouteStep({ d, update, L, lang }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState([0, 0]);
  const run = useCallback(async (force = false) => {
    setBusy(true);
    const route = await fetchRoute(d, { previous: force ? null : d.route, onProgress: (a, b) => setProgress([a, b]) });
    update({ route });
    setBusy(false);
  }, [d, update]);
  useEffect(() => { if (!routeIsFresh(d) && !busy) run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pairs = legPairs(d);
  const r = routeIsFresh(d) ? d.route : null;
  const dur = (s) => fmtDur(s, lang === 'hi');
  const ERR = { no_route: L('No road route found between these places.', 'इन जगहों के बीच सड़क रास्ता नहीं मिला।'), offline: L('You are offline.', 'आप ऑफ़लाइन हैं।'), failed: L('Route service did not answer. Try again.', 'रूट सेवा ने जवाब नहीं दिया। फिर कोशिश करें।') };
  return (
    <section className="ds-panel">
      <h2>{L('Road route', 'सड़क रास्ता')}</h2>
      {busy ? <p className="soft-note" role="status"><span className="spinner" /> {L(`Calculating road route… ${progress[0]}/${progress[1] || pairs.length}`, `सड़क रास्ता निकाल रहे हैं… ${progress[0]}/${progress[1] || pairs.length}`)}</p> : null}
      {r ? <RouteMap d={d} labels={{ mapError: L('Map could not load.', 'मैप लोड नहीं हुआ।'), mapLabel: L('Route map', 'रूट मैप') }} /> : null}
      {r ? (
        <>
          <div className="tp-totals">
            <div><span>{L('Total distance', 'कुल दूरी')}</span><strong>{fmtKm(r.total_km)}</strong></div>
            <div><span>{L('Driving time', 'ड्राइव समय')}</span><strong>{dur(r.total_secs)}</strong></div>
          </div>
          {r.missing ? <p className="soft-note warn">{L(`${r.missing} stretch(es) could not be calculated.`, `${r.missing} हिस्से नहीं निकल पाए।`)}</p> : null}
          <ol className="tp-legs">
            {r.legs.map((leg, i) => (
              <li key={leg.key}>
                <div className="grow"><strong>{pairs[i]?.ret ? `${L('Return', 'वापसी')}: ` : ''}{placeLabel(pairs[i]?.from, lang)} → {placeLabel(pairs[i]?.to, lang)}</strong>
                  {leg.error ? <span className="form-err">{ERR[leg.error] || ERR.failed}</span> : <span className="muted"> {fmtKm(pickLeg(leg).km)} · {dur(pickLeg(leg).secs)}</span>}</div>
                {!leg.error && leg.alts?.length ? (
                  <select className="input input-sm" aria-label={L('Choose route', 'रास्ता चुनें')} value={leg.chosen || 0}
                    onChange={(e) => update((cur) => { const legs = cur.route.legs.map((l, k) => (k === i ? { ...l, chosen: Number(e.target.value) } : l)); const nr = { ...cur.route, legs }; const ok = legs.filter((l) => !l.error).map(pickLeg); return { route: { ...nr, total_km: ok.reduce((s, l) => s + l.km, 0), total_secs: ok.reduce((s, l) => s + l.secs, 0) } }; })}>
                    <option value={0}>{L('Fastest', 'सबसे तेज़')} · {fmtKm(leg.km)}</option>
                    {leg.alts.map((a, k) => <option key={k} value={k + 1}>{L('Alternative', 'दूसरा')} {k + 1} · {fmtKm(a.km)} · {dur(a.secs)}</option>)}
                  </select>
                ) : null}
              </li>
            ))}
          </ol>
          <div className="row-actions"><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(true)}>{L('Recalculate', 'फिर से निकालें')}</button></div>
        </>
      ) : null}
      <p className="small muted">{L('Road routes from OpenStreetMap (OSRM). Live traffic, toll amounts and road closures are not included — check ', 'सड़क रास्ते OpenStreetMap (OSRM) से। लाइव ट्रैफ़िक, टोल रकम और बंद सड़कें शामिल नहीं — देखें ')}
        <a href="https://rajmargyatra.nhai.gov.in/" target="_blank" rel="noopener noreferrer">NHAI Rajmargyatra</a> · <a href="https://usdma.uk.gov.in/" target="_blank" rel="noopener noreferrer">USDMA</a>.</p>
    </section>
  );
}

/* ---------------- Step 3: day plan + weather ---------------- */
function PlanStep({ d, update, L, lang, places, locs, listings }) {
  const key = itinKey(d, routeKey);
  const [warnings, setWarnings] = useState([]);
  const [weather, setWeather] = useState({});
  const generate = useCallback(() => {
    const res = buildItinerary({ d, route: d.route, places, locs, listings, prefThemes: prefThemes(d) });
    setWarnings(res.warnings || []);
    update({ days: res.days, daysKey: key, daysEdited: false, itinWarnings: res.warnings || [] });
  }, [d, places, locs, listings, key, update]);
  useEffect(() => {
    if (!routeIsFresh(d)) return;
    if (!d.days || (d.daysKey !== key && !d.daysEdited)) generate(); else setWarnings(d.itinWarnings || []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Weather for each overnight place on its dates (forecast up to 16 days, then labelled historical average).
  useEffect(() => {
    if (!d.days?.length) return;
    const groups = new Map();
    d.days.forEach((day) => { const p = day.night || d.dests[d.dests.length - 1]; if (!p) return; const k = `${p.lat},${p.lng}`; if (!groups.has(k)) groups.set(k, { p, dates: [] }); groups.get(k).dates.push(day.date); });
    let alive = true;
    Promise.all([...groups.entries()].slice(0, 8).map(async ([k, g]) => [k, await weatherFor(g.p, g.dates).catch(() => null)]))
      .then((list) => { if (alive) setWeather(Object.fromEntries(list)); });
    return () => { alive = false; };
  }, [d.days, d.dests]);

  if (!routeIsFresh(d)) return <section className="ds-panel"><p className="soft-note warn">{L('Calculate the route first (step 2).', 'पहले रूट निकालें (चरण 2)।')}</p></section>;
  const editDay = (i, patch) => update((cur) => ({ days: cur.days.map((x, k) => (k === i ? { ...x, ...patch } : x)), daysEdited: true }));
  const notes = d.depart && d.ret ? seasonNotes(d.depart, d.ret) : [];
  return (
    <section className="ds-panel">
      <h2>{L('Day-wise plan', 'दिन-वार प्लान')}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (!d.daysEdited || window.confirm(L('Your edits to the days will be replaced. Continue?', 'दिनों में किए आपके बदलाव हट जाएँगे। आगे बढ़ें?'))) generate(); }}>{L('Regenerate', 'फिर से बनाएँ')}</button></h2>
      {warnings.map((w) => <p key={w[0]} className="soft-note warn">{L(w[1], w[2])}</p>)}
      {notes.map((n, i) => <p key={i} className="soft-note">{L(n[0], n[1])}</p>)}
      <ol className="tp-days">
        {(d.days || []).map((day, i) => {
          const p = day.night || d.dests[d.dests.length - 1];
          const w = p ? weather[`${p.lat},${p.lng}`]?.days?.[day.date] : null;
          return (
            <li key={i} className="tp-day">
              <div className="tp-day-head">
                <span className="tr-day-pill">{L('Day', 'दिन')} {day.day}</span>
                <span className="muted small">{fmtD(day.date, lang)}</span>
                {w ? <WeatherChip w={w} L={L} /> : null}
              </div>
              <input className="input tp-day-title" aria-label={L('Day title', 'दिन का शीर्षक')} value={lang === 'hi' ? day.title_hi || day.title_en : day.title_en}
                onChange={(e) => editDay(i, lang === 'hi' ? { title_hi: e.target.value } : { title_en: e.target.value })} />
              <ul className="tp-items">
                {day.items.map((it, k) => (
                  <li key={k} className={`tp-item tp-${it.kind}`}>{it.time ? <b>{it.time} </b> : null}{it.text || (lang === 'hi' ? it.hi || it.en : it.en)}
                    <button type="button" className="tp-x" aria-label={L('Remove', 'हटाएँ')} onClick={() => editDay(i, { items: day.items.filter((_, j) => j !== k) })}>✕</button></li>
                ))}
              </ul>
              {w ? weatherWarnings(w).map((x) => <p key={x[0]} className="small tr-warn">⚠ {L(x[1], x[2])}</p>) : null}
              <textarea className="input" rows={2} maxLength={1000} placeholder={L('Your notes for this day', 'इस दिन के लिए आपके नोट्स')} value={day.notes || ''} onChange={(e) => editDay(i, { notes: e.target.value })} />
              {day.night ? <p className="small muted">{L('Night at', 'रात')}: {placeLabel(day.night, lang)}{day.stay?.options?.length ? ` · ${day.stay.options.length} ${L('stay(s) listed', 'होमस्टे सूची में')}` : ''}</p> : null}
            </li>
          );
        })}
      </ol>
      <p className="small muted">{L('Plan built by rules from real drive times, your pace and our place data. Times are estimates.', 'प्लान असली ड्राइव समय, आपकी रफ़्तार और हमारी जगहों की जानकारी से नियमों के आधार पर बना है। समय अनुमान है।')}</p>
    </section>
  );
}

/* ---------------- Step 4: budget ---------------- */
function BudgetStep({ d, update, L, defaults }) {
  // Fill empty money fields once from the admin's defaults (labelled; the traveller can change them).
  useEffect(() => {
    const a = d.assumptions || {};
    const fill = {};
    [['fuel_price', d.mode === 'bike' ? defaults?.fuel_price : defaults?.fuel_price], ['taxi_per_km', defaults?.taxi_per_km], ['stay_per_night', defaults?.stay_per_night], ['food_per_person_day', defaults?.food_per_person_day]]
      .forEach(([k, v]) => { if ((a[k] === undefined || a[k] === '') && v != null && v !== '') fill[k] = v; });
    if (Object.keys(fill).length) update((cur) => ({ assumptions: { ...defaultAssumptions(cur), ...(cur.assumptions || {}), ...fill } }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const b = computeBudget(d, routeIsFresh(d) ? d.route : null, d.days);
  const a = b.a;
  const own = ['car', 'bike'].includes(d.mode);
  const setA = (k, v) => update((cur) => ({ assumptions: { ...defaultAssumptions(cur), ...(cur.assumptions || {}), [k]: v } }));
  const setActual = (k, v) => update((cur) => ({ actuals: { ...(cur.actuals || {}), [k]: v } }));
  const field = (k, label, hint, opts = {}) => (
    <label className="field" key={k}><span className="field-label">{label}</span>
      <input className="input" type="number" min={0} step={opts.step || 1} inputMode="decimal" value={a[k] ?? ''} placeholder={opts.placeholder} onChange={(e) => setA(k, e.target.value)} />
      {hint ? <small className="muted">{hint}</small> : null}</label>
  );
  return (
    <section className="ds-panel">
      <h2>{L('Budget', 'बजट')}</h2>
      <p className="small muted">{L('All amounts are approximate estimates, not quotes. Fuel = distance ÷ mileage × fuel price.', 'सभी रकम लगभग अनुमान हैं, पक्के दाम नहीं। ईंधन = दूरी ÷ माइलेज × ईंधन रेट।')}</p>
      <div className="tp-grid">
        {own ? field('fuel_price', L('Fuel price (₹/litre)', 'ईंधन रेट (₹/लीटर)'), defaults?.fuel_price ? L(`Admin rate ₹${defaults.fuel_price}${defaults.updated_on ? ` (${defaults.updated_on})` : ''} — check your pump`, `एडमिन रेट ₹${defaults.fuel_price}${defaults.updated_on ? ` (${defaults.updated_on})` : ''} — अपने पंप पर देखें`) : null, { step: 0.01 }) : null}
        {own ? field('mileage', L('Mileage (km/litre)', 'माइलेज (किमी/लीटर)'), null, { step: 0.5 }) : null}
        {d.mode === 'taxi' ? field('taxi_per_km', L('Taxi rate (₹/km)', 'टैक्सी रेट (₹/किमी)'), null) : null}
        {!own && d.mode !== 'taxi' ? field('fare_per_person', L('Fare per person, whole trip (₹)', 'प्रति व्यक्ति किराया, पूरी यात्रा (₹)'), null) : null}
        {field('rooms', L('Rooms', 'कमरे'), null)}
        {field('stay_per_night', L('Stay per room per night (₹)', 'प्रति कमरा प्रति रात (₹)'), null)}
        {field('food_per_person_day', L('Food per person per day (₹)', 'प्रति व्यक्ति प्रति दिन खाना (₹)'), null)}
        {field('local_km_per_day', L('Local sightseeing km per stay day', 'रुकने वाले दिन लोकल घूमना (किमी)'), null)}
        {field('activities', L('Activities (₹)', 'गतिविधियाँ (₹)'), null)}
        {field('permits', L('Permits & entry fees (₹)', 'परमिट और एंट्री (₹)'), null)}
        {field('local', L('Local transport (₹)', 'लोकल सफ़र (₹)'), null)}
        {field('tolls', L('Parking & tolls (₹)', 'पार्किंग और टोल (₹)'), null)}
        {field('other', L('Other (₹)', 'अन्य (₹)'), null)}
        {field('reserve_pct', L('Emergency reserve (%)', 'आपात रिज़र्व (%)'), null)}
      </div>
      <div className="table-wrap">
        <table className="table tp-budget">
          <thead><tr><th>{L('Category', 'श्रेणी')}</th><th className="num">{L('Estimate', 'अनुमान')}</th><th className="num">{L('Actual spent', 'असल ख़र्च')}</th></tr></thead>
          <tbody>
            {COST_CATS.map(([k, en, hi]) => {
              const line = b.lines[k];
              if (!line || (line.est === 0 && !line.missing && !d.actuals?.[k] && ['fuel', 'transport'].includes(k) && !line.how)) return null;
              return (
                <tr key={k}>
                  <td>{L(en, hi)}{line.how ? <small className="muted block">{line.how}</small> : null}</td>
                  <td className="num">{line.missing ? <span className="muted">{L('add rate above', 'ऊपर रेट भरें')}</span> : inr(line.est)}</td>
                  <td className="num"><input className="input input-sm" type="number" min={0} inputMode="numeric" aria-label={`${L(en, hi)} ${L('actual', 'असल')}`} value={d.actuals?.[k] ?? ''} onChange={(e) => setActual(k, e.target.value)} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><th>{L('Total', 'कुल')}</th><th className="num">{inr(b.total)}</th><th className="num">{inr(b.actualTotal)}</th></tr>
          </tfoot>
        </table>
      </div>
      <div className="tp-totals">
        <div><span>{L('Per person', 'प्रति व्यक्ति')}</span><strong>{inr(Math.round(b.perPerson))}</strong></div>
        <div><span>{L('Per day', 'प्रति दिन')}</span><strong>{inr(Math.round(b.perDay))}</strong></div>
        {b.remaining != null ? <div><span>{L('Left from budget (estimate)', 'बजट में बचा (अनुमान)')}</span><strong className={b.remaining < 0 ? 'neg' : ''}>{inr(Math.round(b.remaining))}</strong></div> : null}
        {b.actualRemaining != null && b.actualTotal ? <div><span>{L('Left after actual spend', 'असल ख़र्च के बाद बचा')}</span><strong className={b.actualRemaining < 0 ? 'neg' : ''}>{inr(Math.round(b.actualRemaining))}</strong></div> : null}
      </div>
      {b.missing.length ? <p className="soft-note warn">{L('Some rates are empty, so the total is incomplete.', 'कुछ रेट ख़ाली हैं, इसलिए कुल अधूरा है।')}</p> : null}
    </section>
  );
}

/* ---------------- Summary: save ---------------- */
function SaveBar({ d, update, L, signedIn, router }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="row-actions no-print">
      <button type="button" className="btn" disabled={busy} onClick={async () => {
        if (!signedIn) { saveDraft(d); router.push('/login?next=/plan/new'); return; }
        setBusy(true); setErr('');
        try {
          const id = await saveTrip(d);
          update({ tripId: id, status: d.status === 'draft' ? 'planning' : d.status });
          dropDraft();
          router.push(`/trip/${id}`);
        } catch (e) { setErr(e.login ? L('Please sign in to save.', 'सेव करने के लिए लॉगिन करें।') : e.message || String(e)); setBusy(false); }
      }}>{busy ? L('Saving…', 'सेव हो रहा है…') : d.tripId ? L('Save changes', 'बदलाव सेव करें') : L('Save trip', 'ट्रिप सेव करें')}</button>
      {!signedIn ? <small className="muted">{L('Sign in to save. Your plan stays on this device meanwhile.', 'सेव करने के लिए लॉगिन करें। तब तक प्लान इसी डिवाइस में रहेगा।')}</small> : null}
      {err ? <p className="form-err" role="alert">{err}</p> : null}
    </div>
  );
}
