// SAMPLE DATA for the gated review route (/ui-kit/modules) only. Fictional people and figures.
// Never imported by a real management route. The UI labels every screen that uses it as sample data.

const P = { f: 'Sample Founder', c: 'Sample CEO', cf: 'Sample Co-Founder', e1: 'Sample Staff A', e2: 'Sample Staff B' };

export const SAMPLE_ME = {
  founder: { name: P.f, designation: 'Founder', department: 'leadership', employeeId: 'THH-EMP-0001', office: 'Head office', joined: '2025-04-01' },
  ceo: { name: P.c, designation: 'Chief Executive Officer', department: 'operations', employeeId: 'THH-EMP-0002', office: 'Head office', joined: '2025-06-15' },
  co_founder: { name: P.cf, designation: 'Co-Founder, Technology & Growth', department: 'technology', employeeId: 'THH-EMP-0003', office: 'Head office', joined: '2025-06-15' },
};

export function sampleSeed() {
  return {
    approval: [
      { id: 'THH-APR-000001', title: 'Update homepage hero text for winter season', category: 'website_cms', requesterName: P.cf, risk: 'low', stage: 'ceo_review', status: 'pending', reason: 'Winter bookings open next month.', changes: [{ field: 'Hero title', label: 'Hero title', kind: 'changed', before: 'Discover the Himalayas', after: 'Winter in the Kumaon hills' }], executionStatus: 'Not started' },
      { id: 'THH-APR-000002', title: 'Add Surmoli village as a destination', category: 'destination', requesterName: P.cf, risk: 'medium', stage: 'ceo_review', status: 'pending', reason: 'First village office is in Surmoli.', changes: [{ field: 'Destination', label: 'Destination', kind: 'added', before: '', after: 'Surmoli, Deghat, Almora' }], executionStatus: 'Not started' },
      { id: 'THH-APR-000003', title: 'Grant finance view to CEO', category: 'security', requesterName: P.c, risk: 'high', stage: 'founder_review', status: 'pending', reason: 'Needed for monthly expense review.', changes: [{ field: 'CEO permissions', label: 'CEO permissions', kind: 'changed', before: 'expenses:read', after: 'expenses:read, finance:read' }], executionStatus: 'Not started' },
      { id: 'THH-APR-000004', title: 'Social campaign budget for December', category: 'marketing', requesterName: P.cf, risk: 'medium', stage: 'closed', status: 'executed', reason: 'Year-end bookings.', changes: [{ field: 'Budget', label: 'Budget', kind: 'changed', before: '₹0', after: '₹15,000 (sample)' }], executionStatus: 'Executed' },
    ],
    employee: [
      { id: 'THH-EMP-0001', name: P.f, designation: 'Founder', department: 'leadership', office: 'Head office', reportsToName: '—', status: 'active', joining: '2025-04-01', mfa: 'On' },
      { id: 'THH-EMP-0002', name: P.c, designation: 'CEO', department: 'operations', office: 'Head office', reportsToName: P.f, status: 'active', joining: '2025-06-15', mfa: 'On' },
      { id: 'THH-EMP-0003', name: P.cf, designation: 'Co-Founder', department: 'technology', office: 'Head office', reportsToName: P.c, status: 'active', joining: '2025-06-15', mfa: 'On' },
      { id: 'THH-EMP-0004', name: P.e1, designation: 'Village office lead', department: 'village_office', office: 'Surmoli office', reportsToName: P.c, status: 'active', joining: '2026-01-10', mfa: 'Off' },
      { id: 'THH-EMP-0005', name: P.e2, designation: 'Support associate', department: 'support', office: 'Head office', reportsToName: P.c, status: 'invited', joining: '2026-12-01', mfa: 'Off' },
    ],
    department: [
      { id: 'd1', code: 'LDR', name: 'Leadership', head: P.f, headcount: 1 }, { id: 'd2', code: 'OPS', name: 'Operations', head: P.c, headcount: 1 },
      { id: 'd3', code: 'TEC', name: 'Technology', head: P.cf, headcount: 1 }, { id: 'd4', code: 'VLG', name: 'Village office', head: P.e1, headcount: 1 },
      { id: 'd5', code: 'SUP', name: 'Customer support', head: P.c, headcount: 1 },
    ],
    candidate: [{ id: 'THH-CAN-00001', name: 'Sample Candidate', role: 'Field officer', department: 'village_office', email: 'candidate@example.com', status: 'interview' }],
    personnel_action: [{ id: 'THH-PAC-00001', employeeName: P.e2, type: 'appointment', effective: '2026-12-01', status: 'pending_approval', reason: 'New support associate for booking season.' }],
    employee_document: [{ id: 'doc1', employeeName: P.e1, type: 'id_proof', uploaded: '2026-01-10', status: 'verified' }],
    attendance: [
      { id: 'a1', date: '2026-11-27', employeeName: P.e1, mode: 'office', checkIn: '09:12', checkOut: '17:40', status: 'present' },
      { id: 'a2', date: '2026-11-27', employeeName: P.c, mode: 'field', checkIn: '10:05', checkOut: '18:10', status: 'late' },
      { id: 'a3', date: '2026-11-27', employeeName: P.cf, mode: 'wfh', checkIn: '09:00', checkOut: '17:30', status: 'present' },
    ],
    leave: [{ id: 'THH-LV-000001', employeeName: P.e1, type: 'casual', from: '2026-12-08', to: '2026-12-09', days: 2, status: 'pending', reason: 'Family function.' }],
    holiday: [
      { id: 'h1', date: '2026-12-25', name: 'Christmas', scope: 'All offices' },
      { id: 'h2', date: '2027-01-26', name: 'Republic Day', scope: 'All offices' },
      { id: 'h3', date: '2027-01-14', name: 'Uttarayani (sample regional holiday)', scope: 'Village offices' },
    ],
    schedule: [{ id: 's1', employeeName: P.e1, pattern: 'Mon–Sat', hours: '09:00–17:30', office: 'Surmoli office' }],
    performance: [{ id: 'p1', employeeName: P.e1, period: 'Nov 2026', tasksDone: 14, onTime: 86, attendance: 96 }],
    meeting: [{ id: 'THH-MTG-00001', title: 'Weekly leadership sync', date: '2026-12-01', time: '10:00', duration: 45, organiser: P.f, attendees: 'CEO, Co-Founder', agenda: 'Approvals backlog, winter campaign, Surmoli office.', status: 'scheduled' }],
    announcement: [{ id: 'THH-ANN-00001', title: 'Winter office timings', audience: 'company', by: P.c, status: 'pending_approval', body: 'Offices open 09:30 to 17:00 from 1 December.' }],
    activity: [
      { id: 'ev1', at: '2026-11-28T07:40:00+05:30', summary: 'Approval THH-APR-000002 submitted for CEO review', category: 'approval', actorName: P.cf, status: 'unread', read: 'unread' },
      { id: 'ev2', at: '2026-11-28T07:10:00+05:30', summary: 'Task THH-TSK-000002 progress set to 40%', category: 'task', actorName: P.cf, status: 'read', read: 'read' },
      { id: 'ev3', at: '2026-11-27T18:05:00+05:30', summary: 'Homepage hero draft saved', category: 'cms', actorName: P.cf, status: 'read', read: 'read' },
      { id: 'ev4', at: '2026-11-27T16:20:00+05:30', summary: 'New sign-in from a new device', category: 'security', actorName: P.c, status: 'unread', read: 'unread' },
    ],
    notification: [
      { id: 'n1', at: '2026-11-28T07:40:00+05:30', title: 'New approval waiting for you', category: 'approval', status: 'unread' },
      { id: 'n2', at: '2026-11-27T09:00:00+05:30', title: 'Task due tomorrow: Review homestay checklist', category: 'task', status: 'read' },
    ],
    office: [{ id: 'THH-OFF-001', name: 'Surmoli village office', village: 'Surmoli', block: 'Deghat', district: 'Almora', state: 'Uttarakhand', staff: 1, status: 'active' }],
    office_assignment: [{ id: 'oa1', employeeName: P.e1, office: 'Surmoli village office', role: 'Office lead', from: '2026-01-10' }],
    tourist: [{ id: 'THH-TRS-000001', name: 'Sample Traveller', phoneMasked: '••••••4321', party: 3, arrival: '2026-12-05', departure: '2026-12-08', purpose: 'Village stay', status: 'open' }],
    service_request: [{ id: 'THH-SRV-000001', summary: 'Cab from Almora to Surmoli', type: 'cab', office: 'Surmoli village office', status: 'open', details: '3 people, morning.' }],
    verification: [{ id: 'THH-FVR-00001', name: 'Sample Homestay', subject: 'homestay', date: '2026-12-02', officer: P.e1, status: 'scheduled' }],
    business: [{ id: 'THH-LBZ-00001', name: 'Sample Craft Shop', category: 'Crafts', owner: 'Sample Owner', village: 'Surmoli', status: 'pending' }],
    office_ledger: [{ id: 'l1', date: '2026-11-27', description: 'Printing tourist forms (sample)', kind: 'expense', amount: 350, ref: 'R-102', status: 'recorded' }],
    daily_report: [{ id: 'THH-RPT-000001', date: '2026-11-27', office: 'Surmoli village office', tourists: 4, status: 'submitted', summary: 'Helped 4 visitors with stays and a cab.', issues: '' }],
    revenue: [{ id: 'r1', period: 'Nov 2026', source: 'Homestays (sample)', gross: 0, commission: 0 }],
    investment: [], expense: [{ id: 'THH-EXP-000001', description: 'Field visit travel (sample)', category: 'travel', amount: 1200, claimant: P.e1, status: 'approved', payment: 'unpaid', date: '2026-11-20' }],
    budget: [], commission: [], payable: [], settlement: [], refund: [], transaction: [],
    finance_request: [{ id: 'THH-FIN-000001', title: 'Signboard for Surmoli office (sample)', amount: 4500, requesterName: P.c, status: 'pending', needed: '2026-12-10', reason: 'Visible office location for visitors.' }],
    campaign: [{ id: 'THH-CMP-00001', name: 'Winter in Kumaon', channel: 'instagram', budget: 15000, start: '2026-12-01', end: '2026-12-31', status: 'pending_approval', goal: 'Families from Delhi NCR.' }],
    advertisement: [], sponsored_listing: [],
    content: [{ id: 'THH-CNT-00001', title: 'Five quiet villages near Almora', channel: 'instagram', source: 'Person', status: 'draft', body: 'Draft text (sample).' }],
    acquisition: [], referral: [], seo_page: [{ id: 'seo1', path: '/stays', title: 'Homestays in Uttarakhand', issues: 1, status: 'open' }],
    initiative: [], expansion_plan: [],
    policy: [{ id: 'THH-POL-001', title: 'Leave policy (draft)', version: 1, effective: '2027-01-01', status: 'draft', body: 'To be decided by the Founder.' }],
    role: [{ id: 'r-f', key: 'founder', name: 'Founder', members: 1, scope: 'Company-wide' }, { id: 'r-c', key: 'ceo', name: 'CEO', members: 1, scope: 'Operations' }, { id: 'r-cf', key: 'co_founder', name: 'Co-Founder', members: 1, scope: 'Technology & growth' }, { id: 'r-e', key: 'employee', name: 'Employee', members: 2, scope: 'Own office' }],
    session: [{ id: 'se1', device: 'Android phone', browser: 'Chrome', area: 'Delhi (approx.)', lastSeen: '2026-11-28T07:50:00+05:30', status: 'active' }, { id: 'se2', device: 'Windows laptop', browser: 'Edge', area: 'Almora (approx.)', lastSeen: '2026-11-25T19:02:00+05:30', status: 'active' }],
    security_alert: [{ id: 'sa1', at: '2026-11-27T16:20:00+05:30', summary: 'New sign-in from a new device', risk: 'medium', status: 'open' }],
    incident: [{ id: 'THH-INC-00001', title: 'Cab search slow on 3G', severity: 'sev3', opened: '2026-11-26T11:00:00+05:30', status: 'investigating', details: 'Search takes ~8 s on slow networks.' }],
    backup: [{ id: 'b1', target: 'Database (sample)', last: '2026-11-28T02:00:00+05:30', retention: '7 days', status: 'ok' }],
    booking: [{ id: 'bk1', code: 'THH-28112026-0001', customer: 'Sample Guest', product: 'Homestay', dates: '5–8 Dec', amount: 0, status: 'pending' }],
    ticket: [{ id: 'THH-TKT-000001', subject: 'Change booking dates', customer: 'Sample Guest', type: 'query', priority: 'medium', assignee: P.c, status: 'open', details: 'Guest wants to move the stay by one day.' }],
    partner: [{ id: 'THH-PTR-00001', name: 'Sample Homestay', type: 'homestay', owner: 'Sample Owner', village: 'Surmoli', kyc: '2 of 3 uploaded', status: 'pending' }],
    listing_change: [{ id: 'THH-LCR-00001', listing: 'Sample Homestay · Deluxe room', change: 'activate', reason: 'Field visit passed.', status: 'pending_approval' }],
    destination: [{ id: 'THH-DST-00001', name: 'Surmoli', district: 'Almora', images: 0, sources: 0, status: 'draft' }],
    location_match: [{ id: 'm1', candidate: 'Surmoli village', existing: 'Surmoli', similarity: 92, distanceKm: '0.4', status: 'pending' }],
  };
}

export const SAMPLE_HEALTH = { uptime: '— (sample)', errors: '— (sample)', build: 'sample', pwa: 'sample' };
export const SAMPLE_CHAT = [
  { id: 'c1', kind: 'direct', title: P.c, unread: 1, messages: [{ id: 'm1', from: P.c, text: 'Can you review the Surmoli destination request today?', at: '07:42' }] },
  { id: 'c2', kind: 'leadership', title: 'Leadership', unread: 0, messages: [{ id: 'm2', from: P.f, text: 'Weekly sync moved to 10:00 Monday.', at: 'Yesterday' }] },
  { id: 'c3', kind: 'department', title: 'Technology', unread: 0, messages: [] },
];
