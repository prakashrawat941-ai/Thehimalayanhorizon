// Server loaders for the Founder, CEO and Co-founder dashboards — existing tables only.
// Each returns { data, error } and never throws or invents rows. Anything that needs the
// management_* tables (team, work items, MFA, location matching) is not loaded here: those
// screens show "Not connected yet" until Codex lands the management backend (handoff D1–D3).

const IST = 19_800_000;
const DAY = 86_400_000;
export const todayIST = (now = Date.now()) => new Date(now + IST).toISOString().slice(0, 10);
export function istDayRange(now = Date.now()) {
  const start = Math.floor((now + IST) / DAY) * DAY - IST;
  return [new Date(start).toISOString(), new Date(start + DAY).toISOString()];
}
const head = { count: 'exact', head: true };
const n = async (q) => { const r = await q; if (r.error) throw r.error; return r.count || 0; };
const all = async (q) => { const r = await q; if (r.error) throw r.error; return r.data || []; };
const safe = async (label, fn) => {
  try { return { data: await fn(), error: false }; } catch (e) { console.error(`[dash ${label}]`, e?.message || e); return { data: null, error: true }; }
};

/** Founder overview: homestay booking value + commission from the existing admin stats RPC. */
export const loadFounderFinance = (db) => safe('finance', async () => {
  const r = await db.rpc('admin_homestay_stats');
  if (r.error) throw r.error;
  return { booking_value: r.data?.gmv ?? 0, commission: r.data?.commission ?? 0 };
});

/** People who hold the owner-set admin role (read-only on the access screen). */
export const loadAdmins = (db) => safe('admins', async () => {
  const list = await all(db.from('profiles').select('id, full_name').eq('role', 'admin').order('full_name'));
  return list.map((p) => ({ userId: p.id, name: p.full_name || p.id.slice(0, 8), role: 'admin', office: null, mfa: null, lastActive: null }));
});

/** Latest audit entries with actor names. */
export const loadAudit = (db, limit = 30) => safe('audit', async () => {
  const list = await all(db.from('audit_log').select('id, actor, action, table_name, created_at').order('created_at', { ascending: false }).limit(limit));
  const ids = [...new Set(list.map((a) => a.actor).filter(Boolean))];
  const people = ids.length ? await all(db.from('profiles').select('id, full_name').in('id', ids)) : [];
  return list.map((a) => ({ ...a, actorName: people.find((p) => p.id === a.actor)?.full_name || null }));
});

/** CEO operations today (IST). Alerts point to the admin screens that can act on them. */
export const loadOps = (db, now = Date.now()) => safe('ops', async () => {
  const today = todayIST(now);
  const [start, end] = istDayRange(now);
  const nowIso = new Date(now).toISOString();
  const [checkins, rides, holds, sos, slowStays, oldTickets] = await Promise.all([
    n(db.from('booking_requests').select('id', head).eq('kind', 'homestay').eq('start_date', today).in('status', ['confirmed', 'checked_in'])),
    n(db.from('cab_rides').select('id', head).gte('departure_at', start).lt('departure_at', end).neq('status', 'cancelled')),
    n(db.from('cab_bookings').select('id', head).eq('status', 'pending').gt('hold_expires_at', nowIso)),
    n(db.from('sos_incidents').select('id', head).in('status', ['open', 'acknowledged'])),
    n(db.from('booking_requests').select('id', head).eq('status', 'requested').lt('created_at', new Date(now - 12 * 3600e3).toISOString())),
    n(db.from('support_tickets').select('id', head).eq('status', 'open').lt('created_at', new Date(now - DAY).toISOString())),
  ]);
  return { counts: { checkins, rides, holds, sos }, slowStays, oldTickets };
});

/** Homepage sections for the Co-founder website screen. */
export const loadSections = (db) => safe('sections', async () =>
  all(db.from('home_sections').select('id, kind, position, enabled, title, title_hi').order('position')));

const STEP_PHOTOS = 3;
/**
 * Homestay onboarding queue: pending partners and homestays still in draft / pending review.
 * Steps are derived from existing rows: basic (partner exists), rooms (an active room),
 * photos (at least 3), policies (house rules written), kyc (submitted or verified),
 * review (homestay sent for approval).
 */
export const loadOnboarding = (db) => safe('onboarding', async () => {
  const [partners, stays, kyc] = await Promise.all([
    all(db.from('partners').select('id, business_name, village, status, created_at').eq('status', 'pending').contains('categories', ['homestay']).order('created_at')),
    all(db.from('homestays').select('id, partner_id, name, village, images, house_rules, status, updated_at, partners(business_name)').in('status', ['draft', 'pending']).order('updated_at')),
    all(db.from('partner_kyc').select('partner_id, status')),
  ]);
  const rooms = stays.length ? await all(db.from('homestay_rooms').select('homestay_id').eq('is_active', true).in('homestay_id', stays.map((s) => s.id))) : [];
  const kycOk = (pid) => kyc.some((k) => k.partner_id === pid && ['pending', 'verified'].includes(k.status));
  const out = stays.map((s) => {
    const done = ['basic'];
    if (rooms.some((r) => r.homestay_id === s.id)) done.push('rooms');
    if ((s.images || []).length >= STEP_PHOTOS) done.push('photos');
    if (String(s.house_rules || '').trim()) done.push('policies');
    if (kycOk(s.partner_id)) done.push('kyc');
    if (s.status === 'pending') done.push('review');
    return { id: s.id, partnerId: s.partner_id, name: s.name || s.partners?.business_name || '—', village: s.village, partner: s.partners?.business_name, done, at: s.updated_at };
  });
  partners.filter((p) => !stays.some((s) => s.partner_id === p.id)).forEach((p) => {
    out.push({ id: p.id, partnerId: p.id, name: p.business_name, village: p.village, partner: null, done: kycOk(p.id) ? ['basic', 'kyc'] : ['basic'], at: p.created_at });
  });
  return out;
});
