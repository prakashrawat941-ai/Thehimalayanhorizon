import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { getListing, getListings, getLocations, getRooms, KINDS } from '@/lib/data';
import { idFromSlug, inr, listingSlug } from '@/lib/format';
import { getSession } from '@/lib/auth';
import { publicDb } from '@/lib/supabase/server';
import { BookingForm } from './booking/BookingForm';
import { Chips, Empty, Grid, ListingCard, Section } from './Blocks';
import { Cover } from './Cover';
import { imgUrl } from '@/lib/img';
import { PageHero } from './PageHero';
import { PhotoCredits } from './PhotoCredits';
const HERO_PHOTO = { homestay: 'village', workspace: 'workBalcony', village_tour: 'walk' };
const TITLE_KEY = { homestay: 'stays', workspace: 'workspaces', village_tour: 'village_tours' };
const LEGACY_DETAIL = { homestay: 'stay', workspace: 'workspace', village_tour: 'tour' };
function intro(kind, tr) {
    const { L } = tr;
    return {
        homestay: L('Stay in real mountain homes run by local families. Send a request and the host confirms.', 'स्थानीय परिवारों के असली पहाड़ी घरों में ठहरिए। रिक्वेस्ट भेजिए, होस्ट कन्फर्म करेंगे।'),
        workspace: L('Desks with Wi-Fi and power backup, with a Himalayan view. By the day or the month.', 'वाई-फ़ाई और पावर बैकअप वाली डेस्क, हिमालय के नज़ारे के साथ। दिन या महीने के हिसाब से।'),
        village_tour: L('Walk a village with the people who live there: food, farming, crafts and folk traditions.', 'गाँव वालों के साथ गाँव घूमिए: खाना, खेती, हस्तकला और लोक परंपराएँ।'),
    }[kind];
}
export async function listingMeta(kind) {
    const tr = await getT();
    return { title: tr.t(TITLE_KEY[kind]), description: intro(kind, tr), alternates: { canonical: KINDS[kind].route } };
}
/** List page with simple filters (place/district, max price, guests). Filters are links/GET form: no JavaScript needed. */
export async function ListingList({ kind, sp }) {
    const tr = await getT();
    const { t, pick, district, L, lang } = tr;
    const [rows, locs] = await Promise.all([getListings(kind), getLocations()]);
    const k = KINDS[kind];
    const maxPrice = Number(sp.max) || 0;
    const guests = Number(sp.guests) || 0;
    const checkIn = kind === 'homestay' && typeof sp.check_in === 'string' ? sp.check_in : '';
    const checkOut = kind === 'homestay' && typeof sp.check_out === 'string' ? sp.check_out : '';
    const datesRequested = Boolean(checkIn || checkOut);
    const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d))
      && new Date(d).toISOString().slice(0,10) === d;
    const today = new Date(Date.now() + 19_800_000).toISOString().slice(0,10);
    const validStay = validDate(checkIn) && validDate(checkOut) && checkIn >= today && checkOut > checkIn
      && Date.parse(checkOut) - Date.parse(checkIn) <= 60 * 86_400_000
      && Number.isInteger(guests) && guests >= 0 && guests <= 50;
    let dateError = datesRequested && !validStay
      ? L('Choose valid check-in and check-out dates for a stay of up to 60 nights.', '60 रातों तक ठहरने के लिए सही आने और जाने की तारीख चुनें।') : '';
    const districts = [...new Set(rows.map((x) => x.district || locs.find((l) => l.id === x.location_id)?.district).filter(Boolean))];
    let shown = rows
        .filter((x) => !sp.district || (x.district || locs.find((l) => l.id === x.location_id)?.district) === sp.district)
        .filter((x) => !maxPrice || (x[k.priceField] ?? 0) <= maxPrice)
        .filter((x) => !guests || kind !== 'homestay' || (x.max_guests ?? 0) >= guests);
    if (datesRequested && validStay && shown.length) {
        const batches = [];
        for (let i = 0; i < shown.length; i += 100) {
            batches.push(publicDb().rpc('find_available_homestays', {
                p_ids: shown.slice(i, i + 100).map((row) => row.id),
                p_start: checkIn, p_end: checkOut, p_guests: guests || 1,
            }));
        }
        const results = await Promise.all(batches);
        if (results.some((r) => r.error)) {
            dateError = L('Availability could not be checked. Try again.', 'उपलब्धता जाँची नहीं जा सकी। फिर कोशिश करें।');
        } else {
            const ids = new Set(results.flatMap((r) => (r.data || []).map((item) => item.homestay_id)));
            shown = shown.filter((row) => ids.has(row.id));
        }
    }
    if (dateError) shown = [];
    const locName = (x) => { const l = locs.find((y) => y.id === x.location_id); return l ? pick(l, 'name') : undefined; };
    const filtered = !!(sp.district || sp.max || sp.guests || datesRequested);
    return (<div className="rf-page">
      <PageHero lang={lang} photo={HERO_PHOTO[kind]} title={t(TITLE_KEY[kind])} lead={intro(kind, tr)}/>
      <div className="wrap">
      {rows.length ? (<div className="rf-panel"><form className="listing-filters" method="get" action={k.route}>
          <label className="field"><span className="field-label">{t('district')}</span>
            <select className="input" name="district" defaultValue={sp.district || ''}>
              <option value="">{t('any')}</option>{districts.map((d) => <option key={d} value={d}>{district(d)}</option>)}
            </select></label>
          <label className="field"><span className="field-label">{kind === 'homestay' ? t('price_per_night_max') : t('price_from')} (₹)</span>
            <input className="input" name="max" type="number" min={0} step={100} inputMode="numeric" defaultValue={sp.max || ''}/></label>
          {kind === 'homestay' ? (<label className="field"><span className="field-label">{t('guests')}</span>
              <input className="input" name="guests" type="number" min={1} max={50} inputMode="numeric" defaultValue={sp.guests || ''}/></label>) : null}
          {kind === 'homestay' ? <>
            <label className="field"><span className="field-label">{L('Check-in', 'आने की तारीख')}</span>
              <input className="input" name="check_in" type="date" min={today} defaultValue={checkIn}/></label>
            <label className="field"><span className="field-label">{L('Check-out', 'जाने की तारीख')}</span>
              <input className="input" name="check_out" type="date" min={today} defaultValue={checkOut}/></label>
          </> : null}
          <button className="btn" type="submit">{t('filter')}</button>
          {filtered ? <Link className="link" href={k.route}>{t('clear_filters')}</Link> : null}
        </form></div>) : null}
      {dateError ? <p role="alert" className="form-err">{dateError}</p> : null}
      {datesRequested && !dateError && shown.length ? <p className="small muted">{L('Rooms were available when checked. The host still confirms the booking.', 'जाँच के समय कमरे उपलब्ध थे। बुकिंग की पुष्टि होस्ट करेंगे।')}</p> : null}
      {rows.length && !dateError ? <p className="rf-count">{shown.length} {t('results')}</p> : null}
      <div className={rows.length ? '' : 'rf-body'}>
      {dateError ? null : shown.length ? <Grid>{shown.map((x) => <ListingCard key={x.id} kind={kind} x={x} tr={tr} locName={locName(x)}/>)}</Grid>
            : <Empty icon="house" text={rows.length ? t('nothing_here') : t('no_listings')} action={rows.length ? (filtered ? <Link className="btn btn-ghost" href={k.route}>{t('clear_filters')}</Link> : undefined) : <Link className="btn btn-ghost" href="/partner/join">{t('become_partner')}</Link>}/>}
      </div>
      </div>
      <PhotoCredits names={[HERO_PHOTO[kind]]} L={L}/>
    </div>);
}
export async function loadListing(kind, slug) {
    const id = idFromSlug(slug);
    if (!id)
        return null;
    return getListing(kind, id);
}
export async function listingDetailMeta(kind, slug) {
    const x = await loadListing(kind, slug);
    if (!x)
        return {};
    const k = KINDS[kind];
    const image = imgUrl(x.images?.[0]);
    return { title: x[k.nameField], description: String(x.summary || '').slice(0, 160), alternates: { canonical: `${k.route}/${listingSlug(x[k.nameField], x.id)}` }, openGraph: image ? { images: [image] } : undefined };
}
export async function ListingDetail({ kind, slug }) {
    const x = await loadListing(kind, slug);
    if (!x)
        notFound();
    const tr = await getT();
    const { t, L, pick, district } = tr;
    const k = KINDS[kind];
    const session = await getSession();
    const [locs, rooms, more] = await Promise.all([
        getLocations(), kind === 'homestay' ? getRooms(x.id) : Promise.resolve([]),
        x.location_id ? getListings(kind, { locationId: x.location_id, limit: 4 }) : Promise.resolve([]),
    ]);
    const loc = locs.find((l) => l.id === x.location_id);
    const images = (x.images || []).filter(Boolean);
    const amen = x.amenities || [];
    const lowest = rooms.length ? Math.min(...rooms.map((r) => r.base_price)) : x[k.priceField];
    return (<div className="page">
      <p className="small"><Link href={k.route}>← {t(TITLE_KEY[kind])}</Link></p>
      <div className="detail-hero">
        <Cover url={images[0]} seed={x.id} className="detail-img" eager/>
        <div className="detail-hero-text">
          <p className="eyebrow">{[x.village, loc ? pick(loc, 'name') : null, district(x.district || loc?.district)].filter(Boolean).join(' · ')}</p>
          <h1>{x[k.nameField]}</h1>
        </div>
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          {x.summary ? <p className="lead">{x.summary}</p> : null}
          {x.description ? <div className="prose">{String(x.description).split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div> : null}
          {images.length > 1 ? <div className="gallery">{images.slice(1).map((g, i) => <Cover key={i} url={g} seed={`${x.id}-${i}`} className="gallery-img"/>)}</div> : null}

          {kind === 'homestay' && rooms.length ? (<Section title={t('rooms')} subtitle={L('Weekend price applies on Friday and Saturday nights. Final amount is confirmed by the host.', 'वीकेंड दाम शुक्रवार और शनिवार की रात लगता है। अंतिम रकम होस्ट कन्फर्म करेंगे।')}>
              <div className="room-list">
                {rooms.map((r) => (<div className="room" key={r.id}>
                    <div><strong>{r.room_type}</strong><span className="muted small">{t('max_guests')}: {r.max_guests} · {L('Rooms', 'कमरे')}: {r.total_inventory}</span></div>
                    <div className="right"><strong>{inr(r.base_price)}</strong> <span className="muted small">{t('per_night')}</span>
                      {r.weekend_price ? <div className="small muted">{L('Weekend', 'वीकेंड')}: {inr(r.weekend_price)}</div> : null}</div>
                  </div>))}
              </div>
            </Section>) : null}
          {amen.length ? <Section title={t('amenities')}><Chips items={amen}/></Section> : null}
          {kind === 'homestay' && x.meals ? <Section title={t('meals')}><p>{x.meals}</p></Section> : null}
          {kind === 'homestay' && x.house_rules ? <Section title={t('house_rules')}><p className="prose">{x.house_rules}</p></Section> : null}
          {kind === 'village_tour' && (x.culture_highlights || []).length ? <Section title={t('culture')}><Chips items={x.culture_highlights}/></Section> : null}
          {kind === 'village_tour' && (x.includes || []).length ? <Section title={t('includes')}><Chips items={x.includes}/></Section> : null}
          {more.filter((m) => m.id !== x.id).length ? (<Section title={L('More nearby', 'आस-पास और')}><Grid cls="grid">{more.filter((m) => m.id !== x.id).map((m) => <ListingCard key={m.id} kind={kind} x={m} tr={tr}/>)}</Grid></Section>) : null}
        </div>
        <aside className="detail-side">
          <div className="panel sticky">
            {lowest ? <div className="kv"><span>{t('price_from')}</span><strong style={{ fontSize: '1.4rem' }}>{inr(lowest)}</strong><small className="muted">{t(k.unit)}</small></div> : null}
            {kind === 'homestay' ? <div className="kv"><span>{t('max_guests')}</span><strong>{x.max_guests}</strong></div> : null}
            {kind === 'workspace' ? (<>
                <div className="kv"><span>{t('desks')}</span><strong>{x.desks}</strong></div>
                <div className="kv"><span>{t('wifi')}</span><strong>{x.wifi_mbps ? `${x.wifi_mbps} Mbps (${L('as listed by host', 'होस्ट के अनुसार')})` : L('Ask the host', 'होस्ट से पूछें')}</strong></div>
                <div className="kv"><span>{t('power_backup')}</span><strong>{x.power_backup ? L('Yes', 'हाँ') : L('No', 'नहीं')}</strong></div>
                {x.price_per_month ? <div className="kv"><span>{L('Per month', 'प्रति माह')}</span><strong>{inr(x.price_per_month)}</strong></div> : null}
              </>) : null}
            {kind === 'village_tour' ? (<>
                <div className="kv"><span>{t('duration')}</span><strong>{x.duration_hours} {t('hours')}</strong></div>
                <div className="kv"><span>{t('group_size')}</span><strong>{x.max_group}</strong></div>
                {(x.languages || []).length ? <div className="kv"><span>{t('languages')}</span><strong>{x.languages.join(', ')}</strong></div> : null}
                {x.best_season ? <div className="kv"><span>{t('best_season')}</span><strong>{x.best_season}</strong></div> : null}
              </>) : null}
            <BookingForm kind={kind} listing={{ id: x.id }} rooms={rooms} lang={tr.lang} profile={session.profile}/>
          </div>
        </aside>
      </div>
    </div>);
}
