// Booking monitor feed for /admin/bookings: homestay / tour / workspace requests and cab
// bookings as one list, newest first. Read-only; rows come from the admin's own database
// session, so the existing admin policies decide what is visible.

export const FEED_TYPES = ['all', 'stay', 'cab'];
export const FEED_GROUPS = {
  all: null,
  waiting: { stay: ['requested'], cab: ['pending'] },
  confirmed: { stay: ['confirmed', 'checked_in'], cab: ['confirmed'] },
  done: { stay: ['completed'], cab: ['completed'] },
  closed: { stay: ['declined', 'cancelled'], cab: ['declined', 'cancelled', 'expired'] },
};
export const FEED_LIMITS = [25, 50, 100, 200];

const CAB_SELECT = `id, booking_code, booking_ref, seats, status, created_at, hold_expires_at, pickup_geo, drop_geo,
  from_place:places!cab_bookings_from_place_id_fkey(name,name_hi),
  to_place:places!cab_bookings_to_place_id_fkey(name,name_hi),
  cab_rides(ride_ref, departure_at, pickup_point, drop_point, from_geo, to_geo,
    from_place:places!cab_rides_from_place_id_fkey(name,name_hi),
    to_place:places!cab_rides_to_place_id_fkey(name,name_hi),
    from_location:locations!cab_rides_from_location_id_fkey(name,name_hi),
    to_location:locations!cab_rides_to_location_id_fkey(name,name_hi))`;
const STAY_SELECT = `id, kind, booking_code, status, created_at, start_date, end_date, guests, rooms_booked, guest_name,
  homestays(name), village_tours(title), workspaces(name)`;

export function parseFeedQuery(sp = {}) {
  const type = FEED_TYPES.includes(sp.type) ? sp.type : 'all';
  const group = Object.hasOwn(FEED_GROUPS, sp.status) ? sp.status : 'all';
  const n = Number.parseInt(sp.limit, 10);
  const limit = FEED_LIMITS.includes(n) ? n : FEED_LIMITS[0];
  return { type, group, limit };
}

/** Tone for a status tag. A cab booking that is pending with a live seat hold reads as "held". */
export function feedTone(row) {
  if (row.held) return 'amber';
  return { requested: 'amber', pending: 'amber', confirmed: 'green', checked_in: 'blue', completed: 'gray',
    declined: 'red', cancelled: 'gray', expired: 'gray' }[row.status] || 'gray';
}

const placeName = (p, pick) => (p ? pick(p, 'name') : '');
function cabRoute(b, pick) {
  const r = b.cab_rides || {};
  // The passenger's own pickup/drop wins over the ride's endpoints (same order as bookingPlaces()).
  const from = placeName(b.from_place, pick) || b.pickup_geo?.name || placeName(r.from_place, pick) || placeName(r.from_location, pick) || r.from_geo?.name || r.pickup_point || '?';
  const to = placeName(b.to_place, pick) || b.drop_geo?.name || placeName(r.to_place, pick) || placeName(r.to_location, pick) || r.to_geo?.name || r.drop_point || '?';
  return `${from} → ${to}`;
}

export function normaliseStay(b) {
  return {
    key: `s-${b.id}`, type: 'stay', kind: b.kind || 'homestay',
    code: b.booking_code || null,
    title: b.homestays?.name || b.village_tours?.title || b.workspaces?.name || null,
    start: b.start_date, end: b.end_date, rooms: b.rooms_booked, guests: b.guests,
    status: b.status, held: false, holdUntil: null, createdAt: b.created_at,
  };
}

export function normaliseCab(b, pick, now = Date.now()) {
  const holdUntil = b.status === 'pending' && b.hold_expires_at && new Date(b.hold_expires_at).getTime() > now ? b.hold_expires_at : null;
  return {
    key: `c-${b.id}`, type: 'cab', kind: 'cab',
    code: b.booking_code || b.booking_ref || null,
    title: cabRoute(b, pick), departure: b.cab_rides?.departure_at || null, seats: b.seats,
    status: b.status, held: Boolean(holdUntil), holdUntil, createdAt: b.created_at,
  };
}

/** Loads the merged feed. Returns { rows, more, error } — never throws, never invents rows. */
export async function loadBookingFeed(db, { type, group, limit }, pick, now = Date.now()) {
  const want = FEED_GROUPS[group];
  const q = (table, select, kind) => {
    let query = db.from(table).select(select).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
    if (want) query = query.in('status', want[kind]);
    return query;
  };
  const [stays, cabs] = await Promise.all([
    type === 'cab' ? { data: [] } : q('booking_requests', STAY_SELECT, 'stay'),
    type === 'stay' ? { data: [] } : q('cab_bookings', CAB_SELECT, 'cab'),
  ]);
  if (stays.error || cabs.error) {
    console.error('[admin bookings]', stays.error?.message || cabs.error?.message);
    return { rows: [], more: false, error: true };
  }
  const all = [...(stays.data || []).map(normaliseStay), ...(cabs.data || []).map((b) => normaliseCab(b, pick, now))]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { rows: all.slice(0, limit), more: all.length > limit, error: false };
}
