// Hindi / English text for the interface. Content from the database uses its own
// *_hi columns (see pick()).
const dict = {
  en: {
    home: 'Home', explore: 'Explore', villages: 'Villages', plan: 'Plan trip', stays: 'Homestays',
    workspaces: 'Work from Mountain', cabs: 'Instant Cab', itineraries: 'Itineraries', account: 'Account',
    signin: 'Sign in', signout: 'Sign out', signup: 'Create account', partner: 'Partner', admin: 'Admin',
    become_partner: 'Become a partner', language: 'हिंदी', search: 'Search', all: 'All',
    garhwal: 'Garhwal', kumaon: 'Kumaon', both: 'Garhwal & Kumaon', region: 'Region',
    days: 'days', day: 'Day', per_night: '/ night', per_person: '/ person', per_day: '/ day', per_seat: '/ seat',
    from: 'From', to: 'To', date: 'Date', seats: 'Seats', seats_left: 'seats left', book_seats: 'Book seats',
    no_rides: 'No rides on this route yet. Try another date, or check back soon.',
    request_booking: 'Send booking request', request_sent: 'Request sent! The host will confirm soon.',
    name: 'Name', phone: 'Phone', email: 'Email', password: 'Password', message: 'Message (optional)',
    check_in: 'Check-in', check_out: 'Check-out', guests: 'Guests', start: 'Start date', end: 'End date',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add', back: 'Back', close: 'Close',
    approve: 'Approve', reject: 'Reject', confirm: 'Confirm', decline: 'Decline', hide: 'Hide', publish: 'Publish',
    loading: 'Loading…', nothing_here: 'Nothing here yet.', error: 'Something went wrong',
    sign_in_needed: 'Please sign in to continue.', saved: 'Saved', deleted: 'Deleted',
    best_season: 'Best season', how_to_reach: 'How to reach', budget: 'Budget (per person)',
    use_this_plan: 'Use this plan', my_trips: 'My trips', new_trip: 'New trip', interests: 'Interests',
    travellers: 'Travellers', trip_title: 'Trip name', build_plan: 'Suggest a plan', save_trip: 'Save trip',
    my_bookings: 'My bookings', notifications: 'Notifications', profile: 'Profile',
    hosted_by: 'Hosted by', amenities: 'Amenities', rooms: 'Rooms', max_guests: 'Max guests', meals: 'Meals',
    house_rules: 'House rules', desks: 'Desks', wifi: 'Wi-Fi', power_backup: 'Power backup', stay_available: 'Stay available',
    duration: 'Duration', hours: 'hours', group_size: 'Max group', languages: 'Languages', includes: 'Includes',
    culture: 'Culture highlights', status: 'Status', install_app: 'Install app',
    offline: 'You are offline. Showing saved pages.', partner_pending: 'Your partner application is waiting for admin approval.',
    village_focus: 'Village tourism is at the heart of what we do.',
    footer_note: 'Made in Uttarakhand, for travellers who go slow.',
    nav_cab: 'Instant Cab Booking', nav_planner: 'Trip Planner', nav_villages: 'Explore Villages', plan_your_trip: 'Plan your trip',
    hero_eyebrow: 'Slower travel, deeper connections', hero_script: 'Real People\nReal Villages\nBigger Stories',
    watch_story: 'Watch our story', watch_story_sub: 'Real People. Real Villages.',
    q_cab_sub: 'Shared seats on hill routes', q_plan_sub: 'Plan your perfect Uttarakhand trip', q_village_sub: 'Discover hidden villages and homestays',
    places_eyebrow: 'Explore Uttarakhand', places_note: 'From snow peaks to quiet villages, every corner of Uttarakhand tells a different story.', view_all: 'View all',
    stay_h1: 'Stay a little longer,', stay_h2: 'live a little deeper.',
    stay_text: 'More than a trip, it is a chance to be part of the Pahadi life. Support local families, explore nature, enjoy local food and discover a slower way to travel.',
    f_homestay: 'Village Homestays', f_homestay_sub: 'Stay with local families and live real village life',
    f_internet: 'Wi-Fi details listed', f_internet_sub: 'Each stay shows its internet details',
    f_food: 'Local Food & Culture', f_food_sub: 'Home-cooked meals, traditions and stories',
    f_meaning: 'Meaningful Travel', f_meaning_sub: 'Support local communities and sustainable tourism',
    work_eyebrow: 'Workation in Uttarakhand', work_h: 'Your workday, with a Himalayan view.',
    work_text: 'Escape the city. Stay in a peaceful village home, work with a mountain view, and end the day with a walk and local food. Each stay lists its own Wi-Fi details.',
    w_wifi: 'Wi-Fi details', w_wifi_sub: 'Listed by each host — ask before you book', w_desk: 'Comfortable workspace', w_desk_sub: 'Quiet places to work', w_calm: 'Peaceful surroundings', w_calm_sub: 'Focus, relax and feel alive',
    culture_eyebrow: 'More than a destination', culture_h: 'Meet the culture. Taste the place.',
    culture_text: 'Village homestays, regional food, craft traditions and local guides bring you closer to everyday life in the Himalayas.',
    culture_btn: 'Discover local experiences',
    c_food: 'Local Food & Homestays', c_food_sub: 'Home-cooked meals, warm people', c_walk: 'Village Walks', c_walk_sub: 'Forests, rivers and local life', c_craft: 'Crafts & Traditions', c_craft_sub: 'Learn from local artisans',
    why_eyebrow: 'Why travel with us', why_h1: 'A more meaningful', why_h2: 'way to explore Uttarakhand.',
    why_text: 'Local people, real experiences and responsible travel.',
    y_trust: 'Local Homestays', y_trust_sub: 'Every listing is approved by our team', y_resp: 'Responsible Tourism', y_resp_sub: 'Money goes to the village',
    y_cur: 'Curated Experiences', y_cur_sub: 'Offbeat and peaceful', y_safe: 'Approved Partners', y_safe_sub: 'Only partners our team has approved',
    seasons_eyebrow: 'Uttarakhand through the seasons',
    s_spring: 'Spring', s_spring_sub: 'Blooming valleys', s_summer: 'Summer', s_summer_sub: 'Green meadows', s_monsoon: 'Monsoon', s_monsoon_sub: 'Misty mountains',
    s_autumn: 'Autumn', s_autumn_sub: 'Clear views', s_winter: 'Winter', s_winter_sub: 'Snow and silence',
    cta_eyebrow: 'Your next chapter', cta_h: 'Your Uttarakhand journey starts here.', cta_text: 'Create an account to plan your trip, explore villages and meet local families.',
    footer_about: 'About', footer_help: 'Help', footer_responsible: 'Travel responsibly',
    google: 'Continue with Google', google_cancelled: 'Google sign-in was cancelled', google_failed: 'Google sign-in did not work', or_email: 'or with email',
  },
  hi: {
    home: 'होम', explore: 'घूमें', villages: 'गाँव', plan: 'यात्रा प्लान', stays: 'होमस्टे',
    workspaces: 'पहाड़ से काम', cabs: 'इंस्टेंट कैब', itineraries: 'यात्रा प्लान', account: 'अकाउंट',
    signin: 'लॉगिन', signout: 'लॉगआउट', signup: 'अकाउंट बनाएँ', partner: 'पार्टनर', admin: 'एडमिन',
    become_partner: 'पार्टनर बनें', language: 'English', search: 'खोजें', all: 'सभी',
    garhwal: 'गढ़वाल', kumaon: 'कुमाऊँ', both: 'गढ़वाल और कुमाऊँ', region: 'क्षेत्र',
    days: 'दिन', day: 'दिन', per_night: '/ रात', per_person: '/ व्यक्ति', per_day: '/ दिन', per_seat: '/ सीट',
    from: 'कहाँ से', to: 'कहाँ तक', date: 'तारीख़', seats: 'सीटें', seats_left: 'सीटें बाकी', book_seats: 'सीट बुक करें',
    no_rides: 'इस रूट पर अभी कोई राइड नहीं है। दूसरी तारीख़ देखें या थोड़ी देर बाद आएँ।',
    request_booking: 'बुकिंग रिक्वेस्ट भेजें', request_sent: 'रिक्वेस्ट चली गई! होस्ट जल्द कन्फर्म करेंगे।',
    name: 'नाम', phone: 'फ़ोन', email: 'ईमेल', password: 'पासवर्ड', message: 'संदेश (ज़रूरी नहीं)',
    check_in: 'चेक-इन', check_out: 'चेक-आउट', guests: 'मेहमान', start: 'शुरुआत', end: 'आख़िरी दिन',
    save: 'सेव करें', cancel: 'रद्द करें', delete: 'हटाएँ', edit: 'बदलें', add: 'जोड़ें', back: 'वापस', close: 'बंद करें',
    approve: 'मंज़ूर', reject: 'नामंज़ूर', confirm: 'कन्फर्म', decline: 'मना करें', hide: 'छिपाएँ', publish: 'पब्लिश',
    loading: 'लोड हो रहा है…', nothing_here: 'अभी यहाँ कुछ नहीं है।', error: 'कुछ गड़बड़ हुई',
    sign_in_needed: 'आगे बढ़ने के लिए लॉगिन करें।', saved: 'सेव हो गया', deleted: 'हटा दिया',
    best_season: 'सबसे अच्छा मौसम', how_to_reach: 'कैसे पहुँचें', budget: 'बजट (प्रति व्यक्ति)',
    use_this_plan: 'यह प्लान अपनाएँ', my_trips: 'मेरी यात्राएँ', new_trip: 'नई यात्रा', interests: 'पसंद',
    travellers: 'यात्री', trip_title: 'यात्रा का नाम', build_plan: 'प्लान सुझाएँ', save_trip: 'यात्रा सेव करें',
    my_bookings: 'मेरी बुकिंग', notifications: 'सूचनाएँ', profile: 'प्रोफ़ाइल',
    hosted_by: 'होस्ट', amenities: 'सुविधाएँ', rooms: 'कमरे', max_guests: 'अधिकतम मेहमान', meals: 'खाना',
    house_rules: 'घर के नियम', desks: 'डेस्क', wifi: 'वाई-फ़ाई', power_backup: 'पावर बैकअप', stay_available: 'रहने की सुविधा',
    duration: 'अवधि', hours: 'घंटे', group_size: 'अधिकतम समूह', languages: 'भाषाएँ', includes: 'शामिल',
    culture: 'संस्कृति की झलक', status: 'स्थिति', install_app: 'ऐप इंस्टॉल करें',
    offline: 'आप ऑफ़लाइन हैं। सेव किए पेज दिख रहे हैं।', partner_pending: 'आपका पार्टनर आवेदन एडमिन की मंज़ूरी का इंतज़ार कर रहा है।',
    village_focus: 'विलेज टूरिज्म हमारे काम का दिल है।',
    footer_note: 'उत्तराखंड में बना, सुकून से घूमने वालों के लिए।',
    nav_cab: 'इंस्टेंट कैब बुकिंग', nav_planner: 'ट्रिप प्लानर', nav_villages: 'गाँव खोजें', plan_your_trip: 'यात्रा प्लान करें',
    hero_eyebrow: 'धीमी यात्रा, गहरे रिश्ते', hero_script: 'असली लोग\nअसली गाँव\nबड़ी कहानियाँ',
    watch_story: 'हमारी कहानी देखें', watch_story_sub: 'असली लोग। असली गाँव।',
    q_cab_sub: 'पहाड़ी रूट पर शेयर सीट', q_plan_sub: 'अपनी उत्तराखंड यात्रा प्लान करें', q_village_sub: 'छिपे गाँव और होमस्टे खोजें',
    places_eyebrow: 'उत्तराखंड घूमें', places_note: 'बर्फ़ीली चोटियों से शांत गाँवों तक, उत्तराखंड का हर कोना अलग कहानी कहता है।', view_all: 'सब देखें',
    stay_h1: 'थोड़ा ज़्यादा रुकिए,', stay_h2: 'थोड़ा गहराई से जीइए।',
    stay_text: 'यह सिर्फ़ यात्रा नहीं, पहाड़ी जीवन का हिस्सा बनने का मौक़ा है। स्थानीय परिवारों का साथ दीजिए, प्रकृति में घूमिए और पहाड़ी खाने का स्वाद लीजिए।',
    f_homestay: 'गाँव के होमस्टे', f_homestay_sub: 'स्थानीय परिवारों के साथ असली गाँव का जीवन',
    f_internet: 'वाई-फ़ाई की जानकारी', f_internet_sub: 'हर ठहराव अपने इंटरनेट की जानकारी देता है',
    f_food: 'पहाड़ी खाना और संस्कृति', f_food_sub: 'घर का खाना, परंपराएँ और कहानियाँ',
    f_meaning: 'सार्थक यात्रा', f_meaning_sub: 'स्थानीय लोगों और टिकाऊ पर्यटन का साथ',
    work_eyebrow: 'उत्तराखंड में वर्केशन', work_h: 'आपका काम, हिमालय के नज़ारे के साथ।',
    work_text: 'शहर से निकलिए। शांत गाँव के घर में रहिए, पहाड़ों के सामने काम कीजिए, और दिन पैदल सैर और घर के खाने के साथ ख़त्म कीजिए। हर ठहराव अपनी वाई-फ़ाई जानकारी देता है।',
    w_wifi: 'वाई-फ़ाई की जानकारी', w_wifi_sub: 'हर होस्ट बताता है — बुकिंग से पहले पूछ लें', w_desk: 'आरामदायक जगह', w_desk_sub: 'काम के लिए शांत जगह', w_calm: 'शांत माहौल', w_calm_sub: 'ध्यान, आराम और ताज़गी',
    culture_eyebrow: 'सिर्फ़ जगह नहीं', culture_h: 'संस्कृति से मिलिए। स्वाद चखिए।',
    culture_text: 'गाँव के होमस्टे, पहाड़ी खाना, हस्तकला और स्थानीय गाइड आपको हिमालय के रोज़मर्रा के जीवन के करीब लाते हैं।',
    culture_btn: 'गाँव के अनुभव देखें',
    c_food: 'पहाड़ी खाना और होमस्टे', c_food_sub: 'घर का खाना, अपनापन', c_walk: 'गाँव की सैर', c_walk_sub: 'जंगल, नदियाँ और गाँव का जीवन', c_craft: 'हस्तकला और परंपराएँ', c_craft_sub: 'स्थानीय कारीगरों से सीखिए',
    why_eyebrow: 'हमारे साथ क्यों', why_h1: 'उत्तराखंड घूमने का', why_h2: 'एक सार्थक तरीका।',
    why_text: 'स्थानीय लोग, असली अनुभव और ज़िम्मेदार यात्रा।',
    y_trust: 'स्थानीय होमस्टे', y_trust_sub: 'हर लिस्टिंग हमारी टीम मंज़ूर करती है', y_resp: 'ज़िम्मेदार पर्यटन', y_resp_sub: 'पैसा गाँव तक पहुँचता है',
    y_cur: 'चुने हुए अनुभव', y_cur_sub: 'अनछुए और शांत', y_safe: 'मंज़ूर पार्टनर', y_safe_sub: 'सिर्फ़ हमारी टीम द्वारा मंज़ूर पार्टनर',
    seasons_eyebrow: 'हर मौसम में उत्तराखंड',
    s_spring: 'वसंत', s_spring_sub: 'फूलों वाली घाटियाँ', s_summer: 'गर्मी', s_summer_sub: 'हरे बुग्याल', s_monsoon: 'बरसात', s_monsoon_sub: 'धुंध भरे पहाड़',
    s_autumn: 'शरद', s_autumn_sub: 'साफ़ नज़ारे', s_winter: 'सर्दी', s_winter_sub: 'बर्फ़ और शांति',
    cta_eyebrow: 'आपका अगला अध्याय', cta_h: 'आपकी उत्तराखंड यात्रा यहाँ से शुरू होती है।', cta_text: 'अकाउंट बनाइए, यात्रा प्लान कीजिए, गाँव खोजिए और स्थानीय परिवारों से मिलिए।',
    footer_about: 'हमारे बारे में', footer_help: 'मदद', footer_responsible: 'ज़िम्मेदारी से घूमें',
    google: 'Google से जारी रखें', google_cancelled: 'Google लॉगिन रद्द हो गया', google_failed: 'Google लॉगिन नहीं हो पाया', or_email: 'या ईमेल से',
  },
};

