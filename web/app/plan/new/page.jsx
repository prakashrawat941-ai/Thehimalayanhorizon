import { getT } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { getItinerary, getListings, getLocations, getPlaces, getSettings, getThemes } from '@/lib/data';
import { searchLabels } from '@/lib/searchLabels';
import { Planner } from '@/components/trip/Planner';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('nav_planner'), robots: { index: false } };
}

export default async function NewPlan({ searchParams }) {
  const sp = await searchParams;
  const tr = await getT();
  const [session, places, locs, themes, listings, settings, fromIt] = await Promise.all([
    getSession(), getPlaces(), getLocations(), getThemes(), getListings('homestay'), getSettings(),
    sp.from ? getItinerary(sp.from) : Promise.resolve(null),
  ]);
  const L = tr.L;
  const pickerLabels = {
    ...searchLabels(tr), change: L('Change', 'बदलें'), pick_map: L('Pick on map', 'मैप पर चुनें'),
    pick_map_hint: L('Tap a place on the map', 'मैप पर जगह पर टैप करें'), close: L('Close', 'बंद करें'),
  };
  const slimListings = listings.map((s) => ({ id: s.id, name: s.name, location_id: s.location_id, price_per_night: s.price_per_night, village: s.village }));
  const placeList = places.map((p) => ({ ...p, lat: Number(p.lat), lng: Number(p.lng) }));
  return (
    <div className="page">
      <Planner lang={tr.lang} places={placeList} locs={locs} themes={themes} listings={slimListings}
        defaults={settings.trip_defaults || null} pickerLabels={pickerLabels} signedIn={!!session.user}
        start={sp.place || null} fromItinerary={fromIt ? { title: fromIt.title, days: fromIt.days } : null} />
    </div>
  );
}
