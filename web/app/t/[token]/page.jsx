import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { publicDb } from '@/lib/supabase/server';
import { getListings, getLocations, getPlaces, getThemes } from '@/lib/data';
import { draftFromRow } from '@/lib/trip/common';
import { TripReport } from '@/components/trip/TripReport';

export async function generateMetadata({ params }) {
  const { token } = await params;
  const { data } = await publicDb().rpc('get_shared_trip', { p_token: token });
  return { title: data?.title || 'Trip', robots: { index: false } };
}

// Read-only trip shared by link (random token). No owner details are included.
export default async function SharedTrip({ params }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const { data: t } = await publicDb().rpc('get_shared_trip', { p_token: token });
  if (!t || !t.start_place) notFound();
  const tr = await getT();
  const [places, locs, themes, listings] = await Promise.all([getPlaces(), getLocations(), getThemes(), getListings('homestay')]);
  const d = draftFromRow(t, t.destinations || []);
  const slimListings = listings.map((s) => ({ id: s.id, name: s.name, location_id: s.location_id, price_per_night: s.price_per_night, village: s.village }));
  return (
    <div className="page">
      <p className="soft-note no-print">{tr.L('Shared trip — read only.', 'शेयर की गई ट्रिप — सिर्फ़ देखने के लिए।')}</p>
      <TripReport d={d} mode="shared" lang={tr.lang} places={places} locs={locs} themes={themes} listings={slimListings} />
    </div>
  );
}
