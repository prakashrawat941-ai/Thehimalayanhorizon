'use client';
import { useTheme } from './ThemeProvider';

/** Intended for private .ds layouts; public marketing colours remain untouched. */
export function ThemeToggle({ lang = 'en' }) {
  const { theme, setTheme } = useTheme();
  const hi = lang === 'hi';
  return <label className="ui-theme-control">
    <span>{hi ? 'थीम' : 'Theme'}</span>
    <select value={theme} onChange={(event) => setTheme(event.target.value)} aria-label={hi ? 'रंग थीम चुनें' : 'Select color theme'}>
      <option value="system">{hi ? 'डिवाइस' : 'System'}</option>
      <option value="light">{hi ? 'हल्की' : 'Light'}</option>
      <option value="dark">{hi ? 'गहरी' : 'Dark'}</option>
    </select>
  </label>;
}
