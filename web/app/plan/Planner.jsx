'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchRoute, routeIsFresh, routeKey, buildItinerary, computeBudget, defaultAssumptions, pickLeg, tripPoints, legPairs, distanceKm } from '@/lib/trip/engine';
import { PREFS, PACES, MODES, STATUSES, MAX_DESTS, WHO, WHO_KEYS, whoOf, VEHICLES, FUELS, blank, loadDraft, saveDraft, dropDraft, slim, placeLabel, tripDays, validate, prefThemes, todayISO } from '@/lib/trip/common';
import { saveTrip, shareLink, deleteTrip } from '@/lib/trip/save';
import { fetchFuelPrices, fetchRoutePois } from '@/lib/trip/live';
import { inr } from '@/lib/format';
import { PlaceSearch } from '@/components/PlaceSearch';
import { Icon } from '@/components/Icon';
import { RouteMap } from '@/components/trip/RouteMap';
import { RouteLegs } from '@/components/trip/RouteLegs';
import { LiveCost, LiveBar } from '@/components/trip/LiveCost';
import { CostStep } from '@/components/trip/CostStep';
import { LocationPicker } from '@/components/trip/LocationPicker';
import { TripReport } from '@/components/trip/TripReport';
import { useWeather } from '@/components/trip/useWeather';
import { WeatherChip, DayItems, km, dur } from '@/components/trip/bits';
import './planner.css';

const STEPS = ['plan', 'days', 'cost', 'report'];
const itinKey = (d) => [routeKey(d), (d.route?.legs || []).map((l) => l.chosen || 0).join(''), d.depart, d.ret, d.pace, [...d.prefs].sort().join(','), d.roundTrip !== false, d.mode].join('#');
const filled = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== '' && v != null));
const placesReady = (d) => d.start && d.dests.length && d.dests.every(Boolean);

