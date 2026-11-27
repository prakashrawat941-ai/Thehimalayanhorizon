import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { getHomeSections, getItineraries, getListings, getLocations, getSettings, getThemes } from '@/lib/data';
import { inr, listingSlug } from '@/lib/format';
import { TrustStrip, SeasonNow, SamplePlan, TodayRides } from '@/components/home/Extras';
import { ExploreMap } from '@/components/home/ExploreMap';
import { WhatsAppButton } from '@/components/home/WhatsAppButton';
import { istMonth, seasonOf, goodIn } from '@/lib/home/season';
import { getTodayRides } from '@/lib/home/rides';
import { Icon } from '@/components/Icon';
import { Cover } from '@/components/Cover';
import { Photo } from '@/components/Photo';
import { PhotoCredits } from '@/components/PhotoCredits';
import { HomeSearch } from '@/components/home/HomeSearch';
import { PLACE_PHOTO, THEME_PHOTO } from '@/lib/photos';
import { Grid, ItineraryCard, ListingCard, PlaceCard } from '@/components/Blocks';
import { searchLabels } from '@/lib/searchLabels';
import './public-refresh.css';

// Old database links used "#/x"; the new site uses real paths.
const LEGACY_PATHS = { stays: '/homestays', tours: '/village-tours', explore: '/destinations', 'partner/join': '/partner/join', cabs: '/cab' };
function href(url, fallback) {
    if (!url)
        return fallback;
    if (url.startsWith('#/')) {
        const p = url.slice(2);
        return LEGACY_PATHS[p] ?? '/' + p;
    }
    return url;
}
function Head({ eyebrow, title, note, link, label }) {
    return (<div className="rf-head">
      <div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h2>{title}</h2>{note ? <p className="muted">{note}</p> : null}</div>
      {link ? <Link className="rf-more" href={link}>{label}<Icon name="arrow" size={14}/></Link> : null}
    </div>);
}
// Photo tile: a CMS image, a bundled/licensed photo, or generated art when neither exists.
function Tile({ link, cms, photo, seed, title, sub, tag, lang, className = 'rf-tile' }) {
    return (<Link className={className} href={link}>
      {photo && !cms ? <Photo name={photo} lang={lang} alt=""/> : <Cover url={cms || null} seed={seed} className="rf-art"/>}
      {tag ? <span className="rf-tag">{tag}</span> : null}
      <span className="rf-tile-b"><b>{title}</b>{sub ? <span>{sub}</span> : null}</span>
    </Link>);
}
function Feature({ icon, title, sub }) {
    return <div className="rf-feat"><i><Icon name={icon} size={20}/></i><span><b>{title}</b><span>{sub}</span></span></div>;
}

