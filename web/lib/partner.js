// Partner portal helpers (Part 5). Database rules (RLS) limit partners to their own rows.
import { redirect } from 'next/navigation';
import { requireUser, rows } from '@/lib/account';

export async function requirePartner(next = '/partner') {
  const ctx = await requireUser(next);
  const list = await rows(ctx.db.from('partners').select('*').eq('owner_id', ctx.user.id).order('created_at'));
  if (!list.length) redirect('/partner/join');
  return { ...ctx, partner: list[0], partners: list };
}

/** Homestays, rooms and bookings for this partner. */
export async function loadHost(db, partner) {
  const [hs, bookings] = await Promise.all([
    rows(db.from('homestays').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false })),
    rows(db.from('booking_requests').select('*, homestays(name), village_tours(title), workspaces(name), homestay_rooms(room_type)').eq('partner_id', partner.id).order('start_date', { ascending: false })),
  ]);
  const rooms = hs.length ? await rows(db.from('homestay_rooms').select('*').in('homestay_id', hs.map((h) => h.id)).order('sort')) : [];
  return { hs, rooms, bookings };
}

export const AMENITIES = ['Wi-Fi', 'Hot water', 'Parking', 'Home-cooked meals', 'Mountain view', 'Power backup', 'Heater', 'Garden', 'Bonfire', 'Pet friendly', 'Kids friendly', 'Workspace'];
