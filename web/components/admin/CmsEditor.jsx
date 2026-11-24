import Link from 'next/link';
import { getT } from '@/lib/i18n/server';

import { rows } from '@/lib/account';
import { CrudTable } from '@/components/admin/CrudTable';

const REGIONS = [['Garhwal', 'Garhwal'], ['Kumaon', 'Kumaon'], ['Both', 'Both']];

export async function CmsEditor({ searchParams, db, user, base='/admin/cms' }) {
  const sp = await searchParams;

  const { L, lang } = await getT();
  const T = {
    home_sections: { label: L('Home sections', 'होम सेक्शन'), order: 'position', title: 'kind', sub: ['title', 'position'], defaults: { kind: 'text', enabled: true, position: 99 },
      fields: [
        { name: 'kind', label: L('Section type', 'सेक्शन का प्रकार'), type: 'select', options: ['hero', 'themes', 'destinations', 'villages', 'itineraries', 'stays', 'workspaces', 'cabs', 'partner_cta', 'text'].map((k) => [k, k]), required: true },
        { name: 'position', label: L('Order', 'क्रम'), type: 'number' }, { name: 'enabled', label: L('Show on home page', 'होम पेज पर दिखाएँ'), type: 'bool' },
        { name: 'title', label: L('Title (English)', 'शीर्षक (अंग्रेज़ी)') }, { name: 'title_hi', label: L('Title (Hindi)', 'शीर्षक (हिंदी)') },
        { name: 'subtitle', label: L('Subtitle (English)', 'उपशीर्षक (अंग्रेज़ी)'), type: 'textarea' }, { name: 'subtitle_hi', label: L('Subtitle (Hindi)', 'उपशीर्षक (हिंदी)'), type: 'textarea' },
        { name: 'image_url', label: L('Image', 'फ़ोटो'), type: 'image' }, { name: 'cta_label', label: L('Button text', 'बटन का टेक्स्ट') }, { name: 'cta_label_hi', label: L('Button text (Hindi)', 'बटन (हिंदी)') },
        { name: 'cta_url', label: L('Button link (e.g. /villages)', 'बटन लिंक (जैसे /villages)') },
      ] },
    locations: { label: L('Places / destinations', 'जगहें'), order: 'position', title: 'name', sub: ['kind', 'district', 'region'], defaults: { kind: 'destination', region: 'Kumaon', is_published: false, position: 99 },
      fields: [
        { name: 'name', label: L('Name', 'नाम'), required: true }, { name: 'name_hi', label: L('Name (Hindi)', 'नाम (हिंदी)') }, { name: 'slug', label: 'Slug (URL)', required: true, hint: 'e.g. munsiyari' },
        { name: 'kind', label: L('Type', 'प्रकार'), type: 'select', options: [['destination', 'Destination'], ['village', 'Village'], ['town', 'Town'], ['transport_hub', 'Transport hub']] },
        { name: 'region', label: L('Region', 'क्षेत्र'), type: 'select', options: REGIONS }, { name: 'district', label: L('District', 'ज़िला') },
        { name: 'summary', label: L('Summary', 'परिचय'), type: 'textarea' }, { name: 'summary_hi', label: L('Summary (Hindi)', 'परिचय (हिंदी)'), type: 'textarea' },
        { name: 'description', label: L('Description', 'विवरण'), type: 'textarea' }, { name: 'best_season', label: L('Best season', 'सबसे अच्छा मौसम') },
        { name: 'how_to_reach', label: L('How to reach', 'कैसे पहुँचें'), type: 'textarea' }, { name: 'image_url', label: L('Cover photo', 'कवर फ़ोटो'), type: 'image' },
        { name: 'gallery', label: L('More photo URLs (comma separated)', 'और फ़ोटो URL (कॉमा से अलग)'), type: 'list', wide: true },
        { name: 'lat', label: 'Latitude', type: 'number' }, { name: 'lng', label: 'Longitude', type: 'number' },
        { name: 'theme_slugs', label: L('Themes (slugs, comma separated)', 'थीम (स्लग, कॉमा से अलग)'), type: 'list' },
        { name: 'position', label: L('Order', 'क्रम'), type: 'number' }, { name: 'is_cab_point', label: L('Cab pickup point', 'कैब पिकअप पॉइंट'), type: 'bool' },
        { name: 'is_featured', label: L('Featured', 'ख़ास'), type: 'bool' }, { name: 'is_published', label: L('Published', 'प्रकाशित'), type: 'bool' },
      ] },
    themes: { label: L('Themes / experiences', 'थीम / अनुभव'), order: 'position', title: 'name', sub: ['slug', 'icon'], defaults: { is_published: true, position: 99, icon: '⛰️' },
      fields: [
        { name: 'name', label: L('Name', 'नाम'), required: true }, { name: 'name_hi', label: L('Name (Hindi)', 'नाम (हिंदी)') }, { name: 'slug', label: 'Slug', required: true },
        { name: 'icon', label: L('Icon (emoji)', 'आइकन (इमोजी)') }, { name: 'summary', label: L('Summary', 'परिचय'), type: 'textarea' }, { name: 'summary_hi', label: L('Summary (Hindi)', 'परिचय (हिंदी)'), type: 'textarea' },
        { name: 'image_url', label: L('Photo', 'फ़ोटो'), type: 'image' }, { name: 'position', label: L('Order', 'क्रम'), type: 'number' }, { name: 'is_published', label: L('Published', 'प्रकाशित'), type: 'bool' },
      ] },
    itineraries: { label: L('Itineraries', 'तैयार प्लान'), order: 'position', title: 'title', sub: ['days_count', 'region'], defaults: { region: 'Kumaon', difficulty: 'easy', days_count: 3, is_published: false, position: 99, days: [] },
      fields: [
        { name: 'title', label: L('Title', 'शीर्षक'), required: true }, { name: 'title_hi', label: L('Title (Hindi)', 'शीर्षक (हिंदी)') }, { name: 'slug', label: 'Slug', required: true },
        { name: 'region', label: L('Region', 'क्षेत्र'), type: 'select', options: REGIONS }, { name: 'days_count', label: L('Days', 'दिन'), type: 'number', required: true },
        { name: 'difficulty', label: L('Difficulty', 'कठिनाई'), type: 'select', options: [['easy', 'Easy'], ['moderate', 'Moderate'], ['challenging', 'Challenging']] },
        { name: 'budget_min', label: L('Budget from (₹, approx.)', 'बजट से (₹, लगभग)'), type: 'number' }, { name: 'budget_max', label: L('Budget to (₹, approx.)', 'बजट तक (₹, लगभग)'), type: 'number' },
        { name: 'best_season', label: L('Best season', 'सबसे अच्छा मौसम') }, { name: 'theme_slugs', label: L('Themes (slugs)', 'थीम (स्लग)'), type: 'list' },
        { name: 'summary', label: L('Summary', 'परिचय'), type: 'textarea' }, { name: 'summary_hi', label: L('Summary (Hindi)', 'परिचय (हिंदी)'), type: 'textarea' },
        { name: 'image_url', label: L('Photo', 'फ़ोटो'), type: 'image' },
        { name: 'days', label: L('Days (JSON list)', 'दिन (JSON सूची)'), type: 'json', empty: [], hint: '[{"day":1,"title":"…","title_hi":"…","plan":"…","plan_hi":"…","location":"slug"}]' },
        { name: 'position', label: L('Order', 'क्रम'), type: 'number' }, { name: 'is_featured', label: L('Featured', 'ख़ास'), type: 'bool' }, { name: 'is_published', label: L('Published', 'प्रकाशित'), type: 'bool' },
      ] },
  };
  const key = T[sp.t] ? sp.t : 'home_sections';
  const cfg = T[key];
  const data = await rows(db.from(key).select('*').order(cfg.order));
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Content (CMS)', 'कंटेंट (CMS)')}</h1>
        <p className="muted">{L('Changes show on the website straight away. Never add made-up reviews, prices or contact details.', 'बदलाव वेबसाइट पर तुरंत दिखते हैं। कभी भी नकली रिव्यू, दाम या संपर्क न डालें।')}</p></div></div>
      <div className="seg-tabs">{Object.entries(T).map(([k, c]) => <Link key={k} className={k === key ? 'on' : ''} href={`${base}?t=${k}`}>{c.label}</Link>)}{base.startsWith('/admin') && <Link href="/admin/settings">{L('Pages, FAQ & settings', 'पेज, FAQ और सेटिंग')}</Link>}</div>
      <CrudTable lang={lang} table={key} rows={data} fields={cfg.fields} titleField={cfg.title} subField={cfg.sub} defaults={cfg.defaults} userId={user.id} />
    </>
  );
}
