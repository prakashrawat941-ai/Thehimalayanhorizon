'use client';
// Leaflet + OpenStreetMap tiles, loaded only on pages that show a map (free, no key).
let loading = null;
export function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.L?.map) return Promise.resolve(window.L);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => resolve(window.L);
    js.onerror = () => { loading = null; reject(new Error('Map could not load')); };
    document.head.appendChild(js);
  });
  return loading;
}

export const TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
