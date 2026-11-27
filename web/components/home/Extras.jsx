import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Cover } from '@/components/Cover';
import { Photo } from '@/components/Photo';
import { monthsOf } from '@/lib/home/season';
import '@/app/home-extras.css';

// Homepage extras (approved 27 Nov 2026). Server components: data comes from app/page.jsx.

/** Short, true promises under the search card. Every line is how the site already works. */
export function TrustStrip({ L }) {
  const items = [
    ['check', L('Every host checked', 'हर होस्ट जाँचा हुआ'), L('Listings go live only after our team approves them', 'टीम की मंज़ूरी के बाद ही लिस्टिंग दिखती है')],
    ['route', L('Real road times', 'असली सड़क समय'), L('Routes from OpenStreetMap; estimates are labelled', 'रास्ते OpenStreetMap से; अनुमान साफ़ लिखे')],
    ['alert', L('SOS in every cab ride', 'हर कैब राइड में SOS'), L('Alerts our team with your location', 'आपकी लोकेशन के साथ टीम को अलर्ट')],
    ['globe', L('Hindi & English', 'हिंदी और अंग्रेज़ी'), L('Use the whole site in your language', 'पूरी साइट अपनी भाषा में')],
  ];
  return (
    <section className="hx-trust" aria-label={L('Why travel with us', 'हमारे साथ क्यों')}>
      <div className="wrap hx-trust-in">
        {items.map(([ic, b, s]) => <div className="hx-tr" key={ic}><span aria-hidden="true"><Icon name={ic} size={18} /></span><span><b>{b}</b><small>{s}</small></span></div>)}
      </div>
    </section>
  );
}

const SEASON_TEXT = {
  spring: [['Spring', 'बसंत'], ['Mar – Apr', 'मार्च – अप्रैल'], [['Rhododendron (buransh) in bloom', 'बुरांश के फूल खिले'], ['Pleasant days, cool nights', 'सुहाने दिन, ठंडी रातें'], ['Good for village walks', 'गाँव की सैर के लिए अच्छा']]],
  summer: [['Summer', 'गर्मी'], ['May – Jun', 'मई – जून'], [['Escape the heat of the plains', 'मैदानों की गर्मी से राहत'], ['Busy weekends — book stays early', 'वीकेंड पर भीड़ — होमस्टे पहले बुक करें'], ['Long days for treks', 'ट्रेक के लिए लंबे दिन']]],
  monsoon: [['Monsoon', 'बरसात'], ['Jul – Sep', 'जुलाई – सितंबर'], [['Landslides can close roads — keep spare days', 'भूस्खलन से सड़कें बंद हो सकती हैं — अतिरिक्त दिन रखें'], ['Check USDMA and IMD alerts daily', 'रोज़ USDMA और IMD अलर्ट देखें'], ['Green valleys, fewer crowds', 'हरी घाटियाँ, कम भीड़']]],
  autumn: [['Autumn', 'शरद'], ['Oct – Nov', 'अक्टूबर – नवंबर'], [['Clear skies and Himalayan views', 'साफ़ आसमान और हिमालय के नज़ारे'], ['Festival season in the villages', 'गाँवों में त्योहारों का मौसम'], ['Cold nights — carry warm layers', 'ठंडी रातें — गर्म कपड़े रखें']]],
  winter: [['Winter', 'सर्दी'], ['Dec – Feb', 'दिसंबर – फ़रवरी'], [['Snow is possible above 2,000 m — check roads', '2,000 मीटर से ऊपर बर्फ़ संभव — सड़कें जाँचें'], ['Clear peak views on most mornings', 'ज़्यादातर सुबह चोटियों के साफ़ नज़ारे'], ['Nights go below zero up high', 'ऊँचाई पर रातें शून्य से नीचे']]],
};