let lang = (() => {
  try { return localStorage.getItem('hh_lang') || 'hi'; } catch { return 'hi'; }
})();

export const getLang = () => lang;
export function setLang(l) {
  lang = l;
  try { localStorage.setItem('hh_lang', l); } catch { /* private mode */ }
  document.documentElement.lang = l;
}
export const t = (key) => dict[lang][key] ?? dict.en[key] ?? key;

// Pick the Hindi column when the site is in Hindi and the column is filled.
export function pick(row, field) {
  if (!row) return '';
  if (lang === 'hi' && row[`${field}_hi`]) return row[`${field}_hi`];
  return row[field] ?? '';
}

const statusWords = {
  hi: { pending: 'मंज़ूरी बाकी', approved: 'मंज़ूर', rejected: 'नामंज़ूर', suspended: 'निलंबित', draft: 'ड्राफ़्ट', hidden: 'छिपा',
        requested: 'रिक्वेस्ट भेजी', confirmed: 'कन्फर्म', declined: 'मना', cancelled: 'रद्द', completed: 'पूरा',
        open: 'खुली', full: 'भर गई' },
};
export const statusLabel = (s) => (lang === 'hi' && statusWords.hi[s]) || s;

// District and region names in Hindi (shown when the site is in Hindi).
const DISTRICT_HI = {
  Almora: 'अल्मोड़ा', Bageshwar: 'बागेश्वर', Chamoli: 'चमोली', Champawat: 'चंपावत', Dehradun: 'देहरादून', Haridwar: 'हरिद्वार',
  Nainital: 'नैनीताल', 'Pauri Garhwal': 'पौड़ी गढ़वाल', Pauri: 'पौड़ी', Pithoragarh: 'पिथौरागढ़', Rudraprayag: 'रुद्रप्रयाग',
  'Tehri Garhwal': 'टिहरी गढ़वाल', Tehri: 'टिहरी', 'Udham Singh Nagar': 'उधम सिंह नगर', Uttarkashi: 'उत्तरकाशी',
  Garhwal: 'गढ़वाल', Kumaon: 'कुमाऊँ', Uttarakhand: 'उत्तराखंड', Delhi: 'दिल्ली', 'New Delhi': 'नई दिल्ली', Chandigarh: 'चंडीगढ़',
  Saharanpur: 'सहारनपुर', Bareilly: 'बरेली', Moradabad: 'मुरादाबाद', 'Uttar Pradesh': 'उत्तर प्रदेश', Other: 'अन्य',
};
export const districtName = (d) => (d && getLang() === 'hi' ? DISTRICT_HI[d] || d : d || '');

