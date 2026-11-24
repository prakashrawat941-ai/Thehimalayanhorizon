import Link from 'next/link';
import CabScreen from '@/components/CabScreen';
import { Icon } from '@/components/Icon';
import { requireAdmin } from '@/lib/admin';
import { getT } from '@/lib/i18n/server';
import { bookingPlaces, bookingStatuses, loadCabMonitor, ridePlaces, rideStatuses, sosStatuses } from '@/lib/cab/admin-monitor';
import { cancelRide, updateIncident } from './actions';
import { MonitorAction, MonitorRefresh } from './MonitorControls';
import styles from './monitor.module.css';

const path = '/admin/cab';
const periods = [1, 7, 30];
const adminScreens = { drivers: 'driversAdmin', vehicles: 'vehiclesAdmin' };
const tabs = {
  overview: ['Overview', 'ओवरव्यू'],
  rides: ['Rides', 'राइड'],
  bookings: ['Bookings', 'बुकिंग'],
  sos: ['SOS Incidents', 'SOS घटनाएँ'],
  reports: ['Reports', 'रिपोर्ट'],
  drivers: ['Drivers', 'ड्राइवर'],
  vehicles: ['Vehicle Catalogue', 'वाहन कैटलॉग'],
};
const statusNames = {
  open: ['Open', 'खुली'],
  full: ['Full', 'सीटें भरीं'],
  started: ['In progress', 'जारी'],
  completed: ['Completed', 'पूरी'],
  cancelled: ['Cancelled', 'रद्द'],
  pending: ['Pending', 'बाकी'],
  confirmed: ['Confirmed', 'कन्फ़र्म'],
  declined: ['Declined', 'अस्वीकृत'],
  expired: ['Expired', 'समय समाप्त'],
  acknowledged: ['Acknowledged', 'देख ली गई'],
  resolved: ['Resolved', 'हल हुई'],
};

function queryLink(values) {
  return `${path}?${new URLSearchParams(Object.entries(values).filter(([, value]) => value)).toString()}`;
}

function Panel({ title, tool, children }) {
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><h2>{title}</h2>{tool}</div>
    {children}
  </section>;
}

