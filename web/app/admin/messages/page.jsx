import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { rows } from '@/lib/account';
import { SetField } from '@/components/admin/SetField';

export default async function Messages({ searchParams }) {
  const sp = await searchParams;
  const st = ['new', 'replied', 'closed'].includes(sp.status) ? sp.status : 'new';
  const { db } = await requireAdmin('/admin/messages');
  const { L, lang } = await getT();
  const list = await rows(db.from('contact_messages').select('*').eq('status', st).order('created_at', { ascending: false }).limit(200));
  const when = (iso) => new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const label = { new: L('New', 'नए'), replied: L('Replied', 'जवाब दिया'), closed: L('Closed', 'बंद') };
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Contact messages', 'संपर्क मैसेज')}</h1><p className="muted">{L('Reply by email or phone, then mark it.', 'ईमेल या फ़ोन से जवाब दें, फिर स्थिति बदलें।')}</p></div></div>
      <div className="seg-tabs">{['new', 'replied', 'closed'].map((s) => <Link key={s} className={st === s ? 'on' : ''} href={`/admin/messages?status=${s}`}>{label[s]}</Link>)}</div>
      <div className="ds-body">{list.length ? list.map((m) => (
        <article key={m.id} className="ds-panel">
          <div><strong>{m.name}</strong> · <a href={`mailto:${m.email}`}>{m.email}</a>{m.phone ? <> · <a href={`tel:${m.phone}`}>{m.phone}</a></> : null} <small className="muted">· {when(m.created_at)} · {m.lang}</small></div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{m.message}</p>
          <SetField table="contact_messages" id={m.id} field="status" value={m.status} options={[['replied', label.replied], ['closed', label.closed], ['new', label.new]]} />
        </article>
      )) : <p className="muted">{L('No messages.', 'कोई मैसेज नहीं।')}</p>}</div>
    </>
  );
}
