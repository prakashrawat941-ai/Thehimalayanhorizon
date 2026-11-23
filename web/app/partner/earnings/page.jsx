import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requirePartner, loadHost } from '@/lib/partner';
import { rows } from '@/lib/account';
import { fmtDate, inr } from '@/lib/format';
import { RpcButton } from '@/components/account/RpcButton';

export default async function Earnings() {
  const { db, partner } = await requirePartner('/partner/earnings');
  const { L, lang, status } = await getT();
  const [{ bookings }, payouts, { data: kyc }] = await Promise.all([
    loadHost(db, partner),
    rows(db.from('payout_requests').select('*').eq('partner_id', partner.id).order('requested_at', { ascending: false })),
    db.from('partner_kyc').select('status, upi_id, bank_account_number, bank_ifsc').eq('partner_id', partner.id).maybeSingle(),
  ]);
  const done = bookings.filter((b) => b.status === 'completed' && b.partner_payout_amount != null);
  const sum = (arr, k) => arr.reduce((s, b) => s + (b[k] || 0), 0);
  const unpaid = done.filter((b) => b.payout_status === 'unpaid');
  const kycOk = kyc?.status === 'verified' && (kyc.upi_id || (kyc.bank_account_number && kyc.bank_ifsc));
  const open = payouts.some((p) => p.status === 'pending');
  const payoutStatus = { unpaid: L('Unpaid', 'बाकी'), processing: L('Payout requested', 'पेआउट माँगा'), paid: L('Paid', 'भुगतान हुआ') };
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Earnings & payouts', 'कमाई और पेआउट')}</h1>
        <p className="muted">{L('Records only — guests pay you directly; THH commission is settled through payouts.', 'सिर्फ़ रिकॉर्ड — मेहमान सीधे आपको भुगतान करते हैं; THH कमीशन पेआउट से तय होता है।')}</p></div></div>
      <div className="ds-stats">
        <div className="ds-stat"><span className="ds-stat-l">{L('Completed stays (total)', 'पूरे स्टे (कुल)')}</span><span className="ds-stat-n">{inr(sum(done, 'total_amount'))}</span></div>
        <div className="ds-stat"><span className="ds-stat-l">{L('THH commission', 'THH कमीशन')}</span><span className="ds-stat-n">{inr(sum(done, 'platform_commission'))}</span></div>
        <div className="ds-stat"><span className="ds-stat-l">{L('Your share', 'आपका हिस्सा')}</span><span className="ds-stat-n">{inr(sum(done, 'partner_payout_amount'))}</span></div>
        <div className="ds-stat urgent"><span className="ds-stat-l">{L('Not yet paid out', 'अभी पेआउट बाकी')}</span><span className="ds-stat-n">{inr(sum(unpaid, 'partner_payout_amount'))}</span></div>
      </div>
      <section className="ds-panel">
        <h2>{L('Request payout', 'पेआउट माँगें')}</h2>
        {!kycOk ? <p>{L('Payouts open after your KYC and bank / UPI details are verified.', 'KYC और बैंक / UPI वेरिफ़ाई होने के बाद पेआउट खुलेगा।')} <Link href="/partner/kyc">{L('KYC & bank', 'KYC और बैंक')}</Link></p>
          : open ? <p>{L('You have an open payout request. A new one can be made after it is processed.', 'आपकी एक पेआउट रिक्वेस्ट खुली है। उसके पूरा होने के बाद नई माँग सकेंगे।')}</p>
            : unpaid.length ? <RpcButton fn="request_payout" args={{ p_partner: partner.id }} className="btn" label={`${L('Request payout', 'पेआउट माँगें')} ${inr(sum(unpaid, 'partner_payout_amount'))}`}
              confirmText={L('Request payout for all completed, unpaid stays?', 'सभी पूरे, बाकी स्टे का पेआउट माँगें?')} doneText={L('Requested', 'माँगा गया')} />
              : <p className="muted">{L('Nothing to pay out right now.', 'अभी कोई पेआउट बाकी नहीं।')}</p>}
      </section>
      <section className="ds-panel">
        <h2>{L('Completed stays', 'पूरे स्टे')}</h2>
        {done.length ? <div className="table-wrap"><table className="table">
          <thead><tr><th>{L('Booking', 'बुकिंग')}</th><th className="right">{L('Total', 'कुल')}</th><th className="right">{L('Commission', 'कमीशन')}</th><th className="right">{L('Your share', 'आपका हिस्सा')}</th><th>{L('Payout', 'पेआउट')}</th></tr></thead>
          <tbody>{done.map((b) => <tr key={b.id}><td><span className="mono small">{b.booking_code}</span><div className="small muted">{b.guest_name} · {fmtDate(b.start_date, lang)}</div></td>
            <td className="right">{inr(b.total_amount)}</td><td className="right">{inr(b.platform_commission)} <small className="muted">({Number(b.commission_rate)}%)</small></td><td className="right"><strong>{inr(b.partner_payout_amount)}</strong></td>
            <td><span className={`badge badge-${b.payout_status === 'paid' ? 'approved' : b.payout_status === 'processing' ? 'pending' : 'draft'}`}>{payoutStatus[b.payout_status] || b.payout_status}</span></td></tr>)}</tbody>
        </table></div> : <p className="muted">{L('No completed stays yet.', 'अभी कोई पूरा स्टे नहीं।')}</p>}
      </section>
      <section className="ds-panel">
        <h2>{L('Payout history', 'पेआउट इतिहास')}</h2>
        {payouts.length ? <div className="ds-rows">{payouts.map((p) => (
          <div key={p.id} className="ds-row"><span className="grow"><strong>{inr(p.amount)}</strong><span>{fmtDate(p.requested_at, lang)} · {p.bookings_count} {L('stays', 'स्टे')}{p.transaction_ref ? ` · UTR/UPI ${p.transaction_ref}` : ''}{p.admin_note ? ` · ${p.admin_note}` : ''}</span></span>
            <span className={`badge badge-${p.status === 'approved' ? 'approved' : p.status}`}>{p.status === 'approved' ? L('Paid', 'भुगतान हुआ') : status(p.status)}</span></div>
        ))}</div> : <p className="muted">{L('No payouts yet.', 'अभी कोई पेआउट नहीं।')}</p>}
      </section>
    </>
  );
}
