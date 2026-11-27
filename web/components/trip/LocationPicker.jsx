'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadLeaflet, TILE, ATTR } from './leaflet';

// Accuracy bands for the phone's reported radius (metres). GPS is never "100%": the red pin,
// which the person can move, is what the trip uses.
export const accuracyBand = (m) => (m == null ? null : m <= 30 ? 'good' : m <= 200 ? 'mid' : 'low');
const fmtM = (m) => (m >= 1000 ? `±${(m / 1000).toFixed(1)} km` : `±${Math.round(m)} m`);

/**
 * Full-screen-ish location chooser: a fixed red pin in the middle of the map, "Use my location"
 * (high-accuracy GPS, best reading within ~12 s), an accuracy circle, and the nearest place name
 * from OpenStreetMap. onPick({ name, lat, lng, custom, near, accuracy, source }).
 */
export function LocationPicker({ lang, initial = null, onPick, onCancel }) {
  const L = useCallback((en, hi) => (lang === 'hi' ? hi : en), [lang]);
  const box = useRef(null);
  const map = useRef(null);
  const circle = useRef(null);
  const watch = useRef(null);
  const [center, setCenter] = useState(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [fix, setFix] = useState(null); // { lat, lng, accuracy }
  const [gps, setGps] = useState('idle'); // idle | finding | done | denied | unavailable
  const [near, setNear] = useState('');
  const [label, setLabel] = useState('');
  const [err, setErr] = useState('');
  const moved = useRef(false);

  useEffect(() => {
    let alive = true;
    loadLeaflet().then((Lf) => {
      if (!alive || !box.current || map.current) return;
      const m = Lf.map(box.current, { zoomControl: true }).setView(initial ? [initial.lat, initial.lng] : [29.9, 79.5], initial ? 15 : 8);
      Lf.tileLayer(TILE, { attribution: ATTR, maxZoom: 19 }).addTo(m);
      // Only a person dragging the map counts as a manual move (setView from GPS does not).
      m.on('dragstart', () => { moved.current = true; });
      m.on('moveend', () => { const c = m.getCenter(); setCenter({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) }); });
      map.current = m;
      setTimeout(() => m.invalidateSize(), 60);
    }).catch((e) => setErr(e.message));
    return () => { alive = false; };
  }, [initial]);

  useEffect(() => () => {
    if (watch.current != null && typeof navigator !== 'undefined') navigator.geolocation?.clearWatch(watch.current);
    if (map.current) { map.current.remove(); map.current = null; }
  }, []);

  // Nearest place name for the pin (OpenStreetMap Nominatim), after the map settles.
  useEffect(() => {
    if (!center) return undefined;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${center.lat}&lon=${center.lng}&accept-language=${lang === 'hi' ? 'hi' : 'en'}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((j) => { const a = j?.address || {}; setNear([a.hamlet || a.village || a.suburb || a.town || a.city || j?.name, a.county || a.state_district].filter(Boolean).join(', ')); })
        .catch(() => {});
    }, 600);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [center, lang]);

  const drawFix = useCallback((p) => {
    loadLeaflet().then((Lf) => {
      const m = map.current; if (!m) return;
      if (circle.current) circle.current.remove();
      circle.current = Lf.layerGroup([
        Lf.circle([p.lat, p.lng], { radius: p.accuracy, color: '#1d5f99', weight: 1, fillOpacity: 0.12 }),
        Lf.circleMarker([p.lat, p.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#1d5f99', fillOpacity: 1 }),
      ]).addTo(m);
    });
  }, []);

  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGps('unavailable'); return; }
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    setGps('finding'); moved.current = false;
    let best = null;
    const stop = () => { if (watch.current != null) { navigator.geolocation.clearWatch(watch.current); watch.current = null; } setGps((g) => (g === 'finding' ? 'done' : g)); };
    watch.current = navigator.geolocation.watchPosition((pos) => {
      const p = { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6), accuracy: pos.coords.accuracy };
      if (best && p.accuracy >= best.accuracy) return;
      best = p; setFix(p); drawFix(p);
      if (!moved.current && map.current) map.current.setView([p.lat, p.lng], p.accuracy <= 30 ? 17 : p.accuracy <= 200 ? 15 : 12);
      if (!map.current && !moved.current) setCenter({ lat: p.lat, lng: p.lng }); // map failed to load: GPS still works
      if (p.accuracy <= 15) stop();
    }, (e) => { setGps(e.code === 1 ? 'denied' : 'unavailable'); stop(); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    setTimeout(stop, 12000);
  };

  const band = accuracyBand(fix?.accuracy);
  const onFix = fix && center && Math.abs(center.lat - fix.lat) < 1e-5 && Math.abs(center.lng - fix.lng) < 1e-5;
  const tone = { good: 'ok', mid: 'warn', low: 'bad' }[band];
  const advice = {
    good: L('Good. The pin is on your location — move the map if you want a different spot.', 'अच्छा। पिन आपकी जगह पर है — दूसरी जगह चाहिए तो नक्शा खिसकाएँ।'),
    mid: L('Not exact. Drag the map so the red pin sits on your gate or road, or step outside for GPS.', 'सटीक नहीं। नक्शा खिसकाकर लाल पिन अपने गेट या सड़क पर रखें, या GPS के लिए बाहर आएँ।'),
    low: L('Too rough to use. Turn on precise location for this site, or move the pin yourself.', 'इस्तेमाल लायक नहीं। इस साइट के लिए सटीक लोकेशन चालू करें, या पिन ख़ुद रखें।'),
  }[band];

  return (
    <div className="tp2-picker">
      <div className="tp2-picker-map">
        <div ref={box} className="route-map" style={{ height: '100%' }} role="application" aria-label={L('Map. Move it to place the red pin.', 'नक्शा। लाल पिन रखने के लिए खिसकाएँ।')} />
        {err ? <p className="soft-note warn tp2-maperr" role="alert">{L('The map could not load. You can still use your location, or search the place by name.', 'नक्शा लोड नहीं हुआ। आप फिर भी अपनी लोकेशन ले सकते हैं, या जगह का नाम खोज सकते हैं।')}</p> : <span className="tp2-pin" aria-hidden="true" />}
      </div>
      <div className="tp2-picker-side">
        <button type="button" className="btn btn-block" onClick={locate} disabled={gps === 'finding'}>
          {gps === 'finding' ? L('Finding you… (stay still for a few seconds)', 'आपकी जगह ढूँढ रहे हैं… (कुछ सेकंड रुकें)') : L('◎ Use my location', '◎ मेरी लोकेशन लें')}
        </button>
        {gps === 'denied' ? <p className="soft-note warn" role="alert">{L('Location permission is blocked. Allow it in your browser settings — or move the map to place the pin.', 'लोकेशन की अनुमति बंद है। ब्राउज़र सेटिंग में चालू करें — या नक्शा खिसकाकर पिन रखें।')}</p> : null}
        {gps === 'unavailable' ? <p className="soft-note warn" role="alert">{L('Could not get your location. Move the map to place the pin.', 'आपकी लोकेशन नहीं मिली। नक्शा खिसकाकर पिन रखें।')}</p> : null}
        {fix ? (
          <div className="tp2-pbox">
            <div className="tp2-acc-row"><b>{{ good: L('Precise', 'सटीक'), mid: L('Approximate', 'लगभग'), low: L('Rough', 'मोटा अंदाज़ा') }[band]}</b>
              <span className={`tp2-tag ${tone}`}>{fmtM(fix.accuracy)}</span>
              <span className="tp2-meter"><i className={tone} style={{ width: `${band === 'good' ? 100 : band === 'mid' ? 45 : 12}%` }} /></span></div>
            <p className="small muted">{L('The blue circle shows how far off the phone may be.', 'नीला घेरा बताता है कि फ़ोन कितना ग़लत हो सकता है।')}{onFix ? '' : ` ${L('You moved the pin — the pin is used.', 'आपने पिन खिसकाया — पिन वाली जगह ली जाएगी।')}`}</p>
            {onFix ? <p className={`soft-note ${tone === 'ok' ? '' : 'warn'}`}>{advice}</p> : null}
          </div>
        ) : null}
        <div className="tp2-pbox">
          <span className="small muted">{L('Pin is at', 'पिन यहाँ है')}</span>
          <b className="tp2-near">{near || (center ? L('Finding the place name…', 'जगह का नाम ढूँढ रहे हैं…') : L('Move the map to place the pin', 'पिन रखने के लिए नक्शा खिसकाएँ'))}</b>
          {center ? <span className="mono small">{center.lat.toFixed(5)}° N, {center.lng.toFixed(5)}° E</span> : null}
          <label className="field" style={{ marginTop: 8 }}><span className="field-label">{L('Name this spot (optional)', 'इस जगह का नाम (वैकल्पिक)')}</span>
            <input className="input" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder={L('e.g. Our homestay gate', 'जैसे हमारे होमस्टे का गेट')} /></label>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{L('Cancel', 'रद्द')}</button>
          <button type="button" className="btn" disabled={!center || (onFix && band === 'low')} onClick={() => onPick({
            name: label.trim() || near || `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`, lat: center.lat, lng: center.lng, custom: true, near: near || null,
            accuracy: onFix ? Math.round(fix.accuracy) : null, source: onFix ? 'gps' : 'pin',
          })}>{L('Use this spot', 'यह जगह लें')}</button>
        </div>
      </div>
    </div>
  );
}
