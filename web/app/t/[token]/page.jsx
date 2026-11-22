import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { publicDb } from '@/lib/supabase/server';
import { getListings, getLocations, getPlaces } from '@/lib/data';
import { draftFromRow } from '@/lib/trip/common';
import { TripReport } from '@/components/trip/TripReport';
import { PrintButton } from '@/components/account/PrintButton';

// Public read-only trip, opened with the random share link. No owner details are returned.
export const metadata = { robots: { index: false } };

export default async function SharedTrip({ params }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const { lang, L } = await getT();
  const { data } = await publicDb().rpc('get_shared_trip', { p_token: token });
  if (!data) notFound();
  const [places, locations, listings] = await Promise.all([getPlaces(), getLocations(), getListings('homestay')]);
  const d = draftFromRow(data, data.destinations || []);
  return (
    <div className="page">
      <p className="soft-note no-print">{L('Shared trip — read only.', 'शेयर की गई ट्रिप — सिर्फ़ देखने के लिए।')}</p>
      <TripReport d={d} places={places} locations={locations} listings={listings} lang={lang}
        actions={<div className="row-actions no-print"><PrintButton label={L('Download PDF', 'PDF डाउनलोड')} /></div>} />
    </div>
  );
}
