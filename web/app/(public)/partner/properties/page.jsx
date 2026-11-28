import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requirePartner, loadHost } from '@/lib/partner';
import { inr, listingSlug } from '@/lib/format';
import { listingHealth } from '@/lib/partner-ui';
import { Icon } from '@/components/Icon';
import { Cover } from '@/components/Cover';

export default async function Properties() {
  const { db, partner } = await requirePartner('/partner/properties');
  const { L, status } = await getT();
  const { hs, rooms } = await loadHost(db, partner);
  const label = (s) => (s === 'approved' ? L('Live', 'लाइव') : s === 'pending' ? L('In review', 'जाँच में') : s === 'rejected' ? L('Changes needed', 'बदलाव चाहिए') : status(s));
  return (
    <>
      <div className="pp-head"><div><h1>{L('My homestays', 'मेरे होमस्टे')}</h1></div>
        <Link className="btn" href="/partner/properties/new"><Icon name="plus" size={16} /> {L('Add homestay', 'होमस्टे जोड़ें')}</Link></div>
      {hs.length ? <div className="pp-props">{hs.map((h) => {
        const rs = rooms.filter((r) => r.homestay_id === h.id && r.is_active);
        const hl = listingHealth(h, rooms, L);
        return (
          <article key={h.id} className="pp-prop">
            <Cover url={h.images?.[0]} seed={h.id} className="pp-cover" />
            <div className="pp-prop-b">
              <span className={`badge badge-${h.status}`}>{label(h.status)}</span>
              <b>{h.name}</b>
              <small>{[h.village, h.district].filter(Boolean).join(', ')} · {rs.length} {L('room types', 'रूम टाइप')} · {(h.images || []).length} {L('photos', 'फ़ोटो')}{h.price_per_night ? ` · ${L('from', 'से')} ${inr(h.price_per_night)}` : ''}</small>
              <div className="pp-bar" role="progressbar" aria-valuenow={hl.pct} aria-valuemin={0} aria-valuemax={100} aria-label={L('Listing complete', 'लिस्टिंग पूरी')}><i style={{ width: `${hl.pct}%` }} /></div>
              <small>{h.status === 'approved' ? `${L('Commission', 'कमीशन')}: ${Number(h.commission_rate ?? 12)}% · ${L('set by admin', 'एडमिन तय करते हैं')}`
                : h.status === 'pending' ? L('Our team is checking it.', 'हमारी टीम जाँच रही है।')
                  : h.status === 'draft' ? L(`${hl.done} of ${hl.total} done — finish and send for review.`, `${hl.total} में से ${hl.done} पूरे — पूरा करके जाँच के लिए भेजें।`) : null}</small>
              {h.admin_note && h.status !== 'approved' ? <p className="pp-remark"><strong>{L('Admin remark', 'एडमिन टिप्पणी')}:</strong> {h.admin_note}</p> : null}
              <div className="pp-acts" style={{ marginTop: 'auto' }}>
                <Link className="btn btn-sm" href={`/partner/properties/${h.id}`}>{L('Edit', 'बदलें')}</Link>
                {rs[0] ? <Link className="btn btn-ghost btn-sm" href={`/partner/calendar?room=${rs[0].id}`}>{L('Calendar', 'कैलेंडर')}</Link> : null}
                {h.status === 'approved' ? <Link className="btn btn-ghost btn-sm" href={`/homestays/${listingSlug(h.name, h.id)}`}>{L('View as guest', 'मेहमान की तरह देखें')}</Link> : null}
              </div>
            </div>
          </article>
        );
      })}</div> : <div className="pp-state"><Icon name="house" size={30} /><h2>{L('Add your first homestay', 'अपना पहला होमस्टे जोड़ें')}</h2>
        <p>{L('Five short steps: basic info, rooms, photos, house rules and a final check. Save as a draft any time.', 'पाँच आसान कदम: जानकारी, कमरे, फ़ोटो, घर के नियम और आख़िरी जाँच। कभी भी ड्राफ़्ट सेव करें।')}</p>
        <Link className="btn" href="/partner/properties/new"><Icon name="plus" size={16} /> {L('Add homestay', 'होमस्टे जोड़ें')}</Link></div>}
    </>
  );
}
