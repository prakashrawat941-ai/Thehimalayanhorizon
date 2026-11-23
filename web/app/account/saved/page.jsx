import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireUser, rows } from '@/lib/account';
import { getLocations } from '@/lib/data';
import { Empty } from '@/components/Blocks';
import { Cover } from '@/components/Cover';
import { RemoveSaved } from '@/components/account/RemoveSaved';

export async function generateMetadata() {
  const { L } = await getT();
  return { title: L('Saved places', 'सेव की जगहें') };
}

export default async function Saved() {
  const { db, user } = await requireUser('/account/saved');
  const { t, L, pick, district } = await getT();
  const [saved, locations] = await Promise.all([
    rows(db.from('saved_destinations').select('location_id, created_at').eq('user_id', user.id).order('created_at', { ascending: false })),
    getLocations(),
  ]);
  const list = saved.map((s) => locations.find((l) => l.id === s.location_id)).filter(Boolean);
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Saved places', 'सेव की जगहें')}</h1></div></div>
      {list.length ? (
        <div className="acc-saved">
          {list.map((l) => (
            <div key={l.id} className="acc-place">
              <Link href={`/destinations/${l.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                <Cover url={l.image_url} seed={l.slug} className="acc-place-img" />
                <strong style={{ display: 'block' }}>{pick(l, 'name')}</strong>
              </Link>
              <div style={{ padding: '0 10px 10px' }}>
                <small className="muted">{district(l.district)}</small><br />
                <RemoveSaved locationId={l.id} label={L('Remove', 'हटाएँ')} />
              </div>
            </div>
          ))}
        </div>
      ) : <Empty icon="heart" text={L('No saved places yet. Tap ♥ on a place to save it.', 'अभी कोई सेव जगह नहीं। किसी जगह पर ♥ दबाकर सेव करें।')} action={<Link className="btn btn-ghost" href="/destinations">{t('destinations')}</Link>} />}
    </>
  );
}
