export const categories = {
  founder: ['initiative','strategy'],
  ceo: ['task', 'email', 'operation', 'finance', 'critical'],
  co_founder: ['partner', 'cms', 'release', 'critical'],
  employee: ['attendance', 'booking', 'service', 'expense', 'report'],
};
export const labels = {
  founder: ['Founder', 'संस्थापक'],
  ceo: ['CEO', 'मुख्य कार्यकारी'],
  co_founder: ['Co-founder', 'सह-संस्थापक'],
  employee: ['Village office', 'ग्राम कार्यालय'],
  initiative: ['Business initiative','व्यावसायिक पहल'],
  planning: ['Awaiting CEO plan','CEO योजना लंबित'],
  assigned: ['Assigned','कार्य सौंपा गया'],
  review: ['Awaiting CEO review','CEO समीक्षा लंबित'],
  final_review: ['Awaiting Founder approval','संस्थापक की मंज़ूरी लंबित'],
  closed: ['Closed','समाप्त'],
  assign: ['Assign work','कार्य सौंपें'],
  deliver: ['Submit for review','समीक्षा के लिए भेजें'],
  reviewed: ['Send for final approval','अंतिम मंज़ूरी के लिए भेजें'],
  strategy: ['Business strategy', 'व्यापार रणनीति'],
  task: ['Team task', 'टीम कार्य'],
  email: ['Email follow-up', 'ईमेल फ़ॉलो-अप'],
  operation: ['Operations', 'संचालन'],
  finance: ['Finance request', 'वित्तीय अनुरोध'],
  critical: ['Critical approval', 'महत्वपूर्ण मंज़ूरी'],
  partner: ['Partner onboarding', 'पार्टनर पंजीकरण'],
  cms: ['Website content', 'वेबसाइट सामग्री'],
  release: ['PWA release', 'ऐप रिलीज़'],
  attendance: ['Attendance check-in', 'उपस्थिति दर्ज करें'],
  booking: ['Booking enquiry', 'बुकिंग पूछताछ'],
  service: ['Tourist service', 'पर्यटक सेवा'],
  expense: ['Expense claim', 'खर्च दावा'],
  report: ['Daily report', 'दैनिक रिपोर्ट'],
  open: ['Open', 'खुला'],
  completed: ['Completed', 'पूरा'],
  approved: ['Approved', 'स्वीकृत'],
  returned: ['Returned', 'वापस भेजा'],
  submitted: ['Submitted', 'दर्ज किया'],
};
export function decisions(member, userId, row) {
  if (row.kind === 'initiative') {
    if (row.initiative_stage === 'planning' && member === 'ceo') return ['assign'];
    if (row.initiative_stage === 'assigned' && row.assignee === userId && ['co_founder','employee'].includes(member)) return ['deliver'];
    if (row.initiative_stage === 'review' && member === 'ceo') return ['reviewed'];
    if (row.initiative_stage === 'final_review' && row.owner_id === userId && member === 'founder') return ['approved'];
    return [];
  }
  if (row.status !== 'open') return [];
  if (
    row.owner_id !== userId &&
    ((member === 'founder' &&
      ['critical', 'expense', 'finance'].includes(row.kind)) ||
      (member === 'ceo' && ['partner', 'cms', 'release'].includes(row.kind)))
  )
    return ['approved', 'returned'];
  if (
    ['strategy', 'operation', 'task', 'email', 'service', 'booking'].includes(
      row.kind,
    ) &&
    (row.owner_id === userId ||
      row.assignee === userId ||
      (member === 'ceo' && row.kind !== 'strategy'))
  )
    return ['completed'];
  return [];
}
