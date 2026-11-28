import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requirePartner, loadHost } from '@/lib/partner';
import { todayIST } from '@/lib/account';
import { fmtDate, inr } from '@/lib/format';
import { listingHealth, nextDays, addDays } from '@/lib/partner-ui';
import { Icon } from '@/components/Icon';

export async function generateMetadata() { const { L } = await getT(); return { title: L('Partner portal', 'पार्टनर पोर्टल') }; }

export default async function PartnerOverview() {
  const { db, partner } = await requirePartner('/partner');
  const { L, status, lang } = await getT();
  const { hs, rooms, bookings } = await loadHost(db, partner);
  const { data: kyc } = await db.from('partner_kyc').select('status').eq('partner_id', partner.id).maybeSingle();
  const today = todayIST();
  const week = addDays(today, 7);
  const pending = bookings.filter((b) => b.status === 'requested');
  const arriving = bookings.filter((b) => b.status === 'confirmed' && b.start_date >= today && b.start_date <= week);
  const staying = bookings.filter((b) => b.status === 'checked_in' || (b.status === 'confirmed' && b.start_date < today && b.end_date > today));
  const unpaid = bookings.filter((b) => b.status === 'completed' && b.payout_status === 'unpaid').reduce((s, b) => s + (b.partner_payout_amount || 0), 0);
  const soon = nextDays(bookings, today).slice(0, 6);
  const kycOk = kyc?.status === 'verified';
  const live = hs.filter((h) => h.status === 'approved');
  const inReview = hs.filter((h) => h.status === 'pending');
  const main = live[0] || inReview[0] || hs[0];
  const health = main ? listingHealth(main, rooms, L) : null;
  const name = (b) => b.homestays?.name || b.village_tours?.title || b.workspaces?.name || '';
  const greet = <div className="pp-head"><div><p className="eyebrow">{L('Partner portal', 'पार्टनर पोर्टल')}</p><h1>{L('Namaste', 'नमस्ते')}, {partner.business_name}</h1>
    <p><span className={`badge badge-${partner.status}`}>{status(partner.status)}</span></p></div>
    <Link className="btn btn-ghost btn-sm" href="/partner/properties/new"><Icon name="plus" size={16} /> {L('Add homestay', 'होमस्टे जोड़ें')}</Link></div>;

  // New host: nothing listed yet, or KYC not added — show the getting-started steps first.
  if (!live.length && !inReview.length) {
    const steps = [
      { ok: true, b: L('Business details', 'बिज़नेस जानकारी'), s: L('Name, phone, village', 'नाम, फ़ोन, गाँव'), href: '/partner/profile' },
      { ok: hs.length > 0, b: L('Add your homestay', 'अपना होमस्टे जोड़ें'), s: L('Rooms, prices and real photos', 'कमरे, किराया और असली फ़ोटो'), href: hs[0] ? `/partner/properties/${hs[0].id}` : '/partner/properties/new' },
      { ok: !!kyc && kyc.status !== 'rejected', b: L('KYC & bank', 'KYC और बैंक'), s: L('So payouts can be sent to you', 'ताकि आपको पेआउट भेजा जा सके'), href: '/partner/kyc' },
      { ok: false, later: partner.status !== 'approved' || !hs.length, b: L('Send for review', 'जाँच के लिए भेजें'), s: partner.status === 'approved' ? L('Our team checks and approves it', 'हमारी टीम जाँचकर मंज़ूर करेगी') : L('Opens after your partner account is approved', 'पार्टनर अकाउंट मंज़ूर होने के बाद'), href: hs[0] ? `/partner/properties/${hs[0].id}` : '/partner/properties/new' },
    ];
    return (
      <>
        {greet}
        {partner.status === 'pending' ? <div className="pp-banner info"><Icon name="bell" /><span><b>{L('Application waiting for approval', 'आवेदन मंज़ूरी के इंतज़ार में')}</b><p>{L('You can prepare your homestay as a draft meanwhile.', 'तब तक होमस्टे ड्राफ़्ट में तैयार कर सकते हैं।')}</p></span></div> : null}
        {partner.status === 'rejected' && partner.admin_note ? <div className="pp-banner bad"><Icon name="alert" /><span><b>{L('Admin remark', 'एडमिन टिप्पणी')}</b><p>{partner.admin_note}</p></span></div> : null}
        <p className="muted" style={{ margin: 0 }}>{L("Let's get your homestay online in a few short steps.", 'कुछ आसान कदमों में अपना होमस्टे ऑनलाइन करें।')}</p>
        <ol className="pp-onb">{steps.map((x) => (
          <li key={x.b} className={x.ok ? 'ok' : ''}><span><b>{x.b}</b><small>{x.s}</small></span>
            {x.ok ? <span className="badge badge-approved">{L('Done', 'हो गया')}</span> : x.later ? <span className="badge badge-full">{L('Later', 'बाद में')}</span> : <Link className="btn btn-sm" href={x.href}>{L('Start', 'शुरू करें')}</Link>}</li>
        ))}</ol>
        <p className="small muted">{L('Stuck?', 'अटक गए?')} <Link href="/partner/support">{L('Ask the THH team', 'THH टीम से पूछें')}</Link></p>
      </>
    );
  }

  return (
    <>
      {greet}
      {pending.length ? <div className="pp-banner warn"><Icon name="bell" /><span>
        <b>{L(`${pending.length} booking request(s) waiting`, `${pending.length} बुकिंग रिक्वेस्ट इंतज़ार में`)}</b>
        <p>{L("Guests are waiting for your answer — reply soon so they don't book elsewhere.", 'मेहमान आपके जवाब का इंतज़ार कर रहे हैं — जल्दी जवाब दें।')}</p>
        <Link className="btn btn-sm" href="/partner/bookings?tab=requests">{L('Reply now', 'अभी जवाब दें')}</Link></span></div> : null}
      {!live.length && inReview.length ? <div className="pp-banner info"><Icon name="house" /><span><b>{L('Your homestay is with our team for review', 'आपका होमस्टे हमारी टीम के पास जाँच में है')}</b>
        <p>{L('You will see the status and any remarks on “My homestays”.', 'स्थिति और टिप्पणी “मेरे होमस्टे” पर दिखेगी।')}</p></span></div> : null}
      {!kyc || kyc.status === 'rejected' ? <div className="pp-banner warn"><Icon name="shield" /><span><b>{L('Add KYC & bank details', 'KYC और बैंक जानकारी जोड़ें')}</b>
        <p>{L('Needed so payouts can be sent to you.', 'इसके बिना पेआउट नहीं भेजा जा सकता।')}</p><Link className="btn btn-ghost btn-sm" href="/partner/kyc">{L('Open KYC', 'KYC खोलें')}</Link></span></div> : null}
      <div className="pp-kpis">
        <Link className={`pp-kpi${pending.length ? ' hot' : ''}`} href="/partner/bookings?tab=requests"><small>{L('Requests waiting', 'बाकी रिक्वेस्ट')}</small><b>{pending.length}</b></Link>
        <Link className="pp-kpi" href="/partner/bookings?tab=upcoming"><small>{L('Arriving in 7 days', '7 दिन में आने वाले')}</small><b>{arriving.length}</b></Link>
        <Link className="pp-kpi" href="/partner/bookings?tab=today"><small>{L('Guests staying now', 'अभी ठहरे मेहमान')}</small><b>{staying.length}</b></Link>
        <Link className="pp-kpi" href="/partner/earnings"><small>{L('Not yet paid to you', 'आपको अभी मिलना बाकी')}</small><b>{inr(unpaid)}</b></Link>
      </div>
      <div className="pp-cols">
        <section className="pp-card">
          <h2>{L('Next 7 days', 'अगले 7 दिन')} <Link href="/partner/bookings?tab=upcoming">{L('All bookings', 'सभी बुकिंग')}</Link></h2>
          {soon.length ? soon.map(({ b, type, date }) => (
            <div key={`${b.id}-${type}`} className="pp-row">
              <span className={`pp-ic ${type === 'arrive' ? 'in' : 'out'}`}><Icon name={type === 'arrive' ? 'pin' : 'arrow'} size={18} /></span>
              <span className="pp-tx"><b>{type === 'arrive' ? L('Arrives', 'आएँगे') : L('Leaves', 'जाएँगे')} {date === today ? L('today', 'आज') : fmtDate(date, lang)} · {b.guest_name}</b>
                <small>{[name(b), b.homestay_rooms?.room_type ? `${b.homestay_rooms.room_type} × ${b.rooms_booked || 1}` : null, `${b.guests} ${L('guests', 'मेहमान')}`].filter(Boolean).join(' · ')}</small></span>
            </div>
          )) : <p className="muted" style={{ margin: 0 }}>{L('No arrivals or departures in the next 7 days.', 'अगले 7 दिन में कोई आना-जाना नहीं।')}</p>}
        </section>
        {health ? <section className="pp-card">
          <h2>{L('Listing health', 'लिस्टिंग कितनी पूरी')} <Link href={`/partner/properties/${main.id}`}>{L('Edit', 'बदलें')}</Link></h2>
          <p className="small" style={{ margin: '0 0 6px' }}><strong>{main.name}</strong> · {status(main.status)}</p>
          <div className="pp-bar" role="progressbar" aria-valuenow={health.pct} aria-valuemin={0} aria-valuemax={100} aria-label={L('Listing complete', 'लिस्टिंग पूरी')}><i style={{ width: `${health.pct}%` }} /></div>
          <p className="small muted" style={{ margin: '6px 0 10px' }}>{L(`${health.done} of ${health.total} done — complete listings get more bookings.`, `${health.total} में से ${health.done} पूरे — पूरी लिस्टिंग पर ज़्यादा बुकिंग आती है।`)}</p>
          <ul className="pp-check">
            {health.items.map((i) => <li key={i.key} className={i.ok ? 'ok' : ''}><i>{i.ok ? '✓' : '!'}</i>{i.label}{i.ok ? null : <Link href={`/partner/properties/${main.id}`}>{L('Fix', 'ठीक करें')}</Link>}</li>)}
            <li className={kycOk ? 'ok' : ''}><i>{kycOk ? '✓' : '!'}</i>{L('KYC & bank verified', 'KYC और बैंक वेरिफ़ाइड')}{kycOk ? null : <Link href="/partner/kyc">{L('Open', 'खोलें')}</Link>}</li>
          </ul>
        </section> : null}
      </div>
    </>
  );
}
