'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { computeBudget, COST_CATS, placesAlong, pickLeg, distanceKm, tripPoints, seasonNotes } from '@/lib/trip/engine';
import { PREFS, PACES, MODES, WHO, whoOf, VEHICLES, FUELS, placeLabel } from '@/lib/trip/common';
import { listingSlug, inr, slugify } from '@/lib/format';
import { RouteMap } from './RouteMap';
import { useWeather } from './useWeather';
import { WeatherChip, DayItems, km, dur } from './bits';
import '@/app/plan/planner.css';

const SAFETY = [
  ['https://mausam.imd.gov.in/', 'IMD weather warnings', 'IMD मौसम चेतावनी'],
  ['https://usdma.uk.gov.in/', 'USDMA (Uttarakhand disaster updates)', 'USDMA (उत्तराखंड आपदा अपडेट)'],
  ['https://uk.gov.in/', 'Uttarakhand government / district sites', 'उत्तराखंड सरकार / ज़िला साइटें'],
  ['https://rajmargyatra.nhai.gov.in/', 'NHAI Rajmargyatra (highways, tolls)', 'NHAI राजमार्गयात्रा (हाईवे, टोल)'],
];
const NUMBERS = [['112', 'All emergencies', 'सभी आपात'], ['1070', 'State disaster control room', 'राज्य आपदा कंट्रोल रूम'], ['1077', 'District disaster control room', 'ज़िला आपदा कंट्रोल रूम'],
  ['100', 'Police', 'पुलिस'], ['101', 'Fire', 'फ़ायर'], ['108', 'Ambulance', 'एम्बुलेंस']];

