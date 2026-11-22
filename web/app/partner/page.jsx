import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requirePartner, loadHost } from '@/lib/partner';
import { todayIST } from '@/lib/account';
import { inr } from '@/lib/format';
import { Icon } from '@/components/Icon';

export async function generateMetadata() { const { L } = await getT(); return { title: L('Partner portal', 'पार्टनर पोर्टल') }; }

export default async function PartnerOverview() {
  const { db, partner } = await requirePartner('/partner');
  const { L, status, lang } = await getT();
  const { hs, bookings } = await loadHost(db, partner);
  const { data: kyc } = await db.from('partner_kyc').select('status').eq('partner_id', partner.id).maybeSingle();
  const today = todayIST();
  const checkins = bookings.filter((b) => b.status === 'confirmed' && b.start_date === today);
  const pending = bookings.filter((b) => b.status === 'requested');
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && b.start_date > today);
  const earned = bookings.filter((b) => b.status === 'completed').reduce((s, b) => s + (b.partner_payout_amount || 0), 0);
  // Bookings per month for the last 6 months (by check-in date, not cancelled/declined).
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); return d.toISOString().slice(0, 7); });
  const counts = months.map((m) => bookings.filter((b) => b.start_date?.startsWith(m) && !['declined', 'cancelled'].includes(b.status)).length);
  const max = Math.max(1, ...counts);
  const stat = (href, icon, label, n, urgent) => <Link className={`ds-stat${urgent ? ' urgent' : ''}`} href={href}><span className="ds-stat-l"><Icon name={icon} size={16} />{label}</span><span className="ds-stat-n">{n}</span></Link>;
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Partner portal', 'पार्टनर पोर्टल')}</p><h1>{partner.business_name}</h1>
        <p className="muted"><span className={`badge badge-${partner.status}`}>{status(partner.status)}</span></p></div>
        <div className="ds-actions"><Link className="btn" href="/partner/properties/new"><Icon name="plus" size={16} /> {L('Add property', 'प्रॉपर्टी जोड़ें')}</Link></div></div>
      {partner.status === 'pending' ? <p className="soft-note">{L('Your application is waiting for admin approval. You can prepare your property as a draft meanwhile.', 'आपका आवेदन एडमिन की मंज़ूरी का इंतज़ार कर रहा है। तब तक प्रॉपर्टी ड्राफ़्ट में तैयार कर सकते हैं।')}</p> : null}
      {partner.status === 'rejected' && partner.admin_note ? <p className="soft-note warn"><strong>{L('Admin remark', 'एडमिन टिप्पणी')}:</strong> {partner.admin_note}</p> : null}
      {!kyc || kyc.status === 'rejected' ? <Link className="soft-note ds-alert" href="/partner/kyc"><Icon name="doc" size={18} /> {L('Add your ID and bank / UPI details so payouts can be sent.', 'अपनी आईडी और बैंक / UPI जानकारी जोड़ें ताकि पेआउट भेजा जा सके।')}</Link> : null}
      <div className="ds-stats">
        {stat('/partner/bookings?tab=today', 'calendar', L("Today's check-ins", 'आज के चेक-इन'), checkins.length, checkins.length > 0)}
        {stat('/partner/bookings?tab=requests', 'bell', L('Pending requests', 'बाकी रिक्वेस्ट'), pending.length, pending.length > 0)}
        {stat('/partner/bookings?tab=upcoming', 'house', L('Upcoming stays', 'आने वाले स्टे'), upcoming.length)}
        {stat('/partner/earnings', 'layers', L('Your earnings (completed)', 'आपकी कमाई (पूरी)'), inr(earned))}
      </div>
      <div className="ds-cols">
        <section className="ds-panel">
          <h2>{L('Bookings, last 6 months', 'पिछले 6 महीने की बुकिंग')}</h2>
          <div className="bars" role="img" aria-label={counts.join(', ')}>
            {months.map((m, i) => (
              <div key={m} className="bar-col"><span className="bar" style={{ height: `${(counts[i] / max) * 100}%` }} /><small>{new Date(`${m}-01`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short' })}</small><strong>{counts[i]}</strong></div>
            ))}
          </div>
        </section>
        <section className="ds-panel">
          <h2>{L('My properties', 'मेरी प्रॉपर्टी')} <Link href="/partner/properties">{L('All', 'सभी')}</Link></h2>
          {hs.length ? <div className="ds-rows">{hs.slice(0, 4).map((h) => (
            <Link key={h.id} className="ds-row" href={`/partner/properties/${h.id}`}><span className="ds-row-ico"><Icon name="house" /></span><span className="grow"><strong>{h.name}</strong><span>{h.village}</span></span><span className={`badge badge-${h.status}`}>{status(h.status)}</span></Link>
          ))}</div> : <p className="muted">{L('No property yet.', 'अभी कोई प्रॉपर्टी नहीं।')} <Link href="/partner/properties/new">{L('Add one', 'जोड़ें')}</Link></p>}
        </section>
      </div>
    </>
  );
}
