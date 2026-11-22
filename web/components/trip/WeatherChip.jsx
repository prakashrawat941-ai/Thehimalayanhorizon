'use client';
import { WMO } from '@/lib/trip/engine';

export function WeatherChip({ w, L }) {
  if (!w) return null;
  if (w.kind === 'history') return <span className="chip" title={L(`Average of ${w.years?.join(', ')}`, `${w.years?.join(', ')} का औसत`)}>{Math.round(w.min)}–{Math.round(w.max)}°C · {L('past-years average', 'पिछले सालों का औसत')}</span>;
  const label = WMO[w.code] || ['', ''];
  return <span className="chip">{Math.round(w.min)}–{Math.round(w.max)}°C · {L(label[0], label[1])}{w.rainProb != null ? ` · ${w.rainProb}% ${L('rain', 'बारिश')}` : ''}</span>;
}
