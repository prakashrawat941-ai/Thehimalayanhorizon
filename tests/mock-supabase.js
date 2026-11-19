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
};
const loc = (slug) => fx.locations.find((l) => l.slug === slug).id;

const db = {
  ...fx,
  profiles: Object.values(users).map((u) => ({ id: u.id, full_name: u.full_name, phone: '9876543210', role: u.role, lang: 'hi', created_at: now() })),
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
    { id: 'r2', partner_id: 'p1', from_location_id: loc('rishikesh'), to_location_id: loc('joshimath'), pickup_point: 'Rishikesh ISBT', drop_point: '', departure_at: inDays(2, 6), vehicle_model: 'Toyota Innova', vehicle_type: 'suv', seats_total: 6, seats_booked: 5, price_per_seat: 1100, auto_confirm: false, notes: '', status: 'open', created_at: now() },
  ],
  cab_bookings: [
    { id: 'cb1', ride_id: 'r1', user_id: 'u-traveler', seats: 2, passenger_name: 'Asha Negi', phone: '9876543210', note: '', status: 'confirmed', created_at: now() },
  ],
  booking_requests: [
    { id: 'b1', kind: 'homestay', homestay_id: 'h1', village_tour_id: null, workspace_id: null, partner_id: 'p1', user_id: 'u-traveler', guest_name: 'Asha Negi', guest_phone: '9876543210', start_date: inDays(10).slice(0, 10), end_date: inDays(12).slice(0, 10), guests: 2, message: 'Vegetarian food please', status: 'requested', partner_note: '', created_at: now() },
  ],
  trips: [],
  notifications: [
    { id: 'n1', user_id: 'u-partner', title: 'New booking request', body: 'Asha Negi · Rawat Family Homestay', link: '#/partner/requests', read_at: null, created_at: now() },
    { id: 'n2', user_id: 'u-traveler', title: 'Cab booking confirmed', body: 'Kathgodam → Munsiyari', link: '#/account', read_at: null, created_at: now() },
  ],
  admin_emails: [],
};

const singular = { homestays: 'homestay', village_tours: 'village_tour', workspaces: 'workspace', partners: 'partner', cab_rides: 'ride', profiles: 'user' };

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
  upsert(v) { this.op = 'upsert'; this.payload = v; return this; }
  update(v) { this.op = 'update'; this.payload = v; return this; }
  delete() { this.op = 'delete'; return this; }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
  run() {
    const rows = db[this.table] || (db[this.table] = []);
    const match = (r) => this.filters.every((f) => f(r));
    if (this.op === 'insert' || this.op === 'upsert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r) => ({ id: uid(), created_at: now(), ...r }));
      if (this.op === 'upsert') list.forEach((r) => { const i = rows.findIndex((x) => (x.key && x.key === r.key) || x.id === r.id); if (i >= 0) rows[i] = { ...rows[i], ...r }; else rows.push(r); });
      else rows.push(...list);
      return { data: this._single ? list[0] : list, error: null };
    }
    if (this.op === 'update') { rows.filter(match).forEach((r) => Object.assign(r, this.payload)); return { data: null, error: null }; }
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

const session = role && users[role] ? { user: { id: users[role].id, email: users[role].email } } : null;

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
      if (name === 'set_booking_status') { const b = db.booking_requests.find((x) => x.id === args.p_id); b.status = args.p_status; return { data: b, error: null }; }
      if (name === 'set_cab_booking_status') { const b = db.cab_bookings.find((x) => x.id === args.p_booking); b.status = args.p_status; return { data: b, error: null }; }
      return { data: null, error: { message: 'unknown rpc ' + name } };
    },
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ error: { message: 'Mock: set localStorage mock_role' } }),
      signUp: async () => ({ data: {}, error: null }),
      signOut: async () => { localStorage.removeItem('mock_role'); return {}; },
      resetPasswordForEmail: async () => ({}),
      updateUser: async () => ({}),
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'https://example.com/' + p } }) }) },
  };
}