export function Planner({ lang, places, locations, listings, defaults, searchLabels, signedIn, initial }) {
  const router = useRouter();
  const L = useCallback((en, hi) => (lang === 'hi' ? hi : en), [lang]);
  const [d, setD] = useState(null);
  const [step, setStep] = useState('plan');
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [progress, setProgress] = useState(null);
  const [editing, setEditing] = useState(null);
  const [picker, setPicker] = useState(null); // 'start' | destination index
  const [layers, setLayers] = useState({ fuel: true, toll: true, stay: false });
  const [liveResults, setLive] = useState({ fuel: null, pois: null });
  const latest = useRef(null);

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
  useEffect(() => { latest.current = d; }, [d]);

  const update = useCallback((patch) => setD((cur) => { const n = { ...cur, ...patch }; saveDraft(n); return n; }), []);
  const flash = (text, err = false) => { setMsg({ text, err }); setTimeout(() => setMsg(null), 4000); };

  // ---------- route (runs by itself once the start and every stop are chosen) ----------
  const runRoute = useCallback(async (cur) => {
    setBusy('route'); setProgress([0, legPairs(cur).length]);
    const route = await fetchRoute(cur, { previous: cur.route, onProgress: (a, b) => setProgress([a, b]) });
    setBusy(''); setProgress(null);
    if (latest.current && routeKey(latest.current) === route.key) update({ route });
  }, [update]);
  const rk = d && placesReady(d) ? routeKey(d) : null;
  useEffect(() => {
    if (!rk || busy === 'route' || routeIsFresh(latest.current)) return undefined;
    const t = setTimeout(() => runRoute(latest.current), 700);
    return () => clearTimeout(t);
  }, [rk, busy, runRoute]);

  // ---------- live data owned by Codex (fuel price API, pumps and tolls on the route) ----------
  const startKey = d?.start ? `${d.start.lat},${d.start.lng}` : '';
  useEffect(() => {
    if (!startKey) return undefined;
    let alive = true;
    fetchFuelPrices(latest.current.start).then((r) => { if (alive) setLive((s) => ({ ...s, fuel: { key: startKey, result: r } })); }).catch(() => { if (alive) setLive((s) => ({ ...s, fuel: { key: startKey, result: { status: 'error' } } })); });
    return () => { alive = false; };
  }, [startKey]);
  const vehicleClass = d ? (d.mode === 'car' || d.mode === 'taxi' ? d.assumptions?.vehicle || d.mode : d.mode) : '';
  const chosenKey = d?.route ? `${d.route.key}|${d.route.legs.map((l) => l.chosen || 0).join(',')}|${vehicleClass}|${rk}` : '';
  useEffect(() => {
    if (!chosenKey || !routeIsFresh(latest.current)) return undefined;
    let alive = true;
    fetchRoutePois(latest.current.route, vehicleClass).then((r) => { if (alive) setLive((s) => ({ ...s, pois: { key: chosenKey, result: r } })); }).catch(() => { if (alive) setLive((s) => ({ ...s, pois: { key: chosenKey, result: { status: 'error' } } })); });
    return () => { alive = false; };
  }, [chosenKey, vehicleClass]);
  const live = useMemo(() => ({
    fuel: liveResults.fuel?.key === startKey ? liveResults.fuel.result : null,
    pois: liveResults.pois?.key === chosenKey && d && routeIsFresh(d) ? liveResults.pois.result : null,
  }), [liveResults, startKey, chosenKey, d]);

  // ---------- itinerary ----------
  const generate = useCallback((cur, force = false) => {
    const key = itinKey(cur);
    if (!force && cur.days && (cur.daysKey === key || cur.daysEdited)) return;
    const res = buildItinerary({ d: cur, route: cur.route, places, locs: locations, listings, prefThemes: prefThemes(cur) });
    update({ days: res.days, daysKey: key, daysEdited: false, itinWarnings: res.warnings, needDays: res.needDays });
  }, [places, locations, listings, update]);
  useEffect(() => {
    if (d && step !== 'plan' && routeIsFresh(d)) generate(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, d?.route?.key]);

  // ---------- automatic cost inputs ----------
  const auto = useMemo(() => {
    const a = {};
    if (!d) return a;
    const ft = d.assumptions?.fuel_type || 'petrol';
    const fp = live.fuel?.status === 'ok' ? live.fuel.prices?.[ft] : null;
    if (fp?.price) { a.fuel_price = fp.price; a.fuelInfo = { area: live.fuel.area, date: fp.date }; }
    if (live.pois?.status === 'ok' && d.route && ['car', 'taxi', 'bike'].includes(d.mode)) {
      const tolls = d.route.legs.flatMap((l) => (live.pois.legs?.[l.key] || []).filter((p) => p.kind === 'toll'));
      a.tollInfo = { count: tolls.length, unknown: tolls.filter((p) => p.rate == null).length };
      if (tolls.some((p) => p.rate != null)) a.tolls = tolls.reduce((s, p) => s + (p.rate ?? 0), 0);
    }
    return a;
  }, [d, live]);
  const effective = useMemo(() => {
    if (!d) return null;
    const { fuelInfo, tollInfo, ...autoRates } = auto; // eslint-disable-line no-unused-vars
    return { ...defaultsFor(d, defaults), ...autoRates, ...filled(d.assumptions) };
  }, [d, auto, defaults]);
  const budget = useMemo(() => (d && d.depart && d.ret && effective ? computeBudget({ ...d, assumptions: effective }, d.route, d.days) : null), [d, effective]);

  // ---------- map data ----------
  const points = useMemo(() => (d ? tripPoints(d) : []), [d?.start, d?.dests]); // eslint-disable-line react-hooks/exhaustive-deps
  const legs = useMemo(() => d?.route?.legs || [], [d?.route]); // eslint-disable-line react-hooks/exhaustive-deps
  const pois = useMemo(() => {
    if (!d) return [];
    const list = [];
    if (live.pois?.status === 'ok' && d.route) {
      d.route.legs.forEach((l, li) => (live.pois.legs?.[l.key] || []).forEach((p) => list.push({ ...p, leg: li + 1, sub: p.kind === 'toll' ? (p.rate != null ? `${inr(p.rate)} · ${L('one way', 'एक तरफ़')}` : L('Rate not known', 'रेट पता नहीं')) : p.brand || '' })));
    }
    const dests = d.dests.filter(Boolean);
    listings.filter((s) => s.lat != null && dests.some((p) => distanceKm(p, s) <= 25))
      .forEach((s) => list.push({ kind: 'stay', lat: s.lat, lng: s.lng, name: s.name, sub: s.price_per_night ? `${inr(s.price_per_night)} / ${L('night', 'रात')}` : '' }));
    return list;
  }, [d, live.pois, listings, L]);

  const { byDay } = useWeather(step === 'days' ? d?.days : null);

  if (!d) return <div className="loading"><span className="spinner" /> …</div>;
  const n = tripDays(d);
  const who = whoOf(d);
  const ownVehicle = ['car', 'bike'].includes(d.mode);
  const fuelType = d.assumptions?.fuel_type || 'petrol';

  const go = (s) => {
    if (s !== 'plan') {
      const e = validate(d, L);
      setErrs(e);
      if (Object.keys(e).length) { setStep('plan'); flash(L('Please fix the highlighted fields.', 'कृपया लाल निशान वाले खाने ठीक करें।'), true); return; }
      if (!routeIsFresh(d)) { setStep('plan'); flash(L('Waiting for the road route…', 'सड़क रास्ते का इंतज़ार…')); return; }
    }
    setStep(s);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const setWho = (k) => {
    const w = WHO.find((x) => x[0] === k);
    update({ prefs: [...d.prefs.filter((p) => !WHO_KEYS.includes(p)), k], adults: w[3], children: w[4] });
  };
  const setA = (patch) => update({ assumptions: { ...(d.assumptions || {}), ...patch } });

  async function onSave(extra = {}) {
    if (!signedIn) { saveDraft(d); router.push('/login?next=/plan'); return null; }
    setBusy('save');
    try {
      // Save the resolved rates (cleared overrides already fall back to the auto value in `effective`).
      const id = await saveTrip({ ...d, ...extra, assumptions: { ...effective, auto_sources: { fuel: auto.fuelInfo || null, tolls: auto.tollInfo || null } } });
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

  const stepIdx = STEPS.indexOf(step);
  const stepper = (
    <ol className="tp2-steps" aria-label={L('Steps', 'चरण')}>
      {[L('Plan & route', 'प्लान और रास्ता'), L('Day plan', 'दिन-वार'), L('Cost', 'ख़र्च'), L('Report', 'रिपोर्ट')].map((label, i) => (
        <li key={label} className={i === stepIdx ? 'on' : i < stepIdx ? 'done' : ''}>
          <button type="button" onClick={() => go(STEPS[i])} aria-current={i === stepIdx ? 'step' : undefined}><i>{i < stepIdx ? '✓' : i + 1}</i>{label}</button>
        </li>
      ))}
    </ol>
  );
  const nextOf = { plan: ['days', L('Day plan', 'दिन-वार')], days: ['cost', L('Cost', 'ख़र्च')], cost: ['report', L('Report', 'रिपोर्ट')] }[step];
  const mapBox = (
    <div className="tp2-mapwrap">
      <div className="tp2-layers" role="group" aria-label={L('Map layers', 'नक्शे की परतें')}>
        {[['fuel', L('⛽ Fuel', '⛽ पेट्रोल')], ['toll', L('₹ Toll', '₹ टोल')], ['stay', L('⌂ Stays', '⌂ होमस्टे')]].map(([k, label]) => (
          <button key={k} type="button" aria-pressed={layers[k]} onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}>{label}</button>
        ))}
      </div>
      <RouteMap points={points} legs={legs} pois={pois} layers={layers} height={420} />
    </div>
  );

  // ---------- location picker (start or a stop) ----------
  if (picker !== null) {
    const cur = picker === 'start' ? d.start : d.dests[picker];
    return (
      <div className="planner tp2">
        <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Trip Planner', 'ट्रिप प्लानर')}</p><h1>{L('Choose a location', 'जगह चुनें')}</h1>
          <p className="muted small">{L('The red pin is what we use. Move the map to put it exactly on the spot.', 'लाल पिन वाली जगह ली जाएगी। नक्शा खिसकाकर पिन ठीक जगह पर रखें।')}</p></div></div>
        <LocationPicker lang={lang} initial={cur && cur.lat != null ? cur : null} onCancel={() => setPicker(null)} onPick={(p) => {
          if (picker === 'start') update({ start: slim(p) }); else { const dd = [...d.dests]; dd[picker] = slim(p); update({ dests: dd }); }
          setPicker(null);
        }} />
      </div>
    );
  }

  return (
    <div className="planner tp2">
      <div className="ds-head">
        <div className="grow"><p className="eyebrow">{L('Trip Planner', 'ट्रिप प्लानर')}</p><h1>{d.title || L('Plan your trip', 'अपनी यात्रा प्लान करें')}</h1>
          <p className="muted small">{d.tripId ? L('Saved trip — changes stay on this device until you save.', 'सेव ट्रिप — सेव करने तक बदलाव इसी फ़ोन में रहेंगे।') : L('Your draft saves on this device automatically.', 'ड्राफ़्ट अपने आप इस फ़ोन में सेव होता है।')}</p></div>
        <div className="ds-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm(L('Start a new empty trip?', 'नई ख़ाली यात्रा शुरू करें?'))) { dropDraft(); setD(blank()); setStep('plan'); setLive({ fuel: null, pois: null }); } }}><Icon name="plus" size={16} /> {L('New', 'नई')}</button>
        </div>
      </div>
      {stepper}
      {msg ? <p className={msg.err ? 'form-err' : 'form-ok'} role="status">{msg.text}</p> : null}

      {step === 'plan' ? (
        <div className="tp2-builder">
          <div className="tp2-bmap">
            {mapBox}
            <div className="tp2-only-d"><RouteLegs d={d} lang={lang} pois={live.pois} busy={busy === 'route'} progress={progress} onRoute={(route) => update({ route })}
              onRetry={() => runRoute({ ...d, route: { ...d.route, legs: d.route.legs.filter((x) => !x.error) } })} /></div>
          </div>
          <div className="tp2-bpanel">
            <label className="field"><span className="field-label">{L('Trip name (optional)', 'यात्रा का नाम (वैकल्पिक)')}</span>
              <input className="input" value={d.title} maxLength={160} onChange={(e) => update({ title: e.target.value })} placeholder={L('e.g. Kumaon family trip', 'जैसे कुमाऊँ फ़ैमिली ट्रिप')} /></label>

            <div className="tp2-route" role="group" aria-label={L('Your route', 'आपका रास्ता')}>
              <div className="tp2-stop">
                <span className="tp2-pn s">S</span>
                {d.start ? <span className="tp2-stop-tx"><b>{placeLabel(d.start, lang)}</b><small>{[d.start.source === 'gps' && d.start.accuracy != null ? `GPS · ±${d.start.accuracy} m` : d.start.source === 'pin' ? L('Pin on map', 'नक्शे का पिन') : null, d.start.district].filter(Boolean).join(' · ')}</small></span>
                  : <span className="tp2-stop-in"><PlaceSearch lang={lang} labels={searchLabels} onPick={(p) => update({ start: slim(p) })} placeholder={L('Start: city, town or village', 'शुरुआत: शहर, कस्बा या गाँव')} /></span>}
                {d.start ? <span className="tp2-tools"><button type="button" className="icon-btn" aria-label={L('Change start', 'शुरुआत बदलें')} onClick={() => update({ start: null })}>✕</button></span> : null}
              </div>
              <div className="tp2-locrow">
                <button type="button" onClick={() => setPicker('start')}>◎ {L('Use my location', 'मेरी लोकेशन')}</button>
                <button type="button" onClick={() => setPicker('start')}>📍 {L('Pick on map', 'नक्शे पर चुनें')}</button>
              </div>
              {errs.start ? <span className="form-err">{errs.start}</span> : null}
              {d.dests.map((p, i) => {
                const leg = routeIsFresh(d) ? d.route.legs[i] : null;
                const l = leg && !leg.error ? pickLeg(leg) : null;
                return (
                  <div key={i}>
                    <div className="tp2-legline"><span aria-hidden="true" /><span>{l ? <><b>{km(l.km)} · {dur(l.secs, lang)}</b></> : leg?.error ? L('No road route', 'सड़क रास्ता नहीं') : ''}</span></div>
                    <div className="tp2-stop">
                      <span className={`tp2-pn${p ? '' : ' e'}`}>{i + 1}</span>
                      {p ? <span className="tp2-stop-tx"><b>{placeLabel(p, lang)}</b>{p.district ? <small>{p.district}</small> : null}</span>
                        : <span className="tp2-stop-in"><PlaceSearch lang={lang} labels={searchLabels} onPick={(x) => { const dd = [...d.dests]; dd[i] = slim(x); update({ dests: dd }); }} placeholder={L('Add a place', 'जगह जोड़ें')} /></span>}
                      <span className="tp2-tools">
                        {!p ? <button type="button" className="icon-btn" aria-label={L('Pick on map', 'नक्शे पर चुनें')} onClick={() => setPicker(i)}>📍</button> : null}
                        <button type="button" className="icon-btn" disabled={i === 0} aria-label={L('Move up', 'ऊपर')} onClick={() => { const dd = [...d.dests]; [dd[i - 1], dd[i]] = [dd[i], dd[i - 1]]; update({ dests: dd }); }}>↑</button>
                        <button type="button" className="icon-btn" disabled={d.dests.length === 1 && !p} aria-label={L('Remove', 'हटाएँ')} onClick={() => update({ dests: d.dests.length === 1 ? [null] : d.dests.filter((_, k) => k !== i) })}>✕</button>
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="tp2-locrow">
                {d.dests.length < MAX_DESTS ? <button type="button" onClick={() => update({ dests: [...d.dests, null] })}>+ {L('Add stop', 'पड़ाव जोड़ें')}</button> : null}
                <label className="small tp2-round"><input type="checkbox" checked={d.roundTrip !== false} onChange={(e) => update({ roundTrip: e.target.checked })} /> {L('Back to start', 'शुरुआत पर वापस')}</label>
              </div>
              {errs.dests ? <span className="form-err">{errs.dests}</span> : null}
            </div>

            <div className="field"><span className="field-label">{L("Who's going?", 'कौन जा रहा है?')}</span>
              <div className="tp2-who" role="radiogroup">{WHO.map(([k, en, hi, , , ic]) => (
                <button key={k} type="button" role="radio" aria-checked={who === k} onClick={() => setWho(k)}><span aria-hidden="true">{ic}</span>{lang === 'hi' ? hi : en}</button>
              ))}</div></div>
            <div className="tp2-grid2">
              <Counter label={L('Adults', 'वयस्क')} value={d.adults} min={1} max={40} onChange={(v) => update({ adults: v })} lang={lang} />
              <Counter label={L('Children', 'बच्चे')} value={d.children} min={0} max={20} onChange={(v) => update({ children: v })} lang={lang} />
            </div>
            {errs.people ? <span className="form-err">{errs.people}</span> : null}
            {d.adults + d.children >= 8 && ['car', 'taxi'].includes(d.mode) ? <p className="soft-note">{L('8 or more people will not fit in one car. Plan two cars or a tempo traveller, and set the vehicle cost to match.', '8 या ज़्यादा लोग एक कार में नहीं आएँगे। दो कार या टेम्पो ट्रैवलर रखें, और गाड़ी का ख़र्च उसी हिसाब से भरें।')}</p> : null}

            <div className="tp2-grid2">
              <label className="field"><span className="field-label">{L('Start date', 'जाने की तारीख़')}</span>
                <input className="input" type="date" min={todayISO()} value={d.depart} onChange={(e) => update({ depart: e.target.value, ret: d.ret && d.ret < e.target.value ? e.target.value : d.ret })} />
                {errs.depart ? <span className="form-err">{errs.depart}</span> : null}</label>
              <label className="field"><span className="field-label">{L('Days', 'दिन')}</span>
                <input className="input" type="number" min={1} max={30} inputMode="numeric" value={n || ''} disabled={!d.depart}
                  onChange={(e) => { const k = Math.max(1, Math.min(30, Number(e.target.value) || 1)); const r = new Date(`${d.depart}T12:00:00Z`); r.setUTCDate(r.getUTCDate() + k - 1); update({ ret: r.toISOString().slice(0, 10) }); }} />
                {errs.ret ? <span className="form-err">{errs.ret}</span> : null}</label>
            </div>

            <details className="tp2-acc" open>
              <summary>🚗 {L('Vehicle', 'सवारी')} <span>{MODES.find((m) => m[0] === d.mode)?.[lang === 'hi' ? 2 : 1]}</span></summary>
              <div className="tp2-acc-in">
                <div className="tp2-modes" role="radiogroup" aria-label={L('Travel mode', 'सवारी')}>{MODES.map(([k, en, hi]) => (
                  <button key={k} type="button" role="radio" aria-checked={d.mode === k} onClick={() => update({ mode: k })}>{lang === 'hi' ? hi : en}</button>
                ))}</div>
                {['car', 'taxi'].includes(d.mode) ? (
                  <div className="tp2-seg" role="radiogroup" aria-label={L('Vehicle type', 'गाड़ी का प्रकार')}>{VEHICLES.map(([k, en, hi]) => (
                    <button key={k} type="button" role="radio" aria-checked={(d.assumptions?.vehicle || 'hatch') === k} onClick={() => setA({ vehicle: k })}>{lang === 'hi' ? hi : en}</button>
                  ))}</div>
                ) : null}
                {ownVehicle ? (
                  <>
                    <div className="tp2-seg" role="radiogroup" aria-label={L('Fuel', 'ईंधन')}>{FUELS.map(([k, en, hi, unit]) => {
                      const p = live.fuel?.status === 'ok' ? live.fuel.prices?.[k] : null;
                      return <button key={k} type="button" role="radio" aria-checked={fuelType === k} onClick={() => setA({ fuel_type: k })}>{lang === 'hi' ? hi : en}{p?.price ? <small>₹{p.price}/{unit}</small> : null}</button>;
                    })}</div>
                    {live.fuel?.status === 'ok' ? <p className="small muted">{L(`Dated rates for ${live.fuel.area} (${live.fuel.source}).`, `${live.fuel.area} के दर्ज दाम (${live.fuel.source})।`)}</p>
                      : <p className="small muted">{L('Live fuel prices are not connected yet — the cost uses the admin default or your price.', 'लाइव ईंधन दाम अभी जुड़े नहीं — ख़र्च में एडमिन का डिफ़ॉल्ट या आपका दाम लगेगा।')}</p>}
                    <label className="field"><span className="field-label">{(fuelType === 'cng' ? L('Your mileage (km per kg, optional)', 'आपका माइलेज (किमी/किग्रा, वैकल्पिक)') : L('Your mileage (km per litre, optional)', 'आपका माइलेज (किमी/लीटर, वैकल्पिक)'))}</span>
                      <input className="input" type="number" min={1} max={100} step={0.5} inputMode="decimal" value={d.assumptions?.mileage ?? ''} placeholder={L(`Empty = typical ${defaultAssumptions(d).mileage} ${fuelType === 'cng' ? 'km/kg' : 'km/l'}`, `ख़ाली = आम ${defaultAssumptions(d).mileage} ${fuelType === 'cng' ? 'किमी/किग्रा' : 'किमी/लीटर'}`)}
                        onChange={(e) => setA({ mileage: e.target.value })} /></label>
                  </>
                ) : null}
                {d.mode === 'shared' ? <p className="soft-note">{L('Shared seats are booked in Instant Cab. The planner only links to rides; seat prices come from the ride.', 'शेयर सीटें इंस्टेंट कैब में बुक होती हैं। प्लानर सिर्फ़ राइड का लिंक देता है; सीट का दाम राइड से आता है।')}</p> : null}
                {['bus', 'train'].includes(d.mode) ? <p className="soft-note warn">{L('Bus and train fares are not in our data. Add the fare on the Cost step — it will not be guessed.', 'बस और ट्रेन का किराया हमारे डेटा में नहीं है। ख़र्च वाले चरण में किराया भरें — अंदाज़ा नहीं लगाया जाएगा।')}</p> : null}
              </div>
            </details>

            <details className="tp2-acc">
              <summary>✨ {L('Pace & interests', 'रफ़्तार और पसंद')} <span>{PACES.find((p) => p[0] === d.pace)?.[lang === 'hi' ? 2 : 1]} · {d.prefs.filter((p) => !WHO_KEYS.includes(p)).length}</span></summary>
              <div className="tp2-acc-in">
                <div className="tp2-seg" role="radiogroup" aria-label={L('Pace', 'रफ़्तार')}>{PACES.map(([k, en, hi, sen, shi]) => (
                  <button key={k} type="button" role="radio" aria-checked={d.pace === k} onClick={() => update({ pace: k })}>{lang === 'hi' ? hi : en}<small>{lang === 'hi' ? shi : sen}</small></button>
                ))}</div>
                <div className="tp2-chips">{PREFS.filter(([k]) => !WHO_KEYS.includes(k)).map(([k, en, hi]) => (
                  <button key={k} type="button" className="tp2-chip" aria-pressed={d.prefs.includes(k)} onClick={() => update({ prefs: d.prefs.includes(k) ? d.prefs.filter((x) => x !== k) : [...d.prefs, k] })}>{lang === 'hi' ? hi : en}</button>
                ))}</div>
              </div>
            </details>

            <div className="tp2-only-d"><LiveCost b={budget} lang={lang} onOpen={() => go('cost')} openLabel={L("See how it's worked out", 'देखें ख़र्च कैसे बना')} /></div>
            <div className="tp2-only-m"><RouteLegs d={d} lang={lang} pois={live.pois} busy={busy === 'route'} progress={progress} onRoute={(route) => update({ route })}
              onRetry={() => runRoute({ ...d, route: { ...d.route, legs: d.route.legs.filter((x) => !x.error) } })} /></div>
            <div className="row-actions tp2-only-d" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn" disabled={busy === 'route'} onClick={() => go('days')}>{L('Day-wise plan', 'दिन-वार प्लान')} →</button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 'days' ? (
        <section className="stack tp2-days">
          {(d.itinWarnings || []).map(([k, en, hi]) => <p key={k} className="soft-note warn">{lang === 'hi' ? hi : en}</p>)}
          <div className="row-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (!d.daysEdited || window.confirm(L('Your edits to the days will be replaced. Continue?', 'दिनों में किए आपके बदलाव हट जाएँगे। आगे बढ़ें?'))) generate(d, true); }}>
              ↻ {L('Regenerate', 'फिर से बनाएँ')}</button>
            <span className="small muted">{L('Made from real drive times, your pace and listed places. Tap Edit on any day.', 'असली ड्राइव समय, आपकी रफ़्तार और लिस्टेड जगहों से बना। किसी भी दिन पर बदलें दबाएँ।')}</span>
          </div>
          {(d.days || []).map((x, idx) => (
            <article className="tp2-day" key={x.day}>
              <div className="tp2-day-h">
                <span className="tp2-dn">{L('Day', 'दिन')} {x.day}<small>{x.date}</small></span>
                <h3>{lang === 'hi' ? x.title_hi || x.title_en : x.title_en}</h3>
                <WeatherChip w={byDay[x.date]} lang={lang} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(editing === idx ? null : idx)}>{editing === idx ? L('Done', 'हो गया') : L('Edit', 'बदलें')}</button>
              </div>
              {editing === idx ? (
                <div className="tp2-day-edit">
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
                <div className="tp2-day-body"><DayItems items={x.items || []} lang={lang} />{x.notes ? <p className="small"><strong>{L('Notes', 'नोट्स')}:</strong> {x.notes}</p> : null}</div>
              )}
            </article>
          ))}
          <div className="row-actions tp2-only-d">
            <button type="button" className="btn btn-ghost" onClick={() => go('plan')}>← {L('Plan & route', 'प्लान और रास्ता')}</button>
            <button type="button" className="btn" onClick={() => go('cost')}>{L('Cost', 'ख़र्च')} →</button>
          </div>
        </section>
      ) : null}

      {step === 'cost' && budget ? (
        <div className="tp2-costwrap">
          <CostStep d={d} b={budget} auto={auto} defaults={defaults} lang={lang} update={update} onBack={() => go('days')} onNext={() => go('report')} />
          <div className="tp2-only-d tp2-costside"><LiveCost b={budget} lang={lang} onOpen={() => go('report')} openLabel={`${L('Trip report', 'ट्रिप रिपोर्ट')} →`} /></div>
        </div>
      ) : null}

      {step === 'report' ? (
        <TripReport d={{ ...d, assumptions: effective }} places={places} locations={locations} listings={listings} lang={lang} pois={pois} auto={auto}
          actions={(
            <div className="row-actions no-print">
              <button type="button" className="btn" disabled={busy === 'save'} onClick={() => onSave()}>{busy === 'save' ? L('Saving…', 'सेव हो रहा है…') : d.tripId ? L('Save changes', 'बदलाव सेव करें') : L('Save trip', 'ट्रिप सेव करें')}</button>
              <button type="button" className="btn btn-ghost" onClick={onShare}><Icon name="globe" size={16} /> {L('Share', 'शेयर')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => window.print()}><Icon name="doc" size={16} /> {L('Download PDF', 'PDF डाउनलोड')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => go('plan')}>{L('Edit', 'बदलें')}</button>
              {d.tripId ? (
                <>
                  <select className="input input-sm" aria-label={L('Trip status', 'ट्रिप की स्थिति')} value={d.status || 'planning'} onChange={(e) => onSave({ status: e.target.value })}>
                    {STATUSES.map(([k, en, hi]) => <option key={k} value={k}>{lang === 'hi' ? hi : en}</option>)}
                  </select>
                  <button type="button" className="btn btn-ghost" onClick={() => { const copy = { ...d, tripId: null, clientId: null, status: 'draft', title: `${d.title || 'Trip'} (${L('copy', 'कॉपी')})`.slice(0, 160) }; setD(copy); saveDraft(copy); flash(L('Copy made — save it to keep it.', 'कॉपी बनी — रखने के लिए सेव करें।')); }}>{L('Duplicate', 'कॉपी बनाएँ')}</button>
                  <button type="button" className="btn btn-ghost" onClick={async () => { if (!window.confirm(L('Delete this trip?', 'यह ट्रिप हटाएँ?'))) return; try { await deleteTrip(d.tripId); dropDraft(); router.push('/account/trips'); } catch (e) { flash(e.message, true); } }}>{L('Delete', 'हटाएँ')}</button>
                </>
              ) : null}
            </div>
          )} />
      ) : null}

      {nextOf ? <LiveBar b={budget} lang={lang} next={nextOf[1]} onNext={() => go(nextOf[0])} /> : null}
    </div>
  );
}

// Admin-set defaults (Admin → Trip Planner cost assumptions) fill empty rates.
function defaultsFor(d, defaults = {}) {
  const base = defaultAssumptions(d);
  ['fuel_price', 'taxi_per_km', 'food_per_person_day', 'stay_per_night'].forEach((k) => { if (defaults?.[k] != null && defaults[k] !== '') base[k] = defaults[k]; });
  return base;
}

function Counter({ label, value, min, max, onChange, lang }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  return (
    <div className="field"><span className="field-label">{label}</span>
      <div className="tp2-cnt">
        <button type="button" aria-label={L(`Fewer ${label}`, `${label} कम`)} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <b aria-live="polite">{value}</b>
        <button type="button" aria-label={L(`More ${label}`, `${label} ज़्यादा`)} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}
