import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireUser, rows } from '@/lib/account';
import { getLocations } from '@/lib/data';
import { fmtDate } from '@/lib/format';
import { Empty } from '@/components/Blocks';

export async function generateMetadata() {
  const { L } = await getT();
  return { title: L('My reviews', 'मेरे रिव्यू') };
}

export default async function Reviews() {
  const { db, user } = await requireUser('/account/reviews');
  const { L, pick, lang, status } = await getT();
  const [list, locations] = await Promise.all([
    rows(db.from('destination_reviews').select('id, location_id, rating, body, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false })),
    getLocations(),
  ]);
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('My reviews', 'मेरे रिव्यू')}</h1>
        <p className="muted">{L('Reviews appear on the place page after the admin approves them.', 'एडमिन की मंज़ूरी के बाद रिव्यू जगह के पेज पर दिखते हैं।')}</p></div></div>
      {list.length ? (
        <section className="ds-panel">
          {list.map((r) => {
            const l = locations.find((x) => x.id === r.location_id);
            return (
              <div className="review" key={r.id}>
                <div className="row-actions" style={{ justifyContent: 'space-between' }}>
                  {l ? <Link href={`/destinations/${l.slug}`}><strong>{pick(l, 'name')}</strong></Link> : <strong>—</strong>}
                  <span className={`badge badge-${r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending'}`}>{status(r.status)}</span>
                </div>
                <span className="stars" aria-label={`${r.rating} / 5`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className="small muted"> · {fmtDate(r.created_at, lang)}</span>
                {r.body ? <p>{r.body}</p> : null}
              </div>
            );
          })}
        </section>
      ) : <Empty icon="star" text={L('You have not written a review yet. Open a place you visited and share your experience.', 'आपने अभी कोई रिव्यू नहीं लिखा। घूमी हुई जगह खोलकर अपना अनुभव लिखें।')} action={<Link className="btn btn-ghost" href="/destinations">{L('Places', 'जगहें')}</Link>} />}
    </>
  );
}
