import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { rows } from '@/lib/account';
import { fmtDate } from '@/lib/format';
import { SetField } from '@/components/admin/SetField';

export default async function Reviews({ searchParams }) {
  const sp = await searchParams;
  const st = ['pending', 'approved', 'rejected'].includes(sp.status) ? sp.status : 'pending';
  const { db } = await requireAdmin('/admin/reviews');
  const { L, lang, status } = await getT();
  const list = await rows(db.from('destination_reviews').select('*, locations(name, slug)').eq('status', st).order('created_at', { ascending: false }).limit(200));
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Review moderation', 'रिव्यू की जाँच')}</h1><p className="muted">{L('Approve only genuine traveller reviews.', 'सिर्फ़ असली यात्रियों के रिव्यू मंज़ूर करें।')}</p></div></div>
      <div className="seg-tabs">{['pending', 'approved', 'rejected'].map((s) => <Link key={s} className={st === s ? 'on' : ''} href={`/admin/reviews?status=${s}`}>{status(s)}</Link>)}</div>
      <section className="ds-panel">{list.length ? list.map((r) => (
        <div key={r.id} className="review">
          <strong>{r.locations?.name}</strong> <span className="stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span> <small className="muted">{fmtDate(r.created_at, lang)}</small>
          {r.body ? <p>{r.body}</p> : null}
          <SetField table="destination_reviews" id={r.id} field="status" value={r.status} options={[['approved', L('Approve', 'मंज़ूर')], ['rejected', L('Reject', 'मना')]]} />
        </div>
      )) : <p className="muted">{L('Nothing here.', 'यहाँ कुछ नहीं।')}</p>}</section>
    </>
  );
}
