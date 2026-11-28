'use client';
import { useSyncExternalStore } from 'react';
import { getPref, setPref, subscribe, getServerPref, THEME_PREFS } from '@/lib/theme/theme';
import { UiIcon } from './icons';

const ICON = { light: 'sun', dark: 'moon', system: 'monitor' };

/** Light / Dark / System. Persists to localStorage (key thh.theme); the inline head script applies it before paint. */
export function ThemeToggle({ labels = {}, className }) {
  const l = { group: 'Theme', light: 'Light', dark: 'Dark', system: 'System', ...labels };
  const pref = useSyncExternalStore(subscribe, getPref, getServerPref);
  return (
    <div className={`ui-theme-toggle ${className || ''}`} role="radiogroup" aria-label={l.group}>
      {THEME_PREFS.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={pref === p}
          className={`ui-theme-opt${pref === p ? ' is-on' : ''}`}
          onClick={() => setPref(p)}
          title={l[p]}
        >
          <UiIcon name={ICON[p]} size={15} />
          <span className="ui-sr-only">{l[p]}</span>
        </button>
      ))}
    </div>
  );
}
