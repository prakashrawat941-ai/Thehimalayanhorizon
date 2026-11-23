import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { rows } from '@/lib/account';
import { fmtDate } from '@/lib/format';

export default async function Users({ searchParams }) {
  const sp = await searchParams;
  const { db } = await requireAdmin('/admin/users');
  const { L, lang } = await getT();
  let q = db.from('profiles').select('id, full_name, phone, role, lang, created_at').order('created_at', { ascending: false }).limit(200);
  const term = String(sp.q || '').replace(/[%,()]/g, '').slice(0, 60);
  if (term) q = q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
  const list = await rows(q);
  const ids = list.map((u) => u.id);
  const [partners, drivers] = ids.length ? await Promise.all([
    rows(db.from('partners').select('owner_id, business_name, status').in('owner_id', ids)),
    rows(db.from('driver_profiles').select('user_id, is_verified, status').in('user_id', ids)),
  ]) : [[], []];
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Users', 'यूज़र')}</h1>
        <p className="muted">{L('Admin role is set only by the owner directly in the database. Blocking a login is done in Supabase → Authentication → Users (ban user).', 'एडमिन रोल सिर्फ़ मालिक डेटाबेस में सीधे देते हैं। किसी लॉगिन को रोकना Supabase → Authentication → Users (ban user) से होता है।')}</p></div></div>
      <form className="listing-filters" method="get"><label className="field"><span className="field-label">{L('Search name or phone', 'नाम या फ़ोन खोजें')}</span><input className="input" name="q" defaultValue={sp.q || ''} /></label><button className="btn">{L('Search', 'खोजें')}</button></form>
      <section className="ds-panel"><div className="table-wrap"><table className="table">
        <thead><tr><th>{L('Name', 'नाम')}</th><th>{L('Phone', 'फ़ोन')}</th><th>{L('Access', 'पहुँच')}</th><th>{L('Joined', 'जुड़े')}</th></tr></thead>
        <tbody>{list.map((u) => {
          const p = partners.find((x) => x.owner_id === u.id); const d = drivers.find((x) => x.user_id === u.id);
          return <tr key={u.id}><td>{u.full_name || '—'}</td><td>{u.phone || '—'}</td>
            <td className="small">{[u.role === 'admin' ? 'Admin' : null, p ? `${L('Partner', 'पार्टनर')}: ${p.business_name} (${p.status})` : null, d ? `${L('Driver', 'ड्राइवर')}${d.is_verified ? ' ✓' : ''}` : null, L('Traveller', 'यात्री')].filter(Boolean).join(' · ')}</td>
            <td className="small">{fmtDate(u.created_at, lang)}</td></tr>;
        })}</tbody>
      </table></div></section>
    </>
  );
}
