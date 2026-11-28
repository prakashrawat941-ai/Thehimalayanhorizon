import { getT } from '@/lib/i18n/server';
import { requirePartner } from '@/lib/partner';
import { KycForm } from '@/components/partner/KycForm';

export default async function Kyc() {
  const { db, partner, user } = await requirePartner('/partner/kyc');
  const { L, lang, status } = await getT();
  const { data: kyc } = await db.from('partner_kyc').select('*').eq('partner_id', partner.id).maybeSingle();
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('KYC & bank', 'KYC और बैंक')}</h1>
        <p className="muted">{L('Only you and the THH admin can see these details. ID files are stored privately.', 'ये जानकारी सिर्फ़ आप और THH एडमिन देख सकते हैं। आईडी फ़ाइलें निजी रखी जाती हैं।')}</p></div></div>
      {kyc?.status ? <p className={`soft-note ${kyc.status === 'rejected' ? 'warn' : ''}`}><strong>{L('KYC status', 'KYC स्थिति')}:</strong> <span className={`badge badge-${kyc.status === 'verified' ? 'approved' : kyc.status}`}>{status(kyc.status)}</span>{kyc.admin_remark ? ` · ${kyc.admin_remark}` : ''}</p> : null}
      <KycForm lang={lang} partnerId={partner.id} userId={user.id} initial={kyc} />
    </>
  );
}
