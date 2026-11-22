'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { editDistance, km } from '@/lib/format';
import { slim, placeLabel } from '@/lib/trip/common';
import { loadLeaflet, TILE, TILE_ATTR } from './leaflet';
import { Icon } from '../Icon';

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const PHOTON = 'https://photon.komoot.io';
const photonPlace = (f) => ({
  id: null, ext: true, name: f.properties.name || f.properties.city || f.properties.county || 'Place',
  district: f.properties.county || f.properties.district || null, region: f.properties.state || null,
  lat: +f.geometry.coordinates[1].toFixed(5), lng: +f.geometry.coordinates[0].toFixed(5),
});

/**
 * Choose a place: our own list (typo-tolerant), any Indian village/town from OpenStreetMap,
 * "Use my location", or "Pick on map". Calls onChange(slimPlace | null).
 */
export function PlacePicker({ value, onChange, places, lang, labels, id }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [osm, setOsm] = useState([]);
  const [note, setNote] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    const close = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const { matches, suggestion } = useMemo(() => {
    const n = norm(q);
    if (n.length < 2) return { matches: [], suggestion: null };
    const score = (p) => {
      let best = 99;
      for (const s of [p.name, p.name_hi, ...(p.aliases || [])].filter(Boolean).map(norm)) {
        if (s === n) best = Math.min(best, 0); else if (s.startsWith(n)) best = Math.min(best, 1);
        else if (s.split(' ').some((w) => w.startsWith(n))) best = Math.min(best, 2); else if (s.includes(n)) best = Math.min(best, 3);
      }
      return best;
    };
    const m = places.map((p) => ({ p, s: score(p) })).filter((x) => x.s < 99).sort((a, b) => a.s - b.s).slice(0, 7).map((x) => x.p);
    let sug = null;
    if (!m.length && n.length >= 3) {
      let bestD = Math.max(2, Math.floor(n.length / 3)) + 1;
      for (const p of places) for (const s of [p.name, ...(p.aliases || [])].map(norm)) {
        const dd = editDistance(n, s.slice(0, Math.max(n.length, Math.min(s.length, n.length + 2))));
        if (dd < bestD) { bestD = dd; sug = p; }
      }
    }
    return { matches: m, suggestion: sug };
  }, [q, places]);

  useEffect(() => {
    const n = q.trim();
    if (n.length < 3) { setOsm([]); return undefined; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${PHOTON}/api/?q=${encodeURIComponent(n)}&limit=6&lang=en&bbox=68.1,6.5,97.4,35.7`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { features: [] }))
        .then((j) => setOsm((j.features || []).filter((f) => f.properties.countrycode === 'IN' || /India/i.test(f.properties.country || '')).map(photonPlace)))
        .catch(() => {});
    }, 350);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q]);

  const choose = (p) => { onChange(slim(p)); setQ(''); setOpen(false); setNote(''); };
  const nearestListed = (pt) => {
    let best = null;
    for (const p of places) { const dd = km(pt, p); if (!best || dd < best.d) best = { p, d: dd }; }
    return best;
  };
  const reverse = async (pt) => {
    const listed = nearestListed(pt);
    if (listed && listed.d <= 2) return listed.p;
    try {
      const r = await fetch(`${PHOTON}/reverse?lat=${pt.lat}&lon=${pt.lng}&lang=en&limit=1`);
      const f = r.ok ? (await r.json()).features?.[0] : null;
      if (f) return { ...photonPlace(f), lat: pt.lat, lng: pt.lng };
    } catch { /* keep the exact point */ }
    return { id: null, custom: true, name: `${pt.lat}, ${pt.lng}`, near: listed ? listed.p.name : null, lat: pt.lat, lng: pt.lng };
  };
  const locate = () => {
    setNote(labels.locating);
    if (!navigator.geolocation) { setNote(labels.location_denied); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const pt = { lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5) };
      choose(await reverse(pt));
    }, () => setNote(labels.location_denied), { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  };

  if (value) {
    return (
      <div className="pp-chosen">
        <Icon name="pin" size={18} />
        <span className="grow"><strong>{placeLabel(value, lang)}</strong>{value.district ? <small className="muted"> · {value.district}</small> : null}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>{labels.change}</button>
      </div>
    );
  }
  const show = open && (q.trim().length >= 2 || note);
  return (
    <div className="psearch pp" ref={wrap}>
      <div className="psearch-box">
        <Icon name="search" size={18} />
        <input id={id} value={q} placeholder={labels.search_places} autoComplete="off" enterKeyHint="search"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setNote(''); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter') { e.preventDefault(); if (matches[0]) choose(matches[0]); else if (osm[0]) choose(osm[0]); } }} />
        <button type="button" className="psearch-loc" onClick={locate} aria-label={labels.use_location}><Icon name="locate" size={18} /></button>
        <button type="button" className="psearch-loc" onClick={() => setMapOpen(true)} aria-label={labels.pick_map}><Icon name="map" size={18} /></button>
      </div>
      {show ? (
        <div className="psearch-list" role="listbox">
          {note ? <p className="psearch-note">{note}</p> : null}
          {matches.length ? <h4>{labels.our_places}</h4> : null}
          {matches.map((p) => (
            <button type="button" key={p.id} className="psearch-item" onClick={() => choose(p)}><Icon name="mountain" size={18} />
              <span>{placeLabel(p, lang)}<small>{p.district}</small></span></button>
          ))}
          {!matches.length && suggestion ? <p className="psearch-dym">{labels.did_you_mean} <button type="button" onClick={() => setQ(suggestion.name)}>{placeLabel(suggestion, lang)}</button>?</p> : null}
          {osm.length ? <h4>{labels.more_places}</h4> : null}
          {osm.map((o, i) => (
            <button type="button" key={`${o.lat},${o.lng},${i}`} className="psearch-item" onClick={() => choose(o)}><Icon name="pin" size={18} />
              <span>{o.name}<small>{[o.district, o.region].filter(Boolean).join(', ')}</small></span></button>
          ))}
          {q.trim().length >= 2 && !matches.length && !suggestion && !osm.length && !note ? <p className="psearch-note">{labels.nothing_here}</p> : null}
        </div>
      ) : null}
      {mapOpen ? <MapPicker places={places} lang={lang} labels={labels} onClose={() => setMapOpen(false)} onPick={async (pt, listed) => { setMapOpen(false); choose(listed || await reverse(pt)); }} /> : null}
    </div>
  );
}

function MapPicker({ places, lang, labels, onClose, onPick }) {
  const box = useRef(null);
  const cb = useRef({ onClose, onPick });
  cb.current = { onClose, onPick };
  useEffect(() => {
    let map = null;
    loadLeaflet().then((Lf) => {
      if (!box.current) return;
      map = Lf.map(box.current).setView([30.0, 79.2], 8);
      Lf.tileLayer(TILE, { maxZoom: 18, attribution: TILE_ATTR }).addTo(map);
      places.forEach((p) => Lf.circleMarker([p.lat, p.lng], { radius: 6, color: '#1f4d3a', fillColor: '#b08a3e', fillOpacity: 0.9, weight: 2 })
        .addTo(map).bindTooltip(placeLabel(p, lang)).on('click', (e) => { Lf.DomEvent.stopPropagation(e); cb.current.onPick({ lat: p.lat, lng: p.lng }, p); }));
      map.on('click', (e) => cb.current.onPick({ lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) }, null));
    }).catch(() => {});
    const esc = (e) => { if (e.key === 'Escape') cb.current.onClose(); };
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); map?.remove(); };
  }, [places, lang]);
  return (
    <div className="pp-modal" role="dialog" aria-modal="true" aria-label={labels.pick_map}>
      <div className="pp-modal-card">
        <div className="pp-modal-head"><strong>{labels.pick_map_hint}</strong><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{labels.close}</button></div>
        <div ref={box} className="pp-modal-map" />
      </div>
    </div>
  );
}
