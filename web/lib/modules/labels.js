// Shared English / Hindi labels for the Step 02 module engine. English first, Hindi second.
export const tr = (lang) => (pair) => (Array.isArray(pair) ? (lang === 'hi' ? pair[1] ?? pair[0] : pair[0]) : pair ?? '');

export const STATUS = {
  pending: ['Pending', 'लंबित'], open: ['Open', 'खुला'], draft: ['Draft', 'ड्राफ्ट'], active: ['Active', 'सक्रिय'],
  invited: ['Invited', 'आमंत्रित'], suspended: ['Suspended', 'निलंबित'], resigned: ['Resigned', 'इस्तीफ़ा'],
  terminated: ['Terminated', 'सेवा समाप्त'], approved: ['Approved', 'मंज़ूर'], rejected: ['Rejected', 'अस्वीकृत'],
  cancelled: ['Cancelled', 'रद्द'], completed: ['Completed', 'पूरा'], in_progress: ['In progress', 'चल रहा है'],
  resolved: ['Resolved', 'हल हुआ'], closed: ['Closed', 'बंद'], waiting: ['Waiting on customer', 'ग्राहक का इंतज़ार'],
  revision_requested: ['Revision requested', 'संशोधन माँगा'], executed: ['Executed', 'लागू हुआ'],
  execution_failed: ['Execution failed', 'लागू नहीं हो सका'], pending_approval: ['Awaiting approval', 'मंज़ूरी लंबित'],
  ceo_review: ['CEO review', 'CEO समीक्षा'], founder_review: ['Founder approval', 'संस्थापक मंज़ूरी'],
  live: ['Live', 'चालू'], paused: ['Paused', 'रुका'], ended: ['Ended', 'समाप्त'], published: ['Published', 'प्रकाशित'],
  in_review: ['In review', 'समीक्षा में'], scheduled: ['Scheduled', 'तय'], held: ['Held', 'हुई'],
  passed: ['Passed', 'सफल'], failed: ['Failed', 'असफल'], verified: ['Verified', 'सत्यापित'],
  present: ['Present', 'उपस्थित'], late: ['Late', 'देर से'], absent: ['Absent', 'अनुपस्थित'], on_leave: ['On leave', 'छुट्टी पर'],
  recorded: ['Recorded', 'दर्ज'], submitted: ['Submitted', 'जमा'], paid: ['Paid', 'भुगतान हुआ'], unpaid: ['Not paid', 'भुगतान नहीं'],
  effective: ['Effective', 'लागू'], retired: ['Retired', 'हटाया गया'], not_configured: ['Not configured', 'कॉन्फ़िगर नहीं'],
  connected: ['Connected', 'जुड़ा'], new: ['New', 'नया'], screening: ['Screening', 'जाँच'], interview: ['Interview', 'साक्षात्कार'],
  offer: ['Offer', 'प्रस्ताव'], joined: ['Joined', 'शामिल'], merged: ['Merged', 'मिलाया गया'], kept: ['Kept separate', 'अलग रखा'],
  investigating: ['Investigating', 'जाँच जारी'], mitigated: ['Mitigated', 'नियंत्रित'], ok: ['OK', 'ठीक'],
  revoked: ['Revoked', 'रद्द किया'], read: ['Read', 'पढ़ा'], unread: ['Unread', 'नहीं पढ़ा'],
};

