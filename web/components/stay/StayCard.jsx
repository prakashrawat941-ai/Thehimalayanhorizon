import Link from 'next/link';
import { Cover } from '../Cover';
import { inr, listingSlug } from '@/lib/format';

/** Homestay card for the list page: photo, place, name, up to 3 amenities, "from" price. Real data only. */
export function StayCard({ x, tr, locName }) {
  const { L, district } = tr;
  const place = [x.village || locName, district(x.district)].filter(Boolean).join(' · ');
  return (
    <Link className="st-card-l" href={`/homestays/${listingSlug(x.name, x.id)}`}>
      <Cover url={x.images?.[0]} seed={x.id} className="st-card-img" />
      <span className="st-card-b">
        {place ? <small>{place}</small> : null}
        <b>{x.name}</b>
        {(x.amenities || []).length ? <span className="chips">{x.amenities.slice(0, 3).map((a) => <span key={a} className="chip">{a}</span>)}</span> : null}
        <span className="st-card-p">
          {x.price_per_night ? <span><strong>{inr(x.price_per_night)}</strong> <small>/ {L('night, from', 'रात, से')}</small></span> : <span />}
          <span className="badge badge-approved">{L('Host confirms', 'होस्ट कन्फर्म करेंगे')}</span>
        </span>
      </span>
    </Link>
  );
}
