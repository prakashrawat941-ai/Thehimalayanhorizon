// Step 02 leadership modules: which sections each role sees, and what each module still needs from Codex.
// Section types: table | form | stats | timeline | calendar | idcard | welcome | chat | integrations | prefs |
//                matrix | reports | research | attendance | emergency | tree | links | live-table | live-stats
// `live` sections read existing management RPCs on the server (read-only). Everything else uses the module adapter,
// which is "not connected" on real routes until Codex ships the contract in docs/DATA-CONTRACTS.md.

const s = (id, type, en, hi, extra = {}) => ({ id, type, title: [en, hi], ...extra });
const link = (href, en, hi) => ({ href, label: [en, hi] });

export const PROVIDERS = [
  { key: 'email', label: ['Email', 'ईमेल'], purpose: ['Invitations, approvals and reports by email', 'ईमेल से आमंत्रण, मंज़ूरी और रिपोर्ट'] },
  { key: 'whatsapp', label: ['WhatsApp Business', 'WhatsApp Business'], purpose: ['Booking and task alerts on WhatsApp', 'WhatsApp पर बुकिंग और काम की सूचना'] },
  { key: 'push', label: ['PWA push notifications', 'PWA पुश सूचनाएँ'], purpose: ['Alerts on installed phones', 'इंस्टॉल किए फ़ोन पर सूचनाएँ'] },
  { key: 'maps', label: ['Google Maps', 'Google Maps'], purpose: ['Location search, maps and distance checks', 'स्थान खोज, नक्शे और दूरी जाँच'] },
  { key: 'ai', label: ['AI services', 'AI सेवाएँ'], purpose: ['Sourced destination research and content drafts', 'स्रोत सहित गंतव्य शोध और सामग्री ड्राफ्ट'] },
  { key: 'calendar', label: ['Calendar & meetings', 'कैलेंडर और बैठकें'], purpose: ['Meeting invites and calendar sync', 'बैठक आमंत्रण और कैलेंडर सिंक'] },
  { key: 'storage', label: ['Document storage', 'दस्तावेज़ भंडारण'], purpose: ['Employee documents, receipts and images', 'कर्मचारी दस्तावेज़, रसीदें और फ़ोटो'] },
];

