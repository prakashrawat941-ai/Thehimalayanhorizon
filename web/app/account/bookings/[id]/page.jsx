import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireUser, nights } from '@/lib/account';
import { fmtDate, inr } from '@/lib/format';
import Link from 'next/link';
import { PrintButton } from '@/components/account/PrintButton';
import { splitHouseRules } from '@/lib/stay';

export async function generateMetadata() {
  const { L } = await getT();
  return { title: L('Booking voucher', 'बुकिंग वाउचर') };
}

// Printable homestay voucher (only the guest who booked can open it; RLS checks that).
export default async function Voucher({ params }) {
  const { id } = await params;
  const { db } = await requireUser(`/account/bookings/${id}`);
  const { L, lang, status } = await getT();
  const { data: b } = await db.from('booking_requests').select('*').eq('id', id).maybeSingle();
  if (!b || b.kind !== 'homestay' || !['confirmed', 'checked_in', 'completed'].includes(b.status)) notFound();
  const [{ data: x }, room, partner] = await Promise.all([
    db.from('homestays').select('name, village, district, state, meals, house_rules').eq('id', b.homestay_id).maybeSingle(),
    b.room_id ? db.from('homestay_rooms').select('room_type').eq('id', b.room_id).maybeSingle().then((r) => r.data) : null,
    db.rpc('partner_cards', { p_ids: [b.partner_id] }).then((r) => r.data?.[0] ?? null),
  ]);
  const rules = splitHouseRules(x?.house_rules);
  const day = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const cell = (k, v, wide) => (v ? <div className={wide ? 'w' : undefined}><span>{k}</span><b>{v}</b></div> : null);
  return (
    <div className="voucher">
      <p className="no-print" style={{ margin: '0 0 8px' }}><Link href="/account/bookings">← {L('Stays & tours', 'होमस्टे और टूर')}</Link></p>
      <article className="ac-vc">
        <header className="ac-vc-h">
          <span className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/brand/mark.png" alt="" width={40} height={38} />
            <span><strong>The Himalayan Horizon</strong><br /><small className="muted">{L('Homestay booking voucher', 'होमस्टे बुकिंग वाउचर')}</small></span>
          </span>
          <span className="ac-vc-code" aria-label={L('Booking ID', 'बुकिंग आईडी')}>{b.booking_code}</span>
        </header>
        <div><h1>{x?.name}</h1><p className="muted" style={{ margin: '2px 0 0' }}>{[x?.village, x?.district, x?.state].filter(Boolean).join(', ')}</p></div>
        <div className="ac-vc-grid">
          {cell(L('Check-in', 'चेक-इन'), `${day(b.start_date)}${rules.checkin ? ` · ${L('from', 'से')} ${rules.checkin}` : ''}`)}
          {cell(L('Check-out', 'चेक-आउट'), `${day(b.end_date)}${rules.checkout ? ` · ${L('by', 'तक')} ${rules.checkout}` : ''}`)}
          {cell(L('Room', 'कमरा'), room ? `${b.rooms_booked || 1} × ${room.room_type}` : null)}
          {cell(L('Guests', 'मेहमान'), `${b.guests} · ${nights(b.start_date, b.end_date)} ${L('night(s)', 'रात')}`)}
          {cell(L('Guest', 'मेहमान'), [b.guest_name, b.guest_phone].filter(Boolean).join(' · '))}
          {cell(L('Status', 'स्थिति'), status(b.status))}
          {cell(L('Host', 'होस्ट'), partner?.business_name)}
          {cell(L('Booking value', 'बुकिंग की रकम'), b.total_amount != null ? inr(b.total_amount) : null)}
          {cell(L('Meals', 'खाना'), x?.meals, true)}
          {cell(L('Cancellation', 'रद्द करना'), rules.cancellation, true)}
        </div>
        <p className="small muted" style={{ margin: 0 }}>{L('Payment is made directly to the host as agreed. Show this voucher at check-in.', 'भुगतान तय अनुसार सीधे होस्ट को। चेक-इन पर यह वाउचर दिखाएँ।')}</p>
        <div className="row-actions no-print">
          <PrintButton label={L('Print / save as PDF', 'प्रिंट / PDF सेव करें')} />
          <Link className="btn btn-ghost" href="/plan">{L('Plan the road', 'रास्ता प्लान करें')}</Link>
        </div>
      </article>
    </div>
  );
}
