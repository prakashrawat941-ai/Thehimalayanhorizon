import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requirePartner, loadHost } from '@/lib/partner';
import { todayIST, nights } from '@/lib/account';
import { fmtDate, inr } from '@/lib/format';
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
  const money = (b) => {
    if (b.total_amount == null) return null;
    const fixed = b.partner_payout_amount != null;
    return (
      <div className="pp-money">
        <div><span>{fixed ? L('Guest pays', 'मेहमान देंगे') : L('Estimate', 'अनुमान')}</span><span>{inr(b.total_amount)}</span></div>
        {fixed ? <>
          <div><span>{L('THH commission', 'THH कमीशन')}{b.commission_rate != null ? ` (${Number(b.commission_rate)}%)` : ''}</span><span>− {inr(b.platform_commission || 0)}</span></div>
          <div className="you"><span>{L('You receive', 'आपको मिलेगा')}</span><span>{inr(b.partner_payout_amount)}</span></div>
        </> : <p>{L('Commission and your share are fixed by the system when you confirm.', 'कन्फर्म करने पर कमीशन और आपका हिस्सा सिस्टम तय करता है।')}</p>}
      </div>
    );
  };
  return (
    <>
      <div className="pp-head"><div><h1>{L('Bookings', 'बुकिंग')}</h1>
        <p>{L('Confirm or decline requests, and check guests in and out.', 'रिक्वेस्ट कन्फर्म या मना करें, और मेहमानों का चेक-इन / चेक-आउट करें।')}</p></div></div>
      <div className="seg-tabs" role="navigation" aria-label={L('Booking filter', 'बुकिंग फ़िल्टर')}>{TABS.map((k) => <Link key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} href={`/partner/bookings?tab=${k}`} scroll={false}>{labels[k]} ({groups[k].length})</Link>)}</div>
      {list.length ? <div className="pp-list">{list.map((b) => {
        // The guest's phone is shown once the booking is confirmed (display only).
        const showPhone = ['confirmed', 'checked_in', 'completed'].includes(b.status);
        return (
          <article key={b.id} className="pp-bk">
            <div className="pp-bk-h"><span><b>{b.guest_name}</b><small>{[b.booking_code, name(b)].filter(Boolean).join(' · ')}</small></span>
              <span className={`badge badge-${b.status}`}>{status(b.status)}</span></div>
            <dl className="pp-dl">
              <div><dt>{L('Dates', 'तारीख़')}</dt><dd>{fmtDate(b.start_date, lang)}{b.end_date !== b.start_date ? ` → ${fmtDate(b.end_date, lang)} · ${nights(b.start_date, b.end_date)} ${L('night(s)', 'रात')}` : ''}</dd></div>
              <div><dt>{L('Rooms', 'कमरे')}</dt><dd>{b.homestay_rooms?.room_type ? `${b.rooms_booked || 1} × ${b.homestay_rooms.room_type}` : '—'}</dd></div>
              <div><dt>{L('Guests', 'मेहमान')}</dt><dd>{b.guests}</dd></div>
              <div><dt>{L('Phone', 'फ़ोन')}</dt><dd>{showPhone && b.guest_phone ? <a href={`tel:${b.guest_phone}`}>{b.guest_phone}</a> : b.status === 'requested' ? L('After you confirm', 'कन्फर्म के बाद') : '—'}</dd></div>
            </dl>
            {b.message ? <p className="pp-msg"><strong>{L('Message', 'मैसेज')}:</strong> {b.message}</p> : null}
            {money(b)}
            <BookingActions lang={lang} today={today} b={{ id: b.id, status: b.status, start_date: b.start_date, kind: b.kind, guest_name: b.guest_name, total_amount: b.total_amount, summary: `${fmtDate(b.start_date, lang)}${b.end_date !== b.start_date ? ` → ${fmtDate(b.end_date, lang)}` : ''} · ${b.guests} ${L('guests', 'मेहमान')}` }} />
          </article>
        );
      })}</div> : <div className="pp-state"><h2>{tab === 'requests' ? L('No requests right now', 'अभी कोई रिक्वेस्ट नहीं') : L('Nothing here yet', 'अभी यहाँ कुछ नहीं')}</h2>
        <p>{L('New booking requests show up here. Keep your rate calendar up to date so guests can book.', 'नई बुकिंग रिक्वेस्ट यहाँ दिखेंगी। रेट कैलेंडर अपडेट रखें ताकि मेहमान बुक कर सकें।')}</p>
        <Link className="btn btn-ghost" href="/partner/calendar">{L('Open calendar', 'कैलेंडर खोलें')}</Link></div>}
    </>
  );
}
