import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { getListings, getLocations, getRooms } from '@/lib/data';
import { getSession } from '@/lib/auth';
import { splitHouseRules } from '@/lib/stay';
import { loadListing } from '../ListingPages';
import { Grid, ListingCard } from '../Blocks';
import { Icon } from '../Icon';
import { Gallery } from './Gallery';
import { RoomCards, StayBooking } from './StayBooking';
import '@/app/stay.css';

/** Homestay detail page: gallery, facts, rooms, amenities, rules, host, booking card. Real data only. */
export async function StayDetail({ slug }) {
  const x = await loadListing('homestay', slug);
  if (!x) notFound();
  const tr = await getT();
  const { t, L, pick, district, lang } = tr;
  const [session, locs, rooms, more] = await Promise.all([
    getSession(), getLocations(), getRooms(x.id),
    x.location_id ? getListings('homestay', { locationId: x.location_id, limit: 4 }) : Promise.resolve([]),
  ]);
  const loc = locs.find((l) => l.id === x.location_id);
  const images = (x.images || []).filter(Boolean);
  const amen = (x.amenities || []).filter(Boolean);
  const rules = splitHouseRules(x.house_rules);
  const others = more.filter((m) => m.id !== x.id);
  const place = [x.village, loc ? pick(loc, 'name') : null, district(x.district || loc?.district)].filter((v, i, a) => v && a.indexOf(v) === i);
  const maxGuests = rooms.reduce((s, r) => s + r.max_guests * r.total_inventory, 0) || x.max_guests;
  return (
    <div className="page st-page">
      <Link className="st-back" href="/homestays">← {t('stays')}</Link>
      <Gallery images={images} seed={x.id} lang={lang} name={x.name} />
      <div className="st-layout">
        <div className="st-main">
          <div className="st-head">
            {place.length ? <p className="eyebrow">{place.join(' · ')}</p> : null}
            <h1>{x.name}</h1>
          </div>
          {x.summary ? <p className="st-lead">{x.summary}</p> : null}
          <div className="st-facts">
            {maxGuests ? <div><b>{maxGuests}</b>{L('guests max', 'अधिकतम मेहमान')}</div> : null}
            {rooms.length ? <div><b>{rooms.length}</b>{L('room types', 'रूम टाइप')}</div> : null}
            {rules.checkin ? <div><b>{rules.checkin}</b>{L('check-in from', 'चेक-इन से')}</div> : null}
          </div>
          {x.description && x.description !== x.summary ? <div className="prose">{String(x.description).split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div> : null}

          {rooms.length ? <section className="st-sec"><h2>{t('rooms')}</h2>
            <p className="st-sub">{L('Weekend price applies on Friday and Saturday nights. Tap a room to choose it.', 'वीकेंड किराया शुक्रवार और शनिवार की रात लगता है। चुनने के लिए कमरा दबाएँ।')}</p>
            <RoomCards rooms={rooms} lang={lang} /></section> : null}

          {amen.length ? <section className="st-sec"><h2>{L("What's here", 'यहाँ क्या है')}</h2>
            <div className="chips">{amen.map((a) => <span key={a} className="chip">{a}</span>)}</div></section> : null}

          {x.meals ? <section className="st-sec"><h2>{t('meals')}</h2><p style={{ margin: 0 }}>{x.meals}</p></section> : null}

          {rules.checkin || rules.checkout || rules.cancellation || rules.rules ? <section className="st-sec"><h2>{t('house_rules')}</h2>
            <div className="st-rules">
              {rules.checkin ? <div><span>{L('Check-in', 'चेक-इन')}</span><b>{L('from', 'से')} {rules.checkin}</b></div> : null}
              {rules.checkout ? <div><span>{L('Check-out', 'चेक-आउट')}</span><b>{L('by', 'तक')} {rules.checkout}</b></div> : null}
              {rules.cancellation ? <div className="wide"><span>{L('Cancellation', 'रद्द करना')}</span><b>{rules.cancellation}</b></div> : null}
            </div>
            {rules.rules ? <p className="st-rule-text">{rules.rules}</p> : null}</section> : null}

          <section className="st-sec"><h2>{L('Your host', 'आपके होस्ट')}</h2>
            <div className="st-host"><span className="st-host-ic"><Icon name="house" /></span>
              <span><b>{L('Hosted by a THH partner', 'THH पार्टनर के होस्ट')}</b><small>{L('Listing checked by the THH team · phone shared after the host confirms', 'लिस्टिंग THH टीम ने जाँची · फ़ोन होस्ट के कन्फर्म करने के बाद')}</small></span></div></section>

          {place.length ? <section className="st-sec"><h2>{L('Where', 'कहाँ')}</h2>
            <p style={{ margin: 0 }}>{place.join(', ')}. <Link href="/plan">{L('Plan the road trip →', 'सड़क यात्रा प्लान करें →')}</Link></p></section> : null}

          {others.length ? <section className="st-sec"><h2>{L('More nearby', 'आस-पास और')}</h2>
            <Grid cls="grid">{others.map((m) => <ListingCard key={m.id} kind="homestay" x={m} tr={tr} />)}</Grid></section> : null}
        </div>
        <aside className="st-side">
          <StayBooking listing={{ id: x.id, name: x.name }} lang={lang} profile={session.profile ? { full_name: session.profile.full_name, phone: session.profile.phone } : null}
            rooms={rooms.map((r) => ({ id: r.id, room_type: r.room_type, max_guests: r.max_guests, total_inventory: r.total_inventory, base_price: r.base_price, weekend_price: r.weekend_price }))} />
        </aside>
      </div>
    </div>
  );
}
