import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireUser, rows } from '@/lib/account';
import { getLocations } from '@/lib/data';
import { PartnerForm } from '@/components/partner/PartnerForm';

export async function generateMetadata() { const { t } = await getT(); return { title: t('become_partner') }; }

export default async function Join() {
  const { db, user, profile } = await requireUser('/partner/join');
  const { t, L, lang } = await getT();
  const [existing, locations] = await Promise.all([rows(db.from('partners').select('id').eq('owner_id', user.id)), getLocations()]);
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>{t('become_partner')}</h1>
      <p className="lead">{L('Homestay, cab, workspace or village tour: fill in your details. The admin checks and approves, then you can add listings and rides.', 'होमस्टे, कैब, वर्कस्पेस या गाँव का टूर: अपनी जानकारी भरिए। एडमिन जाँच कर मंज़ूरी देंगे, फिर आप अपनी लिस्टिंग और राइड डाल सकेंगे।')}</p>
      {existing.length ? <p className="soft-note">{L('You already have a partner application.', 'आपका पार्टनर आवेदन पहले से है।')} <Link href="/partner">{L('Open partner portal', 'पार्टनर पोर्टल खोलें')}</Link></p> : (
        <div className="panel">
          <PartnerForm lang={lang} locations={locations.filter((l) => l.kind !== 'transport_hub').map((l) => ({ id: l.id, name: l.name, name_hi: l.name_hi }))}
            initial={{ contact_name: profile?.full_name || '', phone: profile?.phone || '', email: user.email || '' }} />
        </div>
      )}
    </div>
  );
}