/** "Go this season": general tips for the current season + destinations whose best season matches. */
export function SeasonNow({ season, places, L, lang, pick, title = null, note = null }) {
  const [name, span, tips] = SEASON_TEXT[season];
  const mo = monthsOf(season);
  return (
    <section className="wrap rf-sec">
      <div className="rf-head"><div><p className="eyebrow">{L('Go this season', 'इस मौसम में जाएँ')}</p><h2>{title || L(`${name[0]} in Uttarakhand`, `उत्तराखंड में ${name[1]}`)}</h2>
        <p className="muted">{note || L(`Places whose best season includes ${span[0]}. This changes by itself every month.`, `वे जगहें जिनका सबसे अच्छा मौसम ${span[1]} है। यह हर महीने अपने आप बदलता है।`)}</p></div>
        <Link className="rf-more" href="/destinations">{L('All destinations', 'सभी जगहें')}<Icon name="arrow" size={14} /></Link></div>
      <div className="hx-season">
        <div className="hx-season-card">
          <Photo name={season} lang={lang} alt="" />
          <div><span className="hx-chip">{L(span[0], span[1])}</span><h3>{L('What to expect', 'क्या उम्मीद करें')}</h3>
            <ul>{tips.map(([en, hi]) => <li key={en}>{L(en, hi)}</li>)}</ul></div>
        </div>
        {places.length ? (
          <div className="hx-places">
            {places.map((l) => (
              <Link className="hx-pl" key={l.id} href={`/destinations/${l.slug}`}>
                <Cover url={l.image_url || null} seed={l.slug} className="hx-pl-img" />
                <span className="hx-pl-b"><b>{pick(l, 'name')}</b>{l.district ? <small>{l.district}</small> : null}{l.best_season ? <span className="hx-why">{l.best_season}</span> : null}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="hx-state"><span aria-hidden="true">🗓</span><h3>{L(`No places tagged for ${span[0]} yet`, `${span[1]} के लिए अभी कोई जगह नहीं`)}</h3>
            <p>{L('Browse every destination and plan your own route.', 'सभी जगहें देखें और अपना रास्ता प्लान करें।')}</p>
            <Link className="btn btn-ghost btn-sm" href="/destinations">{L('Browse destinations', 'जगहें देखें')}</Link></div>
        )}
      </div>
      <p className="hx-note">{L(`Months used: ${mo.join(', ')}. Weather can change — check IMD before you go.`, `महीने: ${mo.join(', ')}। मौसम बदल सकता है — जाने से पहले IMD देखें।`)}</p>
    </section>
  );
}

/** One ready-made itinerary, opened straight in the Trip Planner (/plan?from=slug). */
export function SamplePlan({ it, L, pick, lang, eyebrow = null, note = null }) {
  if (!it) return null;
  const days = (Array.isArray(it.days) ? it.days : []).slice(0, 5);
  return (
    <section className="wrap rf-sec">
      <div className="hx-plan">
        <div>
          <p className="eyebrow">{eyebrow || L('Sample trip plan', 'नमूना ट्रिप प्लान')}</p>
          <h3>{pick(it, 'title')}</h3>
          <p className="muted">{note || L('Open it in the Trip Planner to change dates, people and car — the route and cost work themselves out.', 'ट्रिप प्लानर में खोलें और तारीख़, लोग और गाड़ी बदलें — रास्ता और ख़र्च अपने आप बनेंगे।')}</p>
          <div className="hx-meta">{it.days_count ? <span>{it.days_count} {L('days', 'दिन')}</span> : null}{it.best_season ? <span>{it.best_season}</span> : null}</div>
          <div className="hx-acts"><Link className="btn" href={`/plan?from=${encodeURIComponent(it.slug)}`}>{L('Open in Trip Planner', 'ट्रिप प्लानर में खोलें')}</Link>
            <Link className="btn btn-ghost" href="/itineraries">{L('See all plans', 'सभी प्लान')}</Link></div>
        </div>
        {days.length ? (
          <ol className="hx-days">{days.map((d, i) => (
            <li key={i}><span className="hx-dn">{L('Day', 'दिन')} {i + 1}</span><span><b>{(lang === 'hi' && d.title_hi) || d.title}</b>{(lang === 'hi' && d.plan_hi) || d.plan ? <small>{(lang === 'hi' && d.plan_hi) || d.plan}</small> : null}</span></li>
          ))}</ol>
        ) : null}
      </div>
    </section>
  );
}

const fmtTime = (iso, lang) => new Date(iso).toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const endName = (r, side, pick) => {
  const p = r[`${side}_place`], l = r[`${side}_location`], g = r[`${side}_geo`];
  return (p && pick(p, 'name')) || (l && pick(l, 'name')) || g?.name || r[side === 'from' ? 'pickup_point' : 'drop_point'] || '?';
};

/** Instant Cab rides leaving today. Seats and price come from each ride. */
export function TodayRides({ rides, L, lang, pick, inr, title = null, note = null }) {
  const body = rides.error ? (
    <div className="hx-state" role="status"><span aria-hidden="true">⚠</span><h3>{L('Couldn’t load today’s rides', 'आज की राइड लोड नहीं हुईं')}</h3><p>{L('Search rides instead — the rest of the page still works.', 'राइड खोजें — बाक़ी पेज चल रहा है।')}</p><Link className="btn btn-ghost btn-sm" href="/cab">{L('Search rides', 'राइड खोजें')}</Link></div>
  ) : !rides.rows.length ? (
    <div className="hx-state"><span aria-hidden="true">🚗</span><h3>{L('No shared rides leaving today', 'आज कोई शेयर राइड नहीं')}</h3><p>{L('Search another date, or offer a ride if you are driving.', 'दूसरी तारीख़ खोजें, या गाड़ी ले जा रहे हैं तो राइड दें।')}</p>
      <div className="hx-acts hx-center"><Link className="btn btn-sm" href="/cab">{L('Search rides', 'राइड खोजें')}</Link><Link className="btn btn-ghost btn-sm" href="/drive">{L('Offer a ride', 'राइड दें')}</Link></div></div>
  ) : (
    <div className="hx-rides">{rides.rows.map((r) => {
      const left = r.seats_total - r.seats_booked;
      return (
        <Link className="hx-ride" key={r.id} href={`/cab/ride/${r.id}`}>
          <span className="hx-rt">{endName(r, 'from', pick)} <span aria-hidden="true">→</span><span className="sr-only">{L('to', 'से')}</span> {endName(r, 'to', pick)}</span>
          <span className="hx-tm">{fmtTime(r.departure_at, lang)}</span>
          <span className="hx-row"><span className="hx-seats" aria-hidden="true">{Array.from({ length: Math.min(r.seats_total, 12) }, (_, i) => <i key={i} className={i < r.seats_booked ? 'b' : ''} />)}</span>
            <span>{L(`${left} seat${left === 1 ? '' : 's'} left`, `${left} सीट बाक़ी`)}</span></span>
          <span className="hx-row"><span>{L('Per seat', 'प्रति सीट')}</span><b>{inr(r.price_per_seat)}</b></span>
        </Link>
      );
    })}</div>
  );
  return (
    <section className="hx-rides-band">
      <div className="wrap rf-sec">
        <div className="rf-head"><div><p className="eyebrow">{L('Instant Cab · leaving today', 'इंस्टेंट कैब · आज निकलने वाली')}</p><h2>{title || L('Shared rides today', 'आज की शेयर राइड')}</h2>
          <p className="muted">{note || L('Live from Instant Cab. Seats and prices come from each ride.', 'इंस्टेंट कैब से लाइव। सीट और दाम हर राइड से आते हैं।')}</p></div>
          <Link className="rf-more" href="/cab">{L('All rides', 'सभी राइड')}<Icon name="arrow" size={14} /></Link></div>
        {body}
      </div>
    </section>
  );
}
