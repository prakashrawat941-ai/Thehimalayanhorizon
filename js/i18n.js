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
