import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireUser } from '@/lib/account';
import { getListings, getLocations, getPlaces } from '@/lib/data';
import { draftFromRow } from '@/lib/trip/common';
import { TripReport } from '@/components/trip/TripReport';
import { TripActions } from '@/components/trip/TripActions';

export const metadata = { robots: { index: false } };

export default async function TripPage({ params }) {
  const { id } = await params;
  const { db } = await requireUser(`/trips/${id}`);
  const { lang, L, t } = await getT();
  const { data: row } = await db.from('trips').select('*').eq('id', id).maybeSingle();
  if (!row) notFound();
  if (!row.start_place || !row.end_date) {
    // Older trips (from the first version) only have a simple day list.
    const days = Array.isArray(row.days) ? row.days : [];
    return (
      <div className="page narrow">
        <h1>{row.title}</h1>
        <p className="muted">{row.days_count} {t('days')}</p>
        <ol className="timeline">{days.map((x, i) => <li key={i}><div className="timeline-day">{t('day')} {x.day ?? i + 1}</div><div><h3>{(lang === 'hi' && x.title_hi) || x.title}</h3><p>{(lang === 'hi' && x.plan_hi) || x.plan}</p></div></li>)}</ol>
        <p className="soft-note">{L('This trip was made with the first planner. Make a new plan to get routes, weather and budget.', 'यह ट्रिप पहले वाले प्लानर से बनी थी। रास्ता, मौसम और बजट के लिए नया प्लान बनाएँ।')}</p>
      </div>
    );
  }
  const [{ data: dests }, places, locations, listings] = await Promise.all([
    db.from('trip_destinations').select('position, place').eq('trip_id', id), getPlaces(), getLocations(), getListings('homestay'),
  ]);
  const d = draftFromRow(row, dests || []);
  return (
    <div className="page">
      <TripReport d={d} places={places} locations={locations} listings={listings} lang={lang}
        actions={<TripActions id={row.id} shared={!!row.share_token} lang={lang} />} />
    </div>
  );
}
