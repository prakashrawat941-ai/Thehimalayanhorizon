'use client';
import { useEffect, useRef, useState } from 'react';
import { loadLeaflet, TILE, TILE_ATTR } from './leaflet';
import { pickLeg, tripPoints } from '@/lib/trip/engine';

/** Map of the trip: numbered stops and each road leg (chosen alternative in green, others grey). */
export function RouteMap({ d, height = 320, extra = [], labels }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((Lf) => {
      if (cancelled || !box.current) return;
      if (!mapRef.current) {
        mapRef.current = Lf.map(box.current, { scrollWheelZoom: false });
        Lf.tileLayer(TILE, { maxZoom: 18, attribution: TILE_ATTR }).addTo(mapRef.current);
      }
      const map = mapRef.current;
      map.eachLayer((l) => { if (!(l instanceof Lf.TileLayer)) map.removeLayer(l); });
      const pts = tripPoints(d);
      const bounds = [];
      (d.route?.legs || []).forEach((leg) => {
        if (leg.error) return;
        (leg.alts || []).forEach((a, i) => { if (leg.chosen !== i + 1) Lf.polyline(a.coords, { color: '#9aa5a0', weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(map); });
        const c = pickLeg(leg).coords;
        Lf.polyline(c, { color: leg.ret ? '#b08a3e' : '#1f4d3a', weight: 5, opacity: 0.85 }).addTo(map);
        c.forEach((x) => bounds.push(x));
      });
      pts.forEach((p, i) => {
        Lf.marker([p.lat, p.lng], { icon: Lf.divIcon({ className: 'tp-pin', html: `<span>${i === 0 ? 'S' : i}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }) })
          .addTo(map).bindTooltip(p.name);
        bounds.push([p.lat, p.lng]);
      });
      extra.forEach((e) => Lf.circleMarker([e.lat, e.lng], { radius: 5, color: e.color || '#c2185b', weight: 2, fillOpacity: 0.8 }).addTo(map).bindTooltip(e.label || ''));
      if (bounds.length) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 }); else map.setView([30.0, 79.2], 7);
      setTimeout(() => map.invalidateSize(), 50);
    }).catch(() => setErr(true));
    return () => { cancelled = true; };
  }, [d, extra]);
  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);
  if (err) return <p className="soft-note warn">{labels?.mapError || 'Map could not load.'}</p>;
  return <div ref={box} className="tp-map" style={{ height }} role="img" aria-label={labels?.mapLabel || 'Route map'} />;
}
