import { getT } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { getItinerary, getListings, getLocation, getLocations, getPlaces, getSettings } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { draftFromRow } from '@/lib/trip/common';
import { searchLabels } from '@/lib/searchLabels';
import { Planner } from './Planner';

export async function generateMetadata() {
  const { t, L } = await getT();
  return { title: t('nav_planner'), alternates: { canonical: '/plan' },
    description: L('Plan an Uttarakhand road trip: real road route, weather, day-wise plan and budget. Free.', 'उत्तराखंड रोड ट्रिप प्लान करें: असली सड़क रास्ता, मौसम, दिन-वार प्लान और बजट। मुफ़्त।') };
}

export default async function PlanPage({ searchParams }) {
  const sp = await searchParams;
  const tr = await getT();
  const [session, places, locations, listings, settings] = await Promise.all([getSession(), getPlaces(), getLocations(), getListings('homestay'), getSettings()]);
  let initial = null;

  // Open a saved trip for editing (?trip=<id>, owner only — database rules check it).
  if (sp.trip && session.user) {
    const db = await createClient();
    const { data: t } = await db.from('trips').select('*').eq('id', sp.trip).maybeSingle();
    if (t?.start_place && t?.end_date) {
      const { data: dests } = await db.from('trip_destinations').select('position, place').eq('trip_id', t.id);
      initial = { draft: draftFromRow(t, dests || []) };
    }
  }
  // Prefill a destination from a place page or search (?place=slug or ?to=name&lat&lng).
  if (!initial && sp.place) {
    const l = await getLocation(sp.place);
    if (l?.lat != null) initial = { dest: { id: null, name: l.name, name_hi: l.name_hi, district: l.district, lat: l.lat, lng: l.lng, location_id: l.id } };
  }
  if (!initial && sp.to && sp.lat && sp.lng && Number.isFinite(+sp.lat) && Number.isFinite(+sp.lng)) {
    initial = { dest: { name: String(sp.to).slice(0, 120), lat: +sp.lat, lng: +sp.lng, ext: true } };
  }
  // Start from a ready-made itinerary (?from=slug): its places become destinations.
  if (!initial && sp.from) {
    const it = await getItinerary(sp.from);
    const slugs = [...new Set((Array.isArray(it?.days) ? it.days : []).map((x) => x.location).filter(Boolean))];
    const dests = slugs.map((s) => locations.find((l) => l.slug === s)).filter((l) => l?.lat != null)
      .map((l) => ({ id: null, name: l.name, name_hi: l.name_hi, district: l.district, lat: l.lat, lng: l.lng, location_id: l.id }));
    if (dests.length) initial = { draft: null, fromItinerary: { title: it.title, dests } };
  }
  if (initial?.fromItinerary) {
    const { blank } = await import('@/lib/trip/common');
    initial = { draft: { ...blank(), title: initial.fromItinerary.title, dests: initial.fromItinerary.dests }, fresh: true };
  }

  const slimLocs = locations.map((l) => ({ id: l.id, slug: l.slug, name: l.name, name_hi: l.name_hi, kind: l.kind, lat: l.lat, lng: l.lng, theme_slugs: l.theme_slugs, best_season: l.best_season, district: l.district }));
  const slimStays = listings.map((s) => ({ id: s.id, name: s.name, location_id: s.location_id, price_per_night: s.price_per_night, lat: s.lat ?? null, lng: s.lng ?? null }));
  return (
    <div className="page">
      <Planner lang={tr.lang} places={places} locations={slimLocs} listings={slimStays} defaults={settings.trip_defaults || {}}
        searchLabels={searchLabels(tr)} signedIn={!!session.user} initial={initial} />
    </div>
  );
}
