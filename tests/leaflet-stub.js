// Tiny stand-in for Leaflet, used only by the offline tests (unpkg is unreachable there).
// Draws markers and lines on a plain box so screenshots show where points are,
// and lets tests fire a marker "dragend". Not shipped to the site.
(function () {
  const markers = [];
  window.__lfMarkers = markers;
  function chain(o) { o.addTo = (t) => { if (t && t._add) t._add(o); return o; }; o.remove = () => { (o._parent?._items || []).splice((o._parent?._items || []).indexOf(o), 1); o._parent?._draw(); return o; }; o.bindTooltip = () => o; o.on = (ev, fn) => { (o._ev ||= {})[ev] = fn; return o; }; return o; }
  function group(root) {
    const g = chain({ _items: [] });
    g._add = (x) => { x._parent = g; g._items.push(x); g._draw(); };
    g._draw = () => g._parent?._draw();
    return g;
  }
  window.L = {
    map(el) {
      el.style.position = 'relative';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%');
      const tag = document.createElement('span');
      tag.textContent = 'Test map (offline, no tiles)';
      tag.setAttribute('style', 'position:absolute;right:8px;bottom:6px;font:11px sans-serif;color:#556');
      el.append(svg, tag);
      el.style.background = 'linear-gradient(160deg,#e3ece2,#d5e3ea)';
      const m = group(null);
      m._root = m; m._bounds = null;
      const all = () => { const out = []; const walk = (g) => g._items.forEach((x) => (x._items ? walk(x) : out.push(x))); walk(m); return out; };
      m._draw = () => {
        const items = all();
        const pts = items.flatMap((x) => x._pts || []);
        if (!pts.length) return;
        const lats = pts.map((p) => p[0]); const lngs = pts.map((p) => p[1]);
        const b = m._bounds || [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
        const W = el.clientWidth, H = el.clientHeight, pad = 40;
        const sx = (lng) => pad + ((lng - b[0][1]) / ((b[1][1] - b[0][1]) || 1)) * (W - 2 * pad);
        const sy = (lat) => H - pad - ((lat - b[0][0]) / ((b[1][0] - b[0][0]) || 1)) * (H - 2 * pad);
        svg.innerHTML = items.filter((x) => x._line).map((x) => `<polyline fill="none" stroke="${x._opt.color || '#1f4d3a'}" stroke-width="${x._opt.weight || 3}" stroke-dasharray="${x._opt.dashArray || ''}" points="${x._pts.map((p) => `${sx(p[1])},${sy(p[0])}`).join(' ')}"/>`).join('');
        el.querySelectorAll('.lf-mk').forEach((n) => n.remove());
        items.filter((x) => x._mk).forEach((x) => {
          const d = document.createElement('div');
          d.className = 'lf-mk';
          d.innerHTML = x._opt.icon?.html || '<span style="display:block;width:12px;height:12px;border-radius:50%;background:#2f8f5a;border:2px solid #fff"></span>';
          d.setAttribute('style', `position:absolute;left:${sx(x._pts[0][1])}px;top:${sy(x._pts[0][0])}px;transform:translate(-50%,-50%)`);
          el.append(d);
        });
      };
      m.fitBounds = (pts) => { const lats = pts.map((p) => p[0]); const lngs = pts.map((p) => p[1]); m._bounds = [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]]; m._draw(); return m; };
      m.setView = () => m; m.invalidateSize = () => m._draw(); m.on = () => m;
      return m;
    },
    tileLayer: () => chain({}),
    layerGroup: () => group(null),
    polyline(pts, opt = {}) { const o = chain({ _pts: pts, _opt: opt, _line: true }); o.getBounds = () => pts; return o; },
    marker(ll, opt = {}) { const o = chain({ _pts: [ll], _opt: opt, _mk: true }); o.getLatLng = () => ({ lat: o._pts[0][0], lng: o._pts[0][1] }); o.setLatLng = (p) => { o._pts = [[p.lat, p.lng]]; return o; }; markers.push(o); return o; },
    circleMarker(ll, opt = {}) { return this.marker(ll, opt); },
    divIcon: (o) => o,
  };
})();
