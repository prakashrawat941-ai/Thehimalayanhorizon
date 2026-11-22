// Illustrated mountain artwork shown when a place or listing has no photo yet
// (honest placeholder, not a fake photo).
const palettes: Record<string, string[]> = {
  dawn: ['#f6d8b8', '#e9a77b', '#b5532b', '#5b2a1c'],
  pine: ['#dbe8dc', '#9cc0a4', '#2f6b4f', '#173628'],
  snow: ['#e8f0f6', '#b9cfe0', '#3b6e8f', '#1c3446'],
  dusk: ['#eadcf0', '#c3a3d1', '#8a5a9e', '#3d2448'],
  meadow: ['#eef0d8', '#c9d38f', '#5d7a2e', '#2b3a14'],
  gold: ['#f7ebc9', '#e3c278', '#c08a1e', '#5a3f08'],
};
const names = Object.keys(palettes);

export function artSvg(seed = '') {
  let p = 0; for (const ch of seed) p = (p * 31 + ch.charCodeAt(0)) >>> 0;
  const [sky, far, mid, near] = palettes[names[p % names.length]];
  let n = 7; for (const ch of seed) n = (n * 17 + ch.charCodeAt(0)) % 9973;
  const rnd = (i: number) => (((n * (i + 11) * 2654435761) >>> 0) % 1000) / 1000;
  const ridge = (base: number, amp: number, count: number, off: number) => Array.from({ length: count + 1 }, (_, i) => {
    const x = Math.round((i / count) * 420);
    const y = Math.round(base - (i % 2 ? amp * (0.55 + 0.45 * rnd(i + off)) : amp * 0.25 * rnd(i + off * 3)));
    return `${x},${y}`;
  });
  const far1 = ridge(150, 95, 6, 1);
  const snow = far1.map((pt, i) => {
    if (i % 2 === 0 || i === far1.length - 1) return '';
    const [x, y] = pt.split(',').map(Number);
    return `<path d="M${x},${y} L${x - 16},${y + 20} L${x - 6},${y + 15} L${x},${y + 22} L${x + 7},${y + 14} L${x + 16},${y + 20} Z" fill="#fff" opacity=".9"/>`;
  }).join('');
  const poly = (pts: string[], fill: string) => `<path d="M0,240 L${pts.join(' L')} L420,240 Z" fill="${fill}"/>`;
  return `<svg viewBox="0 0 420 240" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="420" height="240" fill="${sky}"/><circle cx="${80 + Math.round(rnd(5) * 260)}" cy="52" r="20" fill="#fff" opacity=".6"/>${poly(far1, far)}${snow}${poly(ridge(188, 55, 9, 7), mid)}${poly(ridge(222, 26, 14, 13), near)}</svg>`;
}

export function Art({ seed, className = '' }: { seed: string; className?: string }) {
  return <div className={`art ${className}`} dangerouslySetInnerHTML={{ __html: artSvg(seed) }} />;
}
