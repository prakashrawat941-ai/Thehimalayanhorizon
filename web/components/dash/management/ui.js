// Tiny helpers shared by the management screens (no React here, safe on server and client).
export const tr = (lang) => (en, hi) => (lang === 'hi' ? hi : en);

export const ROLE_LABELS = {
  founder: ['Founder', 'संस्थापक'], ceo: ['CEO', 'मुख्य कार्यकारी'], co_founder: ['Co-founder', 'सह-संस्थापक'],
  employee: ['Village office', 'ग्राम कार्यालय'], admin: ['Admin', 'एडमिन'],
};
export const ROLE_TONE = { founder: 'green', ceo: 'blue', co_founder: 'violet', employee: 'gray', admin: 'amber' };

export const KIND_LABELS = {
  strategy: ['Business strategy', 'व्यापार रणनीति'], task: ['Team task', 'टीम कार्य'], email: ['Email follow-up', 'ईमेल फ़ॉलो-अप'],
  operation: ['Operations', 'संचालन'], finance: ['Finance request', 'वित्तीय अनुरोध'], critical: ['Critical approval', 'महत्वपूर्ण मंज़ूरी'],
  partner: ['Partner onboarding', 'पार्टनर पंजीकरण'], cms: ['Website content', 'वेबसाइट सामग्री'], release: ['App release', 'ऐप रिलीज़'],
  attendance: ['Attendance', 'उपस्थिति'], booking: ['Booking enquiry', 'बुकिंग पूछताछ'], service: ['Tourist service', 'पर्यटक सेवा'],
  expense: ['Expense claim', 'खर्च दावा'], report: ['Daily report', 'दैनिक रिपोर्ट'],
};
export const KIND_ICON = { finance: 'layers', expense: 'doc', critical: 'alert', partner: 'house', cms: 'globe', release: 'arrow', task: 'check', email: 'mail', operation: 'route', strategy: 'star' };
export const KIND_TONE = { finance: 'amber', expense: 'amber', critical: 'red', partner: 'violet', cms: 'violet', release: 'violet', task: 'blue', email: 'blue', operation: 'blue', strategy: 'green' };
export const STATUS_TONE = { open: 'amber', approved: 'green', completed: 'green', returned: 'gray', submitted: 'blue' };
export const STATUS_LABELS = { open: ['Open', 'खुला'], approved: ['Approved', 'स्वीकृत'], completed: ['Completed', 'पूरा'], returned: ['Returned', 'वापस भेजा'], submitted: ['Submitted', 'दर्ज किया'] };

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
export const rupees = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`);
export const NOTE_MAX = 500;
/** Decision notes and access-change reasons: 1–500 characters after trimming (server must re-check). */
export const validNote = (s) => { const t = String(s || '').trim(); return t.length >= 1 && t.length <= NOTE_MAX; };
