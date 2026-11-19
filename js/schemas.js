// Form schemas for every editable table (shared by partner and admin portals).
import { getLang, pick } from './i18n.js';

const hi = () => getLang() === 'hi';
const L = (en, h) => (hi() ? h : en);
const locationOpts = (ctx) => [['', '—'], ...(ctx.locations || []).filter((l) => l.kind !== 'transport_hub').map((l) => [l.id, pick(l, 'name')])];
const cabPointOpts = (ctx) => [['', '—'], ...(ctx.locations || []).filter((l) => l.is_cab_point).map((l) => [l.id, pick(l, 'name')])];
const themeOpts = (ctx) => (ctx.themes || []).map((th) => [th.slug, `${th.icon} ${pick(th, 'name')}`]);
const listingStatus = (admin) => (admin
  ? [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['hidden', 'Hidden'], ['draft', 'Draft']]
  : [['pending', L('Send for approval', 'मंज़ूरी के लिए भेजें')], ['draft', L('Save as draft', 'ड्राफ़्ट')], ['hidden', L('Hide', 'छिपाएँ')]]);

export const CATEGORY_LABELS = () => ({
  homestay: L('Homestay', 'होमस्टे'), cab: L('Cab / taxi', 'कैब / टैक्सी'),
  workspace: L('Workspace (work from mountain)', 'वर्कस्पेस (पहाड़ से काम)'), village_tour: L('Village tour / local guide', 'गाँव का टूर / लोकल गाइड'),
});

export const partnerSchema = (admin) => [
  { name: 'business_name', label: L('Business / homestay name', 'बिज़नेस / होमस्टे का नाम'), required: true, max: 120 },
  { name: 'contact_name', label: L('Your name', 'आपका नाम'), required: true, max: 120 },
  { name: 'phone', label: L('Phone', 'फ़ोन'), inputType: 'tel', required: true, max: 20 },
  { name: 'whatsapp', label: 'WhatsApp', inputType: 'tel', max: 20 },
  { name: 'email', label: L('Email', 'ईमेल'), inputType: 'email', max: 254 },
  { name: 'categories', label: L('What do you offer?', 'आप क्या देते हैं?'), type: 'multi', options: () => Object.entries(CATEGORY_LABELS()) },
  { name: 'village', label: L('Village / town', 'गाँव / कस्बा'), max: 120 },
  { name: 'location_id', label: L('Nearest place', 'पास की जगह'), type: 'select', options: locationOpts, nullable: true },
  { name: 'address', label: L('Address', 'पता'), max: 400, wide: true },
  { name: 'about', label: L('About you', 'अपने बारे में'), type: 'textarea', max: 2000 },
  ...(admin ? [
    { name: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['suspended', 'Suspended']] },
    { name: 'admin_note', label: L('Admin note (partner can see)', 'एडमिन नोट (पार्टनर देख सकता है)'), type: 'textarea', max: 1000, rows: 2 },
  ] : []),
];

const common = (admin, nameField = 'name', nameLabel) => [
  { name: nameField, label: nameLabel || L('Name', 'नाम'), required: true, max: 160 },
  { name: 'village', label: L('Village', 'गाँव'), max: 120 },
  { name: 'location_id', label: L('Nearest place', 'पास की जगह'), type: 'select', options: locationOpts, nullable: true },
  { name: 'summary', label: L('Short description (one line)', 'छोटा परिचय (एक लाइन)'), max: 400, wide: true },
  { name: 'description', label: L('Full description', 'पूरा विवरण'), type: 'textarea', max: 6000, rows: 6 },
];
const tail = (admin) => [
  { name: 'images', label: L('Photos', 'फ़ोटो'), type: 'images' },
  { name: 'status', label: L('Status', 'स्थिति'), type: 'select', options: listingStatus(admin) },
  ...(admin ? [
    { name: 'is_featured', label: L('Feature on home page', 'होम पेज पर दिखाएँ'), type: 'bool' },
    { name: 'admin_note', label: L('Admin note', 'एडमिन नोट'), type: 'textarea', max: 1000, rows: 2 },
  ] : []),
];

