// In-browser stand-in for @supabase/supabase-js, used only by the offline UI tests
// (tests/ui-test.mjs). It keeps data in memory and supports the calls the app makes.
const fx = await fetch('/tests/fixtures.json').then((r) => r.json());
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const inDays = (d, h = 9) => { const x = new Date(Date.now() + d * 864e5); x.setHours(h, 0, 0, 0); return x.toISOString(); };

const role = localStorage.getItem('mock_role') || ''; // '', traveler, partner, admin
const users = {
  traveler: { id: 'u-traveler', email: 'asha@example.com', full_name: 'Asha Negi', role: 'traveler' },
  partner: { id: 'u-partner', email: 'ram@example.com', full_name: 'Ram Singh Rawat', role: 'partner' },
  admin: { id: 'u-admin', email: 'admin@example.com', full_name: 'Prakash Singh', role: 'admin' },
  driver: { id: 'u-driver', email: 'amit@example.com', full_name: 'Amit Rawat', role: 'traveler' },
  newdriver: { id: 'u-new', email: 'neha@example.com', full_name: 'Neha Sharma', role: 'traveler' },
};
const pl = (name) => fx.places.find((p) => p.name === name).id;
const loc = (slug) => fx.locations.find((l) => l.slug === slug).id;

const db = {
  ...fx,
  profiles: Object.values(users).map((u) => ({ id: u.id, full_name: u.full_name, phone: '9876543210', role: u.role, lang: 'hi', avatar_url: '', created_at: now() })),
  driver_profiles: [{ user_id: 'u-driver', full_name: 'Amit Rawat', phone: '9876500011', photo_url: '', about: 'Driving the Rishikesh–Mussoorie road for 8 years. Safe, calm, knows every bend.', is_verified: true, status: 'active', created_at: now() }],
  vehicles: [{ id: 've1', owner_id: 'u-driver', vehicle_type: 'ertiga', model: 'Maruti Ertiga', registration_no: 'UK07AB1234', seats: 6, color: '', has_ac: true, is_active: true, variant_id: 'vv1', created_at: now() }],
  cab_seat_holds: [],
  vehicle_makes: [{ id: 'mk1', name: 'Maruti Suzuki', is_active: true }, { id: 'mk2', name: 'Mahindra', is_active: true }, { id: 'mk3', name: 'Toyota', is_active: true }],
  vehicle_models: [{ id: 'mo1', make_id: 'mk1', name: 'Ertiga', category: 'muv', is_active: true }, { id: 'mo2', make_id: 'mk1', name: 'Swift', category: 'hatchback', is_active: true },
    { id: 'mo3', make_id: 'mk2', name: 'Bolero', category: 'suv', is_active: true }, { id: 'mo4', make_id: 'mk3', name: 'Innova Crysta', category: 'muv', is_active: true }, { id: 'mo5', make_id: 'mk1', name: 'Eeco', category: 'van', is_active: true }],
  vehicle_variants: [{ id: 'vv1', model_id: 'mo1', model_year: null, variant: 'Standard', seats_total: 7, passenger_seats: 6, is_verified: false, is_active: true },
    { id: 'vv2', model_id: 'mo2', model_year: null, variant: 'Standard', seats_total: 5, passenger_seats: 4, is_verified: true, is_active: true },
    { id: 'vv3', model_id: 'mo3', model_year: null, variant: 'Standard', seats_total: 7, passenger_seats: 6, is_verified: false, is_active: true },
    { id: 'vv4', model_id: 'mo4', model_year: null, variant: '7-seater', seats_total: 7, passenger_seats: 6, is_verified: false, is_active: true },
    { id: 'vv5', model_id: 'mo4', model_year: null, variant: '8-seater', seats_total: 8, passenger_seats: 7, is_verified: false, is_active: true },
    { id: 'vv6', model_id: 'mo5', model_year: null, variant: '5-seater', seats_total: 5, passenger_seats: 4, is_verified: false, is_active: true },
    { id: 'vv7', model_id: 'mo5', model_year: null, variant: '7-seater', seats_total: 7, passenger_seats: 6, is_verified: false, is_active: true }],
  vehicle_images: [], driver_documents: [],
  partners: [
    { id: 'p1', owner_id: 'u-partner', business_name: 'Rawat Family Homestay & Cabs', contact_name: 'Ram Singh Rawat', phone: '9876500001', whatsapp: '', email: '', categories: ['homestay', 'cab', 'village_tour'], village: 'Sari', location_id: loc('sari'), address: '', about: '', status: 'approved', admin_note: '', created_at: now() },
    { id: 'p2', owner_id: null, business_name: 'Mukteshwar Desk Co.', contact_name: 'Meena Bisht', phone: '9876500002', categories: ['workspace'], village: 'Mukteshwar', location_id: loc('mukteshwar'), address: '', about: '', status: 'approved', admin_note: '', created_at: now() },
    { id: 'p3', owner_id: 'u-other', business_name: 'Darkot Weavers Walks', contact_name: 'Kamla Devi', phone: '9876500003', categories: ['village_tour'], village: 'Darkot', location_id: loc('darkot'), address: '', about: '', status: 'pending', admin_note: '', created_at: now() },
  ],
  homestays: [
    { id: 'h1', partner_id: 'p1', location_id: loc('sari'), name: 'Rawat Family Homestay', village: 'Sari', summary: 'Stone-and-wood house on the Deoria Tal trail; dinner with the family.', description: 'Three rooms in a traditional Garhwali home.\n\nHot water, home-cooked meals and a walk to Deoria Tal from the door.', rooms: 3, max_guests: 8, price_per_night: 1800, meals: 'Breakfast and dinner', amenities: ['Hot water', 'Parking', 'Home food'], house_rules: 'No loud music after 10 pm.', images: [], status: 'approved', is_featured: true, admin_note: '', created_at: now() },
    { id: 'h2', partner_id: 'p1', location_id: loc('chopta'), name: 'Meadow View Rooms', village: 'Ukhimath', summary: 'Simple rooms with a view of the Chaukhamba range.', description: '', rooms: 2, max_guests: 4, price_per_night: 1500, meals: '', amenities: [], house_rules: '', images: [], status: 'pending', is_featured: false, admin_note: '', created_at: now() },
  ],
  workspaces: [
    { id: 'w1', partner_id: 'p2', location_id: loc('mukteshwar'), name: 'Orchard Desk', village: 'Mukteshwar', summary: 'Quiet desks above the orchards, with backup power.', description: '', desks: 8, wifi_mbps: 100, power_backup: true, stay_available: true, price_per_day: 600, price_per_month: 12000, amenities: ['Tea/coffee', 'Meeting room'], images: [], status: 'approved', is_featured: false, admin_note: '', created_at: now() },
  ],
  village_tours: [
    { id: 'v1', partner_id: 'p1', location_id: loc('sari'), title: 'A day in Sari village', village: 'Sari', summary: 'Farm walk, mandua roti in a village kitchen and folk songs at dusk.', description: '', culture_highlights: ['Mandua farming', 'Folk songs', 'Village temple'], includes: ['Local guide', 'Lunch with family'], duration_hours: 5, price_per_person: 900, max_group: 10, languages: ['Hindi', 'Garhwali'], best_season: 'March–November', images: [], status: 'approved', is_featured: true, admin_note: '', created_at: now() },
  ],
  cab_rides: [
    { id: 'r1', partner_id: 'p1', from_location_id: loc('kathgodam'), to_location_id: loc('munsiyari'), pickup_point: 'Kathgodam station gate', drop_point: 'Munsiyari bus stand', departure_at: inDays(1, 7), vehicle_model: 'Mahindra Bolero', vehicle_type: 'suv', seats_total: 7, seats_booked: 3, price_per_seat: 900, auto_confirm: true, notes: 'Breakfast stop at Bageshwar.', status: 'open', created_at: now() },
    { id: 'r3', partner_id: null, driver_id: 'u-driver', vehicle_id: 've1', from_place_id: pl('Rishikesh'), to_place_id: pl('Mussoorie'), from_location_id: null, to_location_id: null, stops: [{ place_id: pl('Dehradun'), name: 'Dehradun' }], pickup_point: 'Rishikesh bus stand', drop_point: 'Library chowk', departure_at: inDays(1, 8), vehicle_model: 'Maruti Ertiga', vehicle_type: 'ertiga', seats_total: 6, seats_booked: 2, price_per_seat: 500, auto_confirm: false, notes: 'Tea stop at Dehradun.', status: 'open', is_test: false, ride_ref: 'UK07-2011-2026-THH-0003', created_at: now() },
    { id: 'r4', partner_id: null, driver_id: 'u-driver', vehicle_id: 've1', from_place_id: pl('Haridwar'), to_place_id: pl('Rishikesh'), from_location_id: null, to_location_id: null, stops: [], pickup_point: '', drop_point: '', departure_at: inDays(-3, 10), vehicle_model: 'Maruti Ertiga', vehicle_type: 'ertiga', seats_total: 6, seats_booked: 3, price_per_seat: 300, auto_confirm: true, notes: '', status: 'open', is_test: false, ride_ref: 'UK07-1511-2026-THH-0001', created_at: now() },
    { id: 'r2', partner_id: 'p1', from_location_id: loc('rishikesh'), to_location_id: loc('joshimath'), pickup_point: 'Rishikesh ISBT', drop_point: '', departure_at: inDays(2, 6), vehicle_model: 'Toyota Innova', vehicle_type: 'suv', seats_total: 6, seats_booked: 5, price_per_seat: 1100, auto_confirm: false, notes: '', status: 'open', created_at: now() },
  ],
  cab_bookings: [
    { id: 'cb1', ride_id: 'r1', user_id: 'u-traveler', seats: 2, passenger_name: 'Asha Negi', phone: '9876543210', note: '', status: 'confirmed', booking_code: 'THH-7K2P9Q', booking_ref: 'THH-19112026-0001', seat_numbers: [2, 3], created_at: now() },
    { id: 'cb2', ride_id: 'r3', user_id: 'u-traveler', seats: 2, passenger_name: 'Asha Negi', phone: '9876543210', note: 'Two small bags', status: 'pending', booking_code: 'THH-20112026-0002', booking_ref: 'THH-20112026-0002', hold_expires_at: new Date(Date.now() + 11 * 60e3 + 42e3).toISOString(), seat_numbers: [2, 3], created_at: now() },
    { id: 'cb3', ride_id: 'r4', user_id: 'u-traveler', seats: 3, passenger_name: 'Asha Negi', phone: '9876543210', note: '', status: 'completed', booking_code: 'THH-15112026-0001', booking_ref: 'THH-15112026-0001', seat_numbers: [1, 2, 3], created_at: now() },
  ],
  booking_requests: [
    { id: 'hb1', kind: 'homestay', homestay_id: 'h1', partner_id: 'p1', user_id: 'u-other', room_id: 'hr1', rooms_booked: 1, guest_name: 'Rohit Mehra', guest_phone: '9811100001', start_date: inDays(-40).slice(0, 10), end_date: inDays(-37).slice(0, 10), guests: 3, message: '', status: 'completed', booking_code: 'THH-H-01102026-0001', total_amount: 6600, commission_rate: 12, platform_commission: 792, partner_payout_amount: 5808, payout_status: 'paid', created_at: now() },
    { id: 'hb2', kind: 'homestay', homestay_id: 'h1', partner_id: 'p1', user_id: 'u-other', room_id: 'hr2', rooms_booked: 1, guest_name: 'Sara Thomas', guest_phone: '9811100002', start_date: inDays(-9).slice(0, 10), end_date: inDays(-7).slice(0, 10), guests: 2, message: '', status: 'completed', booking_code: 'THH-H-12112026-0004', total_amount: 3600, commission_rate: 12, platform_commission: 432, partner_payout_amount: 3168, payout_status: 'unpaid', created_at: now() },
    { id: 'hb3', kind: 'homestay', homestay_id: 'h1', partner_id: 'p1', user_id: 'u-other', room_id: 'hr1', rooms_booked: 1, guest_name: 'Vikram Joshi', guest_phone: '9811100003', start_date: inDays(0).slice(0, 10), end_date: inDays(2).slice(0, 10), guests: 4, message: 'Arriving by 3 pm', status: 'confirmed', booking_code: 'THH-H-20112026-0006', total_amount: 4400, commission_rate: 12, platform_commission: 528, partner_payout_amount: 3872, payout_status: 'unpaid', created_at: now() },
    { id: 'b1', kind: 'homestay', homestay_id: 'h1', village_tour_id: null, workspace_id: null, partner_id: 'p1', user_id: 'u-traveler', guest_name: 'Asha Negi', guest_phone: '9876543210', start_date: inDays(10).slice(0, 10), end_date: inDays(12).slice(0, 10), guests: 2, message: 'Vegetarian food please', status: 'requested', partner_note: '', created_at: now() },
  ],
  trips: [
    { id: 't1', user_id: 'u-traveler', title: 'Kumaon with family', start_date: inDays(12).slice(0, 10), days_count: 4, travellers: 3, budget: 30000, theme_slugs: ['village-life'], from_itinerary_id: null, days: [{ day: 1, title: 'Arrive in Almora', plan: '', location: 'almora' }], notes: '', created_at: now(), updated_at: now() },
  ],
  notifications: [
    { id: 'n1', user_id: 'u-partner', title: 'New booking request', body: 'Asha Negi · Rawat Family Homestay', link: '#/partner/requests', read_at: null, created_at: now() },
    { id: 'n2', user_id: 'u-traveler', title: 'Cab booking confirmed', body: 'Kathgodam → Munsiyari', link: '#/account', read_at: null, created_at: now() },
  ],
  admin_emails: [],
  trip_destinations: [], trip_expenses: [], saved_destinations: [],
  homestay_rooms: [
    { id: 'hr1', homestay_id: 'h1', room_type: 'Family room', base_price: 2200, weekend_price: 2600, max_guests: 4, total_inventory: 2, is_active: true, sort: 0 },
    { id: 'hr2', homestay_id: 'h1', room_type: 'Double room', base_price: 1800, weekend_price: null, max_guests: 2, total_inventory: 1, is_active: true, sort: 1 }],
  room_rates: [],
  partner_kyc: [], payout_requests: [], support_tickets: [], ticket_messages: [],
  destination_reviews: [{ id: 'dr1', user_id: 'u-traveler', location_id: loc('mukteshwar'), rating: 5, body: 'Quiet orchards and a great sunrise view.', status: 'pending', created_at: now() }],
};

