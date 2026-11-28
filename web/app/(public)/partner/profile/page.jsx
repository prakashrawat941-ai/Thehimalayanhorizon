import { getT } from '@/lib/i18n/server';
import { requirePartner } from '@/lib/partner';
import { getLocations } from '@/lib/data';
import { PartnerForm } from '@/components/partner/PartnerForm';

export default async function PartnerProfile() {
  const { partner } = await requirePartner('/partner/profile');
  const { L, lang, status } = await getT();
  const locations = await getLocations();
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Business profile', 'बिज़नेस प्रोफ़ाइल')}</h1>
        <p className="muted">{L('Status', 'स्थिति')}: <span className={`badge badge-${partner.status}`}>{status(partner.status)}</span></p></div></div>
      {partner.admin_note ? <p className="soft-note warn"><strong>{L('Admin remark', 'एडमिन टिप्पणी')}:</strong> {partner.admin_note}</p> : null}
      <section className="ds-panel">
        <PartnerForm lang={lang} partnerId={partner.id} initial={partner} locations={locations.filter((l) => l.kind !== 'transport_hub').map((l) => ({ id: l.id, name: l.name, name_hi: l.name_hi }))} />
      </section>
    </>
  );
}
