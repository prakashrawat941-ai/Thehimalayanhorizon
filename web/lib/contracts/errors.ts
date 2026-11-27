/**
 * Shared error codes and user-facing messages (English / Hindi).
 *
 * STATUS: PROPOSED v0 (frontend). The code list comes from the Master Spec ("Shared technical contracts").
 * Codex owns the server side; any change to this list must be agreed in docs/AI-HANDOFF.md first.
 */
export const ERROR_CODES = [
  'AUTH_REQUIRED',
  'MFA_REQUIRED',
  'PERMISSION_DENIED',
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'CONFLICT',
  'STALE_VERSION',
  'APPROVAL_REQUIRED',
  'INVALID_TRANSITION',
  'DUPLICATE_REQUEST',
  'INTEGRATION_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type Lang = 'en' | 'hi';

export interface ErrorCopy {
  title: string;
  text: string;
  /** True when trying the same action again can help. */
  retryable: boolean;
}

export const ERROR_MESSAGES: Record<ErrorCode, Record<Lang, ErrorCopy>> = {
  AUTH_REQUIRED: {
    en: { title: 'Please sign in', text: 'Your session has ended. Sign in again to continue.', retryable: false },
    hi: { title: 'कृपया लॉगिन करें', text: 'आपका सत्र समाप्त हो गया है। जारी रखने के लिए फिर लॉगिन करें।', retryable: false },
  },
  MFA_REQUIRED: {
    en: { title: 'Two-step verification required', text: 'Complete two-step verification to open this screen.', retryable: false },
    hi: { title: 'दो-चरण सत्यापन ज़रूरी', text: 'यह स्क्रीन खोलने के लिए दो-चरण सत्यापन पूरा करें।', retryable: false },
  },
  PERMISSION_DENIED: {
    en: { title: 'Not allowed', text: 'Your account does not have permission for this action. Nothing was changed.', retryable: false },
    hi: { title: 'अनुमति नहीं', text: 'आपके अकाउंट को इस काम की अनुमति नहीं है। कुछ नहीं बदला गया।', retryable: false },
  },
  VALIDATION_FAILED: {
    en: { title: 'Check the details', text: 'Some fields need attention. Fix them and try again.', retryable: false },
    hi: { title: 'जानकारी जाँचें', text: 'कुछ फ़ील्ड ठीक करने हैं। ठीक करके फिर कोशिश करें।', retryable: false },
  },
  NOT_FOUND: {
    en: { title: 'Not found', text: 'This item no longer exists or you cannot see it.', retryable: false },
    hi: { title: 'नहीं मिला', text: 'यह आइटम अब मौजूद नहीं है या आप इसे नहीं देख सकते।', retryable: false },
  },
  CONFLICT: {
    en: { title: 'Changed by someone else', text: 'Another change was saved first. Reload and review before trying again.', retryable: false },
    hi: { title: 'किसी और ने बदला', text: 'कोई दूसरा बदलाव पहले सेव हो गया। रीलोड करके देखें, फिर कोशिश करें।', retryable: false },
  },
  STALE_VERSION: {
    en: { title: 'This version is out of date', text: 'The item changed after you opened it. Reload to see the latest version. Nothing was applied.', retryable: false },
    hi: { title: 'यह वर्शन पुराना है', text: 'खोलने के बाद आइटम बदल गया। नया वर्शन देखने के लिए रीलोड करें। कुछ लागू नहीं हुआ।', retryable: false },
  },
  APPROVAL_REQUIRED: {
    en: { title: 'Approval needed first', text: 'This change must be approved before it can be applied. It was sent for review instead.', retryable: false },
    hi: { title: 'पहले मंज़ूरी चाहिए', text: 'यह बदलाव लागू होने से पहले मंज़ूर होना ज़रूरी है। इसे समीक्षा के लिए भेजा गया।', retryable: false },
  },
  INVALID_TRANSITION: {
    en: { title: 'Not possible in this state', text: 'This action is not available for the current status.', retryable: false },
    hi: { title: 'इस स्थिति में संभव नहीं', text: 'मौजूदा स्थिति में यह काम उपलब्ध नहीं है।', retryable: false },
  },
  DUPLICATE_REQUEST: {
    en: { title: 'Already received', text: 'This request was already submitted. It was not applied twice.', retryable: false },
    hi: { title: 'पहले ही मिल चुका', text: 'यह अनुरोध पहले ही भेजा जा चुका है। इसे दो बार लागू नहीं किया गया।', retryable: false },
  },
  INTEGRATION_UNAVAILABLE: {
    en: { title: 'Service not reachable', text: 'A connected service did not respond. Try again in a few minutes.', retryable: true },
    hi: { title: 'सेवा से संपर्क नहीं हुआ', text: 'जुड़ी हुई सेवा ने जवाब नहीं दिया। कुछ मिनट बाद फिर कोशिश करें।', retryable: true },
  },
  INTERNAL_ERROR: {
    en: { title: 'Something went wrong', text: 'We could not complete this. Nothing was changed. Try again, and share the reference if it keeps happening.', retryable: true },
    hi: { title: 'कुछ गड़बड़ हुई', text: 'यह पूरा नहीं हो सका। कुछ नहीं बदला गया। फिर कोशिश करें; बार-बार हो तो रेफरेंस साझा करें।', retryable: true },
  },
};

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/** Copy for any code string; unknown codes fall back to INTERNAL_ERROR. */
export function errorCopy(code: unknown, lang: Lang = 'en'): ErrorCopy {
  const key: ErrorCode = isErrorCode(code) ? code : 'INTERNAL_ERROR';
  return ERROR_MESSAGES[key][lang] ?? ERROR_MESSAGES[key].en;
}
