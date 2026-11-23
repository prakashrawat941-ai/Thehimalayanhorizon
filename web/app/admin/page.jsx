import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireAdmin, count } from '@/lib/admin';
import { inr } from '@/lib/format';
import { Icon } from '@/components/Icon';

export default async function AdminOverview() {
  const { db } = await requireAdmin('/admin');
  const { L } = await getT();
  const h = { count: 'exact', head: true };
  const [users, partners, bookings, cabBookings, sos, stats] = await Promise.all([
    count(db.from('profiles').select('id', h)),
    count(db.from('partners').select('id', h).eq('status', 'approved')),
    count(db.from('booking_requests').select('id', h)),
    count(db.from('cab_bookings').select('id', h)),
    count(db.from('sos_incidents').select('id', h).in('status', ['open', 'acknowledged'])),
    db.rpc('admin_homestay_stats').then((r) => r.data || {}),
  ]);
  const stat = (href, icon, label, n, urgent) => <Link className={`ds-stat${urgent ? ' urgent' : ''}`} href={href}><span className="ds-stat-l"><Icon name={icon} size={16} />{label}</span><span className="ds-stat-n">{n}</span></Link>;
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Admin', 'एडमिन')}</p><h1>{L('Overview', 'ओवरव्यू')}</h1>
        <p className="muted">{L('Real records only. Money figures are booking records — payments happen outside the platform.', 'सिर्फ़ असली रिकॉर्ड। रकम बुकिंग के रिकॉर्ड हैं — भुगतान प्लेटफ़ॉर्म के बाहर होता है।')}</p></div></div>
      {sos ? <Link className="soft-note warn ds-alert" href="/admin/cab?tab=sos"><Icon name="alert" size={18} /> {L(`${sos} SOS incident(s) need attention`, `${sos} SOS घटनाएँ ध्यान माँगती हैं`)}</Link> : null}
      <div className="ds-stats">
        {stat('/admin/users', 'people', L('Users', 'यूज़र'), users)}
        {stat('/admin/approvals', 'check', L('Approved partners', 'मंज़ूर पार्टनर'), partners)}
        {stat('/admin/homestays', 'house', L('Stay / tour bookings', 'स्टे / टूर बुकिंग'), bookings)}
        {stat('/admin/cab', 'car', L('Cab bookings', 'कैब बुकिंग'), cabBookings)}
        {stat('/admin/homestays', 'layers', L('Homestay GMV (records)', 'होमस्टे GMV (रिकॉर्ड)'), inr(stats.gmv || 0))}
        {stat('/admin/homestays', 'layers', L('Commission (records)', 'कमीशन (रिकॉर्ड)'), inr(stats.commission || 0))}
        {stat('/admin/approvals', 'bell', L('Pending approvals', 'बाकी मंज़ूरी'), (stats.pending_properties || 0) + (stats.pending_kyc || 0) + (stats.pending_partners || 0), true)}
        {stat('/admin/payouts', 'layers', L('Pending payouts', 'बाकी पेआउट'), stats.pending_payouts || 0, (stats.pending_payouts || 0) > 0)}
      </div>
    </>
  );
}
