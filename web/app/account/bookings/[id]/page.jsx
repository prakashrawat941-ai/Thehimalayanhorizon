import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireUser, nights } from '@/lib/account';
import { fmtDate, inr } from '@/lib/format';
import { PrintButton } from '@/components/account/PrintButton';

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
  const row = (k, v) => (v ? <div className="kv-row"><dt>{k}</dt><dd>{v}</dd></div> : null);
  return (
    <div className="voucher">
      <div className="vc-actions no-print"><PrintButton label={L('Print / save as PDF', 'प्रिंट / PDF सेव करें')} /></div>
      <article className="vc-card ds-panel">
        <header className="vc-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/brand/mark.png" alt="" width={44} height={42} />
          <div><strong>The Himalayan Horizon</strong><div className="small muted">{L('Homestay booking voucher', 'होमस्टे बुकिंग वाउचर')}</div></div>
          <div className="vc-code"><span className="small muted">{L('Booking ID', 'बुकिंग आईडी')}</span> <strong className="mono">{b.booking_code}</strong></div>
        </header>
        <h1>{x?.name}</h1>
        <p className="muted">{[x?.village, x?.district, x?.state].filter(Boolean).join(', ')}</p>
        <dl className="kv-rows">
          {row(L('Guest', 'मेहमान'), [b.guest_name, b.guest_phone].filter(Boolean).join(' · '))}
          {row(L('Check-in', 'चेक-इन'), fmtDate(b.start_date, lang))}
          {row(L('Check-out', 'चेक-आउट'), fmtDate(b.end_date, lang))}
          {row(L('Nights', 'रातें'), String(nights(b.start_date, b.end_date)))}
          {row(L('Room', 'कमरा'), room ? `${room.room_type} × ${b.rooms_booked || 1}` : null)}
          {row(L('Guests', 'मेहमान'), String(b.guests))}
          {row(L('Booking value', 'बुकिंग की रकम'), b.total_amount != null ? inr(b.total_amount) : null)}
          {row(L('Status', 'स्थिति'), status(b.status))}
          {row(L('Host', 'होस्ट'), partner?.business_name)}
          {row(L('Meals', 'खाना'), x?.meals)}
        </dl>
        <p className="small muted">{L('Payment is made directly to the host as agreed. Show this voucher at check-in.', 'भुगतान तय अनुसार सीधे होस्ट को। चेक-इन पर यह वाउचर दिखाएँ।')}</p>
      </article>
    </div>
  );
}
