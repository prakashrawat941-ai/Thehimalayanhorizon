import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requirePartner, loadHost } from '@/lib/partner';
import { inr, listingSlug } from '@/lib/format';
import { Empty } from '@/components/Blocks';
import { Icon } from '@/components/Icon';
import { Cover } from '@/components/Cover';

export default async function Properties() {
  const { db, partner } = await requirePartner('/partner/properties');
  const { L, status } = await getT();
  const { hs, rooms } = await loadHost(db, partner);
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('My properties', 'मेरी प्रॉपर्टी')}</h1></div>
        <div className="ds-actions"><Link className="btn" href="/partner/properties/new"><Icon name="plus" size={16} /> {L('Add property', 'प्रॉपर्टी जोड़ें')}</Link></div></div>
      {hs.length ? <div className="ds-body">{hs.map((h) => {
        const rs = rooms.filter((r) => r.homestay_id === h.id && r.is_active);
        return (
          <article key={h.id} className="ds-panel">
            <div className="ds-row" style={{ borderTop: 0, padding: 0 }}>
              <Cover url={h.images?.[0]} seed={h.id} className="thumb" />
              <span className="grow"><strong>{h.name}</strong><span>{[h.village, h.district].filter(Boolean).join(', ')} · {rs.length} {L('room types', 'रूम टाइप')}{h.price_per_night ? ` · ${L('from', 'से')} ${inr(h.price_per_night)}` : ''}</span>
                {h.status === 'approved' ? <span>{L('Commission', 'कमीशन')}: {Number(h.commission_rate ?? 12)}%</span> : null}</span>
              <span className={`badge badge-${h.status}`}>{status(h.status)}</span>
            </div>
            {h.admin_note && h.status !== 'approved' ? <p className="soft-note warn"><strong>{L('Admin remark', 'एडमिन टिप्पणी')}:</strong> {h.admin_note}</p> : null}
            <div className="row-actions">
              <Link className="btn btn-sm" href={`/partner/properties/${h.id}`}>{L('Edit', 'बदलें')}</Link>
              <Link className="btn btn-ghost btn-sm" href={`/partner/calendar?room=${rs[0]?.id || ''}`}>{L('Rate calendar', 'रेट कैलेंडर')}</Link>
              {h.status === 'approved' ? <Link className="btn btn-ghost btn-sm" href={`/homestays/${listingSlug(h.name, h.id)}`}>{L('View public page', 'पब्लिक पेज देखें')}</Link> : null}
            </div>
          </article>
        );
      })}</div> : <Empty icon="house" text={L('No property yet.', 'अभी कोई प्रॉपर्टी नहीं।')} action={<Link className="btn" href="/partner/properties/new">{L('Add property', 'प्रॉपर्टी जोड़ें')}</Link>} />}
    </>
  );
}