export default async function Home() {
    const tr = await getT();
    const { t, pick, L, lang } = tr;
    const [sections, session] = await Promise.all([getHomeSections(), getSession()]);
    const signedIn = !!session.user;
    const hiddenHome = sections.find((s) => s.kind === 'destinations')?.data?.hidden_location_ids || [];
    // Homepage extras: live, real data only; each block shows a clear empty state.
    const [locations, stays, itineraries, rides, settings] = await Promise.all([getLocations(), getListings('homestay'), getItineraries(), getTodayRides(), getSettings()]);
    const month = istMonth();
    const season = seasonOf(month);
    const seasonPlaces = locations.filter((l) => l.kind !== 'transport_hub' && goodIn(l.best_season, month)).slice(0, 6);
    const locById = new Map(locations.map((l) => [l.id, l]));
    const mapPoints = [
        ...locations.filter((l) => l.lat != null && l.lng != null && l.kind !== 'transport_hub').map((l) => ({ id: `l-${l.id}`, kind: l.kind === 'village' ? 'village' : 'place', name: pick(l, 'name'),
            sub: [l.district, pick(l, 'summary')].filter(Boolean).join(' · ').slice(0, 140), lat: l.lat, lng: l.lng, href: `/destinations/${l.slug}`, plan: `/plan?place=${encodeURIComponent(l.slug)}` })),
        ...stays.map((h) => { const l = locById.get(h.location_id); return l && l.lat != null && l.lng != null ? { id: `h-${h.id}`, kind: 'stay', name: h.name, sub: L(`Near ${pick(l, 'name')}`, `${pick(l, 'name')} के पास`) + (h.price_per_night ? ` · ${inr(h.price_per_night)} / ${L('night', 'रात')}` : ''),
            lat: l.lat, lng: l.lng, href: `/homestays/${listingSlug(h.name || 'stay', h.id)}`, plan: null } : null; }).filter(Boolean),
    ];
    // Once the home_extras migration has run, the five extras are home_sections rows that the
    // Co-founder/Admin can show, hide, reorder and retitle. Before that they keep fixed places.
    const cmsExtras = settings.home_layout?.extras_in_cms === true;
    const used = new Set();
    const notePhoto = (n) => { if (n) used.add(n); return n; };
    const sTitle = (s) => pick(s, 'title');
    const sSub = (s) => pick(s, 'subtitle');
    const cta = (s, fb) => pick(s, 'cta_label') || fb || t('explore');
    const searchText = {
        search_label: L('Search', 'खोजें'), tab_stays: L('Stays', 'होमस्टे'), tab_cab: L('Cab', 'कैब'), tab_plan: L('Trip plan', 'ट्रिप प्लान'),
        where: L('Where to? Village, town…', 'कहाँ जाना है? गाँव, कस्बा…'), plan_where: L('Where do you want to go?', 'कहाँ घूमना है?'),
        from: L('From', 'कहाँ से'), to: L('To', 'कहाँ तक'), date: L('Date', 'तारीख़'),
        guests: L('Guests', 'मेहमान'), guest: L('guest', 'मेहमान'), guests_unit: L('guests', 'मेहमान'),
        seats: L('Seats', 'सीटें'), seat: L('seat', 'सीट'), seats_unit: L('seats', 'सीटें'),
        go_stays: L('Search stays', 'होमस्टे खोजें'), go_cab: L('Find rides', 'राइड खोजें'), go_plan: L('Plan my trip', 'मेरा ट्रिप प्लान करें'),
        err_route: L('Choose where you start and where you are going.', 'कहाँ से और कहाँ तक, दोनों चुनें।'),
    };
    const blocks = {
        hero: (s) => (<div key={s.id}>
        <section className="rf-hero">
          {s.image_url ? <Cover url={s.image_url} seed="hero" eager className="rf-hero-img"/>
                : <Photo name={notePhoto('hero')} lang={lang} eager className="rf-hero-img"/>}
          <div className="wrap rf-hero-in">
            <p className="eyebrow">{t('tagline')}</p>
            <h1>{sTitle(s) || L('Real villages. Real people.', 'असली गाँव। असली लोग।')}</h1>
            {sSub(s) ? <p className="rf-hero-sub">{sSub(s)}</p> : null}
          </div>
        </section>
        <div className="wrap"><HomeSearch lang={lang} labels={searchLabels(tr)} text={searchText}/></div>
        {!cmsExtras ? <TrustStrip L={L}/> : null}
        <Services tr={tr}/>
      </div>),
        themes: async (s) => {
            const list = await getThemes();
            if (!list.length) return null;
            return (<section className="wrap rf-sec" key={s.id}>
          <Head title={sTitle(s)} note={sSub(s)} link="/experiences" label={t('view_all')}/>
          <div className="rf-themes">
            {list.map((th) => <Tile key={th.id} className="rf-tile rf-theme" link={`/experiences/${th.slug}`} photo={notePhoto(THEME_PHOTO[th.slug])} seed={th.slug} lang={lang} title={pick(th, 'name')}/>)}
          </div>
        </section>);
        },
        destinations: async (s) => {
            const [list, themes] = await Promise.all([getLocations(), getThemes()]);
            const hasPhoto = (l) => (l.image_url || PLACE_PHOTO[l.slug] ? 1 : 0);
            const shown = list.filter((l) => l.kind === 'destination' && !hiddenHome.includes(l.id)).sort((a, b) => hasPhoto(b) - hasPhoto(a) || Number(b.is_featured) - Number(a.is_featured)).slice(0, 4);
            const themeName = (l) => { const th = themes.find((x) => x.slug === l.theme_slugs?.[0]); return th ? pick(th, 'name') : null; };
            return (<section className="wrap rf-sec" key={s.id}>
          <Head eyebrow={t('places_eyebrow')} title={sTitle(s)} note={t('places_note')} link="/destinations" label={t('view_all')}/>
          {shown.length ? <div className="rf-places">
            {shown.map((l) => <Tile key={l.id} link={`/destinations/${l.slug}`} cms={l.image_url} photo={l.image_url ? null : notePhoto(PLACE_PHOTO[l.slug])} seed={l.slug} lang={lang} title={pick(l, 'name')} sub={pick(l, 'summary')} tag={themeName(l)}/>)}
          </div> : <p className="rf-soft">{L('Places are being added. Check back soon.', 'जगहें जोड़ी जा रही हैं। जल्द देखिए।')}</p>}
        </section>);
        },
        villages: async (s) => {
            const vs = (await getLocations()).filter((l) => l.kind === 'village' && !hiddenHome.includes(l.id)).slice(0, 6);
            return (<section className="rf-band" key={s.id}>
          <div className="wrap rf-split">
            <div>
              <p className="eyebrow">{sTitle(s)}</p>
              <h2>{t('stay_h1')}<br /><em>{t('stay_h2')}</em></h2>
              <p className="lead">{sSub(s) || t('stay_text')}</p>
              <div className="rf-feats">
                <Feature icon="house" title={t('f_homestay')} sub={t('f_homestay_sub')}/>
                <Feature icon="wifi" title={t('f_internet')} sub={t('f_internet_sub')}/>
                <Feature icon="leaf" title={t('f_food')} sub={t('f_food_sub')}/>
                <Feature icon="people" title={t('f_meaning')} sub={t('f_meaning_sub')}/>
              </div>
              <Link className="btn" href="/villages">{cta(s, t('nav_villages'))}<Icon name="arrow" size={16}/></Link>
            </div>
            <div className="rf-split-img"><Photo name={notePhoto('village')} lang={lang}/></div>
          </div>
          {vs.length ? <div className="wrap"><div className="rf-scroll">{vs.map((l) => <PlaceCard key={l.id} l={l} tr={tr}/>)}</div></div> : null}
        </section>);
        },
        itineraries: async (s) => {
            const list = (await getItineraries()).slice(0, 6);
            return (<section className="wrap rf-sec" key={s.id}>
          <Head title={sTitle(s)} note={sSub(s)} link="/itineraries" label={cta(s)}/>
          {list.length ? <Grid>{list.map((it) => <ItineraryCard key={it.id} it={it} tr={tr}/>)}</Grid> : <p className="rf-soft">{t('coming_soon')}</p>}
        </section>);
        },
        stays: (s) => listingBlock(s, 'homestay', '/homestays'),
        workspaces: async (s) => {
            const list = await getListings('workspace', { limit: 3 });
            return (<section className="wrap rf-sec" key={s.id}>
          <div className="rf-split">
            <div className="rf-split-img"><Photo name={notePhoto('workBalcony')} lang={lang} alt={L('A laptop on a wooden balcony desk facing Himalayan valleys', 'हिमालय की घाटियों की ओर लकड़ी की बालकनी डेस्क पर लैपटॉप')}/></div>
            <div>
              <p className="eyebrow">{t('work_eyebrow')}</p>
              <h2>{sTitle(s) || t('work_h')}</h2>
              <p className="lead">{sSub(s) || t('work_text')}</p>
              <div className="rf-feats">
                <Feature icon="wifi" title={t('w_wifi')} sub={t('w_wifi_sub')}/>
                <Feature icon="desk" title={t('w_desk')} sub={t('w_desk_sub')}/>
                <Feature icon="leaf" title={t('w_calm')} sub={t('w_calm_sub')}/>
              </div>
              <Link className="btn btn-ghost" href="/workspaces">{cta(s, t('workspaces'))}<Icon name="arrow" size={16}/></Link>
            </div>
          </div>
          {list.length ? <div className="mt"><Grid>{list.map((x) => <ListingCard key={x.id} kind="workspace" x={x} tr={tr}/>)}</Grid></div> : null}
        </section>);
        },
        cabs: (s) => (<section className="wrap rf-sec" key={s.id}>
        <div className="rf-cab">
          <div>
            <p className="eyebrow">{t('nav_cab')}</p><h2>{sTitle(s)}</h2>{sSub(s) ? <p>{sSub(s)}</p> : null}
            <ol>
              <li>{L('Drivers publish a ride with route, vehicle and seats', 'ड्राइवर अपने रूट, गाड़ी और सीटों के साथ राइड डालते हैं')}</li>
              <li>{L('You pick your route, date and exact seat', 'आप रूट, तारीख़ और अपनी सीट चुनते हैं')}</li>
              <li>{L('Pay your share to the driver directly', 'अपने हिस्से का किराया सीधे ड्राइवर को दें')}</li>
            </ol>
            <Link className="btn btn-light" href={href(s.cta_url, '/cab')}>{cta(s, t('cabs'))}<Icon name="arrow" size={16}/></Link>
          </div>
          <div className="rf-cab-seats" aria-hidden="true"><i/><i className="gap"/><i className="drv"/><i className="sel"/><i/><i className="sel"/><i/><i className="gap"/><i/></div>
        </div>
      </section>),
        partner_cta: (s) => (<section className="wrap rf-sec" key={s.id}>
        <div className="rf-partner">
          <div><h2>{sTitle(s)}</h2>{sSub(s) ? <p>{sSub(s)}</p> : null}</div>
          <Link className="btn btn-lg" href={href(s.cta_url, '/partner/join')}>{cta(s, t('become_partner'))}</Link>
        </div>
      </section>),
        text: (s) => (<section className="wrap rf-sec" key={s.id}>
        <Head title={sTitle(s)}/>
        <p className="prose">{sSub(s)}</p>
        {s.cta_url ? <Link className="rf-more" href={href(s.cta_url, '/')}>{cta(s)}<Icon name="arrow" size={14}/></Link> : null}
      </section>),
    };
    async function listingBlock(s, kind, route) {
        const list = await getListings(kind, { limit: 6 });
        return (<section className="wrap rf-sec" key={s.id}>
        <Head title={sTitle(s)} note={sSub(s)} link={route} label={cta(s)}/>
        {list.length ? <Grid>{list.map((x) => <ListingCard key={x.id} kind={kind} x={x} tr={tr}/>)}</Grid>
                : <p className="rf-soft">{t('no_listings')} <Link href="/partner/join">{t('become_partner')}</Link></p>}
      </section>);
    }

    // Homepage extras as blocks (CMS mode) — titles and subtitles come from the section row when set.
    const extraBlocks = {
        trust: (s) => <TrustStrip key={s.id} L={L} title={sTitle(s)} note={sSub(s)}/>,
        season: (s) => <SeasonNow key={s.id} season={season} places={seasonPlaces} L={L} lang={lang} pick={pick} title={sTitle(s)} note={sSub(s)}/>,
        map: (s) => (mapPoints.length ? (<section className="wrap rf-sec" key={s.id}>
        <Head eyebrow={L('Explore on the map', 'नक्शे पर देखें')} title={sTitle(s) || L('Where is everything?', 'सब कहाँ है?')} note={sSub(s) || L('Published destinations, villages and approved homestays. Tap a pin.', 'प्रकाशित जगहें, गाँव और मंज़ूर होमस्टे। किसी पिन पर टैप करें।')}/>
        <ExploreMap points={mapPoints} labels={{ all: L('All', 'सभी'), places: L('Places', 'जगहें'), villages: L('Villages', 'गाँव'), stays: L('Homestays', 'होमस्टे'), place: L('Place', 'जगह'), village: L('Village', 'गाँव'), stay: L('Homestay', 'होमस्टे'),
            view: L('View', 'देखें'), plan: L('Plan a trip here', 'यहाँ का ट्रिप प्लान करें'), map: L('Map of places', 'जगहों का नक्शा'), filter: L('Filter the map', 'नक्शा फ़िल्टर करें'), tap: L('Tap another pin to see it here.', 'दूसरी जगह देखने के लिए पिन पर टैप करें।'), alsoHere: L('Also here:', 'यहाँ और भी:') }}/>
      </section>) : null),
        sample_plan: (s) => <SamplePlan key={s.id} it={itineraries[0] || null} L={L} pick={pick} lang={lang} eyebrow={sTitle(s)} note={sSub(s)}/>,
        today_rides: (s) => <TodayRides key={s.id} rides={rides} L={L} lang={lang} pick={pick} inr={inr} title={sTitle(s)} note={sSub(s)}/>,
    };
    if (cmsExtras) Object.assign(blocks, extraBlocks);
    const rendered = await Promise.all(sections.map(async (s) => (blocks[s.kind] ? blocks[s.kind](s) : null)));
    const contact = settings.contact || {};
    const hasHero = sections.some((s) => s.kind === 'hero');
    ['thali', 'aipan', 'doli', 'bells', 'aipanPlate', 'walk', 'spring', 'summer', 'monsoon', 'autumn', 'winter', 'kumaon'].forEach(notePhoto);
    return (<div className="home rf-home">
      {!hasHero ? blocks.hero({ id: 'fallback-hero', title: '', title_hi: '' }) : null}
      {rendered}
      {!cmsExtras ? ['season', 'map', 'sample_plan', 'today_rides'].map((k) => extraBlocks[k]({ id: `fixed-${k}`, kind: k })) : null}
      <Culture tr={tr}/>
      <WhyUs tr={tr}/>
      <Seasons tr={tr}/>
      <section className="wrap rf-sec">
        <div className="rf-closing">
          <Photo name="kumaon" lang={lang} alt=""/>
          <div><p className="eyebrow">{t('cta_eyebrow')}</p><h2>{t('cta_h')}</h2><p>{t('cta_text')}</p></div>
          <Link className="btn btn-lg btn-light" href={signedIn ? '/plan' : '/login?next=/plan'}>{t('plan_your_trip')}<Icon name="arrow" size={16}/></Link>
        </div>
      </section>
      <PhotoCredits names={[...used]} L={L}/>
      <WhatsAppButton number={contact.whatsapp} labels={{ button: 'WhatsApp', title: L('Chat with us', 'हमसे बात करें'), sub: L('Opens WhatsApp with a message ready.', 'WhatsApp में तैयार मैसेज के साथ खुलेगा।') }}
        messages={[L('Hi! I want to plan a trip.', 'नमस्ते! मुझे ट्रिप प्लान करनी है।'), L('Hi! I want to book a homestay.', 'नमस्ते! मुझे होमस्टे बुक करना है।'), L('Hi! I need help with a cab booking.', 'नमस्ते! कैब बुकिंग में मदद चाहिए।'), L('Hi! I want to list my homestay.', 'नमस्ते! मुझे अपना होमस्टे लिस्ट करना है।')]}/>
    </div>);
}
function Services({ tr }) {
    const { L } = tr;
    const item = (link, ic, tone, title) => (<Link href={link} key={link}><i className={`rf-tone-${tone}`}><Icon name={ic} size={26}/></i>{title}</Link>);
    return (<nav className="wrap rf-svc" aria-label={L('Services', 'सेवाएँ')}>
      {item('/cab', 'car', 'blue', L('Instant Cab', 'इंस्टेंट कैब'))}
      {item('/plan', 'map', 'green', L('Trip Planner', 'ट्रिप प्लानर'))}
      {item('/homestays', 'house', 'amber', L('Homestays', 'होमस्टे'))}
      {item('/workspaces', 'desk', 'violet', L('Workations', 'वर्केशन'))}
    </nav>);
}
function Culture({ tr }) {
    const { t, L, lang } = tr;
    const cards = [
        ['thali', L('Pahadi kitchens', 'पहाड़ी रसोई'), L('Mandua roti, bhatt and local greens', 'मंडुए की रोटी, भट्ट और पहाड़ी साग')],
        ['aipan', L('Aipan art', 'ऐपण कला'), L('Kumaon’s red-and-white folk art', 'कुमाऊँ की लाल-सफ़ेद लोक कला')],
        ['doli', L('Devta doli and fairs', 'देवता की डोली और मेले'), L('Village festivals and processions', 'गाँव के त्योहार और यात्राएँ')],
        ['bells', L('Temple traditions', 'मंदिर परंपराएँ'), L('Bells, prayers and old shrines', 'घंटियाँ, प्रार्थना और पुराने मंदिर')],
        ['aipanPlate', L('Aipan crafts', 'ऐपण हस्तकला'), L('Painted by local artists', 'स्थानीय कलाकारों की बनाई')],
        ['walk', L('Village walks', 'गाँव की सैर'), L('Paths, fields and old houses', 'पगडंडियाँ, खेत और पुराने घर')],
    ];
    return (<section className="wrap rf-sec">
      <Head eyebrow={t('culture_eyebrow')} title={t('culture_h')} link="/village-tours" label={t('culture_btn')}/>
      <div className="rf-culture">
        {cards.map(([p, title, sub]) => <Tile key={p} link="/village-tours" photo={p} lang={lang} title={title} sub={sub}/>)}
      </div>
    </section>);
}
function WhyUs({ tr }) {
    const { t } = tr;
    const item = (ic, title, sub) => (<div key={ic}><i><Icon name={ic} size={22}/></i><b>{title}</b><span>{sub}</span></div>);
    return (<section className="wrap rf-sec">
      <Head eyebrow={t('why_eyebrow')} title={<>{t('why_h1')} <span className="green">{t('why_h2')}</span></>}/>
      <div className="rf-why">
        {item('mountain', t('y_trust'), t('y_trust_sub'))}{item('leaf', t('y_resp'), t('y_resp_sub'))}
        {item('people', t('y_cur'), t('y_cur_sub'))}{item('shield', t('y_safe'), t('y_safe_sub'))}
      </div>
    </section>);
}
function Seasons({ tr }) {
    const { t, L, lang } = tr;
    const subs = { spring: L('Fresh pine forests', 'चीड़ के ताज़ा जंगल'), monsoon: L('Valley of Flowers', 'फूलों की घाटी') };
    const s = (key, photo) => (<Link className="rf-season" href="/destinations" key={key}>
      <Photo name={photo} lang={lang} alt=""/>
      <span><b>{t(key)}</b>{subs[photo] || t(`${key}_sub`)}</span>
    </Link>);
    return (<section className="wrap rf-sec">
      <p className="eyebrow">{t('seasons_eyebrow')}</p>
      <div className="rf-seasons">
        {s('s_spring', 'spring')}{s('s_summer', 'summer')}{s('s_monsoon', 'monsoon')}{s('s_autumn', 'autumn')}{s('s_winter', 'winter')}
      </div>
    </section>);
}