/** Full Trip Report: summary, route, costs, nearby places, day plan, stays, stops, safety, sources. */
export function TripReport({ d, places = [], locations = [], listings = [], lang, actions = null, pois = [], auto = {} }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const pts = tripPoints(d);
  const legs = d.route?.legs || [];
  const days = d.days || [];
  const b = useMemo(() => computeBudget(d, d.route, days), [d, days]);
  const { byDay } = useWeather(days);
  const allCoords = legs.filter((l) => !l.error).flatMap((l) => pickLeg(l).coords || []);
  const dests = d.dests.filter(Boolean);
  const who = WHO.find((w) => w[0] === whoOf(d));
  const vehicle = VEHICLES.find((v) => v[0] === d.assumptions?.vehicle);
  const fuel = FUELS.find((f) => f[0] === (d.assumptions?.fuel_type || 'petrol'));
  const routePois = pois.filter((p) => p.kind === 'fuel' || p.kind === 'toll');
  const themes = d.prefs.filter((k) => !WHO.some((w) => w[0] === k)).map((k) => PREFS.find((p) => p[0] === k)).filter(Boolean).map((p) => (lang === 'hi' ? p[2] : p[1]));
  const pace = PACES.find((p) => p[0] === d.pace);
  const mode = MODES.find((m) => m[0] === d.mode);
  const people = d.adults + d.children;

  // Real approved homestays at or near the destinations (never invented).
  const stays = listings.filter((s) => dests.some((p) => (p.location_id && s.location_id === p.location_id) || (s.lat != null && distanceKm(p, s) <= 25)));
  // Listed places within 30 km of each destination.
  const nearby = dests.map((p) => ({ p, list: locations.filter((l) => l.lat != null && l.kind !== 'transport_hub' && distanceKm(p, l) <= 30 && distanceKm(p, l) > 1)
    .map((l) => ({ l, k: distanceKm(p, l) })).sort((a, c) => a.k - c.k).slice(0, 5) }));
  // Towns on the road where food and fuel are usually available (to confirm locally).
  const towns = placesAlong(allCoords, places.filter((p) => ['town', 'city', 'hub'].includes(p.kind)), pts, 4).slice(0, 10);
  const notes = d.depart && d.ret ? seasonNotes(d.depart, d.ret) : [];
  const fmt = (iso) => (iso ? new Date(`${iso}T12:00:00+05:30`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '');

  return (
    <article className="trip-report">
      <header className="tr-head">
        <p className="eyebrow">{L('Trip report', 'ट्रिप रिपोर्ट')}</p>
        <h1>{d.title || [placeLabel(d.start, lang), ...dests.map((p) => placeLabel(p, lang))].join(' → ')}</h1>
        {themes.length ? <div className="chips">{themes.map((x) => <span className="chip" key={x}>{x}</span>)}</div> : null}
        {actions}
      </header>

      <dl className="tr-summary">
        <div><dt>{L('Start', 'शुरुआत')}</dt><dd>{placeLabel(d.start, lang)}</dd></div>
        <div><dt>{L('Destinations', 'मंज़िलें')}</dt><dd>{dests.map((p) => placeLabel(p, lang)).join(', ')}</dd></div>
        <div><dt>{L('Dates', 'तारीख़')}</dt><dd>{fmt(d.depart)} – {fmt(d.ret)} · {b.nDays} {L('days', 'दिन')}</dd></div>
        <div><dt>{L('Travellers', 'यात्री')}</dt><dd>{who ? `${lang === 'hi' ? who[2] : who[1]} · ` : ''}{d.adults} {L('adults', 'वयस्क')}{d.children ? `, ${d.children} ${L('children', 'बच्चे')}` : ''}</dd></div>
        <div><dt>{L('Vehicle', 'सवारी')}</dt><dd>{mode ? (lang === 'hi' ? mode[2] : mode[1]) : d.mode}{vehicle && ['car', 'taxi'].includes(d.mode) ? ` · ${lang === 'hi' ? vehicle[2] : vehicle[1]}` : ''}{['car', 'bike'].includes(d.mode) && fuel ? ` · ${lang === 'hi' ? fuel[2] : fuel[1]}` : ''}</dd></div>
        {['car', 'bike', 'taxi'].includes(d.mode) ? <div><dt>{L('Mileage', 'माइलेज')}</dt><dd>{b.a.mileage} km/l</dd></div> : null}
        <div><dt>{L('Trip type', 'ट्रिप का प्रकार')}</dt><dd>{d.roundTrip !== false ? L('Round trip', 'आना-जाना') : L('One way', 'एक तरफ़')} · {pace ? (lang === 'hi' ? pace[2] : pace[1]) : ''}</dd></div>
      </dl>

      <section className="section">
        <h2>{L('Route overview', 'रास्ते की जानकारी')}</h2>
        <RouteMap points={pts} legs={legs} pois={pois} layers={{ fuel: true, toll: true, stay: true }} height={300} />
        <ol className="leg-list">
          {legs.map((leg, i) => {
            const l = pickLeg(leg);
            const from = i < pts.length - 1 ? pts[i] : pts[pts.length - 1];
            const to = leg.ret ? pts[0] : pts[i + 1];
            return (
              <li key={i}><strong>{placeLabel(from, lang)} → {placeLabel(to, lang)}</strong>{' '}
                {l.error ? <span className="warn-text">{L('Road route not available — check before you travel', 'सड़क रास्ता नहीं मिला — यात्रा से पहले जाँचें')}</span>
                  : <span className="muted">{km(l.km)} · {dur(l.secs, lang)} {L('driving', 'ड्राइविंग')}</span>}
              </li>
            );
          })}
        </ol>
        {routePois.length ? (
          <>
            <h3 className="tr-sub">{L('Fuel pumps & toll plazas on the way', 'रास्ते के पेट्रोल पंप और टोल प्लाज़ा')}</h3>
            <ul className="tp2-poi tp2-poi-r">{routePois.map((p, i) => (
              <li key={i}><span className="tp2-km">{p.leg ? `${L('Leg', 'हिस्सा')} ${p.leg}` : ''}{p.km != null ? ` · ${km(p.km)}` : ''}</span><span className={`tp2-ic ${p.kind}`} aria-hidden="true">{p.kind === 'toll' ? '₹' : '⛽'}</span>
                <span>{p.name}<small>{p.sub}</small></span><span className="tp2-pr" /></li>
            ))}</ul>
            {auto.tollInfo ? <p className="small muted">{L(`Tolls on this route: ${inr(auto.tolls || 0)}${auto.tollInfo.unknown ? ` (+ ${auto.tollInfo.unknown} plaza(s) with unknown rate)` : ''}.`, `इस रास्ते के टोल: ${inr(auto.tolls || 0)}${auto.tollInfo.unknown ? ` (+ ${auto.tollInfo.unknown} प्लाज़ा का रेट पता नहीं)` : ''}।`)}</p> : null}
          </>
        ) : null}
        <p className="small muted">{L('Road distances and times from OpenStreetMap (OSRM), without traffic. Hill roads are often slower; live traffic, tolls and road closures are not included — see NHAI Rajmargyatra and USDMA.',
          'सड़क की दूरी और समय OpenStreetMap (OSRM) से, ट्रैफ़िक के बिना। पहाड़ी सड़कें अक्सर धीमी होती हैं; लाइव ट्रैफ़िक, टोल और बंद रास्ते शामिल नहीं — NHAI राजमार्गयात्रा और USDMA देखें।')}</p>
      </section>

      <section className="section">
        <h2>{L('Distance & cost', 'दूरी और ख़र्च')}</h2>
        <div className="ds-stats">
          <div className="ds-stat"><span className="ds-stat-l">{L('Road distance', 'सड़क दूरी')}</span><span className="ds-stat-n">{d.route ? km(d.route.total_km) : '—'}</span></div>
          <div className="ds-stat"><span className="ds-stat-l">{L('Driving time', 'ड्राइविंग समय')}</span><span className="ds-stat-n">{d.route ? dur(d.route.total_secs, lang) : '—'}</span></div>
          <div className="ds-stat"><span className="ds-stat-l">{L('Estimated total', 'अनुमानित कुल')}</span><span className="ds-stat-n">{inr(b.total)}</span></div>
          <div className="ds-stat"><span className="ds-stat-l">{L('Per person', 'प्रति व्यक्ति')}</span><span className="ds-stat-n">{inr(Math.round(b.perPerson))}</span></div>
        </div>
        <table className="table budget-table">
          <thead><tr><th>{L('Category', 'श्रेणी')}</th><th className="right">{L('Estimate', 'अनुमान')}</th><th className="right">{L('Actual', 'असल')}</th></tr></thead>
          <tbody>
            {COST_CATS.map(([k, en, hi]) => {
              const line = b.lines[k];
              if (!line || (!line.est && !line.missing && !d.actuals?.[k])) return null;
              return (
                <tr key={k}><td>{lang === 'hi' ? hi : en}{line.how ? <div className="small muted">{line.how}</div> : null}</td>
                  <td className="right">{line.missing ? <span className="muted">{L('add rate', 'रेट भरें')}</span> : inr(line.est)}</td>
                  <td className="right">{d.actuals?.[k] ? inr(Number(d.actuals[k])) : '—'}</td></tr>
              );
            })}
          </tbody>
          <tfoot><tr><th>{L('Total (approx.)', 'कुल (लगभग)')}</th><th className="right">{inr(b.total)}</th><th className="right">{b.actualTotal ? inr(b.actualTotal) : '—'}</th></tr></tfoot>
        </table>
        <p className="small muted">{L(`Approximate. Per day ${inr(Math.round(b.perDay))}.`, `लगभग। प्रति दिन ${inr(Math.round(b.perDay))}।`)}
          {b.remaining != null ? ` ${L('Budget left', 'बचा बजट')}: ${inr(Math.round(b.remaining))}.` : ''}
          {b.missing.length ? ` ${L('Some rates are not filled in, so the total is lower than real.', 'कुछ रेट नहीं भरे, इसलिए कुल असल से कम है।')}` : ''}</p>
      </section>

      {nearby.some((x) => x.list.length) ? (
        <section className="section">
          <h2>{L('Tourist places nearby', 'आस-पास घूमने की जगहें')}</h2>
          {nearby.filter((x) => x.list.length).map(({ p, list }) => (
            <p key={p.name}><strong>{placeLabel(p, lang)}:</strong>{' '}
              {list.map(({ l, k }, i) => <span key={l.id}>{i ? ', ' : ''}<Link href={`/destinations/${l.slug}`}>{lang === 'hi' && l.name_hi ? l.name_hi : l.name}</Link> <small className="muted">~{Math.round(k)} km</small></span>)}
            </p>
          ))}
          <p className="small muted">{L('Straight-line distance, approximate.', 'सीधी दूरी, लगभग।')}</p>
        </section>
      ) : null}

      <section className="section">
        <h2>{L('Day-wise plan', 'दिन-वार प्लान')}</h2>
        {days.length ? days.map((x) => (
          <div className="day-card" key={x.day}>
            <div className="day-head">
              <span className="day-num">{L('Day', 'दिन')} {x.day}</span>
              <span className="muted small">{fmt(x.date)}</span>
              <WeatherChip w={byDay[x.date]} lang={lang} />
            </div>
            <h3>{lang === 'hi' ? x.title_hi || x.title_en : x.title_en}</h3>
            <DayItems items={x.items || []} lang={lang} />
            {x.notes ? <p className="small"><strong>{L('Notes', 'नोट्स')}:</strong> {x.notes}</p> : null}
            {x.night ? <p className="small muted">🛏 {L('Night', 'रात')}: {placeLabel(x.night, lang)}</p> : null}
          </div>
        )) : <p className="muted">{L('No day plan yet.', 'अभी दिन-वार प्लान नहीं।')}</p>}
      </section>

      <section className="section">
        <h2>{L('Stay options', 'रुकने की जगहें')}</h2>
        {stays.length ? (
          <ul className="plain-list">{stays.map((s) => (
            <li key={s.id}><Link href={`/homestays/${listingSlug(s.name || slugify('stay'), s.id)}`}>{s.name}</Link>{s.price_per_night ? <span className="muted"> · {inr(s.price_per_night)} / {L('night', 'रात')}</span> : null}</li>
          ))}</ul>
        ) : <p className="muted">{L('No approved homestays listed near these places yet. We only show real, approved listings.', 'इन जगहों के पास अभी कोई मंज़ूर होमस्टे नहीं। हम सिर्फ़ असली, मंज़ूर लिस्टिंग दिखाते हैं।')}</p>}
      </section>

      <section className="section">
        <h2>{L('Food & fuel stops', 'खाना और पेट्रोल पंप')}</h2>
        {towns.length ? <p>{towns.map((p) => placeLabel(p, lang)).join(' · ')}</p> : <p className="muted">{L('No listed towns found on this road.', 'इस रास्ते पर कोई लिस्टेड कस्बा नहीं मिला।')}</p>}
        <p className="small muted">{L('Towns on your road where food and fuel are usually available. Confirm opening times locally, and fill up before long hill stretches.', 'आपके रास्ते के कस्बे जहाँ आम तौर पर खाना और पेट्रोल मिलता है। समय स्थानीय रूप से पक्का करें, और लंबे पहाड़ी हिस्सों से पहले टंकी भरवा लें।')}</p>
      </section>

      <section className="section">
        <h2>{L('Safety & live information', 'सुरक्षा और लाइव जानकारी')}</h2>
        {notes.map(([en, hi], i) => <p key={i} className="soft-note warn">{lang === 'hi' ? hi : en}</p>)}
        <ul className="plain-list">{SAFETY.map(([u, en, hi]) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer">{lang === 'hi' ? hi : en}</a></li>)}</ul>
        <div className="num-grid">{NUMBERS.map(([n, en, hi]) => <a key={n} className="num" href={`tel:${n}`}><strong>{n}</strong><span>{lang === 'hi' ? hi : en}</span></a>)}</div>
      </section>

      <section className="section small muted">
        <h2>{L('Data sources', 'जानकारी के स्रोत')}</h2>
        <p>{L('Roads: OpenStreetMap contributors via OSRM. Weather: Open-Meteo (forecast up to 16 days; later dates use past years’ averages). Places, stays and itineraries: The Himalayan Horizon database (approved listings only). All costs are estimates.',
          'सड़कें: OpenStreetMap (OSRM)। मौसम: Open-Meteo (16 दिन तक पूर्वानुमान; उसके बाद पिछले सालों का औसत)। जगहें, होमस्टे और प्लान: द हिमालयन होराइज़न डेटाबेस (सिर्फ़ मंज़ूर लिस्टिंग)। सारे ख़र्च अनुमान हैं।')}</p>
      </section>
      <p className="small muted">{people} {L('traveller(s)', 'यात्री')}</p>
    </article>
  );
}
