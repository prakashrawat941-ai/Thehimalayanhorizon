import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requirePartner, loadHost, AMENITIES } from '@/lib/partner';
import { getLocations } from '@/lib/data';
import { PropertyWizard } from '@/components/partner/PropertyWizard';

export default async function PropertyEdit({ params }) {
  const { id } = await params;
  const { db, partner, user } = await requirePartner(`/partner/properties/${id}`);
  const { lang, L, status } = await getT();
  const [{ hs, rooms }, locations] = await Promise.all([loadHost(db, partner), getLocations()]);
  const x = id === 'new' ? null : hs.find((h) => h.id === id);
  if (id !== 'new' && !x) notFound();
  if (!x && !(partner.status === 'approved' || partner.status === 'pending')) return <p className="soft-note warn">{L('Your partner account is not active.', 'आपका पार्टनर अकाउंट सक्रिय नहीं है।')}</p>;
  return (
    <>
      <div className="pp-head"><div><Link className="pp-back" href="/partner/properties">← {L('My homestays', 'मेरे होमस्टे')}</Link>
        <h1>{x ? x.name : L('Add homestay', 'होमस्टे जोड़ें')}</h1></div>
        {x ? <span className={`badge badge-${x.status}`}>{status(x.status)}</span> : null}</div>
      {x?.admin_note && x.status !== 'approved' ? <p className="pp-remark"><strong>{L('Admin remark', 'एडमिन टिप्पणी')}:</strong> {x.admin_note}</p> : null}
      <PropertyWizard lang={lang} partnerId={partner.id} userId={user.id} canSubmit={partner.status === 'approved'} amenities={AMENITIES}
        property={x} rooms={x ? rooms.filter((r) => r.homestay_id === x.id && r.is_active) : []}
        locations={locations.filter((l) => l.kind !== 'transport_hub').map((l) => ({ id: l.id, name: l.name, name_hi: l.name_hi, district: l.district }))} />
    </>
  );
}