export const MODULES = {
  profile: {
    icon: 'user', title: ['Profile & digital ID', 'प्रोफ़ाइल और डिजिटल आईडी'],
    summary: ['Your welcome screen, profile, cover photo and permanent employee ID card.', 'आपकी स्वागत स्क्रीन, प्रोफ़ाइल, कवर फ़ोटो और स्थायी कर्मचारी आईडी कार्ड।'],
    sections: [
      s('welcome', 'welcome', 'Welcome', 'स्वागत'),
      s('idcard', 'idcard', 'Digital ID card', 'डिजिटल आईडी कार्ड'),
      s('edit', 'form', 'Edit profile', 'प्रोफ़ाइल बदलें', { form: 'profile', submit: ['Save profile', 'प्रोफ़ाइल सहेजें'] }),
    ],
    roles: { founder: ['welcome', 'idcard', 'edit'], ceo: ['welcome', 'idcard', 'edit'], co_founder: ['welcome', 'idcard', 'edit'] },
    codex: ['Permanent employee ID issue (THH-EMP-NNNN)', 'Profile update RPC', 'Cover/profile photo storage bucket with private access', 'Signed, expiring QR verification token and public verify endpoint that shows only name, role and validity'],
  },
  approvals: {
    icon: 'approvals', title: ['Approval center', 'मंज़ूरी केंद्र'],
    summary: ['Every controlled change in one place: Co-Founder request → CEO review → Founder approval where required → authorised execution → audit log.', 'हर नियंत्रित बदलाव एक जगह: सह-संस्थापक अनुरोध → CEO समीक्षा → ज़रूरत हो तो संस्थापक मंज़ूरी → अधिकृत क्रियान्वयन → ऑडिट लॉग।'],
    sections: [
      s('queue', 'live-table', 'Legacy work queue', 'पुरानी कार्य कतार', { live: 'work' }),
      s('inbox', 'table', 'Waiting for me', 'मेरे लिए लंबित', { entity: 'approval', scope: 'inbox' }),
      s('mine', 'table', 'My requests', 'मेरे अनुरोध', { entity: 'approval', scope: 'mine', create: true }),
      s('execute', 'table', 'Ready to apply', 'लागू करने को तैयार', { entity: 'approval', scope: 'all', statuses: ['approved', 'failed'] }),
      s('history', 'table', 'History', 'इतिहास', { entity: 'approval', scope: 'history' }),
    ],
    roles: { founder: ['inbox', 'mine', 'execute', 'history', 'queue'], ceo: ['inbox', 'mine', 'execute', 'history', 'queue'], co_founder: ['mine', 'execute', 'history', 'queue'] },
    scope: {
      founder: ['Founder final approvals: sensitive, financial, security and policy changes.', 'संस्थापक अंतिम मंज़ूरी: संवेदनशील, वित्तीय, सुरक्षा और नीति बदलाव।'],
      ceo: ['CEO review of every Co-Founder operational change; escalate sensitive ones to the Founder.', 'सह-संस्थापक के हर संचालन बदलाव की CEO समीक्षा; संवेदनशील बदलाव संस्थापक को भेजें।'],
      co_founder: ['Submit changes for CEO approval and track them to execution.', 'बदलाव CEO मंज़ूरी के लिए भेजें और लागू होने तक देखें।'],
    },
    links: { founder: [link('/founder/approvals', 'My approvals (approved screen)', 'मेरी मंज़ूरियाँ (स्वीकृत स्क्रीन)')], ceo: [link('/ceo/reviews', 'Approve requests (approved screen)', 'अनुरोध मंज़ूर करें (स्वीकृत स्क्रीन)'), link('/ceo/requests', 'Sent to Founder', 'संस्थापक को भेजे')], co_founder: [link('/co-founder/releases', 'App releases', 'ऐप रिलीज़')] },
    codex: ['Move remaining legacy management_work kinds onto approval_requests (bridge)', 'Category-specific executors beyond office creation (CMS publish, listing activation, hiring record)'],
  },
  people: {
    icon: 'people', title: ['People', 'लोग'],
    summary: ['Employee directory, permanent IDs, departments, hierarchy, recruitment, appointments and documents.', 'कर्मचारी निर्देशिका, स्थायी आईडी, विभाग, पदानुक्रम, भर्ती, नियुक्तियाँ और दस्तावेज़।'],
    sections: [
      s('leaders', 'live-table', 'Leadership & staff (live)', 'नेतृत्व और स्टाफ़ (लाइव)', { live: 'people', entity: 'leadership_access' }),
      s('directory', 'table', 'Employee directory', 'कर्मचारी निर्देशिका', { entity: 'employee', create: true }),
      s('departments', 'table', 'Departments', 'विभाग', { entity: 'department' }),
      s('hierarchy', 'tree', 'Reporting hierarchy', 'रिपोर्टिंग पदानुक्रम', { entity: 'employee' }),
      s('recruitment', 'table', 'Recruitment', 'भर्ती', { entity: 'candidate', create: true }),
      s('actions', 'table', 'Appointments & changes', 'नियुक्ति और बदलाव', { entity: 'personnel_action', create: true }),
      s('documents', 'table', 'Employee documents', 'कर्मचारी दस्तावेज़', { entity: 'employee_document', create: true }),
    ],
    roles: { founder: ['leaders', 'directory', 'departments', 'hierarchy', 'actions', 'documents'], ceo: ['directory', 'departments', 'hierarchy', 'recruitment', 'actions', 'documents'], co_founder: ['directory', 'hierarchy'] },
    scope: { co_founder: ['Your department and reporting line. Changes go to the CEO.', 'आपका विभाग और रिपोर्टिंग लाइन। बदलाव CEO को जाते हैं।'] },
    links: { founder: [link('/founder/access', 'Access management (approved screen)', 'एक्सेस प्रबंधन (स्वीकृत स्क्रीन)')] },
    codex: ['employees table (permanent THH-EMP id, designation, department, reports_to, status)', 'departments table', 'candidates + personnel_actions tables routed through approvals', 'employee_documents in private storage with signed URLs', 'Activation/suspension/termination RPCs that revoke sessions'],
  },
  workforce: {
    icon: 'clock', title: ['Workforce', 'कार्यबल'],
    summary: ['Attendance, leave, schedules, holidays, performance and exportable reports.', 'उपस्थिति, छुट्टी, समय-सारिणी, अवकाश, प्रदर्शन और निर्यात योग्य रिपोर्ट।'],
    sections: [
      s('today', 'attendance', 'Check in / out', 'चेक-इन / आउट'),
      s('attendance', 'table', 'Attendance', 'उपस्थिति', { entity: 'attendance' }),
      s('leave', 'table', 'Leave', 'छुट्टी', { entity: 'leave', create: true }),
      s('holidays', 'calendar', 'Holiday calendar', 'अवकाश कैलेंडर', { entity: 'holiday', dateKey: 'date', labelKey: 'name' }),
      s('schedules', 'table', 'Work schedules', 'कार्य समय-सारिणी', { entity: 'schedule' }),
      s('performance', 'table', 'Performance', 'प्रदर्शन', { entity: 'performance' }),
      s('reports', 'reports', 'Reports', 'रिपोर्ट', { reports: [['attendance', 'Attendance report', 'उपस्थिति रिपोर्ट'], ['leave', 'Leave report', 'छुट्टी रिपोर्ट'], ['work', 'Work report', 'कार्य रिपोर्ट'], ['monthly', 'Monthly employee summary', 'मासिक कर्मचारी सारांश']] }),
    ],
    roles: { founder: ['attendance', 'leave', 'holidays', 'performance', 'reports'], ceo: ['today', 'attendance', 'leave', 'holidays', 'schedules', 'performance', 'reports'], co_founder: ['today', 'leave', 'holidays'] },
    codex: ['attendance_entries (mode, check-in/out, server time, optional location consent)', 'leave_requests + leave balances + approval rule (business decision)', 'holidays and schedules tables', 'performance view computed on the server', 'CSV/PDF export endpoint'],
  },
  connect: {
    icon: 'mail', title: ['Connect', 'कनेक्ट'],
    summary: ['Private messages, leadership and department groups, meetings and announcements.', 'निजी संदेश, नेतृत्व और विभाग समूह, बैठकें और घोषणाएँ।'],
    sections: [
      s('messages', 'chat', 'Messages', 'संदेश'),
      s('meetings', 'table', 'Meetings', 'बैठकें', { entity: 'meeting', create: true }),
      s('announcements', 'table', 'Announcements', 'घोषणाएँ', { entity: 'announcement', create: true }),
      s('email', 'integrations', 'Email workflow', 'ईमेल वर्कफ़्लो', { providers: ['email', 'calendar'] }),
    ],
    roles: { founder: ['messages', 'meetings', 'announcements'], ceo: ['messages', 'meetings', 'announcements', 'email'], co_founder: ['messages', 'meetings', 'announcements'] },
    codex: ['conversations + participants + messages with participant-only RLS (Founder role grants no access to private messages)', 'Attachments in private storage', 'Realtime channel per conversation', 'meetings and announcements tables; announcements via approval for company-wide audience'],
  },
  activity: {
    icon: 'layers', title: ['Activity Center', 'गतिविधि केंद्र'],
    summary: ['Timeline of tasks, approvals, people, partners, bookings, website changes, finance and security.', 'काम, मंज़ूरी, लोग, पार्टनर, बुकिंग, वेबसाइट बदलाव, वित्त और सुरक्षा की समयरेखा।'],
    sections: [
      s('live', 'live-table', 'Recent management events (live)', 'हाल की प्रबंधन घटनाएँ (लाइव)', { live: 'events', entity: 'activity' }),
      s('feed', 'timeline', 'Activity feed', 'गतिविधि फ़ीड', { entity: 'activity' }),
    ],
    roles: { founder: ['live', 'feed'], ceo: ['live', 'feed'], co_founder: ['feed'] },
    scope: {
      founder: ['Company-wide activity and security audit.', 'पूरी कंपनी की गतिविधि और सुरक्षा ऑडिट।'],
      ceo: ['Operations, employee work and Co-Founder change requests.', 'संचालन, कर्मचारियों का काम और सह-संस्थापक के बदलाव अनुरोध।'],
      co_founder: ['Your department, website changes, technical tasks and partner onboarding.', 'आपका विभाग, वेबसाइट बदलाव, तकनीकी काम और पार्टनर पंजीकरण।'],
    },
    links: { founder: [link('/founder/audit', 'Audit log (approved screen)', 'ऑडिट लॉग (स्वीकृत स्क्रीन)')] },
    codex: ['activity_feed view scoped by role (RLS)', 'read/unread state per user', 'authorised export endpoint', 'Realtime subscription'],
  },
  notifications: {
    icon: 'bell', title: ['Notifications', 'सूचनाएँ'],
    summary: ['Your alerts, delivery preferences and the status of external providers.', 'आपकी सूचनाएँ, डिलीवरी पसंद और बाहरी सेवाओं की स्थिति।'],
    sections: [
      s('inbox', 'timeline', 'Inbox', 'इनबॉक्स', { entity: 'notification' }),
      s('prefs', 'prefs', 'Delivery preferences', 'डिलीवरी पसंद'),
      s('providers', 'integrations', 'Integrations', 'इंटीग्रेशन', { providers: PROVIDERS.map((p) => p.key) }),
    ],
    roles: { founder: ['inbox', 'prefs', 'providers'], ceo: ['inbox', 'prefs', 'providers'], co_founder: ['inbox', 'prefs', 'providers'] },
    codex: ['notifications table + mark-read RPC', 'notification_preferences per category × channel', 'Provider status endpoint (configured / not configured / failing) — never simulated', 'Provider credentials in server secrets only'],
  },
  village: {
    icon: 'building', title: ['Village Connect', 'विलेज कनेक्ट'],
    summary: ['Village offices: staff, tourist registration, onboarding help, field visits, local businesses, receipts and daily reports.', 'ग्राम कार्यालय: स्टाफ़, पर्यटक पंजीकरण, पंजीकरण सहायता, फ़ील्ड विज़िट, स्थानीय व्यवसाय, रसीदें और दैनिक रिपोर्ट।'],
    sections: [
      s('today', 'live-table', 'Office staff today (live)', 'आज का कार्यालय स्टाफ़ (लाइव)', { live: 'offices', entity: 'office_assignment' }),
      s('offices', 'table', 'Offices', 'कार्यालय', { entity: 'office', create: true }),
      s('staff', 'table', 'Staff assignments', 'स्टाफ़ नियुक्ति', { entity: 'office_assignment' }),
      s('tourists', 'table', 'Tourist registration', 'पर्यटक पंजीकरण', { entity: 'tourist', create: true }),
      s('services', 'table', 'Service help', 'सेवा सहायता', { entity: 'service_request', create: true }),
      s('visits', 'table', 'Field verification', 'फ़ील्ड सत्यापन', { entity: 'verification', create: true }),
      s('businesses', 'table', 'Local businesses', 'स्थानीय व्यवसाय', { entity: 'business', create: true }),
      s('cash', 'table', 'Receipts & expenses', 'रसीदें और खर्च', { entity: 'office_ledger', create: true }),
      s('reports', 'table', 'Daily reports', 'दैनिक रिपोर्ट', { entity: 'daily_report', create: true }),
      s('emergency', 'emergency', 'Emergency help', 'आपातकालीन मदद'),
    ],
    roles: { founder: ['today', 'offices', 'staff', 'reports'], ceo: ['today', 'offices', 'staff', 'tourists', 'services', 'visits', 'businesses', 'cash', 'reports', 'emergency'], co_founder: ['visits', 'businesses'] },
    scope: { ceo: ['Initial office: Surmoli, Deghat, Almora, Uttarakhand. It is created in the database by an authorised request.', 'पहला कार्यालय: सुरमोली, देघाट, अल्मोड़ा, उत्तराखंड। इसे अधिकृत अनुरोध से डेटाबेस में बनाया जाता है।'] },
    codex: ['offices + office_assignments tables (first office Surmoli, Deghat, Almora, Uttarakhand via approved request)', 'tourist_registrations with phone stored encrypted/masked', 'service_requests, field_verifications, local_businesses', 'office_ledger feeding Capital (not a ledger itself)', 'daily_reports', 'emergency alert RPC + escalation contacts', 'Server confirmation for anything submitted from an offline draft'],
  },
  capital: {
    icon: 'wallet', title: ['THH Capital', 'THH कैपिटल'],
    summary: ['Revenue, investments, expenses, budgets, commissions, payables, settlements, refunds and reports — from the accounting service.', 'आय, निवेश, खर्च, बजट, कमीशन, देनदारी, निपटान, रिफ़ंड और रिपोर्ट — अकाउंटिंग सेवा से।'],
    sections: [
      s('overview', 'live-stats', 'Booking value (live)', 'बुकिंग मूल्य (लाइव)', { live: 'finance' }),
      s('revenue', 'table', 'Revenue', 'आय', { entity: 'revenue' }),
      s('investments', 'table', 'Investments', 'निवेश', { entity: 'investment', create: true }),
      s('expenses', 'table', 'Expenses', 'खर्च', { entity: 'expense', create: true }),
      s('budgets', 'table', 'Budgets', 'बजट', { entity: 'budget' }),
      s('commissions', 'table', 'Commissions', 'कमीशन', { entity: 'commission' }),
      s('payables', 'table', 'Partner payables', 'पार्टनर देनदारी', { entity: 'payable' }),
      s('settlements', 'table', 'Settlements', 'निपटान', { entity: 'settlement' }),
      s('refunds', 'table', 'Refunds', 'रिफ़ंड', { entity: 'refund' }),
      s('requests', 'table', 'Financial requests', 'वित्तीय अनुरोध', { entity: 'finance_request', create: true }),
      s('transactions', 'table', 'Transactions', 'लेन-देन', { entity: 'transaction' }),
      s('reports', 'reports', 'Financial reports', 'वित्तीय रिपोर्ट', { reports: [['pnl_monthly', 'Profit & loss — monthly', 'लाभ-हानि — मासिक'], ['pnl_annual', 'Profit & loss — annual', 'लाभ-हानि — वार्षिक'], ['commission', 'Commission report', 'कमीशन रिपोर्ट'], ['payables', 'Partner payables', 'पार्टनर देनदारी']] }),
    ],
    roles: { founder: ['overview', 'revenue', 'investments', 'expenses', 'budgets', 'commissions', 'payables', 'settlements', 'refunds', 'requests', 'transactions', 'reports'], ceo: ['expenses', 'refunds', 'requests'] },
    scope: { founder: ['Figures come only from the accounting service. This screen never calculates the ledger.', 'आँकड़े सिर्फ़ अकाउंटिंग सेवा से आते हैं। यह स्क्रीन लेखा-बही की गणना नहीं करती।'] },
    codex: ['Accounting APIs: revenue, investments, expenses, budgets, commissions, payables, settlements, refunds, transactions', 'Server-computed totals and P&L (frontend never authoritative)', 'Approval ≠ payment: separate payment status set by accounting', 'PDF and spreadsheet export endpoints'],
  },
  growth: {
    icon: 'megaphone', title: ['THH Growth', 'THH ग्रोथ'],
    summary: ['Campaigns, ads, sponsored listings, content studio, acquisition, referrals and SEO.', 'अभियान, विज्ञापन, प्रायोजित लिस्टिंग, कंटेंट स्टूडियो, अधिग्रहण, रेफ़रल और SEO।'],
    sections: [
      s('campaigns', 'table', 'Campaigns', 'अभियान', { entity: 'campaign', create: true }),
      s('ads', 'table', 'Advertisements', 'विज्ञापन', { entity: 'advertisement' }),
      s('sponsored', 'table', 'Sponsored listings', 'प्रायोजित लिस्टिंग', { entity: 'sponsored_listing' }),
      s('studio', 'table', 'Content studio', 'कंटेंट स्टूडियो', { entity: 'content', create: true, ai: true }),
      s('acquisition', 'table', 'Acquisition', 'अधिग्रहण', { entity: 'acquisition' }),
      s('referrals', 'table', 'Referrals', 'रेफ़रल', { entity: 'referral' }),
      s('seo', 'table', 'SEO', 'SEO', { entity: 'seo_page' }),
    ],
    roles: { founder: ['campaigns', 'sponsored', 'acquisition'], co_founder: ['campaigns', 'ads', 'sponsored', 'studio', 'acquisition', 'referrals', 'seo'] },
    scope: { co_founder: ['Campaign budgets go to approval. AI can draft content but never publishes, spends money or changes prices.', 'अभियान बजट मंज़ूरी के लिए जाता है। AI ड्राफ्ट बना सकता है, पर कभी प्रकाशित, खर्च या क़ीमत नहीं बदलता।'] },
    codex: ['campaigns, advertisements, sponsored_listings, content_posts tables', 'Campaign budget approval routing', 'AI draft endpoint (server-side key, rate-limited, output marked as AI draft)', 'Acquisition, referral and SEO views'],
  },
  strategy: {
    icon: 'mountain', title: ['Strategy & policies', 'रणनीति और नीतियाँ'],
    summary: ['Business initiatives, expansion plans, company policies and settings.', 'व्यावसायिक पहल, विस्तार योजनाएँ, कंपनी नीतियाँ और सेटिंग।'],
    sections: [
      s('initiatives', 'table', 'Initiatives', 'पहल', { entity: 'initiative' }),
      s('expansion', 'table', 'Expansion', 'विस्तार', { entity: 'expansion_plan' }),
      s('policies', 'table', 'Policies', 'नीतियाँ', { entity: 'policy', create: true }),
    ],
    roles: { founder: ['initiatives', 'expansion', 'policies'] },
    links: { founder: [link('/founder', 'Founder overview (approved screen)', 'संस्थापक ओवरव्यू (स्वीकृत स्क्रीन)')] },
    codex: ['Expose existing create_initiative / advance_initiative as a list contract', 'expansion_plans table', 'policies table with versions, routed through Founder approval'],
  },
  control: {
    icon: 'shield', title: ['Control center', 'नियंत्रण केंद्र'],
    summary: ['Roles, permissions, leadership access, two-step verification, sessions, alerts, audit, integrations and system health.', 'भूमिकाएँ, अनुमतियाँ, नेतृत्व एक्सेस, दो-चरण सत्यापन, सत्र, चेतावनियाँ, ऑडिट, इंटीग्रेशन और सिस्टम स्थिति।'],
    sections: [
      s('health', 'stats', 'System health', 'सिस्टम स्थिति', { entity: 'health', items: [['uptime', 'Uptime (30 days)', 'अपटाइम (30 दिन)'], ['errors', 'Errors (24 h)', 'त्रुटियाँ (24 घं)'], ['build', 'Live build', 'लाइव बिल्ड'], ['pwa', 'PWA version', 'PWA संस्करण']] }),
      s('roles', 'table', 'Roles', 'भूमिकाएँ', { entity: 'role' }),
      s('permissions', 'matrix', 'Permissions', 'अनुमतियाँ'),
      s('sessions', 'table', 'Sessions & devices', 'सत्र और डिवाइस', { entity: 'session' }),
      s('alerts', 'table', 'Security alerts', 'सुरक्षा चेतावनियाँ', { entity: 'security_alert' }),
      s('suspend', 'form', 'Emergency access suspension', 'आपातकालीन एक्सेस निलंबन', { form: 'suspension', submit: ['Suspend access now', 'अभी एक्सेस निलंबित करें'], danger: true }),
      s('incidents', 'table', 'Incidents', 'घटनाएँ', { entity: 'incident', create: true }),
      s('backups', 'table', 'Backups', 'बैकअप', { entity: 'backup' }),
      s('integrations', 'integrations', 'Integration settings', 'इंटीग्रेशन सेटिंग', { providers: PROVIDERS.map((p) => p.key) }),
    ],
    roles: { founder: ['health', 'roles', 'permissions', 'sessions', 'alerts', 'suspend', 'incidents', 'backups', 'integrations'], co_founder: ['health', 'incidents', 'integrations'] },
    scope: {
      founder: ['Hiding a button is not security. Every rule here is enforced by Codex backend and Supabase RLS.', 'बटन छिपाना सुरक्षा नहीं है। यहाँ का हर नियम Codex बैकएंड और Supabase RLS लागू करते हैं।'],
      co_founder: ['Website and PWA health, technical issues and integrations status.', 'वेबसाइट और PWA स्थिति, तकनीकी समस्याएँ और इंटीग्रेशन स्थिति।'],
    },
    links: { founder: [link('/founder/access', 'Access management (approved screen)', 'एक्सेस प्रबंधन (स्वीकृत स्क्रीन)'), link('/founder/audit', 'Audit log (approved screen)', 'ऑडिट लॉग (स्वीकृत स्क्रीन)')], co_founder: [link('/co-founder/releases', 'App releases', 'ऐप रिलीज़')] },
    codex: ['roles/permissions read model and change-via-approval', 'Session list + revoke RPC (Supabase auth admin, server-side)', 'Emergency suspension RPC: Founder + aal2, immediate session revoke, audit event, reversible only by Founder', 'security_alerts, incidents, backups status, system health endpoint'],
  },
  operations: {
    icon: 'support', title: ['Customers & support', 'ग्राहक और सहायता'],
    summary: ['Bookings, complaints, support tickets, partner verification and operational reports.', 'बुकिंग, शिकायतें, सहायता टिकट, पार्टनर सत्यापन और संचालन रिपोर्ट।'],
    sections: [
      s('tickets', 'table', 'Support tickets', 'सहायता टिकट', { entity: 'ticket', create: true }),
      s('bookings', 'table', 'Bookings', 'बुकिंग', { entity: 'booking' }),
      s('partners', 'table', 'Partner verification', 'पार्टनर सत्यापन', { entity: 'partner' }),
      s('reports', 'reports', 'Operational reports', 'संचालन रिपोर्ट', { reports: [['daily', 'Daily operations', 'दैनिक संचालन'], ['weekly', 'Weekly operations', 'साप्ताहिक संचालन'], ['monthly', 'Monthly operations', 'मासिक संचालन'], ['tickets', 'Support tickets', 'सहायता टिकट']] }),
    ],
    roles: { ceo: ['tickets', 'bookings', 'partners', 'reports'], founder: ['tickets', 'reports'] },
    links: { ceo: [link('/ceo/reviews', 'Partner approvals (approved screen)', 'पार्टनर मंज़ूरी (स्वीकृत स्क्रीन)'), link('/ceo', 'Operations today', 'आज का संचालन')] },
    codex: ['support_tickets table (THH-TKT) with SLA and escalation to Founder via approvals', 'Bookings read model for CEO (masked customer contact)', 'Report export endpoint'],
  },
  destinations: {
    icon: 'map', title: ['Destinations & research', 'गंतव्य और शोध'],
    summary: ['Sourced destination research, duplicate detection, maps, images and tourism details.', 'स्रोत सहित गंतव्य शोध, दोहराव पहचान, नक्शे, फ़ोटो और पर्यटन विवरण।'],
    sections: [
      s('research', 'research', 'AI-assisted research', 'AI सहायता से शोध'),
      s('matches', 'table', 'Duplicate check', 'दोहराव जाँच', { entity: 'location_match' }),
      s('places', 'table', 'Destinations', 'गंतव्य', { entity: 'destination' }),
    ],
    roles: { co_founder: ['research', 'matches', 'places'] },
    scope: { co_founder: ['AI findings must have sources, be reviewed by a person and be approved before anything is published.', 'AI निष्कर्षों के स्रोत होने चाहिए, किसी व्यक्ति से जाँच होनी चाहिए और प्रकाशन से पहले मंज़ूरी चाहिए।'] },
    links: { co_founder: [link('/co-founder/locations', 'Add a location (approved screen)', 'लोकेशन जोड़ें (स्वीकृत स्क्रीन)')] },
    codex: ['research_jobs: server-side AI call with source URLs per fact; nothing auto-published', 'Duplicate detection RPC (name similarity + distance) over location_details', 'Maps provider key server-side'],
  },
  partners: {
    icon: 'house', title: ['Partners & listings', 'पार्टनर और लिस्टिंग'],
    summary: ['Partner registration, verification and listing activation, deactivation or edit requests.', 'पार्टनर पंजीकरण, सत्यापन और लिस्टिंग चालू, बंद या बदलाव के अनुरोध।'],
    sections: [
      s('registrations', 'table', 'Partner registrations', 'पार्टनर पंजीकरण', { entity: 'partner', create: true }),
      s('listings', 'table', 'Listing change requests', 'लिस्टिंग बदलाव अनुरोध', { entity: 'listing_change', create: true }),
    ],
    roles: { co_founder: ['registrations', 'listings'] },
    links: { co_founder: [link('/co-founder/onboarding', 'Homestay onboarding (approved screen)', 'होमस्टे ऑनबोर्डिंग (स्वीकृत स्क्रीन)')] },
    codex: ['Partner registration list over existing partners table', 'listing_change_requests routed to CEO approval; activation executed only after approval'],
  },
};

