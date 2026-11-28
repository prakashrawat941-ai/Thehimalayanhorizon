import { describe, it, expect } from 'vitest';
import vm from 'node:vm';
import { THEME_KEY, normalizePref, resolveTheme, THEME_INIT_SCRIPT } from '@/lib/theme/theme';

describe('theme preference', () => {
  it('normalizes unknown values to system', () => {
    expect(normalizePref('dark')).toBe('dark');
    expect(normalizePref('light')).toBe('light');
    expect(normalizePref('purple')).toBe('system');
    expect(normalizePref(null)).toBe('system');
  });
  it('resolves system from the OS setting', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

function runInit({ stored, systemDark, storageThrows = false }) {
  const attrs = {};
  const sandbox = {
    document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } } },
    localStorage: { getItem: (k) => { if (storageThrows) throw new Error('blocked'); return k === THEME_KEY ? stored : null; } },
    window: { matchMedia: () => ({ matches: systemDark }) },
  };
  vm.runInNewContext(THEME_INIT_SCRIPT, sandbox);
  return attrs;
}

describe('inline theme init script (no flash)', () => {
  it('applies a saved dark choice', () => expect(runInit({ stored: 'dark', systemDark: false })['data-theme']).toBe('dark'));
  it('applies a saved light choice over a dark OS', () => expect(runInit({ stored: 'light', systemDark: true })['data-theme']).toBe('light'));
  it('follows the OS when nothing is saved', () => {
    const a = runInit({ stored: null, systemDark: true });
    expect(a['data-theme']).toBe('dark');
    expect(a['data-theme-pref']).toBe('system');
  });
  it('falls back to light when storage is blocked', () => expect(runInit({ storageThrows: true, systemDark: true })['data-theme']).toBe('light'));
});
