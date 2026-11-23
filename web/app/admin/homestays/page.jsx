import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { rows } from '@/lib/account';
import { fmtDate, inr } from '@/lib/format';

const STATUSES = ['', 'requested', 'confirmed', 'checked_in', 'completed', 'declined', 'cancelled'];

export default async function HomestayBusiness({ searchParams }) {
  const sp = await searchParams;
  const { db } = await requireAdmin('/admin/homestays');
  const { L, lang, status } = await getT();
  const stats = await db.rpc('admin_homestay_stats').then((r) => r.data || {});
  let q = db.from('booking_requests').select('*, homestays(name), village_tours(title), workspaces(name), partners(business_name)').order('created_at', { ascending: false }).limit(200);
  if (STATUSES.includes(sp.status) && sp.status) q = q.eq('status', sp.status);
  if (['homestay', 'village_tour', 'workspace'].includes(sp.kind)) q = q.eq('kind', sp.kind);
  if (/^\d{4}-\d{2}-\d{2}$/.test(sp.from || '')) q = q.gte('start_date', sp.from);
  if (/^\d{4}-\d{2}-\d{2}$/.test(sp.to || '')) q = q.lte('start_date', sp.to);
  if (sp.q) q = q.or(`booking_code.ilike.%${String(sp.q).replace(/[%,()]/g, '').slice(0, 40)}%,guest_name.ilike.%${String(sp.q).replace(/[%,()]/g, '').slice(0, 40)}%`);
  const list = await rows(q);
  const months = Array.isArray(stats.by_month) ? stats.by_month : [];
  const max = Math.max(1, ...months.map((m) => (m.confirmed || 0) + (m.checked_in || 0) + (m.completed || 0) + (m.n || 0)));
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Homestay business', 'होमस्टे बिज़नेस')}</h1></div></div>
      <div className="ds-stats">
        <div className="ds-stat"><span className="ds-stat-l">GMV ({L('records', 'रिकॉर्ड')})</span><span className="ds-stat-n">{inr(stats.gmv || 0)}</span></div>
        <div className="ds-stat"><span className="ds-stat-l">{L('Commission', 'कमीशन')}</span><span className="ds-stat-n">{inr(stats.commission || 0)}</span></div>
        <div className="ds-stat"><span className="ds-stat-l">{L('Paid out', 'पेआउट हुआ')}</span><span className="ds-stat-n">{inr(stats.paid_out || 0)}</span></div>
        <div className="ds-stat"><span className="ds-stat-l">{L('Live homestays', 'लाइव होमस्टे')}</span><span className="ds-stat-n">{stats.live_homestays || 0}</span></div>
      </div>
      {months.length ? (
        <section className="ds-panel"><h2>{L('Bookings by month', 'महीने के हिसाब से बुकिंग')}</h2>
          <div className="bars">{months.slice(-8).map((m) => { const n = (m.confirmed || 0) + (m.checked_in || 0) + (m.completed || 0) + (m.n || 0); return <div key={m.month} className="bar-col"><span className="bar" style={{ height: `${(n / max) * 100}%` }} /><small>{String(m.month).slice(0, 7)}</small><strong>{n}</strong></div>; })}</div>
        </section>
      ) : null}
      <section className="ds-panel">
        <h2>{L('All bookings', 'सभी बुकिंग')}</h2>
        <form className="listing-filters" method="get">
          <label className="field"><span className="field-label">{L('Search code / guest', 'कोड / मेहमान खोजें')}</span><input className="input" name="q" defaultValue={sp.q || ''} /></label>
          <label className="field"><span className="field-label">{L('Status', 'स्थिति')}</span><select className="input" name="status" defaultValue={sp.status || ''}>{STATUSES.map((s) => <option key={s} value={s}>{s ? status(s) : L('All', 'सभी')}</option>)}</select></label>
          <label className="field"><span className="field-label">{L('Type', 'प्रकार')}</span><select className="input" name="kind" defaultValue={sp.kind || ''}><option value="">{L('All', 'सभी')}</option><option value="homestay">Homestay</option><option value="village_tour">Tour</option><option value="workspace">Workspace</option></select></label>
          <label className="field"><span className="field-label">{L('From', 'से')}</span><input className="input" type="date" name="from" defaultValue={sp.from || ''} /></label>
          <label className="field"><span className="field-label">{L('To', 'तक')}</span><input className="input" type="date" name="to" defaultValue={sp.to || ''} /></label>
          <button className="btn">{L('Filter', 'फ़िल्टर')}</button>
          <Link className="link" href="/admin/homestays">{L('Clear', 'हटाएँ')}</Link>
        </form>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>{L('Booking', 'बुकिंग')}</th><th>{L('Partner', 'पार्टनर')}</th><th>{L('Dates', 'तारीख़')}</th><th className="right">{L('Amount', 'रकम')}</th><th>{L('Status', 'स्थिति')}</th></tr></thead>
          <tbody>{list.map((b) => (
            <tr key={b.id}><td><span className="mono small">{b.booking_code || '—'}</span><div className="small">{b.homestays?.name || b.village_tours?.title || b.workspaces?.name} · {b.guest_name}</div></td>
              <td className="small">{b.partners?.business_name}</td><td className="small">{fmtDate(b.start_date, lang)}{b.end_date !== b.start_date ? ` → ${fmtDate(b.end_date, lang)}` : ''}</td>
              <td className="right small">{b.total_amount != null ? inr(b.total_amount) : '—'}{b.platform_commission != null ? <div className="muted">{L('comm.', 'कमीशन')} {inr(b.platform_commission)}</div> : null}</td>
              <td><span className={`badge badge-${b.status}`}>{status(b.status)}</span></td></tr>
          ))}</tbody>
        </table></div>
        {!list.length ? <p className="muted">{L('No bookings match.', 'कोई बुकिंग नहीं मिली।')}</p> : null}
      </section>
    </>
  );
}