/** Standalone forms (not tied to an entity list). */
export const FORMS = {
  profile: { fields: [
    { key: 'displayName', label: ['Display name', 'दिखने वाला नाम'], type: 'text', required: true, minLength: 2, maxLength: 80 },
    { key: 'designation', label: ['Designation', 'पद'], type: 'text', maxLength: 80, hint: ['Set by an appointment. Shown for reference.', 'नियुक्ति से तय होता है। सिर्फ़ जानकारी के लिए।'], readOnly: true },
    { key: 'bio', label: ['About you', 'आपके बारे में'], type: 'textarea', maxLength: 600 },
    { key: 'phone', label: ['Work mobile', 'कार्य मोबाइल'], type: 'phone' },
    { key: 'photo', label: ['Profile photo (image, max 3 MB)', 'प्रोफ़ाइल फ़ोटो (फ़ोटो, अधिकतम 3 MB)'], type: 'file', accept: 'image/*', maxMB: 3 },
    { key: 'cover', label: ['Cover photo (image, max 5 MB)', 'कवर फ़ोटो (फ़ोटो, अधिकतम 5 MB)'], type: 'file', accept: 'image/*', maxMB: 5 },
  ] },
  suspension: { fields: [
    { key: 'person', label: ['Person (email or employee ID)', 'व्यक्ति (ईमेल या कर्मचारी आईडी)'], type: 'text', required: true, minLength: 3, maxLength: 120 },
    { key: 'scope', label: ['What to suspend', 'क्या निलंबित करें'], type: 'select', required: true, options: [{ value: 'all', label: ['All dashboard access', 'सारा डैशबोर्ड एक्सेस'] }, { value: 'finance', label: ['Finance actions only', 'सिर्फ़ वित्तीय कार्रवाई'] }, { value: 'sessions', label: ['Sign out all devices', 'सभी डिवाइस से साइन आउट'] }] },
    { key: 'reason', label: ['Reason (kept in the audit log)', 'कारण (ऑडिट लॉग में रखा जाता है)'], type: 'textarea', required: true, minLength: 10, maxLength: 1000 },
  ] },
};

