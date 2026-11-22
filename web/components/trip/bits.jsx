'use client';
import { WMO, weatherWarnings, fmtKm, fmtDur } from '@/lib/trip/engine';

export function WeatherChip({ w, lang }) {
  if (!w) return null;
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  if (w.error) return <span className="chip">{L('Weather not available', 'मौसम उपलब्ध नहीं')}</span>;
  const t = `${Math.round(w.min)}°–${Math.round(w.max)}°C`;
  if (w.kind === 'history') {
    return <span className="chip" title={L(`Average of ${w.years.join(', ')}`, `${w.years.join(', ')} का औसत`)}>📊 {L('Usually', 'आम तौर पर')} {t}{w.rain >= 1 ? ` · ${L('rain likely', 'बारिश संभव')}` : ''} <small>({L('past years’ average, not a forecast', 'पिछले सालों का औसत, पूर्वानुमान नहीं')})</small></span>;
  }
  const label = WMO[w.code] ? WMO[w.code][lang === 'hi' ? 1 : 0] : '';
  return (
    <span className="chip">
      ⛅ {label} · {t}{w.rainProb != null ? ` · ${L('rain', 'बारिश')} ${w.rainProb}%` : ''}
      {weatherWarnings(w).map(([k, en, hi]) => <strong key={k} className="warn-text"> · ⚠ {L(en, hi)}</strong>)}
    </span>
  );
}

export const km = fmtKm;
export const dur = (secs, lang) => fmtDur(secs, lang === 'hi');

export const ITEM_ICON = { drive: '🚗', stop: '☕', meal: '🍲', arrive: '📍', see: '👀', warn: '⚠️', work: '💻', evening: '🌄', note: '📝' };

export function DayItems({ items, lang }) {
  return (
    <ul className="day-items">
      {items.map((it, i) => (
        <li key={i} className={it.kind === 'warn' ? 'warn-text' : ''}>
          <span aria-hidden="true">{ITEM_ICON[it.kind] || '•'}</span>
          {it.time ? <span className="mono small">{it.time}</span> : null}
          <span>{it.text || (lang === 'hi' ? it.hi || it.en : it.en)}</span>
        </li>
      ))}
    </ul>
  );
}