export const COMMON = {
  sample: ['Sample data', 'नमूना डेटा'],
  sampleNote: ['These records are sample data for review. Changes stay in this browser tab and are not saved or sent to anyone.', 'ये रिकॉर्ड समीक्षा के लिए नमूना डेटा हैं। बदलाव इसी टैब में रहते हैं, सहेजे या किसी को भेजे नहीं जाते।'],
  live: ['Live data', 'लाइव डेटा'],
  liveNote: ['Read from the existing management database. Changes are made on the approved screens linked here.', 'मौजूदा प्रबंधन डेटाबेस से पढ़ा गया। बदलाव यहाँ जुड़ी स्वीकृत स्क्रीनों पर होते हैं।'],
  notConnected: ['Not connected yet', 'अभी जुड़ा नहीं'],
  notConnectedText: ['This part fills in when its backend service is live. Nothing is shown or saved until then.', 'इसकी बैकएंड सेवा चालू होने पर यह भरेगा। तब तक न कुछ दिखाया जाता है, न सहेजा जाता है।'],
  needs: ['Waiting on', 'इसका इंतज़ार'],
  open: ['Open', 'खोलें'], close: ['Close', 'बंद करें'], cancel: ['Cancel', 'रद्द करें'], save: ['Save', 'सहेजें'],
  submit: ['Submit', 'जमा करें'], exportCsv: ['Export CSV', 'CSV निर्यात'], exportPdf: ['Export PDF', 'PDF निर्यात'],
  search: ['Search', 'खोजें'], all: ['All', 'सभी'], clear: ['Clear filters', 'फ़िल्टर हटाएँ'], note: ['Note', 'नोट'],
  noteHint: ['At least 3 characters. Saved with the record history.', 'कम से कम 3 अक्षर। रिकॉर्ड इतिहास में सहेजा जाता है।'],
  details: ['Details', 'विवरण'], history: ['History', 'इतिहास'], actions: ['Actions', 'कार्रवाई'], status: ['Status', 'स्थिति'],
  empty: ['Nothing here yet', 'अभी यहाँ कुछ नहीं'], emptyFiltered: ['No records match these filters.', 'इन फ़िल्टर से कोई रिकॉर्ड नहीं मिला।'],
  saved: ['Saved.', 'सहेजा गया।'], done: ['Done.', 'हो गया।'], prev: ['Previous', 'पिछला'], next: ['Next', 'अगला'], of: ['of', 'में से'],
  viaApproval: ['This goes to approval first. Nothing changes until it is approved and executed.', 'यह पहले मंज़ूरी के लिए जाएगा। मंज़ूरी और लागू होने तक कुछ नहीं बदलेगा।'],
  noActions: ['No actions available to you on this record.', 'इस रिकॉर्ड पर आपके लिए कोई कार्रवाई नहीं है।'],
  openApproved: ['Open the approved screen', 'स्वीकृत स्क्रीन खोलें'],
  draftSaved: ['Draft saved on this device only. It has not been submitted.', 'ड्राफ्ट सिर्फ़ इस डिवाइस पर सहेजा गया। यह जमा नहीं हुआ है।'],
  draftRestored: ['A draft from this device was restored. It has not been submitted.', 'इस डिवाइस का ड्राफ्ट वापस लाया गया। यह जमा नहीं हुआ है।'],
  discardDraft: ['Discard draft', 'ड्राफ्ट हटाएँ'], saveDraft: ['Save draft', 'ड्राफ्ट सहेजें'],
  offline: ['You are offline. You can save a draft here, but nothing is submitted, booked, approved or paid until you are back online and the server confirms it.', 'आप ऑफ़लाइन हैं। आप ड्राफ्ट सहेज सकते हैं, पर ऑनलाइन होकर सर्वर की पुष्टि तक कुछ जमा, बुक, मंज़ूर या भुगतान नहीं होता।'],
  pdfUnavailable: ['PDF export needs the report service. It is not connected yet.', 'PDF निर्यात के लिए रिपोर्ट सेवा चाहिए। वह अभी जुड़ी नहीं है।'],
  csvNote: ['Exports the rows currently loaded on this screen.', 'इस स्क्रीन पर लोड हुई पंक्तियाँ निर्यात करता है।'],
  new: ['New', 'नया'], id: ['ID', 'आईडी'], view: ['View', 'देखें'],
};

export const ERRORS = {
  required: ['This field is required.', 'यह फ़ील्ड ज़रूरी है।'], tooShort: ['Too short.', 'बहुत छोटा है।'], tooLong: ['Too long.', 'बहुत लंबा है।'],
  email: ['Enter a valid email address.', 'सही ईमेल पता लिखें।'], phone: ['Enter a 10-digit Indian mobile number.', '10 अंकों का भारतीय मोबाइल नंबर लिखें।'],
  number: ['Enter a whole number.', 'पूर्ण संख्या लिखें।'], min: ['Value is too small.', 'मान बहुत छोटा है।'], max: ['Value is too large.', 'मान बहुत बड़ा है।'],
  money: ['Enter an amount in rupees, up to 2 decimals.', 'रुपये में राशि लिखें, अधिकतम 2 दशमलव।'], date: ['Enter a valid date.', 'सही तारीख़ लिखें।'],
  time: ['Enter a valid time.', 'सही समय लिखें।'], option: ['Choose an option.', 'एक विकल्प चुनें।'], order: ['Must be on or after the start.', 'शुरुआत के बराबर या बाद में होना चाहिए।'],
  fileType: ['This file type is not allowed.', 'इस प्रकार की फ़ाइल की अनुमति नहीं है।'], fileSize: ['File is too large.', 'फ़ाइल बहुत बड़ी है।'],
};

export const API_ERRORS = {
  INTEGRATION_UNAVAILABLE: ['Not connected yet. Nothing was saved.', 'अभी जुड़ा नहीं। कुछ सहेजा नहीं गया।'],
  STALE_VERSION: ['This record changed while you were looking. Reload and try again.', 'यह रिकॉर्ड आपके देखते समय बदल गया। रीलोड करके फिर कोशिश करें।'],
  INVALID_TRANSITION: ['That step is not possible from the current status. Nothing was changed.', 'मौजूदा स्थिति से यह कदम संभव नहीं। कुछ नहीं बदला।'],
  PERMISSION_DENIED: ['Your role cannot do this. Nothing was changed.', 'आपकी भूमिका यह नहीं कर सकती। कुछ नहीं बदला।'],
  VALIDATION_FAILED: ['Check the highlighted fields and try again.', 'चिह्नित फ़ील्ड जाँचें और फिर कोशिश करें।'],
  APPROVAL_REQUIRED: ['This needs approval first.', 'इसके लिए पहले मंज़ूरी चाहिए।'],
  NOT_FOUND: ['This record no longer exists.', 'यह रिकॉर्ड अब मौजूद नहीं है।'],
  DUPLICATE_REQUEST: ['This request was already sent.', 'यह अनुरोध पहले ही भेजा जा चुका है।'],
  INTERNAL_ERROR: ['Could not complete this. Nothing was changed. Try again.', 'पूरा नहीं हो सका। कुछ नहीं बदला। फिर कोशिश करें।'],
};

export const ROLE_LABEL = { founder: ['Founder', 'संस्थापक'], ceo: ['CEO', 'मुख्य कार्यकारी'], co_founder: ['Co-Founder', 'सह-संस्थापक'] };