/** Which modules each leadership dashboard shows, in nav order. */
export const ROLE_MODULES = {
  founder: ['profile', 'approvals', 'people', 'workforce', 'operations', 'village', 'capital', 'growth', 'strategy', 'connect', 'activity', 'control', 'notifications'],
  ceo: ['profile', 'approvals', 'people', 'workforce', 'operations', 'village', 'capital', 'connect', 'activity', 'notifications'],
  co_founder: ['profile', 'approvals', 'destinations', 'partners', 'growth', 'workforce', 'people', 'village', 'connect', 'activity', 'control', 'notifications'],
};

export const ROLE_BASE = { founder: '/founder', ceo: '/ceo', co_founder: '/co-founder' };
/** Route segment per module (control is "site-health" for the Co-Founder only by label, same path). */
export const MODULE_PATH = {
  profile: 'profile', approvals: 'approval-center', people: 'people', workforce: 'workforce', connect: 'connect',
  activity: 'activity', notifications: 'notifications', village: 'village', capital: 'capital', growth: 'growth',
  strategy: 'strategy', control: 'control', operations: 'operations', destinations: 'destinations', partners: 'partners',
};
export const NAV_LABEL_OVERRIDE = { co_founder: { control: ['Site health', 'साइट स्थिति'] } };

export function sectionsFor(moduleKey, role) {
  const m = MODULES[moduleKey];
  if (!m || !m.roles[role]) return [];
  return m.roles[role].map((id) => m.sections.find((x) => x.id === id)).filter(Boolean);
}

export function modulesFor(role) {
  return (ROLE_MODULES[role] || []).filter((k) => MODULES[k]?.roles[role]);
}

/** Icons for the existing dashboard sidebar (components/Icon.jsx has a smaller set than the UI library). */
export const NAV_ICON = { profile: 'user', approvals: 'check', people: 'people', workforce: 'calendar', connect: 'mail', activity: 'layers', notifications: 'bell', village: 'pin', capital: 'doc', growth: 'star', strategy: 'mountain', control: 'shield', operations: 'support', destinations: 'map', partners: 'house' };

/** Sidebar items for a role's Step 02 modules, appended after the approved items under a heading. */
export function moduleNav(role, L) {
  return [
    { heading: L('Company tools', 'कंपनी टूल') },
    ...modulesFor(role).map((k) => ({ href: moduleHref(role, k), icon: NAV_ICON[k], label: L(...(NAV_LABEL_OVERRIDE[role]?.[k] || MODULES[k].title)) })),
  ];
}

export function moduleHref(role, key) { return `${ROLE_BASE[role]}/${MODULE_PATH[key]}`; }