export const SCHEMAS = {
  homestay: (admin) => [
    ...common(admin),
    { name: 'rooms', label: L('Rooms', 'कमरे'), type: 'number', min: 1, max: 100, default: 1 },
    { name: 'max_guests', label: L('Max guests', 'अधिकतम मेहमान'), type: 'number', min: 1, max: 200, default: 2 },
    { name: 'price_per_night', label: L('Price per night (₹)', 'एक रात का किराया (₹)'), type: 'number', min: 0, step: 50 },
    { name: 'meals', label: L('Meals', 'खाना'), max: 300, placeholder: L('Breakfast + dinner, Pahadi thali', 'नाश्ता + रात का खाना, पहाड़ी थाली') },
    { name: 'amenities', label: L('Amenities (comma separated)', 'सुविधाएँ (कॉमा से अलग)'), type: 'tags', placeholder: 'Hot water, Parking, Wi-Fi' },
    { name: 'house_rules', label: L('House rules', 'घर के नियम'), type: 'textarea', max: 2000, rows: 3 },
    ...tail(admin),
  ],
  workspace: (admin) => [
    ...common(admin),
    { name: 'desks', label: L('Desks', 'डेस्क'), type: 'number', min: 1, max: 500, default: 4 },
    { name: 'wifi_mbps', label: L('Wi-Fi speed (Mbps)', 'वाई-फ़ाई स्पीड (Mbps)'), type: 'number', min: 1, max: 10000, nullable: true },
    { name: 'power_backup', label: L('Power backup', 'पावर बैकअप'), type: 'bool' },
    { name: 'stay_available', label: L('Stay available', 'रहने की सुविधा'), type: 'bool' },
    { name: 'price_per_day', label: L('Price per day (₹)', 'एक दिन का किराया (₹)'), type: 'number', min: 0, step: 50 },
    { name: 'price_per_month', label: L('Price per month (₹)', 'महीने का किराया (₹)'), type: 'number', min: 0, step: 500, nullable: true },
    { name: 'amenities', label: L('Amenities', 'सुविधाएँ'), type: 'tags', placeholder: 'Ergonomic chairs, Tea/coffee, Meeting room' },
    ...tail(admin),
  ],
  village_tour: (admin) => [
    ...common(admin, 'title', L('Experience title', 'अनुभव का नाम')),
    { name: 'culture_highlights', label: L('Culture highlights', 'संस्कृति की झलक'), type: 'tags', placeholder: L('Folk songs, Mandua farming, Temple walk', 'लोकगीत, मंडुआ खेती, मंदिर सैर') },
    { name: 'includes', label: L('Includes', 'शामिल'), type: 'tags', placeholder: L('Local guide, Lunch with family', 'लोकल गाइड, परिवार के साथ खाना') },
    { name: 'duration_hours', label: L('Duration (hours)', 'अवधि (घंटे)'), type: 'number', min: 0.5, max: 240, step: 0.5, default: 3 },
    { name: 'price_per_person', label: L('Price per person (₹)', 'प्रति व्यक्ति (₹)'), type: 'number', min: 0, step: 50 },
    { name: 'max_group', label: L('Max group size', 'अधिकतम समूह'), type: 'number', min: 1, max: 200, default: 10 },
    { name: 'languages', label: L('Languages', 'भाषाएँ'), type: 'tags', default: ['Hindi', 'Garhwali'] },
    { name: 'best_season', label: L('Best season', 'अच्छा मौसम'), max: 200 },
    ...tail(admin),
  ],
  cab_ride: () => [
    { name: 'from_location_id', label: L('From', 'कहाँ से'), type: 'select', options: cabPointOpts, required: true },
    { name: 'to_location_id', label: L('To', 'कहाँ तक'), type: 'select', options: cabPointOpts, required: true },
    { name: 'departure_at', label: L('Departure date & time', 'निकलने की तारीख़ और समय'), type: 'datetime', required: true },
    { name: 'pickup_point', label: L('Pickup point', 'पिकअप पॉइंट'), max: 200, placeholder: L('Kathgodam railway station gate', 'काठगोदाम रेलवे स्टेशन गेट') },
    { name: 'drop_point', label: L('Drop point', 'ड्रॉप पॉइंट'), max: 200 },
    { name: 'vehicle_model', label: L('Vehicle model', 'गाड़ी का मॉडल'), required: true, max: 80, placeholder: 'Mahindra Bolero' },
    { name: 'vehicle_type', label: L('Vehicle type', 'गाड़ी का प्रकार'), type: 'select', options: [['suv', 'SUV'], ['sedan', 'Sedan'], ['hatchback', 'Hatchback'], ['tempo_traveller', 'Tempo Traveller'], ['other', 'Other']] },
    { name: 'seats_total', label: L('Seats for passengers', 'यात्रियों के लिए सीटें'), type: 'number', min: 1, max: 20, required: true, default: 6 },
    { name: 'price_per_seat', label: L('Price per seat (₹)', 'प्रति सीट किराया (₹)'), type: 'number', min: 0, max: 100000, step: 10, required: true },
    { name: 'auto_confirm', label: L('Confirm bookings automatically', 'बुकिंग अपने-आप कन्फर्म हो'), type: 'bool', default: true },
    { name: 'notes', label: L('Notes for passengers', 'यात्रियों के लिए नोट'), type: 'textarea', max: 500, rows: 2 },
    { name: 'status', label: L('Status', 'स्थिति'), type: 'select', options: [['open', L('Open', 'खुली')], ['full', L('Full', 'भर गई')], ['cancelled', L('Cancelled', 'रद्द')], ['completed', L('Completed', 'पूरी')]], when: (v) => !!v.id },
  ],
  location: () => [
    { name: 'name', label: 'Name (English)', required: true, max: 120 },
    { name: 'name_hi', label: 'नाम (हिंदी)', max: 120 },
    { name: 'slug', label: L('Web address (slug)', 'वेब पता (slug)'), max: 80, hint: L('Leave empty to create from the name', 'खाली छोड़ें, नाम से बन जाएगा') },
    { name: 'kind', label: L('Type', 'प्रकार'), type: 'select', options: [['destination', 'Destination'], ['village', 'Village'], ['town', 'Town'], ['transport_hub', 'Transport hub']] },
    { name: 'region', label: L('Region', 'क्षेत्र'), type: 'select', options: [['Garhwal', 'Garhwal'], ['Kumaon', 'Kumaon']] },
    { name: 'district', label: L('District', 'ज़िला'), max: 60 },
    { name: 'summary', label: 'Summary (English)', max: 500, wide: true },
    { name: 'summary_hi', label: 'परिचय (हिंदी)', max: 500, wide: true },
    { name: 'description', label: L('Description', 'विवरण'), type: 'textarea', max: 8000, rows: 6 },
    { name: 'best_season', label: L('Best season', 'अच्छा मौसम'), max: 200 },
    { name: 'how_to_reach', label: L('How to reach', 'कैसे पहुँचें'), type: 'textarea', max: 2000, rows: 3 },
    { name: 'image_url', label: L('Cover photo', 'कवर फ़ोटो'), type: 'image' },
    { name: 'gallery', label: L('Gallery', 'गैलरी'), type: 'images' },
    { name: 'theme_slugs', label: L('Themes', 'थीम'), type: 'multi', options: themeOpts },
    { name: 'lat', label: 'Latitude', type: 'number', step: 'any', nullable: true },
    { name: 'lng', label: 'Longitude', type: 'number', step: 'any', nullable: true },
    { name: 'position', label: L('Order', 'क्रम'), type: 'number', min: 0, max: 10000 },
    { name: 'is_cab_point', label: L('Cab pickup/drop point', 'कैब पिकअप/ड्रॉप पॉइंट'), type: 'bool' },
    { name: 'is_featured', label: L('Featured', 'ख़ास'), type: 'bool' },
    { name: 'is_published', label: L('Published (visible on website)', 'पब्लिश (वेबसाइट पर दिखे)'), type: 'bool' },
  ],
  theme: () => [
    { name: 'name', label: 'Name (English)', required: true, max: 80 },
    { name: 'name_hi', label: 'नाम (हिंदी)', max: 80 },
    { name: 'slug', label: 'Slug', max: 80, hint: L('Leave empty to create from the name', 'खाली छोड़ें, नाम से बन जाएगा') },
    { name: 'icon', label: L('Icon (emoji)', 'आइकन (इमोजी)'), max: 8, default: '⛰️' },
    { name: 'color', label: L('Colour', 'रंग'), inputType: 'color', default: '#2f6b4f' },
    { name: 'summary', label: 'Summary (English)', max: 400, wide: true },
    { name: 'summary_hi', label: 'परिचय (हिंदी)', max: 400, wide: true },
    { name: 'image_url', label: L('Photo', 'फ़ोटो'), type: 'image' },
    { name: 'position', label: L('Order', 'क्रम'), type: 'number', min: 0 },
    { name: 'is_published', label: L('Published', 'पब्लिश'), type: 'bool', default: true },
  ],
  itinerary: () => [
    { name: 'title', label: 'Title (English)', required: true, max: 160 },
    { name: 'title_hi', label: 'शीर्षक (हिंदी)', max: 160 },
    { name: 'slug', label: 'Slug', max: 80, hint: L('Leave empty to create from the title', 'खाली छोड़ें, शीर्षक से बन जाएगा') },
    { name: 'region', label: L('Region', 'क्षेत्र'), type: 'select', options: [['Garhwal', 'Garhwal'], ['Kumaon', 'Kumaon'], ['Both', 'Both']] },
    { name: 'summary', label: 'Summary (English)', max: 600, wide: true },
    { name: 'summary_hi', label: 'परिचय (हिंदी)', max: 600, wide: true },
    { name: 'difficulty', label: L('Difficulty', 'कठिनाई'), type: 'select', options: [['easy', 'Easy'], ['moderate', 'Moderate'], ['challenging', 'Challenging']] },
    { name: 'budget_min', label: L('Budget from (₹/person)', 'बजट से (₹/व्यक्ति)'), type: 'number', min: 0, step: 500 },
    { name: 'budget_max', label: L('Budget up to (₹/person)', 'बजट तक (₹/व्यक्ति)'), type: 'number', min: 0, step: 500 },
    { name: 'best_season', label: L('Best season', 'अच्छा मौसम'), max: 200 },
    { name: 'theme_slugs', label: L('Themes', 'थीम'), type: 'multi', options: themeOpts },
    { name: 'image_url', label: L('Cover photo', 'कवर फ़ोटो'), type: 'image' },
    { name: 'days', label: L('Day-by-day plan', 'दिन-ब-दिन प्लान'), type: 'days' },
    { name: 'position', label: L('Order', 'क्रम'), type: 'number', min: 0 },
    { name: 'is_featured', label: L('Featured', 'ख़ास'), type: 'bool' },
    { name: 'is_published', label: L('Published', 'पब्लिश'), type: 'bool' },
  ],
  home_section: () => [
    { name: 'kind', label: L('Block type', 'ब्लॉक का प्रकार'), type: 'select', options: [
      ['hero', 'Hero (top banner)'], ['themes', 'Themes'], ['villages', 'Village tourism'], ['itineraries', 'Itineraries'],
      ['destinations', 'Destinations'], ['stays', 'Homestays'], ['workspaces', 'Workspaces'], ['cabs', 'Instant cab'],
      ['partner_cta', 'Become a partner'], ['text', 'Text block']] },
    { name: 'title', label: 'Title (English)', max: 200, wide: true },
    { name: 'title_hi', label: 'शीर्षक (हिंदी)', max: 200, wide: true },
    { name: 'subtitle', label: 'Text (English)', type: 'textarea', max: 600, rows: 2 },
    { name: 'subtitle_hi', label: 'टेक्स्ट (हिंदी)', type: 'textarea', max: 600, rows: 2 },
    { name: 'image_url', label: L('Image (hero only)', 'फ़ोटो (सिर्फ़ हीरो)'), type: 'image' },
    { name: 'cta_label', label: 'Button text (English)', max: 60 },
    { name: 'cta_label_hi', label: 'बटन का टेक्स्ट (हिंदी)', max: 60 },
    { name: 'cta_url', label: L('Button link', 'बटन का लिंक'), max: 300, placeholder: '#/villages' },
    { name: 'position', label: L('Order', 'क्रम'), type: 'number', min: 0 },
    { name: 'enabled', label: L('Show on home page', 'होम पेज पर दिखाएँ'), type: 'bool', default: true },
  ],
};
