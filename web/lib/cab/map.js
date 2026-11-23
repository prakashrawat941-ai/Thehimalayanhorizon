import { h, clear } from './ui';
import { getLang } from './i18n';
import { loadLeaflet, placeName as pName } from './places';
import { tripPoints, pickLeg } from '@/lib/trip/engine';
const L = (en, hi) => getLang() === 'hi' ? hi : en;
export function routeMap(d, { extra = null, height } = {}) {
  const box = h('div', { class: 'tp-map', style: height ? { height } : null }, h('p', { class: 'muted small tp-map-msg' }, L('Loading map…', 'मैप लोड हो रहा है…')));
  const api = { map: null, Lf: null, layer: null, draw: () => {} };
  api.draw = () => {
    const { map, Lf } = api; if (!map) return;
    if (api.layer) api.layer.remove();
    api.layer = Lf.layerGroup().addTo(map);
    const pts = tripPoints(d);
    const bounds = pts.map((p) => [p.lat, p.lng]);
    (d.route?.legs || []).forEach((leg) => {
      if (leg.error) return;
      const chosen = pickLeg(leg);
      [leg, ...(leg.alts || [])].forEach((r, i) => { if (r.coords !== chosen.coords) Lf.polyline(r.coords, { color: '#8aa39a', weight: 4, opacity: 0.55, dashArray: '6 8' }).addTo(api.layer); });
      Lf.polyline(chosen.coords, { color: leg.ret ? '#b08a3e' : '#1e5fd6', weight: 5, opacity: 0.9 }).addTo(api.layer);
      chosen.coords.forEach((c) => bounds.push(c));
    });
    if (!d.route) Lf.polyline(pts.map((p) => [p.lat, p.lng]), { color: '#1f4d3a', weight: 3, dashArray: '6 8' }).addTo(api.layer);
    pts.forEach((p, i) => Lf.marker([p.lat, p.lng], { icon: Lf.divIcon({ className: '', html: `<span class="tp-pin${i ? '' : ' start'}">${i ? i : 'S'}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }), title: pName(p), alt: pName(p) }).addTo(api.layer).bindTooltip(h("span", {}, pName(p))));
    if (extra) extra(api);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 11 });
  };
  (async () => {
    try { api.Lf = await loadLeaflet(); } catch {
      clear(box).append(h('p', { class: 'tp-map-msg error-box' }, L('Map could not load. Check your internet.', 'मैप लोड नहीं हुआ। इंटरनेट देखें।'))); return;
    }
    clear(box);
    api.map = api.Lf.map(box, { scrollWheelZoom: false });
    api.Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(api.map);
    api.draw();
    setTimeout(() => api.map.invalidateSize(), 150);
  })();
  api.el = box;
  return api;
}