window.__db = db; // tests may adjust data, then re-render with a hashchange
const singular = { homestays: 'homestay', village_tours: 'village_tour', workspaces: 'workspace', partners: 'partner', cab_rides: 'ride', profiles: 'user' };
db.cab_seat_holds = [{ ride_id: 'r3', booking_id: 'cb2', seat_no: 2, released_at: null }, { ride_id: 'r3', booking_id: 'cb2', seat_no: 3, released_at: null }];

function project(table, row, select) {
  const out = { ...row };
  const re = /(\w+)\(([^)]*)\)/g; let m;
  while ((m = re.exec(select || ''))) {
    const rel = m[1];
    const fk = `${singular[rel] || rel}_id`;
    if (fk in row) out[rel] = (db[rel] || []).find((x) => x.id === row[fk]) || null;
    else out[rel] = (db[rel] || []).filter((x) => x[`${singular[table]}_id`] === row.id);
  }
  return out;
}

class Query {
  constructor(table) { this.table = table; this.filters = []; this.op = 'select'; this.orders = []; }
  select(cols = '*', opts = {}) { if (this.op === 'select') this.cols = cols; this.returning = true; this.countOpt = opts; return this; }
  eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
  neq(c, v) { this.filters.push((r) => r[c] !== v); return this; }
  is(c, v) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  gt(c, v) { this.filters.push((r) => r[c] > v); return this; }
  gte(c, v) { this.filters.push((r) => r[c] >= v); return this; }
  lt(c, v) { this.filters.push((r) => r[c] < v); return this; }
  lte(c, v) { this.filters.push((r) => r[c] <= v); return this; }
  in(c, vs) { this.filters.push((r) => vs.includes(r[c])); return this; }
  contains(c, vs) { this.filters.push((r) => vs.every((v) => (r[c] || []).includes(v))); return this; }
  order(c, o = {}) { this.orders.push([c, o.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this._single = 'maybe'; return this; }
  single() { this._single = 'one'; return this; }
  insert(v) { this.op = 'insert'; this.payload = v; return this; }
  upsert(v, o = {}) { this.op = 'upsert'; this.payload = v; this.conflict = o.onConflict ? o.onConflict.split(',') : null; return this; }
  update(v) { this.op = 'update'; this.payload = v; return this; }
  delete() { this.op = 'delete'; return this; }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
  run() {
    const rows = db[this.table] || (db[this.table] = []);
    const match = (r) => this.filters.every((f) => f(r));
    if (this.op === 'insert' || this.op === 'upsert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r) => ({ id: uid(), created_at: now(), ...(['trips', 'saved_destinations', 'destination_reviews'].includes(this.table) && session ? { user_id: session.user.id } : {}), ...r }));
      if (this.table === 'trips') {
        if (localStorage.getItem('mock_v1') && list.some((r) => 'end_date' in r)) return { data: null, error: { code: 'PGRST204', message: "Could not find the 'end_date' column of 'trips' in the schema cache" } };
        if (list.some((r) => r.client_request_id && rows.some((x) => x.client_request_id === r.client_request_id))) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
      }
      if (this.table === 'booking_requests') list.forEach((r) => { r.status = 'requested'; r.booking_code = 'THH-H-22112026-0009'; r.partner_id = r.partner_id || db.homestays.find((x) => x.id === r.homestay_id)?.partner_id; r.user_id = r.user_id || session?.user.id; if (r.room_id) { const room = db.homestay_rooms.find((x) => x.id === r.room_id); r.total_amount = room.base_price * Math.round((new Date(r.end_date) - new Date(r.start_date)) / 864e5) * (r.rooms_booked || 1); r.payout_status = 'unpaid'; } });
      if (this.op === 'upsert') list.forEach((r) => { const i = rows.findIndex((x) => (this.conflict ? this.conflict.every((c) => x[c] === r[c]) : (x.key && x.key === r.key) || x.id === r.id)); if (i >= 0) { const { id, created_at, ...rest } = r; rows[i] = { ...rows[i], ...(this.conflict ? rest : r) }; } else rows.push(r); });
      else rows.push(...list);
      return { data: this._single ? list[0] : list, error: null };
    }
    if (this.op === 'update') {
      if (this.table === 'trips' && localStorage.getItem('mock_v1') && 'end_date' in this.payload) return { data: null, error: { code: 'PGRST204', message: "Could not find the 'end_date' column" } };
      const hit = rows.filter(match); hit.forEach((r) => Object.assign(r, this.payload));
      return { data: this.returning ? (this._single ? hit[0] || null : hit) : null, error: null };
    }
    if (this.op === 'delete') { db[this.table] = rows.filter((r) => !match(r)); return { data: null, error: null }; }
    let out = rows.filter(match);
    for (const [c, asc] of [...this.orders].reverse()) out = [...out].sort((a, b) => ((a[c] > b[c]) - (a[c] < b[c])) * (asc ? 1 : -1));
    if (this.lim) out = out.slice(0, this.lim);
    out = out.map((r) => project(this.table, r, this.cols));
    if (this.countOpt?.head) return { data: null, count: out.length, error: null };
    if (this._single) return { data: out[0] || null, error: null };
    return { data: out, error: null };
  }
}

const session = role && users[role] ? { user: { id: users[role].id, email: users[role].email, user_metadata: {} } } : null;

export function createClient() {
  return {
    from: (t) => new Query(t),
    async rpc(name, args) {
      if (name === 'partner_cards') return { data: db.partners.filter((p) => args.p_ids.includes(p.id) && p.status === 'approved').map(({ id, business_name, village }) => ({ id, business_name, village })), error: null };
      if (name === 'book_cab_seats') {
        const r = db.cab_rides.find((x) => x.id === args.p_ride);
        if (r.seats_total - r.seats_booked < args.p_seats) return { data: null, error: { message: `Only ${r.seats_total - r.seats_booked} seat(s) left` } };
        r.seats_booked += args.p_seats;
        const b = { id: uid(), ride_id: r.id, user_id: session.user.id, seats: args.p_seats, passenger_name: args.p_name, phone: args.p_phone, status: r.auto_confirm ? 'confirmed' : 'pending', created_at: now() };
        db.cab_bookings.push(b); return { data: b, error: null };
      }
      if (name === 'cab_driver_cards') return { data: db.driver_profiles.filter((d) => args.p_ids.includes(d.user_id)).map((d) => ({ user_id: d.user_id, full_name: d.full_name, photo_url: d.photo_url, about: d.about, is_verified: d.is_verified, trips: 28, member_since: '2026-01-01' })), error: null };
      if (name === 'cab_ride_taken_seats') return { data: db.cab_seat_holds.filter((x) => x.ride_id === args.p_ride && !x.released_at).map((x) => x.seat_no), error: null };
      if (name === 'cab_booking_contact') { const b = db.cab_bookings.find((x) => x.id === args.p_booking); return { data: b?.status === 'confirmed' ? { name: 'Amit Rawat', phone: '9876500011', vehicle: 'Maruti Ertiga', registration: 'UK07AB1234' } : null, error: null }; }
      if (name === 'request_cab_ride') {
        const r = db.cab_rides.find((x) => x.id === args.p_ride);
        const taken = db.cab_seat_holds.filter((x) => x.ride_id === r.id && !x.released_at).map((x) => x.seat_no);
        const clash = args.p_seat_numbers.find((s) => taken.includes(s));
        if (clash) return { data: null, error: { message: `Seat ${clash} has just been taken. Please choose another seat.` } };
        const b = { id: uid(), ride_id: r.id, user_id: session.user.id, seats: args.p_seat_numbers.length, passenger_name: args.p_name, phone: args.p_phone, note: args.p_note, status: r.auto_confirm ? 'confirmed' : 'pending', booking_code: 'THH-21112026-0007', booking_ref: 'THH-21112026-0007', hold_expires_at: r.auto_confirm ? null : new Date(Date.now() + 15 * 60e3).toISOString(), seat_numbers: args.p_seat_numbers, created_at: now() };
        db.cab_bookings.push(b); args.p_seat_numbers.forEach((s) => db.cab_seat_holds.push({ ride_id: r.id, booking_id: b.id, seat_no: s, released_at: null }));
        r.seats_booked += b.seats; return { data: b, error: null };
      }
      if (name === 'respond_cab_request') { const b = db.cab_bookings.find((x) => x.id === args.p_booking); b.status = args.p_accept ? 'confirmed' : 'declined'; return { data: b, error: null }; }
      if (name === 'cancel_cab_booking') { const b = db.cab_bookings.find((x) => x.id === args.p_booking); b.status = 'cancelled'; return { data: b, error: null }; }
      if (name === 'cancel_cab_ride') { const r = db.cab_rides.find((x) => x.id === args.p_ride); r.status = 'cancelled'; return { data: r, error: null }; }
      if (name === 'driver_reliability') {
        const d = db.driver_profiles.find((x) => x.user_id === args.p_driver);
        if (!d) return { data: null, error: null };
        const rich = localStorage.getItem('mock_rel') === 'rich';
        return { data: rich ? { verified: d.is_verified, member_since: '2025-03-01', completed_rides: 42, passengers_served: 118, cancelled_rides: 1, cancellation_rate: 0.023, reviews: 37, avg_rating: 4.8, category_avg: { safety: 4.9, punctuality: 4.6 }, score: 96, level: 'excellent', enough_history: true }
          : { verified: d.is_verified, member_since: '2026-10-02', completed_rides: 2, passengers_served: 5, cancelled_rides: 0, cancellation_rate: 0, reviews: 2, avg_rating: 5, category_avg: {}, score: null, level: 'new', enough_history: false }, error: null };
      }
      if (name === 'quote_homestay') {
        const r = db.homestay_rooms.find((x) => x.id === args.p_room); if (!r) return { data: null, error: { message: 'Room not found' } };
        let total = 0; for (let d = new Date(`${args.p_start}T00:00:00Z`); d < new Date(`${args.p_end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
          const iso = d.toISOString().slice(0, 10); const rr = db.room_rates.find((x) => x.room_id === r.id && x.date === iso);
          total += rr?.custom_price ?? ([5, 6].includes(d.getUTCDay()) && r.weekend_price ? r.weekend_price : r.base_price);
        }
        const n = Math.round((new Date(args.p_end) - new Date(args.p_start)) / 864e5);
        return { data: { nights: n, rooms: args.p_rooms || 1, total: total * (args.p_rooms || 1), available: true }, error: null };
      }
      if (name === 'request_payout') {
        const k = db.partner_kyc.find((x) => x.partner_id === args.p_partner);
        if (!k || k.status !== 'verified') return { data: null, error: { message: 'Complete KYC and bank / UPI details first. Payouts open after verification.' } };
        const due = db.booking_requests.filter((b) => b.partner_id === args.p_partner && b.status === 'completed' && b.payout_status === 'unpaid');
        const p = { id: uid(), partner_id: args.p_partner, amount: due.reduce((s, b) => s + b.partner_payout_amount, 0), bookings_count: due.length, status: 'pending', transaction_ref: '', admin_note: '', requested_at: now() };
        db.payout_requests.push(p); due.forEach((b) => { b.payout_status = 'processing'; b.payout_id = p.id; }); return { data: p, error: null };
      }
      if (name === 'admin_process_payout') {
        const p = db.payout_requests.find((x) => x.id === args.p_id);
        if (args.p_approve && String(args.p_ref || '').trim().length < 3) return { data: null, error: { message: 'Enter the transaction reference (UTR / UPI ref)' } };
        Object.assign(p, { status: args.p_approve ? 'approved' : 'rejected', transaction_ref: args.p_ref || '', admin_note: args.p_note || '', processed_at: now() });
        db.booking_requests.filter((b) => b.payout_id === p.id).forEach((b) => { b.payout_status = args.p_approve ? 'paid' : 'unpaid'; }); return { data: p, error: null };
      }
      if (name === 'open_ticket') {
        const t = { id: uid(), created_by: session.user.id, partner_id: args.p_partner, subject: args.p_subject, category: args.p_category, status: 'open', last_message_at: now(), created_at: now() };
        db.support_tickets.push(t); db.ticket_messages.push({ id: uid(), ticket_id: t.id, author_id: session.user.id, is_admin: false, body: args.p_body, created_at: now() }); return { data: t, error: null };
      }
      if (name === 'post_ticket_message') {
        const t = db.support_tickets.find((x) => x.id === args.p_ticket); const adm = role === 'admin';
        const m = { id: uid(), ticket_id: t.id, author_id: session.user.id, is_admin: adm, body: args.p_body, created_at: now() };
        db.ticket_messages.push(m); t.status = args.p_close ? 'closed' : adm ? 'answered' : 'open'; t.last_message_at = now(); return { data: m, error: null };
      }
      if (name === 'admin_homestay_stats') {
        const live = db.booking_requests.filter((b) => b.kind === 'homestay' && ['confirmed', 'checked_in', 'completed'].includes(b.status));
        return { data: { gmv: live.reduce((s, b) => s + (b.total_amount || 0), 0), commission: live.reduce((s, b) => s + (b.platform_commission || 0), 0), paid_out: 5808,
          active_partners: db.partners.filter((p) => p.status === 'approved').length, live_homestays: db.homestays.filter((x) => x.status === 'approved').length,
          pending_properties: db.homestays.filter((x) => x.status === 'pending').length, pending_kyc: db.partner_kyc.filter((x) => x.status === 'pending').length,
          pending_partners: db.partners.filter((p) => p.status === 'pending').length, pending_payouts: db.payout_requests.filter((x) => x.status === 'pending').length,
          open_tickets: db.support_tickets.filter((x) => x.status === 'open').length,
          by_month: [...new Set(live.map((b) => b.start_date.slice(0, 7)))].map((m) => ({ m, gmv: live.filter((b) => b.start_date.startsWith(m)).reduce((s, b) => s + b.total_amount, 0), commission: live.filter((b) => b.start_date.startsWith(m)).reduce((s, b) => s + b.platform_commission, 0) })) }, error: null };
      }
      if (name === 'match_cab_rides') {
        return { data: db.cab_rides.filter((r) => r.driver_id && ['open'].includes(r.status) && r.departure_at > now() && new Date(new Date(r.departure_at).getTime() + 5.5 * 3600e3).toISOString().slice(0, 10) === args.p_date && r.seats_total - r.seats_booked >= args.p_seats)
          .map((r) => ({ ride_id: r.id, ride_ref: r.ride_ref, departure_at: r.departure_at, seats_left: r.seats_total - r.seats_booked, price_per_seat: r.price_per_seat, pickup_km: 12.4, drop_km: 0.8, detour_km: 26.4, route_km: r.distance_km || null, minutes_off: null })), error: null };
      }
      if (name === 'start_cab_ride') { const r = db.cab_rides.find((x) => x.id === args.p_ride); r.status = 'started'; r.started_at = now(); db.cab_bookings.filter((b) => b.ride_id === r.id && b.status === 'pending').forEach((b) => { b.status = 'expired'; }); return { data: r, error: null }; }
      if (name === 'complete_cab_ride') { const r = db.cab_rides.find((x) => x.id === args.p_ride); r.status = 'completed'; r.completed_at = now(); db.cab_bookings.filter((b) => b.ride_id === r.id && b.status === 'confirmed').forEach((b) => { b.status = 'completed'; }); return { data: r, error: null }; }
      if (name === 'set_booking_status') {
        const b = db.booking_requests.find((x) => x.id === args.p_id); const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
        if (['checked_in', 'completed'].includes(args.p_status) && b.start_date > today) return { data: null, error: { message: 'Guests can be checked in from the check-in date' } };
        if (args.p_status === 'confirmed' && b.room_id) { const rate = db.homestays.find((x) => x.id === b.homestay_id)?.commission_rate ?? 12; b.commission_rate = rate; b.platform_commission = Math.round(b.total_amount * rate / 100); b.partner_payout_amount = b.total_amount - b.platform_commission; }
        b.status = args.p_status; if (args.p_status === 'checked_in') b.checked_in_at = now(); if (args.p_status === 'completed') { b.completed_at = now(); b.payout_status = b.payout_status || 'unpaid'; }
        return { data: b, error: null };
      }
      if (name === 'set_cab_booking_status') { const b = db.cab_bookings.find((x) => x.id === args.p_booking); b.status = args.p_status; return { data: b, error: null }; }
      if (name === 'set_trip_share') { const t = db.trips.find((x) => x.id === args.p_trip); if (!t) return { data: null, error: { message: 'Trip not found' } }; t.share_token = args.p_on ? (t.share_token || 'tok' + uid().replace(/-/g, '').slice(0, 20)) : null; return { data: t.share_token, error: null }; }
      if (name === 'get_shared_trip') { const t = db.trips.find((x) => x.share_token && x.share_token === args.p_token); return { data: t ? { ...t, user_id: undefined, destinations: db.trip_destinations.filter((x) => x.trip_id === t.id) } : null, error: null }; }
      if (name === 'admin_trip_stats') {
        const count = (k) => db.trips.reduce((o, t) => ({ ...o, [t[k] || 'n/a']: (o[t[k] || 'n/a'] || 0) + 1 }), {});
        const dn = {}; db.trip_destinations.forEach((x) => { dn[x.place.name] = (dn[x.place.name] || 0) + 1; });
        const pf = {}; db.trips.forEach((t) => (t.preferences || []).forEach((p) => { pf[p] = (pf[p] || 0) + 1; }));
        return { data: { total_trips: db.trips.length, trips_last_30_days: db.trips.length, avg_days: 4, avg_budget: 30000, avg_travellers: 3, by_status: count('status'), by_mode: count('travel_mode'), by_pace: count('pace'),
          top_destinations: Object.entries(dn).map(([name, n]) => ({ name, n })), top_preferences: Object.entries(pf).map(([pref, n]) => ({ pref, n })),
          by_start_month: [{ month: 12, n: db.trips.length }], created_by_month: [{ month: now().slice(0, 7), n: db.trips.length }], pending_reviews: db.destination_reviews.filter((r) => r.status === 'pending').length, saved_destinations: db.saved_destinations.length }, error: null };
      }
      return { data: null, error: { message: 'unknown rpc ' + name } };
    },
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ error: { message: 'Mock: set localStorage mock_role' } }),
      signInWithOAuth: async (o) => (localStorage.getItem('mock_google') === 'ok' ? (window.__oauth = o, { data: { url: 'https://accounts.google.com/' }, error: null }) : { error: { message: 'Unsupported provider: provider is not enabled' } }),
      signUp: async () => ({ data: {}, error: null }),
      signOut: async () => { localStorage.removeItem('mock_role'); return {}; },
      resetPasswordForEmail: async () => ({}),
      updateUser: async () => ({}),
    },
    // Realtime stand-in: tests call window.__rtPush(row) to simulate a seat change from another phone.
    channel() {
      const ch = { handlers: [], on(_e, _f, cb) { this.handlers.push(cb); return this; }, subscribe() { (window.__rtChannels ||= []).push(this); return this; } };
      window.__rtPush = (row) => { const r = db.cab_rides.find((x) => x.id === row.id); if (r) Object.assign(r, row); (window.__rtChannels || []).forEach((c) => c.handlers.forEach((fn) => fn({ new: r || row }))); };
      return ch;
    },
    removeChannel(ch) { window.__rtChannels = (window.__rtChannels || []).filter((c) => c !== ch); },
    storage: { from: () => ({ createSignedUrl: async (p) => ({ data: { signedUrl: 'https://example.com/signed/' + p }, error: null }), upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'img/home/hero.jpg?u=' + encodeURIComponent(p) } }) }) },
  };
}
