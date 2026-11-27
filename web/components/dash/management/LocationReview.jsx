'use client';
import { useState, useTransition } from 'react';
import { DashError, DashNotConnected } from '../DashStates';
import { tr } from './ui';

// Fields shown on step 3, in order. Values and their sources come only from the chosen match.
export const LOCATION_FIELDS = [
  ['name', 'Name', 'नाम'], ['name_hi', 'Hindi name', 'हिंदी नाम'], ['district', 'District', 'ज़िला'], ['region', 'Region', 'क्षेत्र'],
  ['kind', 'Kind', 'प्रकार'], ['lat_lng', 'Latitude, longitude', 'अक्षांश, देशांतर'], ['nearest_town', 'Nearest town', 'नज़दीकी शहर'],
  ['altitude_m', 'Altitude (m)', 'ऊँचाई (मी)'], ['best_season', 'Best season', 'सबसे अच्छा मौसम'], ['image_url', 'Photo', 'फ़ोटो'],
];
const SOURCE = {
  places: ['places table', 'places टेबल', 'green'], locations: ['site locations', 'साइट लोकेशन', 'green'],
  osm: ['OpenStreetMap', 'OpenStreetMap', 'blue'], derived: ['from district', 'ज़िले से', 'green'], suggested: ['suggested', 'सुझाव', 'blue'],
};
const scoreTone = (s) => (s >= 85 ? 'green' : s >= 60 ? 'blue' : 'gray');

/**
 * Co-founder "Add a location": search → review suggested matches → check prefilled details → publish.
 * All matching, scoring, duplicate checks and autofill belong to Codex's server actions:
 *   findMatches(FormData{ name, district }) → { status: 'ok', matches: [{ id, score, name, sub, distanceKm, lat, lng,
 *       fields: { [key]: { value, source } } }], duplicate: { name, distanceKm } | null } | { status: 'not_connected' }
 *   saveDraft(FormData) / publish(FormData) → { ok, message }
 * Nothing is invented here: a field without a value from the match stays empty and is marked "needs you".
 */
