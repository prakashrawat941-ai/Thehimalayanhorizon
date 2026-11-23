'use client';
import { useEffect, useState } from 'react';
import { weatherFor } from '@/lib/trip/engine';

/** Weather for every night stop on its dates (forecast up to 16 days, history after). */
export function useWeather(days) {
  const [byDay, setByDay] = useState({});
  const [loading, setLoading] = useState(false);
  const key = (days || []).map((x) => `${x.date}@${x.night ? `${x.night.lat},${x.night.lng}` : x.title_en}`).join('|');
  useEffect(() => {
    if (!days?.length) { setByDay({}); return; }
    let alive = true;
    setLoading(true);
    // One request per place (with all its dates).
    const groups = new Map();
    days.forEach((x) => {
      const p = x.night || x.stop;
      if (!p || p.lat == null) return;
      const k = `${(+p.lat).toFixed(3)},${(+p.lng).toFixed(3)}`;
      if (!groups.has(k)) groups.set(k, { p, dates: [] });
      groups.get(k).dates.push(x.date);
    });
    (async () => {
      const out = {};
      for (const { p, dates } of groups.values()) {
        const w = await weatherFor(p, dates).catch(() => null);
        if (!alive) return;
        dates.forEach((dt) => { out[dt] = w?.days?.[dt] || (w?.error ? { error: true } : null); });
        setByDay({ ...out });
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { byDay, loading };
}
