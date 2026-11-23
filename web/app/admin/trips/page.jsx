import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { inr } from '@/lib/format';

export default async function TripAnalytics() {
  const { db } = await requireAdmin('/admin/trips');
  const { L, lang } = await getT();
  const { data: s, error } = await db.rpc('admin_trip_stats');
  if (error || !s) return <p className="soft-note warn">{error?.message || L('No data.', 'कोई डेटा नहीं।')}</p>;
  const months = s.by_start_month || [];
  const max = Math.max(1, ...months.map((m) => m.n));
  const mname = (m) => new Date(2026, m - 1, 1).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short' });
  const obj = (o) => Object.entries(o || {}).map(([k, n]) => `${k}: ${n}`).join(' · ') || '—';
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Trip Planner analytics', 'ट्रिप प्लानर आँकड़े')}</h1><p className="muted">{L('From saved trips only (real data).', 'सिर्फ़ सेव की गई ट्रिप से (असली डेटा)।')}</p></div></div>
      <div className="ds-stats">
        <div className="ds-stat"><span className="ds-stat-l">{L('Trips', 'ट्रिप')}</span><span className="ds-stat-n">{s.total_trips}</span></div>
        <div className="ds-stat"><span className="ds-stat-l">{L('Last 30 days', 'पिछले 30 दिन')}</span><span className="ds-stat-n">{s.trips_last_30_days}</span></div>
        <div className="ds-stat"><span className="ds-stat-l">{L('Average days', 'औसत दिन')}</span><span className="ds-stat-n">{s.avg_days ?? '—'}</span></div>
        <div className="ds-stat"><span className="ds-stat-l">{L('Average budget', 'औसत बजट')}</span><span className="ds-stat-n">{s.avg_budget ? inr(s.avg_budget) : '—'}</span></div>
      </div>
      <div className="ds-cols">
        <section className="ds-panel"><h2>{L('Trips by start month', 'शुरुआती महीने के हिसाब से')}</h2>
          <div className="bars">{months.map((m) => <div key={m.month} className="bar-col"><span className="bar" style={{ height: `${(m.n / max) * 100}%` }} /><small>{mname(m.month)}</small><strong>{m.n}</strong></div>)}</div></section>
        <section className="ds-panel"><h2>{L('Popular destinations', 'लोकप्रिय जगहें')}</h2>
          <ol>{(s.top_destinations || []).map((d) => <li key={d.name}>{d.name} — {d.n}</li>)}</ol></section>
      </div>
      <section className="ds-panel small">
        <p><strong>{L('Status', 'स्थिति')}:</strong> {obj(s.by_status)}</p>
        <p><strong>{L('Travel mode', 'सवारी')}:</strong> {obj(s.by_mode)}</p>
        <p><strong>{L('Pace', 'रफ़्तार')}:</strong> {obj(s.by_pace)}</p>
        <p><strong>{L('Preferences', 'पसंद')}:</strong> {(s.top_preferences || []).map((p) => `${p.pref}: ${p.n}`).join(' · ') || '—'}</p>
      </section>
    </>
  );
}