export function LocationReview({ lang, districts = [], findMatches = null, saveDraft = null, publish = null }) {
  const L = tr(lang);
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState({ name: '', district: '' });
  const [result, setResult] = useState(null);
  const [pick, setPick] = useState(null);
  const [fields, setFields] = useState({});
  const [opts, setOpts] = useState({ show_on_home: true, featured: false });
  const [msg, setMsg] = useState(null);
  const [busy, start] = useTransition();

  if (!findMatches) return <DashNotConnected title={L('Location matching is not connected yet', 'लोकेशन मिलान अभी जुड़ा नहीं')} text={L('Once connected, new places are checked against existing places and OpenStreetMap before they are added.', 'जुड़ने के बाद नई जगह जोड़ने से पहले मौजूदा जगहों और OpenStreetMap से मिलाई जाएगी।')} />;

  const steps = [L('Search', 'खोजें'), L('Review matches', 'मिलान देखें'), L('Check details', 'जानकारी जाँचें'), L('Publish', 'प्रकाशित करें')];
  const stepBar = (
    <ol className="dsx-steps" aria-label={L('Steps', 'चरण')}>
      {steps.map((s, i) => <li key={s} className={i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''} aria-current={i + 1 === step ? 'step' : undefined}>{i + 1} {s}</li>)}
    </ol>
  );
  const head = (title, text) => <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Co-founder · Website', 'सह-संस्थापक · वेबसाइट')}</p><h1>{title}</h1><p className="muted">{text}</p></div></div>;
  const formOf = (extra = {}) => {
    const f = new FormData();
    Object.entries(fields).forEach(([k, v]) => f.set(k, v.value ?? ''));
    f.set('field_sources', JSON.stringify(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.source || 'manual']))));
    if (pick && pick !== 'new') f.set('match_id', pick);
    Object.entries(extra).forEach(([k, v]) => f.set(k, String(v)));
    return f;
  };
  const run = (fn, ok) => start(async () => {
    setMsg(null);
    try { const r = await fn(); if (r?.ok) ok(r); else setMsg({ bad: true, text: r?.message || L('Could not save. Nothing was changed — try again.', 'सहेज नहीं सके। कुछ नहीं बदला — फिर कोशिश करें।') }); }
    catch { setMsg({ bad: true, text: L('Could not save. Nothing was changed — try again.', 'सहेज नहीं सके। कुछ नहीं बदला — फिर कोशिश करें।') }); }
  });
  const status = msg ? <p className={`soft-note${msg.bad ? ' warn' : ''}`} role={msg.bad ? 'alert' : 'status'}>{msg.text}</p> : null;

  if (step === 1) {
    const search = (e) => {
      e.preventDefault();
      if (!query.name.trim()) return;
      const f = new FormData(); f.set('name', query.name.trim()); f.set('district', query.district);
      start(async () => {
        try { setResult(await findMatches(f)); } catch { setResult({ status: 'error' }); }
        setPick(null); setStep(2);
      });
    };
    return (<>
      {head(L('Add a location', 'लोकेशन जोड़ें'), L('We look for matches first, so the same place is never added twice.', 'पहले मिलान खोजते हैं, ताकि एक ही जगह दो बार न जुड़े।'))}
      {stepBar}
      <form className="dsx-card" onSubmit={search}>
        <div className="dsx-fld"><label htmlFor="lr-name">{L('Place name', 'जगह का नाम')}</label><input id="lr-name" value={query.name} required maxLength={120} onChange={(e) => setQuery({ ...query, name: e.target.value })} /></div>
        <div className="dsx-fld"><label htmlFor="lr-district">{L('District (optional)', 'ज़िला (वैकल्पिक)')}</label>
          <select id="lr-district" value={query.district} onChange={(e) => setQuery({ ...query, district: e.target.value })}>
            <option value="">{L('Any district', 'कोई भी ज़िला')}</option>
            {districts.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select></div>
        <button className="btn" disabled={busy}>{busy ? L('Searching…', 'खोज रहे हैं…') : L('Find matches', 'मिलान खोजें')}</button>
      </form>
    </>);
  }

  if (step === 2) {
    if (result?.status === 'not_connected') return (<>{stepBar}<DashNotConnected title={L('Location matching is not connected yet', 'लोकेशन मिलान अभी जुड़ा नहीं')} /></>);
    if (!result || result.status !== 'ok') return (<>{stepBar}<DashError title={L('Couldn’t search', 'खोज नहीं हो सकी')} text={L('Nothing was changed.', 'कुछ नहीं बदला।')} retry={L('Try again', 'फिर कोशिश करें')} /><button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>{L('Back', 'वापस')}</button></>);
    const matches = result.matches || [];
    const choose = () => {
      const m = matches.find((x) => x.id === pick);
      setFields(m ? { ...m.fields } : { name: { value: query.name.trim(), source: 'manual' } });
      setStep(3);
    };
    const chosen = matches.find((x) => x.id === pick);
    return (<>
      {head(L('Review matches', 'मिलान देखें'), L('Pick the place you mean. The score combines name and distance.', 'जिस जगह की बात है उसे चुनें। स्कोर नाम और दूरी से बनता है।'))}
      {stepBar}
      {result.duplicate ? <p className="soft-note warn" role="alert">{L(`Possible duplicate: “${result.duplicate.name}” is already published${result.duplicate.distanceKm != null ? ` ${result.duplicate.distanceKm} km away` : ''}.`, `संभावित दोहराव: “${result.duplicate.name}” पहले से प्रकाशित है${result.duplicate.distanceKm != null ? ` (${result.duplicate.distanceKm} किमी दूर)` : ''}।`)}</p> : null}
      {result.osmAvailable === false ? <p className="soft-note warn" role="status">{L('OpenStreetMap search is unavailable. Review local matches carefully before publishing.', 'OpenStreetMap खोज उपलब्ध नहीं है। प्रकाशित करने से पहले स्थानीय मिलान ध्यान से जाँचें।')}</p> : null}
      <section className="dsx-card">
        <h2 className="dsx-card-h"><span>{L('Suggested matches', 'सुझाए गए मिलान')}</span></h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {matches.length ? matches.map((m) => (
            <button key={m.id} type="button" className="dsx-match" aria-pressed={pick === m.id} onClick={() => setPick(m.id)}>
              <span className={`dsx-match-sc dsx-t-${scoreTone(m.score)}`}>{m.score}<small>{L('match', 'मिलान')}</small></span>
              <span><b>{m.name}</b><small>{m.sub}</small>{m.distanceKm != null ? <small>{L(`${m.distanceKm} km away`, `${m.distanceKm} किमी दूर`)}</small> : null}</span>
            </button>
          )) : <p className="dsx-note">{L('No matches found.', 'कोई मिलान नहीं मिला।')}</p>}
          <button type="button" className="dsx-match" aria-pressed={pick === 'new'} onClick={() => setPick('new')}>
            <span className="dsx-match-sc dsx-t-gray">+</span>
            <span><b>{L('None of these — create a new place', 'इनमें से कोई नहीं — नई जगह बनाएँ')}</b><small>{L('Starts with an empty form', 'खाली फ़ॉर्म से शुरू')}</small></span>
          </button>
        </div>
        {chosen?.lat != null && chosen?.lng != null ? (
          <p className="dsx-note"><a href={`https://www.openstreetmap.org/?mlat=${chosen.lat}&mlon=${chosen.lng}#map=13/${chosen.lat}/${chosen.lng}`} target="_blank" rel="noopener noreferrer">{L('See this match on OpenStreetMap', 'यह मिलान OpenStreetMap पर देखें')}</a></p>
        ) : null}
        <p className="dsx-note">{L('Map data:', 'मानचित्र डेटा:')} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></p>
        <div className="dsx-acts" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>{L('Back', 'वापस')}</button>
          <button type="button" className="btn" disabled={!pick} onClick={choose}>{pick === 'new' ? L('Start empty', 'खाली से शुरू') : L('Use this', 'यही इस्तेमाल करें')}</button>
        </div>
      </section>
    </>);
  }

  const missing = LOCATION_FIELDS.filter(([k]) => !String(fields[k]?.value ?? '').trim());
  if (step === 3) {
    return (<>
      {head(L('Check prefilled details', 'भरी हुई जानकारी जाँचें'), L('Filled from the match. Amber fields need you.', 'मिलान से भरी गई। पीले खाने आपको भरने हैं।'))}
      {stepBar}
      <section className="dsx-card">
        <div className="dsx-pf">
          {LOCATION_FIELDS.map(([k, en, hi]) => {
            const f = fields[k] || {};
            const empty = !String(f.value ?? '').trim();
            const src = SOURCE[f.source];
            const chip = empty ? [L('needs you', 'आपसे'), 'amber'] : src ? [L(src[0], src[1]), src[2]] : [L('entered by you', 'आपने भरा'), 'gray'];
            return (
              <div key={k} className={`dsx-pfi${empty ? ' need' : ''}`}>
                <label htmlFor={`lr-${k}`}>{L(en, hi)}<span className={`dsx-src dsx-t-${chip[1]}`}>{chip[0]}</span></label>
                <input id={`lr-${k}`} value={f.value ?? ''} placeholder={empty ? L('Add before publishing', 'प्रकाशित करने से पहले भरें') : undefined}
                  onChange={(e) => setFields({ ...fields, [k]: { value: e.target.value, source: e.target.value === (f.original ?? f.value) ? f.source : 'manual', original: f.original ?? f.value } })} />
              </div>
            );
          })}
        </div>
        <p className="dsx-note">{L('Nothing is invented: empty facts stay empty until you add them. Each field’s source is saved with the place.', 'कुछ भी गढ़ा नहीं जाता: खाली जानकारी तब तक खाली रहती है जब तक आप न भरें। हर खाने का स्रोत जगह के साथ सेव होता है।')}</p>
        {status}
        <div className="dsx-acts" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>{L('Back', 'वापस')}</button>
          {saveDraft ? <button type="button" className="btn btn-ghost" disabled={busy || !String(fields.name?.value ?? '').trim()} onClick={() => run(() => saveDraft(formOf()), () => setMsg({ text: L('Draft saved. It is not on the website yet.', 'ड्राफ़्ट सेव हुआ। अभी वेबसाइट पर नहीं है।') }))}>{L('Save draft', 'ड्राफ़्ट सेव करें')}</button> : null}
          <button type="button" className="btn" disabled={!String(fields.name?.value ?? '').trim()} onClick={() => { setMsg(null); setStep(4); }}>{L('Continue', 'आगे')}</button>
        </div>
      </section>
    </>);
  }

  return (<>
    {head(L('Publish', 'प्रकाशित करें'), L('Choose where it appears on the website.', 'चुनें कि वेबसाइट पर कहाँ दिखे।'))}
    {stepBar}
    <section className="dsx-card">
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0' }}><input type="checkbox" checked={opts.show_on_home} onChange={(e) => setOpts({ ...opts, show_on_home: e.target.checked })} /> {L('Show in “Places to go” on the homepage', 'होमपेज के “घूमने की जगहें” में दिखाएँ')}</label>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0' }}><input type="checkbox" checked={opts.featured} onChange={(e) => setOpts({ ...opts, featured: e.target.checked })} /> {L('Feature at the top', 'सबसे ऊपर दिखाएँ')}</label>
      {missing.length ? <p className="soft-note warn">{L(`${missing.length} field(s) still empty: ${missing.map(([, en]) => en).join(', ')}. You can publish now and add them later.`, `${missing.length} खाने अभी खाली: ${missing.map(([, , hi]) => hi).join(', ')}। अभी प्रकाशित करके बाद में भर सकते हैं।`)}</p> : null}
      {status}
      <div className="dsx-acts" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setStep(3)}>{L('Back', 'वापस')}</button>
        <button type="button" className="btn" disabled={busy || !publish} onClick={() => run(() => publish(formOf(opts)), (r) => setMsg({ text: r.message || L('Published to the website.', 'वेबसाइट पर प्रकाशित हुआ।') }))}>
          {busy ? L('Publishing…', 'प्रकाशित हो रहा है…') : L('Publish to website', 'वेबसाइट पर प्रकाशित करें')}
        </button>
      </div>
    </section>
  </>);
}
