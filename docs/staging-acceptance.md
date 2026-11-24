# The Himalayan Horizon · Owner acceptance workbook

Use a dedicated staging origin showing the staging banner. Capture the build commit, device, browser, language, account, test record ID, observed result and screenshot for each failed check. Use fictional travellers, sample documents marked TEST, and test transaction references. The product records offline payments. Never transfer money for these tests.

## What is available

Eight distinct password logins were checked against a separate local Supabase Auth + PostgreSQL database. The employee and village-office accounts both use the employee permission set. The latter tests office reception and walk-in bookings. The local database uses storage and scheduler fixtures. Public HTTPS staging, hosted storage/realtime/scheduler, Google redirect credentials and physical-device acceptance require separate hosted verification. Dashboard screenshots in the browser workflow are rendered from PR code using synthetic fixture data.

| Tester | Starting path | First acceptance check |
|---|---|---|
| Founder | /founder | Enroll authenticator, sign out and sign in again, approve a CEO finance request. |
| CEO | /ceo | Assign a dated task, inspect employee completion, submit a financial exception. |
| Co-founder | /co-founder | Update draft CMS content, submit a partner and submit an icon change for review. |
| Employee | /employee | Record attendance, submit an expense and report, try duplicate attendance. |
| Village Office | /employee | Register a walk-in enquiry, request an actual room, retry, confirm one booking reference. |
| Customer | /account | Save a destination, make bookings and view vouchers and notifications. |
| Homestay Partner | /partner | Create two room types, manage rates and complete a stay. |
| Driver | /drive | Complete profile and documents, verify that publication requires approval. |

A separately provisioned staging legacy administrator is needed for driver verification, KYC and payout actions. Giving those permissions to a traveller or a leadership test account would invalidate the role-isolation tests.

## Acceptance results by business requirement

“Database passed” refers to PostgreSQL integration assertions. “Browser passed” means the designated browser suite ran against fixtures. Each row includes the remaining personal acceptance step.

| PRD §9 | Evidence to date | Manual check and expected result |
|---|---|---|
| 1. Village discovery | Photon returned an Almora result. Coverage of every village is unproven. | Search “Almora”, a misspelling and a small village. Open an existing local detail page. For external-only results check how the app identifies the place. |
| 2. Three-destination plan | Planner routes and weather adapters present. OSRM and Open-Meteo returned data on independent probes. | Plan three stops, reorder one, regenerate, edit a day, save, reopen and duplicate. Verify distances, sources, weather labels, read-only share and print layout. |
| 3. Host onboarding | Management partner activation and owner role update passed. | Add a host, two rooms, photos and rates. Verify the pending listing is private. Approve at 15% and find it publicly. Return a second submission with a visible reason. |
| 4. Room pricing and booking lifecycle | Database passed for availability, pricing, locked amounts, commission and transitions. | Configure ₹1,000 base, ₹1,200 weekend, ₹1,500 date override. Book two rooms for Thursday and Friday, override Friday: ₹5,000 total, ₹750 commission at 15%, ₹4,250 host share. Change the rate after confirmation and recheck the voucher. |
| 5. Last room | Local concurrency test passed. | Confirm two requests for the last room in separate sessions. One confirmation succeeds. |
| 6. Payout | Database passed for verified KYC, unpaid bookings and recorded reference. | Request payout twice, reject the duplicate, mark the first paid with TEST-UTR and reconcile earnings. |
| 7. Driver publication | Database blocked unverified driver publication. | Submit sample documents, approve driver, choose a verified vehicle and publish a mapped ride. Try offering too many seats. |
| 8. Matching and hold expiry | Database tested the hold and expiry logic. Hosted scheduler pending. | Search roughly 30 km from a route in the correct direction. Check ordering, countdown and seat release after 15 minutes without manual cleanup. |
| 9. Last seat | Local concurrency test passed; 20 requests for 12 seats produced 12 unique confirmations. | Race two users for one seat. Verify seat totals and booking IDs from both screens. |
| 10. Contact privacy | Cab permission suite passed. | Compare anonymous, requested, confirmed and unrelated traveller views. Only the entitled confirmed traveller should see protected contact details. |
| 11. Feedback | Database tested eligibility and duplicate feedback. | Start and complete a ride. Both parties submit feedback once. Check reliability threshold and moderation. |
| 12. SOS | Database tested incident, admin notification, repeat handling and resolution. | On an active staging ride press SOS using test coordinates. Observe admin realtime, acknowledge and resolve. Verify the display only describes actual notifications. |
| 13. Languages and PWA | Management UI exercised at 360 px in Hindi and 1280 px in English. | Install on Android, relaunch, test offline, switch languages, approve an icon change and verify update on the same installation. |
| 14. Genuine public content | Seed content and CMS require editorial sign-off. | Inspect every public review, image licence, phone, testimonial, price and empty state before publishing. |

