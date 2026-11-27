import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireUser, rows, todayIST, rideRoute } from '@/lib/account';
import { getLocations, getPlaces } from '@/lib/data';
import { fmtDate } from '@/lib/format';
import { Icon } from '@/components/Icon';
import { Cover } from '@/components/Cover';

export default async function AccountOverview() {
  const { db, user, profile, roles } = await requireUser('/account');
  const tr = await getT();
  const { t, L, pick, lang } = tr;
  const today = todayIST();
  const [trips, cabs, saved, unread, feedback, locations, places, recent, nextStays, reqCount] = await Promise.all([
    rows(db.from('trips').select('id,title,start_date,days_count,status').eq('user_id', user.id).neq('status', 'cancelled').gte('start_date', today).order('start_date').limit(1)),
    rows(db.from('cab_bookings').select('id,status,seats,booking_ref,booking_code,from_place_id,to_place_id,pickup_geo,drop_geo,cab_rides(departure_at,from_location_id,to_location_id,from_place_id,to_place_id,from_geo,to_geo,pickup_point,drop_point)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3)),
    rows(db.from('saved_destinations').select('location_id').eq('user_id', user.id)),
    db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null),
    db.rpc('my_pending_feedback').then((r) => (r.error ? [] : r.data || [])),
    getLocations(), getPlaces(),
    rows(db.from('notifications').select('id,title,body,created_at,read_at,link').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3)),
    rows(db.from('booking_requests').select('id,kind,status,start_date,end_date,homestays(name,village),village_tours(title),workspaces(name)').eq('user_id', user.id).in('status', ['confirmed', 'checked_in']).gte('end_date', today).order('start_date').limit(1)),
    db.from('booking_requests').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'requested'),
  ]);
  const name = profile?.full_name || user.email || '';
  const first = name.split(/\s+/)[0];
  const savedLocs = saved.map((s) => locations.find((l) => l.id === s.location_id)).filter(Boolean).slice(0, 4);
  const listingName = (b) => b.homestays?.name || b.village_tours?.title || b.workspaces?.name || b.kind;
  const next = trips[0];

  const requests = reqCount.count || 0;
  const upcomingCabs = cabs.filter((c) => c.status === 'confirmed' && new Date(c.cab_rides?.departure_at || 0).getTime() > Date.now())
    .sort((a, b) => new Date(a.cab_rides.departure_at) - new Date(b.cab_rides.departure_at));
  const ns = nextStays[0];
  const nc = upcomingCabs[0];
  const cabDay = nc ? new Date(new Date(nc.cab_rides.departure_at).getTime() + 5.5 * 3600e3).toISOString().slice(0, 10) : null;
  const useCab = nc && (!ns || cabDay < ns.start_date);
  const daysTo = (d) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
  const inDays = (d) => { const n = daysTo(d); return n <= 0 ? L('today', 'आज') : n === 1 ? L('tomorrow', 'कल') : L(`in ${n} days`, `${n} दिन में`); };
  const when = (iso) => new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

  return (
    <>
      <div className="ac-head">
        <div className="ac-hello">
          <span className="ds-avatar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" /> : (first[0] || '•').toUpperCase()}
          </span>
          <span><h1>{L(`Namaste, ${first}`, `नमस्ते, ${first}`)}</h1><small>{user.email}</small></span>
        </div>
        <form action="/auth/signout" method="post"><button className="btn btn-ghost btn-sm"><Icon name="logout" size={16} /> {t('signout')}</button></form>
      </div>

      {feedback.length ? (
        <div className="ac-banner" role="status"><Icon name="star" /><span>
          <b>{L(`How was your ride with ${feedback.map((f) => f.other_name).filter(Boolean).join(', ')}?`, `${feedback.map((f) => f.other_name).filter(Boolean).join(', ')} के साथ आपकी राइड कैसी रही?`)}</b>
          <p>{L('A quick rating helps other travellers.', 'एक छोटी रेटिंग दूसरे यात्रियों की मदद करती है।')}</p>
          <a className="btn btn-sm" href="/cab/bookings">{L('Give feedback', 'फ़ीडबैक दें')}</a></span></div>
      ) : null}

      {useCab ? (
        <div className="ac-next"><small>{L('Next up', 'अगला')} · {inDays(cabDay)}</small><b>{rideRoute(nc, places, locations, pick)}</b>
          <p>{when(nc.cab_rides.departure_at)} · {nc.seats} {L('seat(s)', 'सीट')}</p>
          <div className="ac-acts"><Link className="btn" href="/account/cab">{L('Open ride', 'राइड खोलें')}</Link></div></div>
      ) : ns ? (
        <div className="ac-next"><small>{L('Next up', 'अगला')} · {ns.status === 'checked_in' ? L('staying now', 'अभी ठहरे हैं') : inDays(ns.start_date)}</small>
          <b>{listingName(ns)}</b>
          <p>{fmtDate(ns.start_date, lang)} → {fmtDate(ns.end_date, lang)}{ns.homestays?.village ? ` · ${ns.homestays.village}` : ''}</p>
          <span className="ac-pill">✓ {L('Host confirmed', 'होस्ट ने कन्फर्म किया')}{ns.kind === 'homestay' ? ` · ${L('voucher ready', 'वाउचर तैयार')}` : ''}</span>
          <div className="ac-acts">{ns.kind === 'homestay' ? <Link className="btn" href={`/account/bookings/${ns.id}`}>{L('Open voucher', 'वाउचर खोलें')}</Link> : null}
            <Link className="btn btn-ghost" href="/account/bookings">{L('All bookings', 'सभी बुकिंग')}</Link></div></div>
      ) : (
        <div className="ac-next"><small>{L('Start here', 'यहाँ से शुरू करें')}</small><b>{L('Plan your next mountain trip', 'अपनी अगली पहाड़ी यात्रा प्लान करें')}</b>
          <p>{L('Find a homestay, share a cab or let the Trip Planner work out the route and cost.', 'होमस्टे खोजें, कैब शेयर करें या ट्रिप प्लानर से रास्ता और ख़र्च निकालें।')}</p>
          <div className="ac-acts"><Link className="btn" href="/plan">{t('plan')}</Link><Link className="btn btn-ghost" href="/homestays">{t('stays')}</Link></div></div>
      )}

      <div className="ac-quick">
        <Link className={`ac-q${requests ? ' hot' : ''}`} href="/account/bookings"><small>{L('Requests waiting', 'बाकी रिक्वेस्ट')}</small><b>{requests}</b></Link>
        <Link className={`ac-q${cabs.some((c) => c.status === 'pending') ? ' hot' : ''}`} href="/account/cab"><small>{L('Cab bookings', 'कैब बुकिंग')}</small><b>{cabs.filter((c) => ['pending', 'confirmed'].includes(c.status)).length}</b></Link>
        <Link className="ac-q" href="/account/saved"><small>{L('Saved places', 'सेव की जगहें')}</small><b>{saved.length}</b></Link>
        <Link className={`ac-q${unread.count ? ' hot' : ''}`} href="/account/notifications"><small>{L('Unread', 'नई सूचनाएँ')}</small><b>{unread.count || 0}</b></Link>
      </div>

      <div className="ac-cols">
        <section className="ac-card">
          <h2>{L('Recent activity', 'हाल की गतिविधि')} <Link href="/account/notifications">{t('view_all')}</Link></h2>
          {recent.length ? recent.map((n) => (
            <div key={n.id} className="ac-row"><span className="ac-ic"><Icon name="bell" size={18} /></span>
              <span className="ac-tx"><b>{n.title}</b>{n.body ? <small>{n.body}</small> : null}</span><span className="ac-when">{when(n.created_at)}</span></div>
          )) : <p className="muted" style={{ margin: 0 }}>{L('Booking and ride updates will show up here.', 'बुकिंग और राइड की ख़बरें यहाँ दिखेंगी।')}</p>}
        </section>
        <div className="ds-body">
          <section className="ac-card">
            <h2>{L('Next trip plan', 'अगली यात्रा का प्लान')} <Link href="/account/trips">{t('view_all')}</Link></h2>
            {next ? (
              <Link className="acc-trip" href={`/trips/${next.id}`}>
                <span className="small muted">{fmtDate(next.start_date, lang)} · {next.days_count} {t('days')}</span>
                <strong>{next.title}</strong>
                <span className="acc-link">{L('Open trip', 'यात्रा खोलें')} <Icon name="arrow" size={14} /></span>
              </Link>
            ) : <><p style={{ margin: 0 }}>{L('No saved trip plan yet.', 'अभी कोई सेव प्लान नहीं।')}</p>
              <p className="small muted" style={{ margin: '4px 0 8px' }}>{L('The Trip Planner works out the road, fuel, tolls and stops.', 'ट्रिप प्लानर रास्ता, ईंधन, टोल और रुकने की जगह निकालता है।')}</p>
              <Link className="btn btn-ghost btn-sm" href="/plan">{t('plan')}</Link></>}
          </section>
          <section className="ac-card">
            <h2>{L('Saved places', 'सेव की जगहें')} <Link href="/account/saved">{t('view_all')}</Link></h2>
            {savedLocs.length ? (
              <div className="acc-saved" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {savedLocs.map((l) => (
                  <Link key={l.id} className="acc-place" href={`/destinations/${l.slug}`}><Cover url={l.image_url} seed={l.slug} className="acc-place-img" /><strong>{pick(l, 'name')}</strong></Link>
                ))}
              </div>
            ) : <p className="muted" style={{ margin: 0 }}>{L('Tap ♥ on a place to save it here.', 'किसी जगह पर ♥ दबाकर यहाँ सेव करें।')} <Link href="/destinations">{t('destinations')}</Link></p>}
          </section>
          {roles.partner || roles.driver || roles.admin ? <section className="ac-card"><h2>{t('your_roles')}</h2>
            <div className="row-actions">
              {roles.partner ? <Link className="btn btn-ghost btn-sm" href="/partner">{t('partner')}</Link> : null}
              {roles.driver ? <Link className="btn btn-ghost btn-sm" href="/drive">{L('Driver', 'ड्राइवर')}</Link> : null}
              {roles.admin ? <Link className="btn btn-ghost btn-sm" href="/admin">{t('admin')}</Link> : null}
            </div></section> : <p className="small muted" style={{ margin: 0 }}><Link href="/partner/join">{t('become_partner')}</Link></p>}
        </div>
      </div>
    </>
  );
}
