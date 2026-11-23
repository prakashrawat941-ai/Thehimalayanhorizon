// Helpers for the signed-in customer portal (Part 3).
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Signed-in user + a database client acting as that user. Sends visitors to login. */
export async function requireUser(next = '/account') {
  const session = await getSession();
  if (!session.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const db = await createClient();
  return { ...session, db };
}

export async function rows(promise) {
  const { data, error } = await promise;
  if (error) { console.error('[account]', error.message); return []; }
  return data ?? [];
}

/** Today's date in India (YYYY-MM-DD). */
export const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

export const nights = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 864e5));

/** "Almora → Munsiyari" for a cab booking, using the booking's own pickup/drop when set. */
export function rideRoute(b, places, locations, pick) {
  const r = b.cab_rides || {};
  const nm = (pid, lid) => {
    const p = pid && places.find((x) => x.id === pid);
    if (p) return pick(p, 'name');
    const l = lid && locations.find((x) => x.id === lid);
    return l ? pick(l, 'name') : '?';
  };
  return `${nm(b.from_place_id || r.from_place_id, r.from_location_id)} → ${nm(b.to_place_id || r.to_place_id, r.to_location_id)}`;
}
