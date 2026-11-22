import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requirePartner, loadHost } from '@/lib/partner';
import { todayIST, nights } from '@/lib/account';
import { fmtDate, inr } from '@/lib/format';
import { Empty } from '@/components/Blocks';
import { BookingActions } from '@/components/partner/BookingActions';

const TABS = ['requests', 'today', 'upcoming', 'completed', 'cancelled'];

export default async function PartnerBookings({ searchParams }) {
  const sp = await searchParams;
  const tab = TABS.includes(sp.tab) ? sp.tab : 'requests';
  const { db, partner } = await requirePartner('/partner/bookings');
  const { L, lang, status } = await getT();
  const { bookings } = await loadHost(db, partner);
  const today = todayIST();
  const groups = {
    requests: bookings.filter((b) => b.status === 'requested'),
    today: bookings.filter((b) => (b.status === 'confirmed' && b.start_date <= today && b.end_date >= today) || (b.status === 'checked_in')),
    upcoming: bookings.filter((b) => b.status === 'confirmed' && b.start_date > today).reverse(),
    completed: bookings.filter((b) => b.status === 'completed'),
    cancelled: bookings.filter((b) => ['declined', 'cancelled'].includes(b.status)),
  };
  const labels = { requests: L('Requests', 'रिक्वेस्ट'), today: L('Check-ins today / staying', 'आज चेक-इन / ठहरे हुए'), upcoming: L('Upcoming', 'आने वाले'), completed: L('Completed', 'पूरे'), cancelled: L('Cancelled', 'रद्द') };
  const list = groups[tab];
  const name = (b) => b.homestays?.name || b.village_tours?.title || b.workspaces?.name || b.kind;
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Bookings', 'बुकिंग')}</h1>
        <p className="muted">{L('Amounts are calculated and locked by the system when you confirm.', 'कन्फर्म करने पर रकम सिस्टम तय और लॉक करता है।')}</p></div></div>
      <div className="seg-tabs">{TABS.map((k) => <Link key={k} className={tab === k ? 'on' : ''} href={`/partner/bookings?tab=${k}`} scroll={false}>{labels[k]} ({groups[k].length})</Link>)}</div>
      {list.length ? <div className="ds-body">{list.map((b) => (
        <article key={b.id} className="ds-panel">
          <div className="ds-row" style={{ borderTop: 0, padding: 0 }}>
            <span className="grow"><strong>{b.guest_name}</strong><span>{name(b)}{b.homestay_rooms?.room_type ? ` · ${b.homestay_rooms.room_type} × ${b.rooms_booked || 1}` : ''}</span></span>
            <span className={`badge badge-${b.status}`}>{status(b.status)}</span>
          </div>
          <dl className="kv-rows">
            {b.booking_code ? <div className="kv-row"><dt>{L('Booking ID', 'बुकिंग आईडी')}</dt><dd className="mono">{b.booking_code}</dd></div> : null}
            <div className="kv-row"><dt>{L('Dates', 'तारीख़')}</dt><dd>{fmtDate(b.start_date, lang)}{b.end_date !== b.start_date ? ` → ${fmtDate(b.end_date, lang)} · ${nights(b.start_date, b.end_date)} ${L('night(s)', 'रात')}` : ''}</dd></div>
            <div className="kv-row"><dt>{L('Guests', 'मेहमान')}</dt><dd>{b.guests}</dd></div>
            <div className="kv-row"><dt>{L('Phone', 'फ़ोन')}</dt><dd>{b.guest_phone ? <a href={`tel:${b.guest_phone}`}>{b.guest_phone}</a> : '—'}</dd></div>
            {b.total_amount != null ? <div className="kv-row"><dt>{b.status === 'requested' ? L('Estimate', 'अनुमान') : L('Amount', 'रकम')}</dt><dd>{inr(b.total_amount)}{b.partner_payout_amount != null ? ` · ${L('your share', 'आपका हिस्सा')} ${inr(b.partner_payout_amount)}` : ''}</dd></div> : null}
            {b.message ? <div className="kv-row"><dt>{L('Message', 'मैसेज')}</dt><dd>{b.message}</dd></div> : null}
          </dl>
          <BookingActions lang={lang} b={{ id: b.id, status: b.status, start_date: b.start_date, kind: b.kind }} today={today} />
        </article>
      ))}</div> : <Empty icon="doc" text={L('Nothing here.', 'यहाँ कुछ नहीं।')} />}
    </>
  );
}
