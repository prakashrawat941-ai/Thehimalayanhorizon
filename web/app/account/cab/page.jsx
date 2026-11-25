import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireUser, rows, rideRoute } from '@/lib/account';
import { getLocations, getPlaces } from '@/lib/data';
import { inr } from '@/lib/format';
import { Empty } from '@/components/Blocks';
import { Icon } from '@/components/Icon';
import { RpcButton } from '@/components/account/RpcButton';
import { Countdown } from '@/components/account/Countdown';

export async function generateMetadata() {
  const { L } = await getT();
  return { title: L('Cab bookings', 'कैब बुकिंग') };
}

const TABS = ['upcoming', 'requests', 'completed', 'cancelled'];

const when = (iso, lang) => (iso ? new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '');

export default async function CabBookings({ searchParams }) {
  const sp = await searchParams;
  const tab = TABS.includes(sp.tab) ? sp.tab : 'upcoming';
  const { db, user } = await requireUser('/account/cab');
  const tr = await getT();
  const { t, L, pick, lang } = tr;
  const [all, places, locations] = await Promise.all([
    rows(db.from('cab_bookings')
      .select('*, cab_rides(departure_at, from_location_id, to_location_id, from_place_id, to_place_id, from_geo, to_geo, pickup_point, drop_point, vehicle_model, price_per_seat, ride_ref, status)')
      .eq('user_id', user.id).order('created_at', { ascending: false })),
    getPlaces(), getLocations(),
  ]);
  const now = Date.now();
  const dep = (b) => new Date(b.cab_rides?.departure_at || 0).getTime();
  const groups = {
    upcoming: all.filter((b) => b.status === 'confirmed' && b.cab_rides?.status !== 'completed').sort((a, b) => dep(a) - dep(b)),
    requests: all.filter((b) => b.status === 'pending'),
    completed: all.filter((b) => b.status === 'completed' || (b.status === 'confirmed' && b.cab_rides?.status === 'completed')),
    cancelled: all.filter((b) => ['cancelled', 'declined', 'expired'].includes(b.status)),
  };
  const labels = { upcoming: L('Upcoming', 'आने वाली'), requests: L('Requests', 'रिक्वेस्ट'), completed: L('Completed', 'पूरी हुईं'), cancelled: L('Cancelled', 'रद्द') };
  const list = groups[tab];

  // Driver phone and vehicle number only for confirmed bookings (the database enforces this too).
  const contacts = Object.fromEntries(await Promise.all(list.filter((b) => b.status === 'confirmed').map(async (b) => {
    const { data } = await db.rpc('cab_booking_contact', { p_booking: b.id });
    return [b.id, data];
  })));

  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Cab bookings', 'कैब बुकिंग')}</h1>
        <p className="muted">{L('Fare is paid to the driver directly. Driver phone and vehicle number appear after confirmation.', 'किराया सीधे ड्राइवर को। ड्राइवर का फ़ोन और गाड़ी नंबर कन्फर्म होने के बाद दिखेगा।')}</p></div>
        <div className="ds-actions"><Link className="btn" href="/cab"><Icon name="car" size={16} /> {L('Find a ride', 'राइड खोजें')}</Link></div>
      </div>
      <div className="seg-tabs" role="tablist">
        {TABS.map((k) => (
          <Link key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} href={`/account/cab?tab=${k}`} scroll={false}>
            {labels[k]} ({groups[k].length})
          </Link>
        ))}
      </div>
      {list.length ? (
        <div className="ds-body">
          {list.map((b) => {
            const r = b.cab_rides || {};
            const c = contacts[b.id];
            const past = dep(b) < now;
            return (
              <article key={b.id} className="ds-panel">
                <div className="ds-row" style={{ borderTop: 0, padding: 0 }}>
                  <span className="ds-row-ico"><Icon name="car" /></span>
                  <span className="grow"><strong>{rideRoute(b, places, locations, pick)}</strong><span>{when(r.departure_at, lang)}{r.vehicle_model ? ` · ${r.vehicle_model}` : ''}</span></span>
                  {b.status === 'pending' && b.hold_expires_at
                    ? <Countdown until={b.hold_expires_at} labels={{ held: L('Held', 'होल्ड'), expired: L('Hold ended', 'होल्ड खत्म') }} />
                    : <span className={`badge badge-${b.status}`}>{tr.status(b.status)}</span>}
                </div>
                <dl className="kv-rows">
                  {b.booking_ref || b.booking_code ? <div className="kv-row"><dt>{L('Booking ID', 'बुकिंग आईडी')}</dt><dd className="mono">{b.booking_ref || b.booking_code}</dd></div> : null}
                  {r.ride_ref ? <div className="kv-row"><dt>{L('Ride ID', 'राइड आईडी')}</dt><dd className="mono">{r.ride_ref}</dd></div> : null}
                  <div className="kv-row"><dt>{L('Seats', 'सीटें')}</dt><dd>{b.seats}{b.seat_numbers?.length ? ` (${b.seat_numbers.join(', ')})` : ''} × {inr(r.price_per_seat)} = <strong>{inr((r.price_per_seat || 0) * b.seats)}</strong></dd></div>
                  {b.status === 'pending' ? <div className="kv-row"><dt>{t('status')}</dt><dd>{L('Waiting for the driver to accept. If there is no reply in time, the seats are released automatically.', 'ड्राइवर के स्वीकार करने का इंतज़ार। समय पर जवाब न आए तो सीटें अपने आप छूट जाएँगी।')}</dd></div> : null}
                  {c ? (
                    <>
                      <div className="kv-row"><dt>{L('Driver', 'ड्राइवर')}</dt><dd>{c.name}{c.phone ? <> · <a href={`tel:${String(c.phone).replace(/\s/g, '')}`}>{c.phone}</a></> : null}</dd></div>
                      {c.registration ? <div className="kv-row"><dt>{L('Vehicle number', 'गाड़ी नंबर')}</dt><dd className="mono">{c.registration}</dd></div> : null}
                    </>
                  ) : null}
                </dl>
                <div className="row-actions">
                  <a className="btn btn-ghost btn-sm" href={`/cab/booking/${b.id}`}>{L('Ride details', 'राइड की जानकारी')}</a>
                  {['pending', 'confirmed'].includes(b.status) && !past ? (
                    <RpcButton fn="cancel_cab_booking" args={{ p_booking: b.id }} label={t('cancel')} confirmText={L('Cancel these seats?', 'ये सीटें रद्द करें?')} />
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : <Empty icon="car" text={L('Nothing here yet.', 'यहाँ अभी कुछ नहीं।')} action={<Link className="btn btn-ghost" href="/cab">{L('Find a ride', 'राइड खोजें')}</Link>} />}
    </>
  );
}
