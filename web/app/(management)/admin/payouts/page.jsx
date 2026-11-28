import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { rows } from '@/lib/account';
import { fmtDate, inr } from '@/lib/format';
import { PayoutDecide } from '@/components/admin/PayoutDecide';

export default async function Payouts() {
  const { db } = await requireAdmin('/admin/payouts');
  const { L, lang, status } = await getT();
  const list = await rows(db.from('payout_requests').select('*, partners(business_name, contact_name)').order('requested_at', { ascending: false }).limit(200));
  const ids = [...new Set(list.filter((p) => p.status === 'pending').map((p) => p.partner_id))];
  const kyc = ids.length ? await rows(db.from('partner_kyc').select('partner_id, status, upi_id, bank_account_name, bank_account_number, bank_ifsc').in('partner_id', ids)) : [];
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Payouts', 'पेआउट')}</h1><p className="muted">{L('Send the money outside the platform, then mark it paid with the reference.', 'पैसा प्लेटफ़ॉर्म के बाहर भेजें, फिर रेफ़रेंस के साथ भुगतान दर्ज करें।')}</p></div></div>
      <div className="ds-body">{list.length ? list.map((p) => {
        const k = kyc.find((x) => x.partner_id === p.partner_id);
        return (
          <article key={p.id} className="ds-panel">
            <div className="ds-row" style={{ borderTop: 0, padding: 0 }}><span className="grow"><strong>{p.partners?.business_name} · {inr(p.amount)}</strong><span>{fmtDate(p.requested_at, lang)} · {p.bookings_count} {L('stays', 'स्टे')}{p.transaction_ref ? ` · ${p.transaction_ref}` : ''}</span></span>
              <span className={`badge badge-${p.status}`}>{p.status === 'approved' ? L('Paid', 'भुगतान हुआ') : status(p.status)}</span></div>
            {p.status === 'pending' ? <>
              <p className="small">{k ? <>{L('Send to', 'भेजें')}: {k.upi_id ? `UPI ${k.upi_id}` : `${k.bank_account_name || ''} · ${k.bank_account_number} · ${k.bank_ifsc}`} · KYC <strong>{status(k.status)}</strong></> : L('No KYC on file.', 'KYC नहीं है।')}</p>
              <PayoutDecide lang={lang} id={p.id} />
            </> : p.admin_note ? <p className="small muted">{p.admin_note}</p> : null}
          </article>
        );
      }) : <p className="muted">{L('No payout requests yet.', 'अभी कोई पेआउट रिक्वेस्ट नहीं।')}</p>}</div>
    </>
  );
}
