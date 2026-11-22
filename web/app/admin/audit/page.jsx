import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { rows } from '@/lib/account';

export default async function Audit({ searchParams }) {
  const sp = await searchParams;
  const { db } = await requireAdmin('/admin/audit');
  const { L, lang } = await getT();
  let q = db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
  if (sp.table && /^[a-z_]{2,40}$/.test(sp.table)) q = q.eq('table_name', sp.table);
  const list = await rows(q);
  const actors = [...new Set(list.map((a) => a.actor).filter(Boolean))];
  const people = actors.length ? await rows(db.from('profiles').select('id, full_name').in('id', actors)) : [];
  const when = (iso) => new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const diff = (a, b) => Object.keys({ ...(a || {}), ...(b || {}) }).filter((k) => !['updated_at'].includes(k) && JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])).slice(0, 6);
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Audit log', 'ऑडिट लॉग')}</h1><p className="muted">{L('Who changed what, and when (latest 200).', 'किसने क्या बदला, कब (पिछले 200)।')}</p></div></div>
      <form className="listing-filters" method="get"><label className="field"><span className="field-label">{L('Table', 'टेबल')}</span><input className="input" name="table" defaultValue={sp.table || ''} placeholder="homestays" /></label><button className="btn">{L('Filter', 'फ़िल्टर')}</button></form>
      <section className="ds-panel"><div className="table-wrap"><table className="table">
        <thead><tr><th>{L('When', 'कब')}</th><th>{L('Who', 'कौन')}</th><th>{L('Action', 'काम')}</th><th>{L('Changed', 'बदला')}</th></tr></thead>
        <tbody>{list.map((a) => (
          <tr key={a.id}><td className="small">{when(a.created_at)}</td><td className="small">{people.find((p) => p.id === a.actor)?.full_name || (a.actor ? a.actor.slice(0, 8) : L('system', 'सिस्टम'))}</td>
            <td className="small">{a.action} · {a.table_name}</td><td className="small mono">{diff(a.old_row, a.new_row).map((k) => `${k}: ${JSON.stringify(a.old_row?.[k] ?? null)} → ${JSON.stringify(a.new_row?.[k] ?? null)}`.slice(0, 120)).join('; ')}</td></tr>
        ))}</tbody>
      </table></div>{!list.length ? <p className="muted">{L('No entries.', 'कोई एंट्री नहीं।')}</p> : null}</section>
    </>
  );
}
