'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BREAK_FACTOR, computeBudget, distanceKm, fmtDur, fmtKm, getJSON, legPairs, pickLeg, seasonNotes, tripPoints, weatherFor, weatherWarnings } from '@/lib/trip/engine';
import { MODES, PACES, PREFS, daysOf, fmtD, placeLabel, saveDraft } from '@/lib/trip/common';
import { deleteTrip, saveTrip, shareLink } from '@/lib/trip/save';
import { inr, listingSlug } from '@/lib/format';
import { RouteMap } from './RouteMap';
import { WeatherChip } from './WeatherChip';
import { Icon } from '../Icon';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

// Food, fuel, tolls and hospitals from OpenStreetMap near the route and the stops.
async function loadOsm(d) {
  const coords = (d.route?.legs || []).filter((l) => !l.error && !l.ret).flatMap((l) => pickLeg(l).coords);
  const step = Math.max(1, Math.floor(coords.length / 90));
  const sample = coords.filter((_, i) => i % step === 0).map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(',');
  const near = d.dests.map((p) => `${(+p.lat).toFixed(4)},${(+p.lng).toFixed(4)}`).join(',');
  const query = `[out:json][timeout:25];(
${sample ? `node["barrier"="toll_booth"](around:500,${sample});node["amenity"="fuel"](around:700,${sample});` : ''}
node["amenity"="fuel"](around:15000,${near});
node["amenity"~"^(hospital|clinic)$"](around:20000,${near});way["amenity"="hospital"](around:20000,${near});
node["amenity"~"^(restaurant|cafe)$"](around:5000,${near});
);out center tags 500;`;
  const data = await getJSON(OVERPASS, { method: 'POST', body: `data=${encodeURIComponent(query)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
  const items = (data.elements || []).map((e) => ({ lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, tags: e.tags || {} })).filter((e) => e.lat);
  const main = d.dests[d.dests.length - 1];
  const nearest = (e) => Math.min(...d.dests.map((p) => distanceKm(e, p)));
  const tolls = [];
  items.filter((e) => e.tags.barrier === 'toll_booth').forEach((e) => { if (!tolls.some((t) => distanceKm(t, e) < 3)) tolls.push(e); });
  return {
    tolls, nearest,
    fuel: items.filter((e) => e.tags.amenity === 'fuel'),
    fuelNear: items.filter((e) => e.tags.amenity === 'fuel' && distanceKm(e, main) <= 15).sort((a, b) => distanceKm(a, main) - distanceKm(b, main)),
    hospitals: items.filter((e) => /hospital|clinic/.test(e.tags.amenity || '')).sort((a, b) => nearest(a) - nearest(b)),
    food: items.filter((e) => /restaurant|cafe/.test(e.tags.amenity || '')).sort((a, b) => nearest(a) - nearest(b)),
  };
}
const osmName = (e) => e.tags.name || e.tags.brand || e.tags.operator || '';

export function TripReport({ d, mode, lang, places, locs, themes, listings, actions, tripId, shareToken }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [osm, setOsm] = useState(undefined);
  const [wx, setWx] = useState(null);
  const [msg, setMsg] = useState('');
  const main = d.dests[d.dests.length - 1];
  const n = daysOf(d) || d.days?.length || 0;
  const people = (d.adults || 0) + (d.children || 0);
  const own = ['car', 'bike'].includes(d.mode);
  const b = useMemo(() => computeBudget(d, d.route, d.days), [d]);
  const dur = (s) => fmtDur(s, lang === 'hi');
  const routeTitle = [d.start, ...d.dests].filter(Boolean).map((p) => placeLabel(p, lang)).join(' → ');
  const themeNames = [...new Set(d.prefs.map((k) => PREFS.find((p) => p[0] === k)).filter(Boolean).map((p) => L(p[1], p[2])))];
  const modeRow = MODES.find((m) => m[0] === d.mode);
  const paceRow = PACES.find((p) => p[0] === d.pace);

  useEffect(() => {
    let alive = true;
    if (d.route) loadOsm(d).then((o) => alive && setOsm(o)).catch(() => alive && setOsm(null)); else setOsm(null);
    if (main && d.depart && d.ret) {
      const dates = []; for (let x = d.depart; x <= d.ret && dates.length < 30; x = new Date(new Date(`${x}T12:00:00Z`).getTime() + 864e5).toISOString().slice(0, 10)) dates.push(x);
      weatherFor(main, dates).then((w) => alive && setWx({ w, dates })).catch(() => alive && setWx(null));
    }
    return () => { alive = false; };
  }, [d, main]);

  // Tourist places near the destinations (our own list; straight-line distance, labelled).
  const nearby = useMemo(() => {
    const seen = new Set();
    return locs.filter((l) => l.lat != null && l.kind !== 'transport_hub')
      .map((l) => ({ l, km: Math.min(...d.dests.map((p) => distanceKm(p, l))), from: d.dests.reduce((best, p) => (distanceKm(p, l) < distanceKm(best, l) ? p : best), d.dests[0]) }))
      .filter((x) => x.km <= 45 && !d.dests.some((p) => p.location_id === x.l.id) && !seen.has(x.l.id) && seen.add(x.l.id))
      .sort((a, c) => a.km - c.km).slice(0, 8);
  }, [locs, d.dests]);

  // Stay options: only real approved listings at the overnight stops.
  const stays = useMemo(() => {
    const ids = new Set((d.days || []).map((x) => x.night?.location_id).filter(Boolean));
    d.dests.forEach((p) => p.location_id && ids.add(p.location_id));
    return listings.filter((s) => ids.has(s.location_id)).slice(0, 6);
  }, [d, listings]);

  const mapExtra = useMemo(() => (osm ? [
    ...osm.tolls.map((e) => ({ ...e, color: '#e0533d', label: osmName(e) || L('Toll plaza', 'टोल प्लाज़ा') })),
    ...osm.fuel.slice(0, 40).map((e) => ({ ...e, color: '#1d8f6a', label: osmName(e) || L('Fuel pump', 'पेट्रोल पंप') })),
    ...osm.hospitals.slice(0, 8).map((e) => ({ ...e, color: '#c2185b', label: osmName(e) || L('Hospital', 'अस्पताल') })),
  ] : []), [osm]); // eslint-disable-line react-hooks/exhaustive-deps

  const pts = tripPoints(d);
  const last = d.roundTrip !== false ? pts[0] : pts[pts.length - 1];
  const via = (d.roundTrip !== false ? pts.slice(1) : pts.slice(1, -1)).map((p) => `${p.lat},${p.lng}`).join('|');
  const gmaps = pts.length ? `https://www.google.com/maps/dir/?api=1&origin=${pts[0].lat},${pts[0].lng}&destination=${last.lat},${last.lng}${via ? `&waypoints=${encodeURIComponent(via)}` : ''}&travelmode=driving` : null;
  const litres = own && b.driveKm != null && Number(b.a.mileage) ? b.driveKm / Number(b.a.mileage) : null;
  const hosp = osm?.hospitals?.[0];
  const notes = d.depart && d.ret ? seasonNotes(d.depart, d.ret) : [];

  async function share() {
    setMsg('');
    try {
      let url = mode === 'shared' ? location.href : null;
      if (!url && tripId) url = await shareLink(tripId, true);
      const text = `${d.title || L('Trip report', 'ट्रिप रिपोर्ट')}: ${routeTitle} (${n} ${L('days', 'दिन')}) — The Himalayan Horizon`;
      if (navigator.share) { await navigator.share({ title: d.title || 'Trip', text, url: url || undefined }).catch(() => {}); return; }
      await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
      setMsg(url ? L('Share link copied', 'शेयर लिंक कॉपी हो गया') : L('Trip details copied', 'ट्रिप की जानकारी कॉपी हो गई'));
    } catch (e) { setMsg(e.message || String(e)); }
  }

  const head = (no, title, action) => <div className="tr-head"><span className="tr-no">{no}</span><h2>{title}</h2>{action || null}</div>;

  return (
    <article className="tr">
      <header className="tr-top">
        <p className="eyebrow">{L('Trip Report', 'ट्रिप रिपोर्ट')} · The Himalayan Horizon</p>
        <h1>{d.title || routeTitle}</h1>
        {d.title ? <p className="lead">{routeTitle}</p> : null}
        {themeNames.length ? <div className="chips">{themeNames.map((x) => <span className="chip" key={x}>{x}</span>)}</div> : null}
        <div className="row-actions no-print">
          {actions}
          {mode !== 'draft' ? <button type="button" className="btn btn-ghost" onClick={share}><Icon name="globe" size={16} /> {L('Share', 'शेयर')}</button> : null}
          <button type="button" className="btn btn-ghost" onClick={() => window.print()}><Icon name="doc" size={16} /> {L('Download PDF', 'PDF डाउनलोड')}</button>
          {mode === 'saved' ? <OwnerActions d={d} tripId={tripId} L={L} router={router} setMsg={setMsg} /> : null}
        </div>
        {msg ? <p className="small" role="status">{msg}</p> : null}
        {shareToken && mode === 'saved' ? <p className="small muted no-print">{L('Shared link is on.', 'शेयर लिंक चालू है।')} <a href={`/t/${shareToken}`}>/t/{shareToken.slice(0, 8)}…</a></p> : null}
      </header>

      <div className="tr-bar">
        <div><span>{L('Start', 'शुरुआत')}</span><strong>{placeLabel(d.start, lang)}</strong></div>
        <div><span>{d.dests.length > 1 ? L('Destinations', 'मंज़िलें') : L('Destination', 'मंज़िल')}</span><strong>{d.dests.map((p) => placeLabel(p, lang)).join(', ')}</strong></div>
        <div><span>{L('Days', 'दिन')}</span><strong>{n}</strong><small>{fmtD(d.depart, lang)} – {fmtD(d.ret, lang)}</small></div>
        <div><span>{L('Travellers', 'यात्री')}</span><strong>{people}</strong>{d.children ? <small>{d.adults} {L('adults', 'वयस्क')}, {d.children} {L('children', 'बच्चे')}</small> : null}</div>
        <div><span>{L('Vehicle', 'साधन')}</span><strong>{modeRow ? L(modeRow[1], modeRow[2]) : '—'}</strong></div>
        {own ? <div><span>{L('Mileage', 'माइलेज')}</span><strong>{b.a.mileage || '—'} km/l</strong></div> : null}
        <div><span>{L('Trip type', 'ट्रिप का प्रकार')}</span><strong>{d.roundTrip !== false ? L('Round trip', 'आना-जाना') : L('One way', 'एक तरफ़')}</strong>{paceRow ? <small>{L(paceRow[1], paceRow[2])}</small> : null}</div>
      </div>

      <section className="tr-card">
        {head(1, L('Route overview', 'रूट की जानकारी'))}
        {d.route ? (
          <>
            <RouteMap d={d} extra={mapExtra} height={340} labels={{ mapError: L('Map could not load.', 'मैप लोड नहीं हुआ।'), mapLabel: L('Route map', 'रूट मैप') }} />
            <p className="small muted tr-legend"><i className="lg lg-route" /> {L('Route', 'रास्ता')} <i className="lg lg-toll" /> {L('Toll plaza', 'टोल')} <i className="lg lg-fuel" /> {L('Fuel pump', 'पेट्रोल पंप')} <i className="lg lg-hosp" /> {L('Hospital', 'अस्पताल')}</p>
            <ol className="tp-legs">
              {d.route.legs.map((leg, i) => {
                const pr = legPairs(d)[i];
                return <li key={leg.key || i}><span className="grow">{pr?.ret ? `${L('Return', 'वापसी')}: ` : ''}{placeLabel(pr?.from, lang)} → {placeLabel(pr?.to, lang)}</span>
                  <strong>{leg.error ? L('not calculated', 'नहीं निकला') : `${fmtKm(pickLeg(leg).km)} · ${dur(pickLeg(leg).secs)}`}</strong></li>;
              })}
            </ol>
          </>
        ) : <p className="soft-note warn">{L('Route not calculated yet.', 'रूट अभी नहीं निकला।')}</p>}
      </section>

      <section className="tr-card">
        {head(2, L('Distance & cost summary', 'दूरी और ख़र्च'))}
        <div className="tr-tiles">
          <div><span>{L('Total distance', 'कुल दूरी')}</span><strong>{b.driveKm == null ? '—' : fmtKm(b.driveKm)}</strong><small>{L('road + local sightseeing', 'सड़क + लोकल घूमना')}</small></div>
          <div><span>{L('Driving time', 'ड्राइव समय')}</span><strong>{d.route ? dur(d.route.total_secs) : '—'}</strong><small>{d.route ? L(`about ${dur(d.route.total_secs * BREAK_FACTOR)} with breaks`, `आराम सहित लगभग ${dur(d.route.total_secs * BREAK_FACTOR)}`) : ''}</small></div>
          {own ? <div><span>{L('Fuel needed', 'ईंधन चाहिए')}</span><strong>{litres == null ? '—' : `${litres.toFixed(1)} L`}</strong></div> : null}
          {own ? <div><span>{L('Fuel cost', 'ईंधन ख़र्च')}</span><strong>{b.lines.fuel?.missing ? '—' : inr(b.lines.fuel?.est)}</strong><small>{b.a.fuel_price ? `₹${b.a.fuel_price}/L` : ''}</small></div> : null}
          <div><span>{L('Toll plazas on route', 'रास्ते के टोल')}</span><strong>{osm ? osm.tolls.length : '—'}</strong><small>{L('amounts not included', 'रकम शामिल नहीं')}</small></div>
          <div><span>{L('Stay', 'रुकना')}</span><strong>{b.lines.stay?.missing ? '—' : inr(b.lines.stay?.est)}</strong><small>{b.nights} {L('nights', 'रात')}</small></div>
        </div>
        <div className="tp-totals">
          <div><span>{L('Total estimate', 'कुल अनुमान')}</span><strong>{inr(b.total)}</strong></div>
          <div><span>{L('Per person', 'प्रति व्यक्ति')}</span><strong>{inr(Math.round(b.perPerson))}</strong></div>
          <div><span>{L('Per day', 'प्रति दिन')}</span><strong>{inr(Math.round(b.perDay))}</strong></div>
          {b.remaining != null ? <div><span>{L('Left from budget', 'बजट में बचा')}</span><strong className={b.remaining < 0 ? 'neg' : ''}>{inr(Math.round(b.remaining))}</strong></div> : null}
        </div>
        <p className="small muted">{L('Approximate estimates, not confirmed prices.', 'लगभग अनुमान, पक्के दाम नहीं।')}{b.missing.length ? ` ${L('Some rates are empty — total is incomplete.', 'कुछ रेट ख़ाली हैं — कुल अधूरा है।')}` : ''}</p>
      </section>

      <section className="tr-card">
        {head(3, `${L('Places to see near', 'घूमने की जगहें:')} ${placeLabel(main, lang)}`, <Link className="btn btn-ghost btn-sm no-print" href="/destinations">{L('All places', 'सभी जगहें')}</Link>)}
        {nearby.length ? (
          <ul className="tr-places">
            {nearby.map(({ l, km, from }) => {
              const th = themes.find((x) => x.slug === l.theme_slugs?.[0]);
              return <li key={l.id}><Link href={`/destinations/${l.slug}`}><strong>{lang === 'hi' && l.name_hi ? l.name_hi : l.name}</strong></Link>
                {th ? <span className="chip">{th.icon} {lang === 'hi' && th.name_hi ? th.name_hi : th.name}</span> : null}
                <small className="muted">~{Math.round(km)} km {L('from', 'दूरी:')} {placeLabel(from, lang)} {L('(straight line)', '(सीधी दूरी)')}</small></li>;
            })}
          </ul>
        ) : <p className="soft-note">{L('No listed places near your destinations yet.', 'आपकी मंज़िलों के पास अभी कोई सूचीबद्ध जगह नहीं।')}</p>}
      </section>

      <section className="tr-card">
        {head(4, `${L('Day-wise plan', 'दिन-वार प्लान')} (${n} ${L('days', 'दिन')})`)}
        {d.days?.length ? (
          <ol className="tp-days">
            {d.days.map((day, i) => (
              <li key={i} className="tp-day">
                <div className="tp-day-head"><span className="tr-day-pill">{L('Day', 'दिन')} {day.day}</span><span className="muted small">{fmtD(day.date, lang)}</span>
                  {day.km ? <span className="muted small">· {fmtKm(day.km)} · {dur(day.secs)}</span> : null}</div>
                <h3>{lang === 'hi' ? day.title_hi || day.title_en || day.title : day.title_en || day.title}</h3>
                {Array.isArray(day.items) ? (
                  <ul className="tp-items">{day.items.map((it, k) => <li key={k} className={`tp-item tp-${it.kind}`}>{it.time ? <b>{it.time} </b> : null}{it.text || (lang === 'hi' ? it.hi || it.en : it.en)}</li>)}</ul>
                ) : <p>{lang === 'hi' ? day.plan_hi || day.plan : day.plan}</p>}
                {day.notes ? <p className="small"><em>{day.notes}</em></p> : null}
                {day.night ? <p className="small muted">{L('Night', 'रात')}: {placeLabel(day.night, lang)}</p> : null}
              </li>
            ))}
          </ol>
        ) : <p className="soft-note warn">{L('No day plan yet.', 'अभी दिन-वार प्लान नहीं।')}</p>}
      </section>

      <section className="tr-card">
        {head(5, L('Stay options', 'रुकने की जगहें'), <Link className="btn btn-ghost btn-sm no-print" href="/homestays">{L('All stays', 'सभी होमस्टे')}</Link>)}
        {stays.length ? (
          <ul className="tr-places">
            {stays.map((s) => <li key={s.id}><Link href={`/homestays/${listingSlug(s.name, s.id)}`}><strong>{s.name}</strong></Link>
              <small className="muted">{[s.village, s.price_per_night ? `${inr(s.price_per_night)} / ${L('night', 'रात')}` : null].filter(Boolean).join(' · ')}</small></li>)}
          </ul>
        ) : <p className="soft-note">{L('No homestays are listed at these stops yet. New hosts are joining.', 'इन पड़ावों पर अभी कोई होमस्टे सूची में नहीं। नए होस्ट जुड़ रहे हैं।')}</p>}
        <p className="small muted">{L('Availability is not confirmed — send a booking request to the host.', 'उपलब्धता पक्की नहीं — होस्ट को बुकिंग रिक्वेस्ट भेजें।')}</p>
      </section>

      <section className="tr-card">
        {head(6, L('Food & fuel stops', 'खाना और पेट्रोल पंप'))}
        {osm === undefined ? <p className="muted"><span className="spinner" /> {L('Loading from OpenStreetMap…', 'OpenStreetMap से ला रहे हैं…')}</p>
          : osm === null ? <p className="soft-note warn">{L('Food and fuel points could not load right now.', 'खाना और पेट्रोल पंप की जानकारी अभी लोड नहीं हुई।')}</p> : (
            <dl className="kv-rows">
              <div className="kv-row"><dt>{L('Places to eat near your stops', 'पड़ावों के पास खाने की जगहें')}</dt><dd>{osm.food.length ? osm.food.slice(0, 6).map(osmName).filter(Boolean).join(', ') || `${osm.food.length}` : L('None on the map', 'मैप पर नहीं')}</dd></div>
              <div className="kv-row"><dt>{L('Fuel stations on the way', 'रास्ते में पेट्रोल पंप')}</dt><dd>{osm.fuel.length} {L('on the map', 'मैप पर')}</dd></div>
              <div className="kv-row"><dt>{L('Fuel near', 'पेट्रोल पंप पास में:')} {placeLabel(main, lang)}</dt><dd>{osm.fuelNear.length ? `${osmName(osm.fuelNear[0]) || L('Fuel pump', 'पेट्रोल पंप')} · ~${Math.round(distanceKm(osm.fuelNear[0], main))} km` : L('No pump near the destination on the map — fill up before the last climb.', 'मंज़िल के पास पंप नहीं दिखा — आख़िरी चढ़ाई से पहले टंकी भरवा लें।')}</dd></div>
              <div className="kv-row"><dt>{L('Rest breaks', 'आराम')}</dt><dd>{L('Stop every 2 hours on hill roads.', 'पहाड़ी सड़कों पर हर 2 घंटे में रुकें।')}</dd></div>
            </dl>
          )}
      </section>

      <section className="tr-card">
        {head(7, L('Safety & live information', 'सुरक्षा और लाइव जानकारी'))}
        <dl className="kv-rows">
          <div className="kv-row"><dt>{L('Weather at', 'मौसम:')} {placeLabel(main, lang)}</dt>
            <dd>{wx?.w ? wx.dates.filter((x) => wx.w.days[x]).slice(0, 5).map((x) => <span key={x} className="block">{fmtD(x, lang)}: <WeatherChip w={wx.w.days[x]} L={L} /></span>) : L('Not available right now', 'अभी उपलब्ध नहीं')}
              {wx?.w ? wx.dates.flatMap((x) => weatherWarnings(wx.w.days[x]).map((y) => <span key={x + y[0]} className="block tr-warn">⚠ {fmtD(x, lang)}: {L(y[1], y[2])}</span>)).slice(0, 4) : null}
              <span className="block small">{L('Official forecast:', 'सरकारी पूर्वानुमान:')} <a href="https://mausam.imd.gov.in/" target="_blank" rel="noopener noreferrer">IMD mausam.imd.gov.in</a></span></dd></div>
          <div className="kv-row"><dt>{L('Road status & alerts', 'सड़क और चेतावनी')}</dt>
            <dd><a href="https://usdma.uk.gov.in/" target="_blank" rel="noopener noreferrer">USDMA</a> · <a href="https://rajmargyatra.nhai.gov.in/" target="_blank" rel="noopener noreferrer">NHAI Rajmargyatra</a> · {L('your district administration website', 'अपने ज़िला प्रशासन की वेबसाइट')}</dd></div>
          <div className="kv-row"><dt>{L('Emergency numbers', 'आपातकालीन नंबर')}</dt>
            <dd className="selectable"><strong>112</strong> {L('all emergencies', 'सभी आपात')} · <strong>1070</strong> {L('State EOC', 'राज्य आपदा कंट्रोल रूम')} · <strong>1077</strong> {L('District EOC', 'ज़िला कंट्रोल रूम')} · <strong>100</strong> {L('Police', 'पुलिस')} · <strong>101</strong> {L('Fire', 'फ़ायर')} · <strong>108</strong> {L('Ambulance', 'एम्बुलेंस')}</dd></div>
          <div className="kv-row"><dt>{L('Nearest hospital', 'सबसे पास अस्पताल')}</dt>
            <dd>{hosp ? `${osmName(hosp) || L('Hospital / clinic', 'अस्पताल / क्लिनिक')} · ~${Math.round(osm.nearest(hosp))} km ${L('from your nearest stop (straight line)', 'आपके सबसे पास के पड़ाव से (सीधी दूरी)')}` : L('Not found on the map near your stops.', 'आपके पड़ावों के पास मैप पर नहीं मिला।')}</dd></div>
          {gmaps ? <div className="kv-row no-print"><dt>{L('Live traffic', 'लाइव ट्रैफ़िक')}</dt><dd><a href={gmaps} target="_blank" rel="noopener noreferrer">{L('Open this route in Google Maps', 'यह रास्ता Google Maps में खोलें')}</a></dd></div> : null}
        </dl>
        {notes.map((x, i) => <p key={i} className="soft-note">{L(x[0], x[1])}</p>)}
        <p className="soft-note">{L('Carry a printed copy or offline map — mobile signal drops in many valleys. Avoid driving on hill roads after dark.', 'प्रिंट कॉपी या ऑफ़लाइन मैप साथ रखें — कई घाटियों में मोबाइल सिग्नल नहीं होता। अँधेरे के बाद पहाड़ी सड़कों पर गाड़ी न चलाएँ।')}</p>
      </section>

      <footer className="tr-sources">
        <strong>{L('Data sources:', 'डेटा स्रोत:')}</strong> OpenStreetMap · OSRM routing · Overpass (OSM points) · Open-Meteo weather · IMD · USDMA · The Himalayan Horizon listings
        <p className="small muted">{L('Distances and times come from OpenStreetMap routing; costs are estimates, not quotes. Stays are suggestions, not bookings. Check road, weather and permit status before you travel.', 'दूरी और समय OpenStreetMap रूटिंग से; ख़र्च अनुमान हैं, पक्के दाम नहीं। होमस्टे सुझाव हैं, बुकिंग नहीं। यात्रा से पहले सड़क, मौसम और परमिट की स्थिति देख लें।')}</p>
      </footer>
    </article>
  );
}

function OwnerActions({ d, tripId, L, router, setMsg }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => { saveDraft({ ...d, tripId }); router.push('/plan/new'); }}>{L('Edit', 'बदलें')}</button>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={async () => {
        setBusy(true);
        try { const id = await saveTrip({ ...d, title: `${d.title} (${L('copy', 'कॉपी')})`.slice(0, 160), tripId: null, clientId: null, status: 'planning' }); router.push(`/trip/${id}`); }
        catch (e) { setMsg(e.message || String(e)); setBusy(false); }
      }}>{L('Duplicate', 'कॉपी बनाएँ')}</button>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={async () => {
        if (!window.confirm(L('Delete this trip? This cannot be undone.', 'यह ट्रिप हटाएँ? यह वापस नहीं होगा।'))) return;
        setBusy(true);
        try { await deleteTrip(tripId); router.push('/account/trips'); router.refresh(); } catch (e) { setMsg(e.message || String(e)); setBusy(false); }
      }}>{L('Delete', 'हटाएँ')}</button>
    </>
  );
}
