import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireUser } from '@/lib/account';
import { getListings, getLocations, getPlaces, getThemes } from '@/lib/data';
import { draftFromRow } from '@/lib/trip/common';
import { LEGACY_APP } from '@/lib/config';
import { TripReport } from '@/components/trip/TripReport';

export const metadata = { robots: { index: false } };

export default async function TripPage({ params }) {
  const { id } = await params;
  const { db } = await requireUser(`/trip/${id}`);
  const tr = await getT();
  const { data: t } = await db.from('trips').select('*').eq('id', id).maybeSingle();
  if (!t) notFound();
  if (!t.start_place || !t.end_date) {
    // Trip made with the older quick planner: open it in the current app.
    return <div className="page narrow"><h1>{t.title}</h1><p>{tr.L('This trip was made with the older planner.', 'यह ट्रिप पुराने प्लानर से बनी थी।')}</p><a className="btn" href={`${LEGACY_APP}trip/${id}`}>{tr.t('open_current_app')}</a> <Link className="btn btn-ghost" href="/plan/new">{tr.t('new_trip')}</Link></div>;
  }
  const [{ data: dests }, places, locs, themes, listings] = await Promise.all([
    db.from('trip_destinations').select('position, place').eq('trip_id', id), getPlaces(), getLocations(), getThemes(), getListings('homestay'),
  ]);
  const d = draftFromRow(t, dests || []);
  const slimListings = listings.map((s) => ({ id: s.id, name: s.name, location_id: s.location_id, price_per_night: s.price_per_night, village: s.village }));
  return (
    <div className="page">
      <p className="small no-print"><Link href="/account/trips">← {tr.t('my_trips')}</Link></p>
      <TripReport d={d} mode="saved" tripId={id} shareToken={t.share_token} lang={tr.lang} places={places} locs={locs} themes={themes} listings={slimListings} />
    </div>
  );
}
