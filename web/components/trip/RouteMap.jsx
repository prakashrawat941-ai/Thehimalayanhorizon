'use client';
import { useEffect, useRef, useState } from 'react';
import { loadLeaflet, TILE, ATTR } from './leaflet';
import { pickLeg } from '@/lib/trip/engine';

/** Road route on a map: each leg as a line, numbered stops. Optional click-to-pick. */
export function RouteMap({ points = [], legs = [], height = 320, onPick = null, pickLabel = '' }) {
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
  }, [points, legs, onPick]);

  useEffect(() => () => { if (map.current) { map.current.remove(); map.current = null; } }, []);

  if (err) return <p className="soft-note">{err}</p>;
  return (
    <div>
      <div ref={box} className="route-map" style={{ height }} role="img" aria-label={pickLabel || 'Map'} />
      {onPick && pickLabel ? <p className="small muted">{pickLabel}</p> : null}
    </div>
  );
}
