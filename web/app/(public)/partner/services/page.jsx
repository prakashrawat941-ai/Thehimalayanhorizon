import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requirePartner } from '@/lib/partner';
import { rows } from '@/lib/account';
import { getLocations } from '@/lib/data';
import { inr } from '@/lib/format';
import { ServiceForm } from '@/components/partner/ServiceForm';

// Village tours and workspaces: list, add (?new=village_tour|workspace) and edit (?edit=<kind>:<id>).
export default async function Services({ searchParams }) {
  const sp = await searchParams;
  const { db, partner, user } = await requirePartner('/partner/services');
  const { L, lang, status } = await getT();
  const [tours, works, locations] = await Promise.all([
    rows(db.from('village_tours').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false })),
    rows(db.from('workspaces').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false })),
    getLocations(),
  ]);
  const locs = locations.filter((l) => l.kind !== 'transport_hub').map((l) => ({ id: l.id, name: l.name, name_hi: l.name_hi }));
  const [ek, eid] = String(sp.edit || '').split(':');
  const editRow = ek === 'village_tour' ? tours.find((x) => x.id === eid) : ek === 'workspace' ? works.find((x) => x.id === eid) : null;
  const formKind = editRow ? ek : ['village_tour', 'workspace'].includes(sp.new) ? sp.new : null;
  const can = (k) => (partner.categories || []).includes(k);
  if (formKind) {
    return (
      <>
        <p className="small"><Link href="/partner/services">← {L('Tours & workspaces', 'टूर और वर्कस्पेस')}</Link></p>
        <div className="ds-head"><div className="grow"><h1>{formKind === 'village_tour' ? L('Village tour', 'गाँव का टूर') : L('Workspace', 'वर्कस्पेस')}</h1></div></div>
        <ServiceForm lang={lang} kind={formKind} partnerId={partner.id} userId={user.id} row={editRow} locations={locs} />
      </>
    );
  }
  const item = (k, x) => (
    <Link key={x.id} className="ds-row" href={`/partner/services?edit=${k}:${x.id}`}>
      <span className="grow"><strong>{x.title || x.name}</strong><span>{x.village || ''} · {inr(x.price_per_person ?? x.price_per_day)}</span></span>
      <span className={`badge badge-${x.status}`}>{status(x.status)}</span>
    </Link>
  );
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Tours & workspaces', 'टूर और वर्कस्पेस')}</h1>
        <p className="muted">{L('Booking requests for these come to your Bookings page.', 'इनकी बुकिंग रिक्वेस्ट आपके बुकिंग पेज पर आती हैं।')}</p></div></div>
      <div className="ds-cols">
        <section className="ds-panel">
          <h2>{L('Village tours', 'गाँव के टूर')} {can('village_tour') && partner.status === 'approved' ? <Link href="/partner/services?new=village_tour">+ {L('Add', 'जोड़ें')}</Link> : null}</h2>
          {tours.length ? <div className="ds-rows">{tours.map((x) => item('village_tour', x))}</div> : <p className="muted">{can('village_tour') ? L('No tours yet.', 'अभी कोई टूर नहीं।') : L('Add "Village tour" in your business profile to offer tours.', 'टूर देने के लिए बिज़नेस प्रोफ़ाइल में "गाँव का टूर" जोड़ें।')}</p>}
        </section>
        <section className="ds-panel">
          <h2>{L('Workspaces', 'वर्कस्पेस')} {can('workspace') && partner.status === 'approved' ? <Link href="/partner/services?new=workspace">+ {L('Add', 'जोड़ें')}</Link> : null}</h2>
          {works.length ? <div className="ds-rows">{works.map((x) => item('workspace', x))}</div> : <p className="muted">{can('workspace') ? L('No workspaces yet.', 'अभी कोई वर्कस्पेस नहीं।') : L('Add "Workspace" in your business profile to offer desks.', 'डेस्क देने के लिए बिज़नेस प्रोफ़ाइल में "वर्कस्पेस" जोड़ें।')}</p>}
        </section>
      </div>
      {partner.status !== 'approved' ? <p className="soft-note">{L('You can add tours and workspaces after your partner account is approved.', 'पार्टनर अकाउंट मंज़ूर होने के बाद टूर और वर्कस्पेस जोड़ सकेंगे।')}</p> : null}
    </>
  );
}
