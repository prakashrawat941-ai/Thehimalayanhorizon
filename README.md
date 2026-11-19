# The Himalayan Horizon · द हिमालयन होराइज़न

उत्तराखंड के लिए ट्रिप प्लानर, विलेज टूरिज्म, होमस्टे बुकिंग, "पहाड़ से काम" (वर्कस्पेस) और इंस्टेंट कैब (सीट शेयरिंग) वेबसाइट।
फ़ोन पर यह ऐप की तरह इंस्टॉल होती है (PWA), और यही कोड आगे Play Store ऐप बनाने में काम आएगा।

Trip planner, village tourism, homestay booking requests, work-from-mountain spaces and shared cab seats for Uttarakhand. Installable on phones as an app (PWA).

## क्या-क्या है

| हिस्सा | कौन इस्तेमाल करता है | क्या कर सकता है |
|---|---|---|
| वेबसाइट / ऐप | यात्री | जगहें और गाँव देखना, तैयार इटिनरी, अपना दिन-ब-दिन प्लान बनाना और सेव करना, होमस्टे/वर्कस्पेस/गाँव टूर की बुकिंग रिक्वेस्ट, कैब में सीट बुक करना |
| पार्टनर पोर्टल (`#/partner`) | होमस्टे मालिक, कैब ड्राइवर, वर्कस्पेस मालिक, गाँव टूर होस्ट | रजिस्ट्रेशन, अपनी लिस्टिंग डालना, राइड पब्लिश करना, रिक्वेस्ट कन्फर्म/मना करना |
| एडमिन पोर्टल (`#/admin`) | आप | पार्टनर और लिस्टिंग की मंज़ूरी, ख़ुद पार्टनर/होमस्टे जोड़ना, होम पेज का पूरा कंट्रोल, लोकेशन पब्लिश करना, नई थीम, इटिनरी, यूज़र रोल, सेटिंग्स |

## तकनीक (Tech)

- **Frontend:** सादा HTML, CSS और JavaScript मॉड्यूल। कोई build step नहीं, इसलिए फ़ाइल बदलो और वेबसाइट बदल जाती है।
- **Backend + Database:** [Supabase](https://supabase.com) (Postgres, Auth, Storage)। सारे नियम डेटाबेस में ही Row Level Security से लागू हैं।
- **PWA:** `manifest.webmanifest` + `sw.js` (ऑफ़लाइन सपोर्ट, होम स्क्रीन पर इंस्टॉल)।

```
index.html            ऐप का ढाँचा
css/app.css           डिज़ाइन
js/config.js          Supabase का पता और publishable key (पब्लिक रखना सुरक्षित है)
js/app.js             राउटर, हेडर, नीचे की टैब बार
js/pages/*.js         हर पेज (public, listings, cabs, planner, account, partner, admin)
js/forms.js, js/schemas.js   पार्टनर/एडमिन फ़ॉर्म
supabase/migrations/  डेटाबेस की सारी टेबल, नियम और शुरुआती कंटेंट
tests/                ऑफ़लाइन ब्राउज़र टेस्ट
docs/SETUP.md         वेबसाइट चालू करने के आसान स्टेप
```

शुरू करने के लिए [docs/SETUP.md](docs/SETUP.md) पढ़िए।
