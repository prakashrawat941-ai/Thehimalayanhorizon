'use client';
import { legPairs, pickLeg, summarise } from '@/lib/trip/engine';
import { placeLabel } from '@/lib/trip/common';
import { inr } from '@/lib/format';
import { km, dur } from './bits';
import { poiLegKey } from '@/lib/trip/live';

const fmtDate = (iso, lang) => (iso ? new Date(`${iso}T12:00:00+05:30`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/**
 * Legs of the road route with road options, and — when the live data is connected — the fuel
 * pumps, toll plazas and long no-fuel stretches on each leg. pois = fetchRoutePois() result.
 */
export function RouteLegs({ d, lang, pois, busy, progress, onRoute, onRetry }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const route = d.route;
  const pairs = legPairs(d);
  const live = pois?.status === 'ok';
  if (busy) {
    return (
      <div className="tp2-card" role="status">
        <h2>{L('Finding road routes…', 'सड़क रास्ते ढूँढ रहे हैं…')}</h2>
        <div className="tp2-progress"><i style={{ width: progress ? `${(progress[0] / progress[1]) * 100}%` : '20%' }} /></div>
        <p className="small muted">{progress ? L(`Leg ${progress[0]} of ${progress[1]}`, `${progress[1]} में से ${progress[0]} हिस्सा`) : ''}</p>
      </div>
    );
  }
  if (!route) return null;
  return (
    <div className="tp2-card">
      <h2>{L('Route, fuel & tolls', 'रास्ता, पेट्रोल और टोल')}</h2>
      {route.legs.map((leg, i) => {
        const pr = pairs[i] || {};
        const l = pickLeg(leg);
        const pk = poiLegKey(route, i);
        const list = live ? (pois.legs?.[pk] || []) : [];
        const gaps = live ? (pois.gaps?.[pk] || []) : [];
        const tolls = list.filter((p) => p.kind === 'toll');
        const fuel = list.filter((p) => p.kind === 'fuel');
        return (
          <div className="tp2-leg" key={leg.key || i}>
            <div className="tp2-leg-h"><span className="tp2-leg-n">{i + 1}</span><b>{placeLabel(pr.from, lang)} → {placeLabel(pr.to, lang)}</b>{leg.ret ? <span className="tp2-tag">{L('return', 'वापसी')}</span> : null}</div>
            {leg.error ? (
              <p className="soft-note warn tp2-in">{leg.error === 'no_route' ? L('No road route found here. Move the pin closer to a road, or try again.', 'यहाँ सड़क रास्ता नहीं मिला। पिन सड़क के पास रखें, या फिर कोशिश करें।')
                : leg.error === 'offline' ? L('You are offline.', 'आप ऑफ़लाइन हैं।') : L('Route service did not answer. Try again.', 'रास्ता सेवा ने जवाब नहीं दिया। फिर कोशिश करें।')}</p>
            ) : (
              <>
                <div className="tp2-leg-meta tp2-in">
                  <span className="tp2-tag">{km(l.km)}</span><span className="tp2-tag">{dur(l.secs, lang)}</span>
                  {live ? <><span className="tp2-tag toll">{L(`${tolls.length} toll${tolls.length === 1 ? '' : 's'}`, `${tolls.length} टोल`)}</span><span className="tp2-tag fuel">{L(`${fuel.length} fuel pump${fuel.length === 1 ? '' : 's'}`, `${fuel.length} पेट्रोल पंप`)}</span></> : null}
                </div>
                {leg.alts?.length ? (
                  <div className="tp2-alts tp2-in" role="radiogroup" aria-label={L('Road options', 'रास्ते के विकल्प')}>
                    {[leg, ...leg.alts].map((a, k) => (
                      <button key={k} type="button" role="radio" aria-checked={(leg.chosen || 0) === k} className="tp2-alt"
                        onClick={() => { const legs = [...route.legs]; legs[i] = { ...leg, chosen: k }; onRoute(summarise({ ...route, legs })); }}>
                        {k ? L(`Option ${k + 1}`, `विकल्प ${k + 1}`) : L('Fastest', 'सबसे तेज़')}<small>{km(a.km)} · {dur(a.secs, lang)}</small>
                      </button>
                    ))}
                  </div>
                ) : null}
                {live && (list.length || gaps.length) ? (
                  <ul className="tp2-poi tp2-in">
                    {[...list.map((p) => ({ ...p, at: p.km })), ...gaps.map((g) => ({ kind: 'gap', at: g.fromKm, ...g }))].sort((a, c) => a.at - c.at).map((p, k) => (
                      <li key={k}>
                        <span className="tp2-km">{km(p.at)}</span>
                        <span className={`tp2-ic ${p.kind}`} aria-hidden="true">{p.kind === 'toll' ? '₹' : p.kind === 'fuel' ? '⛽' : '⚠'}</span>
                        <span>{p.kind === 'gap' ? L(`No mapped fuel pump for ~${Math.round(p.toKm - p.fromKm)} km`, `~${Math.round(p.toKm - p.fromKm)} किमी तक नक्शे पर पेट्रोल पंप नहीं`) : p.name}
                          <small>{p.kind === 'toll' ? (p.rate != null ? L(`One way · rate as of ${fmtDate(p.rateDate, lang)}`, `एक तरफ़ · ${fmtDate(p.rateDate, lang)} का रेट`) : L('Rate not known', 'रेट पता नहीं'))
                            : p.kind === 'fuel' ? (p.brand || L('Fuel pump', 'पेट्रोल पंप')) : L('Fill up before this stretch', 'इससे पहले टंकी भरवाएँ')}</small></span>
                        <span className="tp2-pr">{p.kind === 'toll' && p.rate != null ? inr(p.rate) : ''}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        );
      })}
      <p className="tp2-total"><b>{L('Total', 'कुल')}:</b> {km(route.total_km)} · {dur(route.total_secs, lang)} {L('driving, without breaks', 'ड्राइविंग, आराम के बिना')}</p>
      {route.missing ? <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>{L('Try missing parts again', 'बाक़ी हिस्से फिर से')}</button> : null}
      {pois?.status === 'not_connected' ? <p className="small muted">{L('Fuel pumps, toll plazas and their prices will show here once the live price service is connected.', 'लाइव प्राइस सेवा जुड़ते ही पेट्रोल पंप, टोल प्लाज़ा और उनके दाम यहाँ दिखेंगे।')}</p> : null}
      {pois?.status === 'error' ? <p className="small muted">{L('Could not load fuel pumps and tolls right now.', 'अभी पेट्रोल पंप और टोल लोड नहीं हुए।')}</p> : null}
      <p className="small muted">{L('Roads: OpenStreetMap (OSRM), no live traffic. Hill roads are often slower.', 'सड़कें: OpenStreetMap (OSRM), लाइव ट्रैफ़िक नहीं। पहाड़ी सड़कें अक्सर धीमी होती हैं।')}{live && pois.source ? ` ${L('POI data', 'रास्ते की जानकारी')}: ${pois.source}.` : ''}</p>
    </div>
  );
}
