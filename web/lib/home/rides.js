// Shared rides leaving today (IST) for the homepage. Public read of open, non-test rides
// (same rows /cab/find shows). Returns { rows, error } and never invents a ride.
import { publicDb } from '@/lib/supabase/server';

const IST = 19_800_000;
const DAY = 86_400_000;

export async function getTodayRides(limit = 8, now = Date.now()) {
  const end = new Date(Math.floor((now + IST) / DAY) * DAY - IST + DAY).toISOString();
  const { data, error } = await publicDb().from('cab_rides')
    .select(`id, departure_at, seats_total, seats_booked, price_per_seat, pickup_point, drop_point, from_geo, to_geo,
      from_place:places!cab_rides_from_place_id_fkey(name,name_hi),
      to_place:places!cab_rides_to_place_id_fkey(name,name_hi),
      from_location:locations!cab_rides_from_location_id_fkey(name,name_hi),
      to_location:locations!cab_rides_to_location_id_fkey(name,name_hi)`)
    .eq('status', 'open').eq('is_test', false)
    .gt('departure_at', new Date(now).toISOString()).lt('departure_at', end)
    .order('departure_at').limit(limit);
  if (error) { console.error('[home rides]', error.message); return { rows: [], error: true }; }
  return { rows: (data || []).filter((r) => r.seats_total - r.seats_booked > 0), error: false };
}
