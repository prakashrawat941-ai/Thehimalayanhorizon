import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { build, parseCss } from '../scripts/gen-brand-dark.mjs';

describe('generated brand dark CSS', () => {
  it('is up to date with the approved source CSS (run `npm run gen:dark` to refresh)', () => {
    const committed = readFileSync(new URL('../styles/brand-dark.generated.css', import.meta.url), 'utf8');
    expect(build()).toBe(committed);
  });
  it('is scoped so it cannot touch the public site', () => {
    const css = readFileSync(new URL('../styles/brand-dark.generated.css', import.meta.url), 'utf8');
    const rules = parseCss(css);
    expect(rules.length).toBeGreaterThan(10);
    for (const rule of rules) {
      for (const sel of rule.selector.split(',').map((x) => x.trim())) {
        expect(sel.startsWith('html[data-theme="dark"] body:has([data-surface])'), sel).toBe(true);
      }
    }
  });
  it('parses simple rules', () => {
    expect(parseCss('.a{color:#fff}').length).toBeGreaterThan(0);
  });
});
