'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { loadLeaflet, TILE, ATTR } from '@/components/trip/leaflet';

const COLORS = { place: '#1f4d3a', village: '#9a5b00', stay: '#534AB7' };

/**
 * "Explore on the map": published destinations / villages and approved homestays as pins
 * (OpenStreetMap tiles). points: [{ id, kind: 'place'|'village'|'stay', name, sub, lat, lng, href, plan }].
 * If the map cannot load, the same points are shown as a list so nothing is lost.
 */
export function ExploreMap({ points, labels }) {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState(points[0]?.id || null);
  const [failed, setFailed] = useState(false);
  const shown = useMemo(() => points.filter((p) => filter === 'all' || p.kind === filter), [points, filter]);
  const kinds = useMemo(() => new Set(points.map((p) => p.kind)), [points]);

  useEffect(() => {
    let alive = true;
    loadLeaflet().then((L) => {
      if (!alive || !box.current) return;
      if (!map.current) {
        map.current = L.map(box.current, { scrollWheelZoom: false }).setView([30.0, 79.4], 7);
        L.tileLayer(TILE, { attribution: ATTR, maxZoom: 18 }).addTo(map.current);
      }
      if (layer.current) layer.current.remove();
      layer.current = L.layerGroup().addTo(map.current);
      const bounds = [];
      shown.forEach((p) => {
        const icon = L.divIcon({ className: 'hx-pin', html: `<span style="background:${COLORS[p.kind] || COLORS.place}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });
        L.marker([p.lat, p.lng], { icon, title: p.name, keyboard: true }).addTo(layer.current).on('click', () => setSel(p.id));
        bounds.push([p.lat, p.lng]);
      });
      if (bounds.length > 1) map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
      else if (bounds.length === 1) map.current.setView(bounds[0], 10);
      setTimeout(() => map.current && map.current.invalidateSize(), 60);
    }).catch(() => setFailed(true));
    return () => { alive = false; };
  }, [shown]);
  useEffect(() => () => { if (map.current) { map.current.remove(); map.current = null; } }, []);

  const cur = shown.find((p) => p.id === sel) || shown[0];
  const filters = [['all', labels.all], ['place', labels.places], ['village', labels.villages], ['stay', labels.stays]].filter(([k]) => k === 'all' || kinds.has(k));
  return (
    <div className="hx-mapwrap">
      <div className="hx-map">
        {failed ? (
          <ul className="hx-maplist">{shown.map((p) => <li key={p.id}><button type="button" onClick={() => setSel(p.id)} aria-pressed={cur?.id === p.id}>{p.name}<small>{p.sub}</small></button></li>)}</ul>
        ) : <div ref={box} className="hx-map-box" role="region" aria-label={labels.map} />}
        {filters.length > 2 ? (
          <div className="hx-map-chips" role="group" aria-label={labels.filter}>
            {filters.map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
        ) : null}
      </div>
      {cur ? (
        <div className="hx-pop" aria-live="polite">
          <span className="hx-pop-kind" style={{ background: COLORS[cur.kind] }}>{cur.kind === 'stay' ? labels.stay : cur.kind === 'village' ? labels.village : labels.place}</span>
          <h3>{cur.name}</h3>{cur.sub ? <p>{cur.sub}</p> : null}
          <div className="hx-acts"><Link className="btn btn-sm" href={cur.href}>{labels.view}</Link>{cur.plan ? <Link className="btn btn-ghost btn-sm" href={cur.plan}>{labels.plan}</Link> : null}</div>
          {shown.length > 1 ? <p className="hx-note">{labels.tap}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
