'use client';
import { useEffect, useRef, useState } from 'react';
import { loadLeaflet, TILE, ATTR } from './leaflet';
import { pickLeg } from '@/lib/trip/engine';

const POI_STYLE = { fuel: ['#c2410c', '⛽'], toll: ['#5b3aa8', '₹'], stay: ['#534AB7', '⌂'] };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Road route on a map: each leg as a line, numbered stops, optional fuel / toll / stay markers
 *  (pois: [{ kind, lat, lng, name, sub }], shown when layers[kind] is on). Optional click-to-pick. */
export function RouteMap({ points = [], legs = [], height = 320, onPick = null, pickLabel = '', pois = [], layers = null }) {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !box.current) return;
      if (!map.current) {
        map.current = L.map(box.current, { scrollWheelZoom: false }).setView([30.07, 79.3], 7);
        L.tileLayer(TILE, { attribution: ATTR, maxZoom: 18 }).addTo(map.current);
      }
      const m = map.current;
      if (layer.current) layer.current.remove();
      layer.current = L.layerGroup().addTo(m);
      const bounds = [];
      legs.forEach((leg) => {
        const l = pickLeg(leg);
        if (l.error || !l.coords?.length) return;
        L.polyline(l.coords, { color: leg.ret ? '#8a7a55' : '#1f4d3a', weight: 5, opacity: 0.85, dashArray: leg.ret ? '6 8' : null }).addTo(layer.current);
        l.coords.forEach((c) => bounds.push(c));
      });
      pois.filter((p) => p && p.lat != null && (!layers || layers[p.kind]) && POI_STYLE[p.kind]).forEach((p) => {
        const [bg, ch] = POI_STYLE[p.kind];
        const icon = L.divIcon({ className: 'map-poi', html: `<span style="background:${bg}" class="${p.kind}">${ch}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
        L.marker([p.lat, p.lng], { icon, title: p.name, keyboard: true }).addTo(layer.current).bindPopup(`<b>${esc(p.name)}</b>${p.sub ? `<br>${esc(p.sub)}` : ''}`);
      });
      points.filter(Boolean).forEach((p, i) => {
        const icon = L.divIcon({ className: 'map-num', html: `<span>${i === 0 ? 'S' : i}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] });
        L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(layer.current).bindPopup(p.name);
        bounds.push([p.lat, p.lng]);
      });
      if (bounds.length > 1) m.fitBounds(bounds, { padding: [24, 24] });
      else if (bounds.length === 1) m.setView(bounds[0], 11);
      m.off('click');
      if (onPick) m.on('click', (e) => onPick({ lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) }));
      setTimeout(() => m.invalidateSize(), 50);
    }).catch((e) => setErr(e.message));
    return () => { cancelled = true; };
  }, [points, legs, onPick, pois, layers]);

  useEffect(() => () => { if (map.current) { map.current.remove(); map.current = null; } }, []);

  if (err) return <p className="soft-note">{err}</p>;
  return (
    <div>
      <div ref={box} className="route-map" style={{ height }} role="img" aria-label={pickLabel || 'Map'} />
      {onPick && pickLabel ? <p className="small muted">{pickLabel}</p> : null}
    </div>
  );
}
