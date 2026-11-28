import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function blocks() {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) out.push({ selector: m[1].trim(), body: m[2] });
  return out;
}
function vars(body) {
  const o = {};
  for (const m of body.matchAll(/(--ui-[a-z0-9-]+)\s*:\s*([^;]+);/g)) o[m[1]] = m[2].trim();
  return o;
}
function pick(test) {
  const found = blocks().filter((b) => test(b.selector));
  if (!found.length) throw new Error('theme block not found');
  return Object.assign({}, ...found.map((b) => vars(b.body)));
}
const isDark = (s) => s.includes('html[data-theme="dark"] ');
const THEMES = {
  'enterprise light': pick((s) => s.includes('[data-surface="enterprise"]') && !isDark(s)),
  'enterprise dark': pick((s) => isDark(s) && s.includes('[data-surface="enterprise"]')),
  'brand light': pick((s) => s.includes('[data-surface="brand"]') && !isDark(s)),
  'brand dark': pick((s) => isDark(s) && s.includes('[data-surface="brand"]')),
};

function lum(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const TEXT_PAIRS = [
  ['--ui-text', '--ui-bg'], ['--ui-text', '--ui-surface'], ['--ui-muted', '--ui-bg'], ['--ui-muted', '--ui-surface'],
  ['--ui-on-primary', '--ui-primary'], ['--ui-on-accent', '--ui-accent'], ['--ui-nav-text', '--ui-nav-bg'],
  ['--ui-nav-active-text', '--ui-nav-active-bg'],
  ['--ui-info-fg', '--ui-info-bg'], ['--ui-success-fg', '--ui-success-bg'], ['--ui-warning-fg', '--ui-warning-bg'],
  ['--ui-danger-fg', '--ui-danger-bg'], ['--ui-teal-fg', '--ui-teal-bg'], ['--ui-neutral-fg', '--ui-neutral-bg'],
];

describe('design tokens meet WCAG AA', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    describe(name, () => {
      for (const [fg, bg] of TEXT_PAIRS) {
        if (!t[fg] || !t[bg]) continue;
        it(`${fg} on ${bg} >= 4.5:1`, () => expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5));
      }
      it('control border on surface >= 3:1', () => expect(ratio(t['--ui-control-border'], t['--ui-surface'])).toBeGreaterThanOrEqual(3));
      it('focus ring on surface >= 3:1', () => expect(ratio(t['--ui-focus'], t['--ui-surface'])).toBeGreaterThanOrEqual(3));
    });
  }
  it('all four themes were found', () => expect(Object.keys(THEMES)).toHaveLength(4));
});
