import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireUser, rows, todayIST, rideRoute } from '@/lib/account';
import { getLocations, getPlaces } from '@/lib/data';
import { fmtDate, inr } from '@/lib/format';
import { LEGACY_APP } from '@/lib/config';
import { Icon } from '@/components/Icon';
import { Cover } from '@/components/Cover';

export default async function AccountOverview() {
  const { db, user, profile, roles } = await requireUser('/account');
  const tr = await getT();
  const { t, L, pick, lang } = tr;
  const today = todayIST();
  const [trips, stays, cabs, saved, unread, feedback, locations, places] = await Promise.all([
    rows(db.from('trips').select('id,title,start_date,days_count,status').eq('user_id', user.id).neq('status', 'cancelled').gte('start_date', today).order('start_date').limit(1)),
    rows(db.from('booking_requests').select('id,kind,status,start_date,end_date,booking_code,total_amount,homestays(name),village_tours(title),workspaces(name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3)),
    rows(db.from('cab_bookings').select('id,status,seats,booking_ref,booking_code,from_place_id,to_place_id,cab_rides(departure_at,from_location_id,to_location_id,from_place_id,to_place_id)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3)),
    rows(db.from('saved_destinations').select('location_id').eq('user_id', user.id)),
    db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null),
    db.rpc('my_pending_feedback').then((r) => (r.error ? [] : r.data || [])),
    getLocations(), getPlaces(),
  ]);
  const upcomingStays = stays.filter((b) => ['requested', 'confirmed', 'checked_in'].includes(b.status) && b.end_date >= today).length;
  const name = profile?.full_name || user.email || '';
  const first = name.split(/\s+/)[0];
  const savedLocs = saved.map((s) => locations.find((l) => l.id === s.location_id)).filter(Boolean).slice(0, 4);
  const listingName = (b) => b.homestays?.name || b.village_tours?.title || b.workspaces?.name || b.kind;
  const next = trips[0];

  const stat = (href, icon, label, n, urgent) => (
    <Link className={`ds-stat${urgent ? ' urgent' : ''}`} href={href}>
      <span className="ds-stat-l"><Icon name={icon} size={16} />{label}</span><span className="ds-stat-n">{n}</span>
    </Link>
  );

  return (
    <>
      <div className="ds-head">
        <span className="ds-avatar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" /> : (first[0] || '•').toUpperCase()}
        </span>
        <div className="grow">
          <p className="eyebrow">{L('My account', 'मेरा अकाउंट')}</p>
          <h1>{L(`Namaste, ${first}`, `नमस्ते, ${first}`)}</h1>
          <p className="muted">{user.email}</p>
        </div>
        <div className="ds-actions">
          <Link className="btn" href="/plan"><Icon name="map" size={16} /> {t('plan')}</Link>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost"><Icon name="logout" size={16} /> {t('signout')}</button></form>
        </div>
      </div>

      {feedback.length ? (
        <div className="ds-alert soft-note warn" role="status">
          <strong>{L('Feedback pending', 'फ़ीडबैक बाकी')}</strong> — {L(`Please rate your ride${feedback.length > 1 ? 's' : ''} with ${feedback.map((f) => f.other_name).filter(Boolean).join(', ')}.`, `कृपया ${feedback.map((f) => f.other_name).filter(Boolean).join(', ')} के साथ अपनी राइड को रेटिंग दें।`)}{' '}
          <a href={`${LEGACY_APP}cab/bookings`}>{L('Give feedback', 'फ़ीडबैक दें')}</a>
        </div>
      ) : null}

      <div className="ds-stats">
        {stat('/account/bookings', 'house', L('Upcoming stays', 'आने वाले होमस्टे'), upcomingStays)}
        {stat('/account/cab', 'car', L('Cab bookings', 'कैब बुकिंग'), cabs.filter((c) => ['pending', 'confirmed'].includes(c.status)).length, cabs.some((c) => c.status === 'pending'))}
        {stat('/account/saved', 'heart', L('Saved places', 'सेव की जगहें'), saved.length)}
        {stat('/account/notifications', 'bell', L('Unread', 'नई सूचनाएँ'), unread.count || 0, (unread.count || 0) > 0)}
      </div>

      <div className="ds-cols">
        <div className="ds-body">
          <section className="ds-panel">
            <h2>{L('Next trip', 'अगली यात्रा')} <Link href="/account/trips">{t('view_all')}</Link></h2>
            {next ? (
              <Link className="acc-trip" href={`/trip/${next.id}`}>
                <span className="small muted">{fmtDate(next.start_date, lang)} · {next.days_count} {t('days')}</span>
                <strong>{next.title}</strong>
                <span className="acc-link">{L('Open trip', 'यात्रा खोलें')} <Icon name="arrow" size={14} /></span>
              </Link>
            ) : <p className="muted">{L('No upcoming trip. Plan one in a few minutes.', 'कोई आने वाली यात्रा नहीं। कुछ मिनट में प्लान कीजिए।')} <Link href="/plan">{t('plan')}</Link></p>}
          </section>

          <section className="ds-panel">
            <h2>{L('Stays & tours', 'होमस्टे और टूर')} <Link href="/account/bookings">{t('view_all')}</Link></h2>
            {stays.length ? (
              <div className="ds-rows">
                {stays.map((b) => (
                  <Link key={b.id} className="ds-row" href="/account/bookings">
                    <span className="ds-row-ico"><Icon name={b.kind === 'homestay' ? 'house' : b.kind === 'workspace' ? 'desk' : 'people'} /></span>
                    <span className="grow"><strong>{listingName(b)}</strong><span>{fmtDate(b.start_date, lang)}{b.total_amount != null ? ` · ${inr(b.total_amount)}` : ''}{b.booking_code ? ` · ${b.booking_code}` : ''}</span></span>
                    <span className={`badge badge-${b.status}`}>{tr.status(b.status)}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="muted">{L('No bookings yet.', 'अभी कोई बुकिंग नहीं।')} <Link href="/homestays">{t('stays')}</Link></p>}
          </section>

          <section className="ds-panel">
            <h2>{L('Cab bookings', 'कैब बुकिंग')} <Link href="/account/cab">{t('view_all')}</Link></h2>
            {cabs.length ? (
              <div className="ds-rows">
                {cabs.map((b) => (
                  <Link key={b.id} className="ds-row" href="/account/cab">
                    <span className="ds-row-ico"><Icon name="car" /></span>
                    <span className="grow"><strong>{rideRoute(b, places, locations, pick)}</strong><span>{fmtDate(b.cab_rides?.departure_at, lang)} · {b.seats} {L('seat(s)', 'सीट')}</span></span>
                    <span className={`badge badge-${b.status}`}>{tr.status(b.status)}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="muted">{L('No cab bookings yet.', 'अभी कोई कैब बुकिंग नहीं।')} <Link href="/cab">{t('cabs')}</Link></p>}
          </section>
        </div>

        <div className="ds-body">
          <section className="ds-panel">
            <h2>{L('Saved places', 'सेव की जगहें')} <Link href="/account/saved">{t('view_all')}</Link></h2>
            {savedLocs.length ? (
              <div className="acc-saved" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {savedLocs.map((l) => (
                  <Link key={l.id} className="acc-place" href={`/destinations/${l.slug}`}><Cover url={l.image_url} seed={l.slug} className="acc-place-img" /><strong>{pick(l, 'name')}</strong></Link>
                ))}
              </div>
            ) : <p className="muted">{L('Tap ♥ on a place to save it here.', 'किसी जगह पर ♥ दबाकर यहाँ सेव करें।')} <Link href="/destinations">{t('destinations')}</Link></p>}
          </section>
          <section className="ds-panel">
            <h2>{t('your_roles')}</h2>
            <div className="chips">
              {[roles.customer && t('role_customer'), roles.partner && t('role_partner'), roles.driver && t('role_driver'), roles.admin && t('role_admin')].filter(Boolean).map((r) => <span className="chip" key={r}>{r}</span>)}
            </div>
            <div className="row-actions">
              {roles.partner ? <Link className="btn btn-ghost btn-sm" href="/partner">{t('partner')}</Link> : <Link className="btn btn-ghost btn-sm" href="/partner/join">{t('become_partner')}</Link>}
              {roles.driver ? <Link className="btn btn-ghost btn-sm" href="/drive">{L('Driver', 'ड्राइवर')}</Link> : null}
              {roles.admin ? <Link className="btn btn-ghost btn-sm" href="/admin">{t('admin')}</Link> : null}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
