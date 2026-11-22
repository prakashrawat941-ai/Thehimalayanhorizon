'use client';
// Leaflet + OpenStreetMap tiles, loaded only when a map is shown (keeps pages light).
let promise = null;
export function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('server'));
  if (window.L?.map) return Promise.resolve(window.L);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.append(css);
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = () => resolve(window.L);
      s.onerror = () => { promise = null; reject(new Error('map')); };
      document.head.append(s);
    });
  }
  return promise;
}
export const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTR = '© OpenStreetMap contributors';
