import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { fmtDate } from '@/lib/format';
import { feedTone, loadBookingFeed, parseFeedQuery } from '@/lib/dash/bookings';
import { BookingMonitor } from '@/components/dash/BookingMonitor';
import { FilterChips } from '@/components/dash/parts';

export async function generateMetadata() {
  const { L } = await getT();
  return { title: L('Booking monitor', 'बुकिंग मॉनिटर') };
}

const when = (iso, lang) => (iso ? new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '');

export default async function BookingMonitorPage({ searchParams }) {
  const { db } = await requireAdmin('/admin/bookings');
  const [{ L, lang, pick }, sp] = await Promise.all([getT(), searchParams]);
  const query = parseFeedQuery(sp || {});
  const feed = await loadBookingFeed(db, query, pick);
  const href = (patch) => {
    const v = { ...query, ...patch };
    const p = new URLSearchParams();
    if (v.type !== 'all') p.set('type', v.type);
    if (v.group !== 'all') p.set('status', v.group);
    if (v.limit !== 25) p.set('limit', String(v.limit));
    const s = p.toString();
    return `/admin/bookings${s ? `?${s}` : ''}`;
  };
  const rows = feed.rows.map((r) => ({
    ...r,
    tone: feedTone(r),
    when: r.type === 'cab' ? when(r.departure, lang)
      : [fmtDate(r.start, lang), r.end && r.end !== r.start ? fmtDate(r.end, lang) : ''].filter(Boolean).join(' – '),
    qty: r.type === 'cab' ? L(`${r.seats} seat(s)`, `${r.seats} सीट`)
      : [r.kind === 'homestay' && r.rooms ? L(`${r.rooms} room(s)`, `${r.rooms} कमरे`) : '', r.guests ? L(`${r.guests} guest(s)`, `${r.guests} मेहमान`) : ''].filter(Boolean).join(' · ') || '—',
  }));
  const statusWords = {
    requested: L('Waiting for host', 'होस्ट का इंतज़ार'), pending: L('Waiting for driver', 'ड्राइवर का इंतज़ार'),
    confirmed: L('Confirmed', 'कन्फ़र्म'), checked_in: L('Checked in', 'चेक-इन'), completed: L('Completed', 'पूरी'),
    declined: L('Declined', 'अस्वीकृत'), cancelled: L('Cancelled', 'रद्द'), expired: L('Expired', 'समय समाप्त'),
  };
  const status = (s) => statusWords[s] || s;
  const kinds = { homestay: L('Homestay', 'होमस्टे'), village_tour: L('Village tour', 'गाँव का टूर'), workspace: L('Workspace', 'वर्कस्पेस'), cab: L('Cab', 'कैब') };
  const tx = {
    colId: L('Booking ID', 'बुकिंग ID'), colType: L('Type', 'प्रकार'), colWhat: L('Listing / route', 'लिस्टिंग / रूट'),
    colWhen: L('When', 'कब'), colQty: L('Booked', 'बुक'), colStatus: L('Status', 'स्थिति'),
    held: L('Held', 'होल्ड'), expired: L('Hold ended', 'होल्ड खत्म'), noCode: L('No ID yet', 'ID अभी नहीं'),
    status, kind: (k) => kinds[k] || k,
    emptyTitle: L('No bookings here', 'यहाँ कोई बुकिंग नहीं'),
    emptyText: query.type === 'all' && query.group === 'all' ? L('Bookings appear here as soon as they are made.', 'बुकिंग होते ही यहाँ दिखेंगी।') : L('Try another filter.', 'दूसरा फ़िल्टर आज़माएँ।'),
    errorTitle: L('Couldn’t load bookings', 'बुकिंग लोड नहीं हुईं'),
    errorText: L('Check your connection and try again. Nothing was changed.', 'कनेक्शन जाँचकर फिर कोशिश करें। कुछ नहीं बदला गया।'),
    retry: L('Try again', 'फिर कोशिश करें'),
    more: L('Show more', 'और दिखाएँ'), showing: (n) => L(`Showing newest ${n}`, `नई ${n} दिख रही हैं`),
  };
  const nextLimit = [50, 100, 200].find((n) => n > query.limit);
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Admin', 'एडमिन')}</p><h1>{L('Booking monitor', 'बुकिंग मॉनिटर')}</h1>
        <p className="muted">{L('Homestay, tour, workspace and cab bookings, newest first. Seat holds count down live.', 'होमस्टे, टूर, वर्कस्पेस और कैब बुकिंग, नई सबसे ऊपर। सीट होल्ड का समय लाइव घटता है।')}</p></div></div>
      <FilterChips label={L('Booking type', 'बुकिंग का प्रकार')} items={[
        { href: href({ type: 'all', limit: 25 }), label: L('All', 'सभी'), on: query.type === 'all' },
        { href: href({ type: 'stay', limit: 25 }), label: L('Stays & tours', 'स्टे और टूर'), on: query.type === 'stay' },
        { href: href({ type: 'cab', limit: 25 }), label: L('Cabs', 'कैब'), on: query.type === 'cab' },
      ]} />
      <FilterChips label={L('Booking status', 'बुकिंग की स्थिति')} items={[
        { href: href({ group: 'all', limit: 25 }), label: L('Any status', 'कोई भी स्थिति'), on: query.group === 'all' },
        { href: href({ group: 'waiting', limit: 25 }), label: L('Waiting / held', 'इंतज़ार / होल्ड'), on: query.group === 'waiting' },
        { href: href({ group: 'confirmed', limit: 25 }), label: L('Confirmed', 'कन्फ़र्म'), on: query.group === 'confirmed' },
        { href: href({ group: 'done', limit: 25 }), label: L('Completed', 'पूरी'), on: query.group === 'done' },
        { href: href({ group: 'closed', limit: 25 }), label: L('Declined / cancelled', 'अस्वीकृत / रद्द'), on: query.group === 'closed' },
      ]} />
      <BookingMonitor rows={rows} error={feed.error} more={feed.more && Boolean(nextLimit)} moreHref={href({ limit: nextLimit })} tx={tx} />
    </>
  );
}
