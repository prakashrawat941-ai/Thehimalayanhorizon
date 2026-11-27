// Two-language helper for the work UI. Keep English first, Hindi second.
export const tt = (lang) => (en, hi) => (lang === 'hi' ? hi : en);
export const STATUS_LABEL = {
  draft: ['Draft', 'ड्राफ्ट'], assigned: ['Assigned', 'सौंपा गया'], accepted: ['Accepted', 'स्वीकार'],
  in_progress: ['In progress', 'चल रहा है'], submitted: ['Submitted', 'जमा किया'],
  revision_required: ['Revision needed', 'संशोधन ज़रूरी'], blocked: ['Blocked', 'रुका हुआ'],
  on_hold: ['On hold', 'होल्ड पर'], approved: ['Approved', 'मंज़ूर'], completed: ['Completed', 'पूरा'],
  cancelled: ['Cancelled', 'रद्द'],
};
export const PRIORITY_LABEL = {
  low: ['Low', 'कम'], medium: ['Medium', 'मध्यम'], high: ['High', 'ज़्यादा'], urgent: ['Urgent', 'तुरंत'],
};
export const ACTION_LABEL = {
  assign: ['Assign', 'सौंपें'], accept: ['Accept', 'स्वीकारें'], start: ['Start work', 'काम शुरू करें'],
  progress: ['Save progress', 'प्रगति सहेजें'], submit: ['Submit for review', 'समीक्षा के लिए भेजें'],
  request_revision: ['Request revision', 'संशोधन माँगें'], approve: ['Approve', 'मंज़ूर करें'],
  complete: ['Mark completed', 'पूरा चिह्नित करें'], block: ['Mark blocked', 'रुका हुआ चिह्नित करें'],
  unblock: ['Unblock', 'रुकावट हटाएँ'], hold: ['Put on hold', 'होल्ड पर रखें'], resume: ['Resume', 'फिर शुरू करें'],
  cancel: ['Cancel task', 'काम रद्द करें'],
};
export const ERROR_TEXT = {
  STALE_VERSION: ['This task changed while you were looking. Reload and try again.', 'यह काम आपके देखते समय बदल गया। रीलोड करके फिर कोशिश करें।'],
  INVALID_TRANSITION: ['That step is not possible from the current status. Nothing was changed.', 'मौजूदा स्थिति से यह कदम संभव नहीं है। कुछ नहीं बदला।'],
  PERMISSION_DENIED: ['Your role cannot do this on this task. Nothing was changed.', 'आपकी भूमिका इस काम पर यह नहीं कर सकती। कुछ नहीं बदला।'],
  APPROVAL_REQUIRED: ['This task needs a reviewer approval before it can be completed.', 'पूरा करने से पहले समीक्षक की मंज़ूरी ज़रूरी है।'],
  VALIDATION_FAILED: ['Check the highlighted fields and try again.', 'चिह्नित फ़ील्ड जाँचें और फिर कोशिश करें।'],
  INTERNAL_ERROR: ['Could not save. Nothing was changed. Try again.', 'सहेज नहीं सके। कुछ नहीं बदला। फिर कोशिश करें।'],
};