## Cross-role and integration checks

- [ ] Anonymous access to each protected route returns to login and preserves the intended route. Test email login, sign-out, password recovery, expired reset link and Google sign-in using the staging redirect.
- [ ] Enroll each staff account in TOTP. A password-only session cannot read staff work. Check an invalid code, a valid code, the next login and session expiry. A traveller cannot assign themselves a role.
- [ ] A founder sees financial requests. A CEO assigns tasks and email follow-ups. A second employee cannot see another employee’s private work. Test switch-user and browser Back after logout.
- [ ] An approver cannot approve their own submission. Two reviewers deciding simultaneously produce one decision. Check audit actor, timestamp, outcome and return reason.
- [ ] Office intake links an existing booking. A new walk-in booking uses an approved room and guest details, returns a real code and appears in the host queue. Retrying does not duplicate it. Record a tourist service, expense and daily report.
- [ ] Co-founder changes English and Hindi CMS entries, order, visibility and images. Check published content in both languages. Check icon approval, and that a returned release leaves the current icon alone.
- [ ] Partner tests draft, pending, rejected, resubmitted and approved states, room limits, blocked dates, cancellation, support ticket/reply and access to only their own documents.
- [ ] Driver tests route, stops, manual vehicle fallback, representative image credit, vehicle capacity, accept/decline, instant confirmation, cancellation, live seat totals, expiry and expiring location share.
- [ ] Customer tests upcoming/completed/cancelled tabs, profile photo type and size, emergency contact, saved places, reviews, notifications, unread count and notification links on the staging origin.
- [ ] Tour and workspace partners publish a test service. Guest requests it, partner responds, guest sees status. Rejected and unpublished items stay private.
- [ ] Test all public pages, navigation and language persistence. Open a nonexistent slug, simulate no results and disconnect during a request. Check loading, retry and empty states.
- [ ] In the planner, deny geolocation, choose map pin, try an unreachable route and dates beyond the forecast window. Check estimated fuel with 300 km / 15 km per litre × ₹100 = ₹2,000. Test zero mileage, day-by-day edit, actual expenses, per-person split, PDF and shared-link privacy.
- [ ] Compare two authenticated sessions during booking, cancellation, notification and SOS. Verify realtime updates, file upload validation, signed-file expiry, contact throttling and scheduled release of holds using hosted services.
- [ ] Management email follow-ups open the mail client. Verify recipient, subject and manual completion. Confirm no claim of automatic delivery. Payment entries and manual payouts use test references only.
- [ ] Verify mobile keyboard layout, focus order, accessible labels, contrast, 200% zoom, slow mobile network, image sizes and Lighthouse performance/accessibility/SEO targets of 90 on public pages.
- [ ] Confirm staging search engines receive noindex and that staging auth, uploads, links, notifications, service worker and installed PWA stay on staging. Remove test sessions from shared devices after sign-off.

## Install the staging PWA on Android

1. Open the **staging HTTPS URL** in Chrome. Verify the staging banner and app name.
2. Open Chrome’s three-dot menu. Choose **Install and create shortcut → Install**, or **Add to Home screen → Install** in versions using that label.
3. Launch **THH Staging** from the home screen. Verify standalone mode, launch icon and footer version. Log in with a staging account.
4. Visit a public page, go offline, then reopen it. Inspect the offline fallback. Check that financial and staff pages never show another account’s cached records.
5. Reconnect and reopen. Check notifications and data refresh. Record the installed icon separately from the browser manifest preview.

Chrome reference: https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en