export default async function AdminCab({ searchParams }) {
  const { db } = await requireAdmin(path);
  const [{ L, lang, pick }, query] = await Promise.all([getT(), searchParams]);
  const tab = typeof query.tab === 'string' && Object.hasOwn(tabs, query.tab) ? query.tab : 'overview';
  const availableStatuses = { rides: rideStatuses, bookings: bookingStatuses, sos: sosStatuses, overview: sosStatuses }[tab] || [];
  const status = availableStatuses.includes(query.status) ? query.status : '';
  const readPeriod = (value, fallback) => periods.includes(Number(value)) ? Number(value) : fallback;
  const days = readPeriod(query.days, tab === 'overview' ? 1 : 7);
  const reportDays = readPeriod(query.reportDays, 7);
  const page = /^\d{1,8}$/.test(query.page) ? Math.max(Number(query.page), 1) : 1;
  const overview = tab === 'overview';
  const watchIncidents = overview || tab === 'sos';
  const base = { tab, days, reportDays };
  const number = new Intl.NumberFormat(lang === 'hi' ? 'hi-IN' : 'en-IN');
  const date = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  });
  const statusText = (key) => statusNames[key] ? L(...statusNames[key]) : key;
  const localeDay = (n) => n === 1 ? L('Today', 'आज') : L(`Last ${n} days`, `पिछले ${n} दिन`);
  const openView = (view) => queryLink({ ...base, tab: view, days: view === 'reports' ? (tab === 'reports' ? days : reportDays) : days, status: view === 'sos' ? status : '' });
  const pendingLabel = L('Saving…', 'सेव हो रहा है…');
  const unavailable = L('Could not load this data. Please refresh.', 'डेटा लोड नहीं हुआ। कृपया रीफ़्रेश करें।');

  const nav = <nav className={styles.tabs} aria-label={L('Cab administration', 'कैब प्रशासन')}>
    {Object.entries(tabs).map(([key, label]) => <Link key={key} href={openView(key)}
      aria-current={tab === key ? 'page' : undefined}>{L(...label)}</Link>)}
  </nav>;

  if (adminScreens[tab]) return <>
    {nav}
    <CabScreen area="admin" screen={adminScreens[tab]} query={query} />
  </>;

  const { rideList, bookingList, sosList, metrics, reportMetrics, pageSize } = await loadCabMonitor(db, {
    tab, status, days, reportDays, page,
  });

  function filter(label, field, values, current, labelFor) {
    return <form action={path} method="get" className={styles.filter}>
      {Object.entries({ ...base, status }).filter(([key, value]) => key !== field && value)
        .map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <label><span>{label}</span>
        <select className="input" name={field} defaultValue={current} key={`${field}-${current}`}>
          {values.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}
        </select>
      </label>
      <button className="btn btn-ghost btn-sm" type="submit">{L('Apply', 'लागू करें')}</button>
    </form>;
  }

  const statusFilter = (values) => filter(L('Status', 'स्थिति'), 'status', ['', ...values], status,
    (key) => key ? statusText(key) : L('All statuses', 'सभी स्थितियाँ'));

  const routeLabel = (names) => names.every(Boolean)
    ? names.join(' → ') : L('Route unavailable', 'रूट उपलब्ध नहीं');

  const empty = (icon, message) => <div className={styles.empty}>
    <Icon name={icon} size={28} /><p>{message}</p>
  </div>;

  function entries(result, icon, message, render) {
    if (result.error) return <p className={styles.error} role="alert">{unavailable}</p>;
    if (!result.data?.length) return empty(icon, message);
    return <ul className={styles.entries}>{result.data.map(render)}</ul>;
  }

  function badge(key, incident = false) {
    const tone = incident && key === 'open' ? 'danger'
      : ['started', 'confirmed', 'completed', 'resolved'].includes(key) ? 'good' : 'neutral';
    return <span className={styles.badge} data-tone={tone}>{statusText(key)}</span>;
  }

  const viewLink = (key) => <Link className={styles.view} href={openView(key)}>{L('View all', 'सभी देखें')}</Link>;

  const rides = rideList && <Panel title={L('Rides', 'राइड')} tool={overview ? viewLink('rides') : statusFilter(rideStatuses)}>
    {entries(rideList, 'car', L('No rides for these filters.', 'इन फ़िल्टर में कोई राइड नहीं।'), (ride) => (
      <li key={ride.id}>
        <div className={styles.itemLine}>
          <div>
            <strong>{routeLabel(ridePlaces(ride, pick))}</strong>
            <p>{date.format(new Date(ride.departure_at))} · {ride.vehicle_model}</p>
            {ride.ride_ref && <p>{ride.ride_ref}</p>}
          </div>
          {badge(ride.status)}
        </div>
        <p>{L('Seats booked', 'बुक हुई सीटें')} {ride.seats_booked}/{ride.seats_total}</p>
        {!overview && ['open', 'full'].includes(ride.status) && <MonitorAction
          action={cancelRide.bind(null, ride.id)} label={L('Cancel ride', 'राइड रद्द करें')}
          confirm={L('Cancel this ride and notify passengers?', 'यह राइड रद्द करके यात्रियों को सूचित करें?')}
          pendingLabel={pendingLabel} danger />}
      </li>
    ))}
  </Panel>;

  const bookings = bookingList && <Panel title={L('Booking activity', 'बुकिंग गतिविधि')}
    tool={overview ? viewLink('bookings') : statusFilter(bookingStatuses)}>
    {entries(bookingList, 'calendar', L('No bookings for these filters.', 'इन फ़िल्टर में कोई बुकिंग नहीं।'), (booking) => (
      <li key={booking.id}>
        <div className={styles.itemLine}>
          <div>
            <strong>{routeLabel(bookingPlaces(booking, pick))}</strong>
            <p>{booking.booking_ref || booking.booking_code || L('Booking code unavailable', 'बुकिंग कोड उपलब्ध नहीं')}</p>
            <p>{date.format(new Date(booking.created_at))} · {L('Seats', 'सीटें')} {number.format(booking.seats)}</p>
          </div>
          {badge(booking.status)}
        </div>
      </li>
    ))}
  </Panel>;

  const incidentStatus = status || 'open';
  const incidents = sosList && <Panel title={L('SOS Incidents', 'SOS घटनाएँ')} tool={overview ? viewLink('sos') : null}>
    <nav className={styles.tabs} aria-label={L('Incident status', 'घटना की स्थिति')}>
      {sosStatuses.map((key) => <Link key={key} href={queryLink({ ...base, status: key })}
        aria-current={incidentStatus === key ? 'page' : undefined}>{statusText(key)}</Link>)}
    </nav>
    {entries(sosList, 'shield', incidentStatus === 'open'
      ? L('No open incidents.', 'कोई खुली घटना नहीं।')
      : L('No incidents in this status.', 'इस स्थिति में कोई घटना नहीं।'), (incident) => {
      const coordinates = Number.isFinite(incident.lat) && Number.isFinite(incident.lng);
      const contactPhone = incident.emergency_phone.replace(/[^+\d]/g, '');
      const nextStatus = { open: 'acknowledged', acknowledged: 'resolved' }[incident.status];
      return <li key={incident.id}>
        <div className={styles.itemLine}>
          <div>
            <strong>{routeLabel(ridePlaces(incident.ride, pick))}</strong>
            <p>{date.format(new Date(incident.created_at))} · {incident.role === 'driver' ? L('Driver', 'ड्राइवर') : L('Passenger', 'यात्री')}</p>
          </div>
          {badge(incident.status, true)}
        </div>
        {!overview && <details className={styles.details}>
          <summary>{L('Incident details', 'घटना का विवरण')}</summary>
          <dl>
            {incident.ride?.ride_ref && <><dt>{L('Ride ID', 'राइड आईडी')}</dt><dd>{incident.ride.ride_ref}</dd></>}
            {incident.booking && <><dt>{L('Booking code', 'बुकिंग कोड')}</dt><dd>{incident.booking.booking_ref || incident.booking.booking_code || '—'}</dd></>}
            <dt>{L('Reported location', 'बताई गई लोकेशन')}</dt>
            <dd>{coordinates ? <>
              {incident.lat.toFixed(5)}, {incident.lng.toFixed(5)}
              {incident.accuracy_m != null && ` (±${Math.round(incident.accuracy_m)} m)`}
              {' · '}<a href={`https://www.openstreetmap.org/?mlat=${incident.lat}&mlon=${incident.lng}#map=16/${incident.lat}/${incident.lng}`}
                target="_blank" rel="noreferrer">{L('Open map', 'मैप खोलें')}</a>
            </> : L('Location unavailable', 'लोकेशन उपलब्ध नहीं')}</dd>
            {(incident.emergency_name || contactPhone) && <>
              <dt>{L('Emergency contact', 'आपातकालीन संपर्क')}</dt>
              <dd>{incident.emergency_name}{' '}{contactPhone && <a href={`tel:${contactPhone}`}>{contactPhone}</a>}</dd>
            </>}
            {incident.message && <><dt>{L('Message', 'संदेश')}</dt><dd>{incident.message}</dd></>}
            {incident.acknowledged_at && <><dt>{L('Acknowledged at', 'देखने का समय')}</dt><dd>{date.format(new Date(incident.acknowledged_at))}</dd></>}
            {incident.resolved_at && <><dt>{L('Resolved at', 'हल होने का समय')}</dt><dd>{date.format(new Date(incident.resolved_at))}</dd></>}
            {incident.cancel_reason && <><dt>{L('Cancellation reason', 'रद्द करने का कारण')}</dt><dd>{incident.cancel_reason}</dd></>}
            {incident.admin_note && <><dt>{L('Saved admin note', 'सेव किया गया एडमिन नोट')}</dt><dd>{incident.admin_note}</dd></>}
          </dl>
          {nextStatus && <MonitorAction key={nextStatus}
            action={updateIncident.bind(null, incident.id, nextStatus)}
            label={nextStatus === 'resolved' ? L('Resolve incident', 'घटना हल करें') : L('Acknowledge incident', 'देखी गई मार्क करें')}
            noteLabel={L('Admin note', 'एडमिन नोट')} note={incident.admin_note}
            pendingLabel={pendingLabel} />}
        </details>}
      </li>;
    })}
  </Panel>;

  const metricLabels = [
    [L('Active rides', 'जारी राइड'), 'car'],
    [L('Confirmed bookings', 'कन्फ़र्म बुकिंग'), 'calendar'],
    [L('Open SOS incidents', 'खुली SOS घटनाएँ'), 'alert'],
    [L('Completed rides', 'पूरी हुई राइड'), 'check'],
  ];
  const reportLabels = [
    [L('Completed rides', 'पूरी हुई राइड'), 'check'],
    [L('Cancelled rides', 'रद्द राइड'), 'car'],
    [L('Confirmed or completed bookings', 'कन्फ़र्म या पूरी बुकिंग'), 'calendar'],
    [L('Expired requests', 'समय समाप्त रिक्वेस्ट'), 'doc'],
  ];

  const counters = (labels, counts) => <dl className={styles.counters}>
    {labels.map(([label, icon], index) => <div key={label} className={styles.counter} data-alert={icon === 'alert' || undefined}>
      <dt><Icon name={icon} size={18} />{label}</dt>
      <dd>{counts[index] == null ? '—' : number.format(counts[index])}</dd>
    </div>)}
  </dl>;

  const reports = reportMetrics && <Panel title={L('Reports', 'रिपोर्ट')} tool={overview
    ? filter(L('Report period', 'रिपोर्ट अवधि'), 'reportDays', periods, reportDays, localeDay) : null}>
    {reportMetrics.some((value) => value == null) && <p className={styles.error} role="alert">{unavailable}</p>}
    {counters(reportLabels, reportMetrics)}
    {overview && viewLink('reports')}
  </Panel>;

  const result = rideList || bookingList || sosList;
  const resultsCount = result?.count ?? 0;
  return <div className={styles.monitor}>
    <header className={styles.header}>
      <div>
        <p className={styles.module}>{L('Instant Cab', 'इंस्टेंट कैब')}</p>
        <h1>{overview ? L('Cab Monitor', 'कैब मॉनिटर') : L(...tabs[tab])}</h1>
        {overview && <p>{L('Track rides, bookings and safety alerts.', 'राइड, बुकिंग और सुरक्षा अलर्ट देखें।')}</p>}
      </div>
      <MonitorRefresh watchIncidents={watchIncidents} label={L('Refresh', 'रीफ़्रेश करें')} loadingLabel={L('Refreshing…', 'रीफ़्रेश हो रहा है…')} />
    </header>
    {nav}
    {tab !== 'sos' && filter(L('Date range (IST)', 'तारीख़ (IST)'), 'days', periods, days, localeDay)}
    {metrics && <>
      {metrics.some((value) => value == null) && <p className={styles.error} role="alert">{unavailable}</p>}
      {counters(metricLabels, metrics)}
    </>}
    {overview ? <div className={styles.grid}>{rides}{incidents}{bookings}{reports}</div> : <>{rides}{bookings}{incidents}{reports}</>}
    {!overview && result && !result.error && (page > 1 || page * pageSize < resultsCount) &&
      <nav className={styles.tabs} aria-label={L('Pagination', 'पेज')}>
        {page > 1 && <Link href={queryLink({ ...base, status, page: page - 1 })}>{L('Previous', 'पिछला')}</Link>}
        {page * pageSize < resultsCount && <Link href={queryLink({ ...base, status, page: page + 1 })}>{L('Next', 'अगला')}</Link>}
      </nav>}
  </div>;
}
