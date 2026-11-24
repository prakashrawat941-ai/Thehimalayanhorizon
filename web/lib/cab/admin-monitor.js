const rideRoute = `
  ride_ref, from_geo, to_geo,
  from_place:places!cab_rides_from_place_id_fkey(name,name_hi),
  to_place:places!cab_rides_to_place_id_fkey(name,name_hi),
  from_location:locations!cab_rides_from_location_id_fkey(name,name_hi),
  to_location:locations!cab_rides_to_location_id_fkey(name,name_hi)
`;

export const rideStatuses = ['open', 'full', 'started', 'completed', 'cancelled'];
export const bookingStatuses = ['pending', 'confirmed', 'completed', 'declined', 'expired', 'cancelled'];
export const sosStatuses = ['open', 'acknowledged', 'resolved', 'cancelled'];

const pageSize = 25;
const countOptions = { count: 'exact', head: true };
const day = 86_400_000;
const indiaOffset = 19_800_000;

export function monitorPeriod(days, now = Date.now()) {
  const midnight = Math.floor((now + indiaOffset) / day) * day - indiaOffset;
  return [new Date(midnight - (days - 1) * day).toISOString(), new Date(midnight + day).toISOString()];
}

const inPeriod = (query, field, [start, end]) => query.gte(field, start).lt(field, end);

function list(query, dateField, { overview, page }) {
  const start = overview ? 0 : (page - 1) * pageSize;
  return query.order(dateField, { ascending: false }).order('id', { ascending: false })
    .range(start, start + (overview ? 5 : pageSize) - 1);
}

function withStatus(query, status) {
  return status ? query.eq('status', status) : query;
}

function reports(db, period) {
  const rides = (timestamp, status) => inPeriod(db.from('cab_rides').select('id', countOptions), timestamp, period)
    .eq('status', status);
  const bookings = (status) => inPeriod(db.from('cab_bookings').select('id', countOptions), 'created_at', period)
    .eq('status', status);
  return Promise.all([
    // Older rides can have a completed status without a recorded completion time.
    rides('completed_at', 'completed'),
    rides('departure_at', 'completed').is('completed_at', null),
    rides('departure_at', 'cancelled'),
    bookings('confirmed'),
    bookings('completed'),
    bookings('expired'),
  ]).then(([completed, legacyCompleted, cancelled, confirmed, completedBookings, expired]) => {
    const sum = (a, b) => a.error || b.error ? null : a.count + b.count;
    return [
      sum(completed, legacyCompleted), cancelled.count,
      sum(confirmed, completedBookings), expired.count,
    ];
  });
}

export async function loadCabMonitor(db, { tab, status, days, reportDays, page }) {
  const overview = tab === 'overview';
  const period = monitorPeriod(days);
  const listOptions = { overview, page };
  const selectOptions = overview ? undefined : { count: 'exact' };

  const rides = overview || tab === 'rides' ? list(withStatus(
    inPeriod(db.from('cab_rides').select(`id, ${rideRoute}, departure_at, status, vehicle_model, seats_booked, seats_total`, selectOptions), 'departure_at', period),
    tab === 'rides' ? status : null,
  ), 'departure_at', listOptions) : null;

  const bookings = overview || tab === 'bookings' ? list(withStatus(
    inPeriod(db.from('cab_bookings').select(`id, booking_ref, booking_code, status, seats, created_at,
      pickup_geo, drop_geo,
      from_place:places!cab_bookings_from_place_id_fkey(name,name_hi),
      to_place:places!cab_bookings_to_place_id_fkey(name,name_hi),
      ride:cab_rides(${rideRoute})`, selectOptions), 'created_at', period),
    tab === 'bookings' ? status : null,
  ), 'created_at', listOptions) : null;

  const incidents = overview || tab === 'sos' ? list(
    withStatus(db.from('sos_incidents').select(`
      id, role, status, lat, lng, accuracy_m, message, emergency_name, emergency_phone,
      admin_note, cancel_reason, created_at, acknowledged_at, resolved_at,
      ride:cab_rides(${rideRoute}), booking:cab_bookings(booking_ref, booking_code)
    `, selectOptions), status || 'open'), 'created_at', listOptions,
  ) : null;

  const summary = overview ? Promise.all([
    db.from('cab_rides').select('id', countOptions).eq('status', 'started'),
    inPeriod(db.from('cab_bookings').select('id', countOptions), 'created_at', period).eq('status', 'confirmed'),
    db.from('sos_incidents').select('id', countOptions).eq('status', 'open'),
    inPeriod(db.from('cab_rides').select('id', countOptions), 'departure_at', period).eq('status', 'completed'),
  ]).then((results) => results.map(({ count }) => count)) : null;

  const report = overview || tab === 'reports'
    ? reports(db, monitorPeriod(tab === 'reports' ? days : reportDays)) : null;

  const [rideList, bookingList, sosList, metrics, reportMetrics] = await Promise.all([
    rides, bookings, incidents, summary, report,
  ]);
  return { rideList, bookingList, sosList, metrics, reportMetrics, pageSize };
}

export function ridePlaces(ride, pick) {
  return ['from', 'to'].map((end) => pick(ride?.[`${end}_place`], 'name')
    || pick(ride?.[`${end}_location`], 'name') || ride?.[`${end}_geo`]?.name);
}

export function bookingPlaces(booking, pick) {
  const [from, to] = ridePlaces(booking.ride, pick);
  return [
    pick(booking.from_place, 'name') || booking.pickup_geo?.name || from,
    pick(booking.to_place, 'name') || booking.drop_geo?.name || to,
  ];
}
