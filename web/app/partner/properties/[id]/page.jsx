import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requirePartner, loadHost, AMENITIES } from '@/lib/partner';
import { getLocations } from '@/lib/data';
import { PropertyWizard } from '@/components/partner/PropertyWizard';

export default async function PropertyEdit({ params }) {
  const { id } = await params;
  const { db, partner, user } = await requirePartner(`/partner/properties/${id}`);
  const { lang, L } = await getT();
  const [{ hs, rooms }, locations] = await Promise.all([loadHost(db, partner), getLocations()]);
  const x = id === 'new' ? null : hs.find((h) => h.id === id);
  if (id !== 'new' && !x) notFound();
  if (!x && !(partner.status === 'approved' || partner.status === 'pending')) return <p className="soft-note warn">{L('Your partner account is not active.', 'आपका पार्टनर अकाउंट सक्रिय नहीं है।')}</p>;
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{x ? x.name : L('Add property', 'प्रॉपर्टी जोड़ें')}</h1></div></div>
      <PropertyWizard lang={lang} partnerId={partner.id} userId={user.id} canSubmit={partner.status === 'approved'} amenities={AMENITIES}
        property={x} rooms={x ? rooms.filter((r) => r.homestay_id === x.id && r.is_active) : []}
        locations={locations.filter((l) => l.kind !== 'transport_hub').map((l) => ({ id: l.id, name: l.name, name_hi: l.name_hi, district: l.district }))} />
    </>
  );
}
