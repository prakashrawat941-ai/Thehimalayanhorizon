# AI handoff: THH UI refresh

Owner: Prakash Singh. Frontend and UI: Claude. Backend integration, permissions, booking correctness, data validation and final verification: Codex.

| Item | Value |
|---|---|
| Instant Cab | Merged to main in PR #14 (`b2cd6fa`, 26 Nov 2026) at the owner's request |
| Public pages | Merged to main in PR #15 (`b11baa9`, 26 Nov 2026) at the owner's request |
| Homepage extras (area 5) | Merged to main in PR #22; CMS mode merged in PR #23 (`26cde57`, 27 Nov 2026) after fixing 2 Codex findings (blank optional text saves as '', trust title/subtitle). The #23 migration is NOT applied to production; CMS mode stays off until it is. |
| Trip Planner (area 4) | Merged to main in PR #19 (`01d2928`, 27 Nov 2026) at the owner's request. Was branch `claude/thh-trip-planner`. Code commit `691339c`. Review PR: https://github.com/prakashrawat941-ai/Thehimalayanhorizon/pull/19 (base `main`). Not merged; needs the owner's approval. |
| Guest account (area 9) | Merged to main in PR #26 (27 Nov 2026) at the owner's request, after fixing 2 Codex review findings (next confirmed ride, dialog focus). |
| Homestay booking (area 8) | Merged to main in PR #25 (`3ac39bf`, 27 Nov 2026) at the owner's request, after fixing 3 Codex review findings (empty date crash, submitted-values summary, dialogs above the header). |
| Partner portal (area 7) | Merged to main in PR #24 (`8e68aef`, 27 Nov 2026) at the owner's request. |
| Dashboards (area 3) | Merged to main in PR #17 (`a303710`, 27 Nov 2026) at the owner's request, after fixing 4 Codex review findings (booking route order, room counts for tours/workspaces, homestay-only check-in KPI, homestay-only onboarding queue). |

## Design previews (claude.ai artifacts, private to the owner)

Every value in these previews is demo data, and each preview is labelled as such.

| Area | Preview | Approval |
|---|---|---|
| 1. Instant Cab booking | https://claude.ai/artifact/VRH2V9ftq3ZKPLGJx278bp | Approved 26 Nov 2026; implemented (see below) |
| 2. Homepage and public pages | https://claude.ai/artifact/5J12rL8aEzxvExJgaZT3n5 (layout) and the HD preview at `/design-preview/public-pages.html` on branch `claude/thh-public-preview` | Approved 26 Nov 2026; implemented (see below) |
| 3. Founder, CEO, Co-founder and Admin dashboards | https://claude.ai/artifact/7N3W4hcriB1nS2MBwniViw | Approved 27 Nov 2026; implemented (see below) |
| 5. Homepage extras | https://claude.ai/artifact/VA4FfYixRRFmus7uhsima7 | Approved 27 Nov 2026; implemented (see below) |
| 9. Guest account pages | https://claude.ai/artifact/XjkZrVuBcSdGydo221utcD | Approved 27 Nov 2026; implemented (see below) |
| 8. Homestay booking flow | https://claude.ai/artifact/EZaU2HRzVzwhztCtgxYsud | Approved 27 Nov 2026; implemented (see below) |
| 7. Partner / homestay portal | https://claude.ai/artifact/CPCnXmyt7mbp8Zp54wuHuR | Approved 27 Nov 2026; implemented (see below) |
| 4. Trip Planner and Trip Report | https://claude.ai/artifact/TjyUeTJMSW1ueGfotfDR6G (v2) | v1 changed at the owner's request; v2 approved 27 Nov 2026 with price option B (paid fuel-price API); implemented (see below) |

An earlier all-in-one preview (https://claude.ai/artifact/K2uJ3wuzDYM4LBo6qvoYr3) was rejected and is superseded.

## Phase 1: Frontend foundation, as implemented (branch `claude/thh-phase-1-ui`)

Status: DRAFT PR, not merged, not deployed. Based on `main` because no verified integration baseline exists yet. PR #18 and PR #28 were not touched and not merged. Waiting for the Founder's approval before Phase 2.

### Founder decisions applied
Forest Green + Gold stays on the public site and every approved screen. Navy / Blue / Teal is used for new internal management screens. One theme system (light / dark / system) covers management dashboards, employee portals, customer dashboards and partner portals. Lucide React is the icon library for new screens; `components/Icon.jsx` is kept so approved screens look the same. Vitest, Playwright and axe are dev dependencies only.

### Design tokens and theme (UI only)
| Piece | Where | Notes |
|---|---|---|
| Tokens | `web/styles/tokens.css` | `--ui-*` variables for 2 surfaces x 2 themes. `data-surface="enterprise"` (navy/blue/teal) and `data-surface="brand"` (forest green/gold). Text pairs checked at 4.5:1 or more, control borders and focus ring at 3:1 or more (`test/contrast.test.js`). |
| Theme store | `web/lib/theme/theme.js` | `light`, `dark` or `system`, saved in `localStorage` key `thh.theme`. `THEME_INIT_SCRIPT` is inlined in `app/layout.jsx` `<head>` so there is no flash. Storage failure falls back to light. |
| Brand dark mode | `web/scripts/gen-brand-dark.mjs` -> `web/styles/brand-dark.generated.css` | Generated dark overrides for the hard-coded colours in `dash.css`, `account.css`, `partner.css` and an allow-list of `globals.css`. Scoped to `html[data-theme="dark"] body:has([data-surface])`, so the public site is untouched. `npm run gen:dark` regenerates; `npm run check:dark` fails when stale. Regenerate after editing those CSS files. |
| Surfaces applied | `account/layout.jsx`, `partner/layout.jsx`, `DashLayout.jsx` get `data-surface="brand"`. `AccountNav` gets a theme toggle. | No other markup or style changes to approved screens. |

New management screens should wrap in `<Surface surface="enterprise">` (or use `<AppShell>`).

### Component library (`web/components/ui`, import from `@/components/ui`)
Button, ButtonLink, IconButton, Field, Input, Select, Textarea, Checkbox, Switch, Dialog, ConfirmDialog, ToastProvider/useToast, Tabs, Badge, StatusBadge, Avatar, Skeleton, Spinner, Card, CardHeader, Stat, StatGrid, EmptyState, ErrorState, SuccessState, NotConnectedState, LoadingState, AsyncView, DataTable (sort, card layout on phones, loading/empty/error), Pagination, FilterBar, Chart (SVG bar/line with data table for screen readers), Stepper, ThemeToggle, ApprovalCard, DiffView, ApprovalTimeline, RiskBadge, AppShell, Surface, PageHeader, Breadcrumbs, UiIcon.

Rules the components enforce:
- A success message or closed dialog appears only after the server answers `{ ok: true }`. A failure keeps the dialog open and shows the message.
- `Stat` and `Chart` draw only the data they are given. No value shows a dash with a screen-reader note, never a made-up number. `NotConnectedState` is the placeholder for a screen without a live data source.
- Approval actions are disabled, with the reason shown, when the viewer lacks permission, the request is not in a decidable status, or a newer version exists (stale). Reject and Revise need a note. The UI never approves anything by itself and sends `expectedVersion` with every decision.
- Status, risk and diff kinds are always text as well as colour. Focus rings are always visible. Motion respects `prefers-reduced-motion`.

Developer gallery: `/ui-kit` returns 404 unless `ENABLE_UI_KIT=1` and `VERCEL_ENV` is not `production`. It shows sample data only, labelled as such.

### Shared TypeScript contracts (PROPOSED v0, UI-facing; Codex owns the physical schema)
Files: `web/lib/contracts/{errors,envelope,permissions,approvals,common,index}.ts`. Typecheck: `npm run typecheck` (`tsconfig.contracts.json`, named so Next does not auto-convert the project to TypeScript).
- `ApiEnvelope`: `{ success: true, data, requestId }` or `{ success: false, error: { code, message }, requestId }`. `toUiResult` also accepts the existing `{ ok, message }` server-action shape.
- 12 error codes with English and Hindi copy: AUTH_REQUIRED, MFA_REQUIRED, PERMISSION_DENIED, VALIDATION_FAILED, NOT_FOUND, CONFLICT, STALE_VERSION, APPROVAL_REQUIRED, INVALID_TRANSITION, DUPLICATE_REQUEST, INTEGRATION_UNAVAILABLE, INTERNAL_ERROR. Unknown codes show INTERNAL_ERROR copy.
- `WriteMeta`: `expectedVersion`, `idempotencyKey`, `approvalRef`.
- Permissions view-model: `canShow(perms, resource, action, actor, record)` is a UI hint only and denies by default. The server must enforce every action.
- Approval view-models: statuses, risk, PROPOSED SLA hours (critical 2, high 12, medium 24, low 72; not approved policy), field diff, exact version binding, stale detection.

### What Codex needs to do (integration requirements)
1. **Baseline.** Tell me which branch is the verified integration baseline. I used `main`. Rebase or retarget this PR once PR #18 and PR #28 land. My edits to shared files are small: `app/layout.jsx`, `account/layout.jsx`, `partner/layout.jsx`, `DashLayout.jsx`, `AccountNav.jsx`, `package.json`, `.gitignore`.
2. **Private-route protection.** `middleware.js` `PROTECTED` lists only `/account /trips /partner /admin /drive`. The management dashboards (`/founder /ceo /co-founder /employee /leadership /management`) need server-side auth and role checks there. Hiding navigation items in the UI is not protection.
3. **Service worker.** `scripts/sw.template.js` already skips caching for `/account|cab|drive|admin|partner|trips|login|t`. Add the management prefixes. The list lives in `web/lib/privacy/clear-private-caches.js` (`PRIVATE_PATH_PREFIXES`); keep the three lists in sync. Private dashboard data must never be cached. Also call `clearPrivateCaches()` on sign-out (client helper, deletes cached private pages; it cannot fix a worker that caches them in the first place).
4. **Contracts.** Confirm or change the envelope, error codes, `WriteMeta`, permission grant shape and approval states. The UI compiles against these. Return `STALE_VERSION` for a version mismatch and `DUPLICATE_REQUEST` for a repeated idempotency key.
5. **Dependencies.** Run `npm install` once and commit the lockfile. I could not install packages in my workspace. Versions in `web/package.json` (`lucide-react ^0.468.0`, `vitest ^2.1.8`, `@playwright/test ^1.49.0`, `@axe-core/playwright ^4.10.0`, `typescript ^5.7.0`) are from memory and unverified.
6. **CI.** `.github/workflows/web-test.yml` runs typecheck, dark-CSS check, unit tests and Playwright with axe. It has not run yet; the first run on GitHub is the real test.

### Not done in Phase 1
- No screen was redesigned. No management dashboard was built (Phase 2 onward).
- No change to authentication, MFA, RLS, schemas, APIs or business logic.
- No merge, no deploy.

### Checks run: Phase 1
Run in my workspace (no npm registry access, so no `npm install`, no `next build`):
- `tsc --strict` on the contracts: passes.
- `node scripts/gen-brand-dark.mjs --check`: passes.
- 115 unit assertions (contrast, theme init script, contracts, privacy helper, components via server rendering, generated CSS scope) passed. **They ran in a small stand-in runner that I wrote, not in real Vitest.** The test files use only `describe`/`it`/`expect`, but they have not run under Vitest yet.
- 59 browser checks passed in Chromium (Playwright) against a static page that bundles the real `UiKitDemo` and CSS, at 1280 and 360 px, light and dark: theme apply and persistence, keyboard tabs, filter, sort, dialog focus trap and Escape, approval gating, stale request, mobile drawer, no horizontal overflow, no console errors, plus a basic names/labels/landmarks sweep. The harness used Lucide icons from `react-icons/lu` as a stand-in for `lucide-react`.
- **Not run:** axe (`@axe-core/playwright` is not available here), the committed `e2e/ui-kit.spec.js` against `next dev`, and `next build`. These are the first things to check in CI.
- One real bug was found and fixed by the browser run: the chart's hidden data table stretched the page.

Screenshots: `docs/ui-previews/phase-1/` (desktop and mobile, light and dark, five tabs plus the mobile menu). Sample data only.

## Area 9: Guest account pages, as implemented

UI refresh of `/account`. No change to auth, schema, RLS, roles or booking transactions. Cab bookings, My trips, Saved places and Reviews pages keep their current inside; only the menu (Overview is now `exact`) and shared shell around them change.

### Screens and routes

| Route | What changed |
|---|---|
| `/account` | Greeting with avatar and sign-out; ride-feedback banner (existing `my_pending_feedback`); "Next up" card = earliest of the next confirmed cab ride and the next confirmed / checked-in stay (voucher button for homestays), or a "Plan your next trip" card; 4 quick counts (requests waiting = exact count of `requested`, cab bookings, saved, unread); recent activity = latest 3 notifications; next trip plan; saved places; roles links. |
| `/account/bookings` | Cards with photo (listing's first image), status badge, booking ID, status line (homestay: Requested → Confirmed → Checked in → Completed; tours/workspaces skip check-in; declined/cancelled show a red ✕ step), dates/room/guests/amount, host note, "waiting for the host" text. Cancel uses a new dialog (`CancelBooking`) showing the homestay's cancellation rule; it calls `set_booking_status(..., 'cancelled')` and refreshes only on success, errors stay in the dialog. Declined/cancelled homestays get "Find another homestay". `?sent=1` shows a confirmation note. |
| `/account/bookings/[id]` | Voucher card: booking ID, place, check-in/out with weekday and the host's times (from house rules), room, guests and nights, guest, status, host, booking value, meals, cancellation; Print / save as PDF and Trip Planner link. Same query and access rule as before. |
| `/account/notifications` | Grouped "Today" / "Earlier", unread highlighted. Auto mark-as-read (existing `MarkRead`) unchanged, so no separate "Mark all read" button (not added; would be redundant). |
| `/account/profile` | "Your details" (photo + existing form) and "Sign-in" (password + sign out) cards; banner when no emergency contact. The emergency contact stays inside the existing details form (one Save), not a separate card as in the preview, to avoid touching the save action. |
| `loading.jsx`, `error.jsx` | New skeleton and bilingual retry for every account page. |

### Changed and new files

- `web/app/account/account.css` (new, `ac-`), `web/components/account/CancelBooking.jsx` (new), `web/lib/stay.js` (same file as in PR #25; identical content so the two branches merge cleanly)
- `web/app/account/layout.jsx`, `page.jsx`, `bookings/page.jsx`, `bookings/[id]/page.jsx`, `notifications/page.jsx`, `profile/page.jsx`, `loading.jsx` (new), `error.jsx` (new)

### Data

Same tables and RPCs as before. Additions: bookings select now includes `homestays(images, house_rules)`, `village_tours(images)`, `workspaces(images)`; overview adds a `requested` count, latest 3 notifications, and the next confirmed stay.

### Pending Codex items: guest account

- AC1. Signed-in staging check of the overview "Next up" card with a real confirmed cab ride and stay.
- AC2. Optional: a host note notification when the partner adds `partner_note` (not built here).

### Checks run: guest account

- Transpile check of every changed file.
- Local harness (not committed): real account pages and `CancelBooking` bundled with esbuild, stubbed Supabase/i18n/Next and invented rows; data and empty × EN/HI × overview, 3 booking tabs, voucher, notifications, profile, loading, error at 360px and 1280px: no horizontal scroll, no page errors.
- Cancel dialog shows the cancellation rule; a failing RPC keeps the dialog with the message and no refresh; success sends `set_booking_status(p_status='cancelled')`, closes and refreshes. Status line marks Confirmed / Requested correctly; tours show 3 steps.
- Not run: `next build` locally (relies on CI); no signed-in Supabase test.

## Area 8: Homestay booking flow, as implemented

UI refresh of `/homestays` and `/homestays/[slug]`. No change to auth, schema, RLS, roles or booking transactions. Workspaces and village tours still use the old `ListingDetail` / `BookingForm`.

### Screens and routes

| Route | What changed |
|---|---|
| `/homestays` | Homestay cards (`StayCard`): photo, place, up to 3 amenities, "from" price, "Host confirms" tag. Filters unchanged. |
| `/homestays/[slug]` | New `StayDetail`: photo grid (1 big + up to 4) with full-screen viewer (Esc / arrow keys), facts (max guests from rooms × units, room types, check-in), description, room cards, amenities, meals, house rules parsed from the `Check-in:` / `Check-out:` / `Cancellation:` lines the partner wizard writes, host card (no partner name or phone), place + Trip Planner link, more nearby. |
| Booking (`StayBooking`) | Desktop: sticky card with dates, room, rooms/guests steppers, live `quote_homestay` estimate → Continue opens the request dialog. Phone: fixed bar above the site tab bar → same dialog. Dialog adds name, phone, message. Guests over `max_guests × rooms` and "not free" disable sending (the database still re-checks both). Not signed in: login link carries `ci, co, room, n, g` in `next`, read back on return. |
| Request sent | Shown only after `booking_requests.insert(...).select('id, booking_code').single()` succeeds; shows the server's booking code and next steps. Insert errors stay in the dialog. |
| `loading.jsx` | Skeleton for the detail page. |

### Changed and new files

- `web/components/stay/StayDetail.jsx`, `StayBooking.jsx` (`RoomCards` + `StayBooking`), `Gallery.jsx`, `StayCard.jsx` (new)
- `web/lib/stay.js` (new: `splitHouseRules`, `istDay`, `nightsBetween`), `web/app/stay.css` (new, `st-`)
- `web/app/homestays/[slug]/page.jsx`, `web/app/homestays/[slug]/loading.jsx` (new), `web/components/ListingPages.jsx` (homestay list uses `StayCard`)

### Data and APIs

Same as before: `getListing('homestay')`, `getRooms`, `getListings` (nearby), `getLocations`, `getSession` (name/phone prefill), `quote_homestay(p_room, p_start, p_end, p_rooms)` RPC, `booking_requests` insert with the same columns as `BookingForm`. New: the insert now also selects `id, booking_code` of the new row (needs the existing "guest reads own bookings" policy).

### Pending Codex items: homestay booking

- SB1. Confirm in staging that the insert + select of the user's own new row is allowed by RLS (if not, the request is saved but the dialog shows an error).
- SB2. Optional: a quote breakdown per night (weekday / weekend / special) from the RPC; the UI shows only the total today.
- SB3. Signed-in staging test of a real request end to end.

### Checks run: homestay booking

- Transpile check of every changed file.
- Local harness (not committed): real `StayDetail`, `StayBooking`, `Gallery` and `StayCard` bundled with esbuild, stubbed data/auth/Supabase and invented rows; EN/HI × signed in/out × detail/list at 360px and 1280px, plus sparse data (1 room, no photos, no rules): no horizontal scroll, no page errors.
- Room card tap selects the room in the booking card and re-quotes; 5 guests in a 3-guest room blocks sending with the message; a failed insert keeps the dialog with the error and no success screen; a successful insert shows the server's booking code; quote failure shows retry; "not free" message; login link keeps dates; photo viewer opens, arrows, Esc.
- Not run: `next build` locally (relies on CI); no signed-in Supabase test.

## Area 7: Partner / homestay portal, as implemented

UI-only refresh of `/partner`. No change to authentication, database schema, RLS, roles or booking transactions. Every write goes through the same calls as before (`set_booking_status` RPC, `homestays` / `homestay_rooms` / `room_rates` writes under the existing RLS, `request_payout`).

### Screens and routes

| Route | What changed |
|---|---|
| `/partner` (Today) | New host: 4-step getting-started list (business details, homestay, KYC, send for review; the last is "Later" until the partner account is approved and a homestay exists). Live host: banners (requests waiting, homestay in review, KYC missing), 4 KPIs (requests waiting, arriving in 7 days, staying now, not yet paid), "Next 7 days" arrivals/departures, listing-health checklist. The 6-month bar chart was removed (not in the approved design). |
| `/partner/bookings` | Card layout. Money box: estimate only while `requested`; guest pays / THH commission (rate) / you receive once the server has fixed `partner_payout_amount`. Guest phone is displayed only for confirmed, checked-in and completed bookings (display rule; the row is still readable by the partner under RLS). Empty state links to the calendar. |
| `BookingActions` | `window.prompt` replaced by dialogs. Confirm dialog shows the estimate and says the system fixes the amounts. Decline dialog has an optional reason with 3 quick chips. Both close and refresh only after the RPC returns without error; on error the message stays in the dialog. Esc closes; focus returns. |
| `/partner/calendar` | Range select (tap a start date, then an end date), weekend / special-price / booked / closed cell styles, legend, "Close all rooms" (sets `blocked_units = total_inventory`, keeps any special price), "Reset to normal". Booked nights per date are counted from the partner's confirmed/checked-in bookings for that room (same rule as `private.rooms_free`: `start_date <= d < end_date`), display only. |
| `/partner/properties` | Cover cards with status (Live / In review / Changes needed / Draft), photo count, completeness bar, commission line, admin remark. |
| `/partner/properties/[id]` | Back link, status badge, admin remark. Wizard: pill steps with ticks, room cards with remove button, photo grid with cover/remove, sticky Back / Save draft / Next or Send for review bar, "How guests will see it" preview on the last step. Validation and save logic unchanged. |
| `/partner/earnings` | KPI tiles restyled; logic unchanged. |
| `loading.jsx`, `error.jsx` | New skeleton and bilingual error with retry for every partner page. |

Mobile note: the site already has a fixed bottom tab bar on phones, so the partner menu stays as the scrollable chip strip at the top instead of the second bottom bar shown in the preview.

### Changed and new files

- `web/app/partner/partner.css` (new, `pp-` classes), `web/lib/partner-ui.js` (new: `listingHealth`, `nextDays`, `addDays`)
- `web/app/partner/layout.jsx` (labels Today / My homestays, order, `exact` on Today, css import)
- `web/app/partner/page.jsx`, `bookings/page.jsx`, `calendar/page.jsx`, `earnings/page.jsx`, `properties/page.jsx`, `properties/[id]/page.jsx`, `loading.jsx` (new), `error.jsx` (new)
- `web/components/partner/BookingActions.jsx`, `RateCalendar.jsx`, `PropertyWizard.jsx`

### Data each screen uses

Unchanged queries: `partners`, `homestays`, `homestay_rooms`, `booking_requests` (via `loadHost`), `partner_kyc.status`, `room_rates`, `payout_requests`. Listing health uses only `name, village, district, summary, images, house_rules, location_id` and active rooms' `base_price`.

### Pending Codex items: partner portal

- PP1. Optional: if guest phone should be hidden from partners until confirmation at the data level too, that needs an RLS/view change (not done here).
- PP2. Optional: `room_rates` upsert has no server check that closed rooms do not go below rooms already booked; the UI warns that closing does not cancel bookings.
- PP3. Signed-in staging test of confirm/decline/check-in/complete and calendar save with a real partner account.

### Checks run: partner portal

- Transpile check of every changed file.
- Local harness (not committed): the real page and client components bundled with esbuild, with stubbed Supabase, i18n and Next modules and invented test rows. 3 host states (new, in review, live) × English/Hindi × 9 screens (Today, Bookings, Calendar, Homestays, Earnings, loading, error, wizard edit, wizard new) at 360px and 1280px: no horizontal page scroll, no page errors.
- Confirm with a failing RPC keeps the dialog open, shows the message and does not refresh; a successful RPC sends `set_booking_status(p_status='confirmed')`, closes and refreshes. Decline sends the chosen reason. Esc closes.
- Calendar range 10–14 Dec upserts 5 rows with the entered price; booked nights show on 1–2 Dec.
- Wizard reaches step 5 with the guest preview; a new wizard blocks Next with "Enter the homestay name."
- Not run: `next build` locally (no node_modules here); relies on CI. No signed-in test against Supabase.

## Area 5: Homepage extras, as implemented

Six additions to `/`. Each uses real data only and shows a clear empty state.

| Block | Where | Data | Empty / error |
|---|---|---|---|
| Trust strip | Under the search card | Static. Every line describes how the site already works: listings approved by the team, OSRM road times with labelled estimates, SOS in cab rides, Hindi/English. | — |
| Go this season | After the CMS blocks | `locations` (published, not `transport_hub`) whose free-text `best_season` covers the current IST month. Parsed by `lib/home/season.js` (English and Hindi month names, ranges such as "Oct–Mar" or "अक्टूबर से मार्च", season words, "all year"). Uses the site's 5 seasons, so it is autumn in Oct–Nov. General season tips are written text, not data. | "No places tagged for … yet" with a Browse button |
| Explore on the map | After season | Published locations with lat/lng, plus approved homestays placed at their location's coordinates (homestays have no lat/lng column). Leaflet + OSM. Filter chips appear only for kinds that exist. | The block is hidden when there are no points. If the map fails to load, it falls back to a list. |
| Sample trip plan | After map | First published itinerary (`getItineraries()`, featured first) → `/plan?from=slug` | Hidden when there are no itineraries |
| Shared rides today | After sample plan | `cab_rides` with status open, not test, departing from now to the end of the IST day, seats left > 0 (public read policy). Links to `/cab/ride/<id>`. | "No shared rides leaving today" with Search / Offer a ride. Error: "Couldn't load today's rides". |
| WhatsApp button | Floating, above the tab bar | `site_settings.contact.whatsapp`. Four prefilled `wa.me` messages. | **Not shown** until a WhatsApp number (with country code) is saved in Admin → Settings. On 27 Nov 2026 it is empty; only `phone` is set, and we do not assume that phone number is on WhatsApp. |

Files:
- `web/lib/home/season.js`, `web/lib/home/rides.js`
- `web/components/home/Extras.jsx`, `ExploreMap.jsx`, `WhatsAppButton.jsx`
- `web/app/home-extras.css`
- `web/app/page.jsx` (wiring)

Editable in the CMS (follow-up branch `claude/thh-home-cms`, owner request 27 Nov 2026):
- The five extras can become `home_sections` kinds: `trust`, `season`, `map`, `sample_plan`, `today_rides`. Admin (and the Co-founder through the `management_cms` policy from PR #18) can then show or hide them, change their order, and set an optional title/subtitle (EN/HI). Their content still fills itself from live data.
- **Switch:** `site_settings.home_layout.extras_in_cms = true`. Until it is set, the site keeps the current fixed placement, so merging the code changes nothing on its own.
- **Migration** `supabase/migrations/20261127060000_home_extras_sections.sql` (**not applied**):
  - widens `home_sections_kind_check`
  - inserts the 5 rows, with trust at position 2 and the other four after every existing section, shifting existing rows from position 2 by one
  - sets the switch
  - Dry run on staging inside `begin … rollback` gave hero:1, trust:2, themes:3 … partner_cta:10, season:11, map:12, sample_plan:13, today_rides:14. Nothing was kept.
- **CMS editor:** `web/app/admin/cms/page.jsx` lists the new kinds with labels and a hint. CODEX: PR #18 moves this list into `web/components/admin/CmsEditor.jsx`; carry the new options over there when merging.
- Apply the migration with the PR #18/#21 production release (staging first, owner approval).

Pending for content and Codex:
- H1 (owner/admin): add destinations with `best_season`, lat/lng and photos. Only 1 location is published today.
- H2 (owner): save the WhatsApp number in Settings.
- H3 (Codex, optional): make `best_season` a structured month list so the season match does not depend on text parsing.
- H4 (Codex, optional): give homestays their own coordinates for exact map pins.

Checks run:
- Transpile check: OK.
- Season parser unit run: 11 sample strings, including Hindi and wrap-around ranges, gave the expected months.
- Harness (real components, invented rows, Leaflet stubbed) at 360px and 1280px, in English and Hindi, in the data, empty and error states:
  - No visible overflow. The only flagged nodes were clipped SVG art inside the cards.
  - The map filter switches the card to the filtered kind. A bug where the card kept showing a filtered-out place was found and fixed.
  - WhatsApp links are `https://wa.me/<digits>?text=…`. Escape closes the sheet. With no number, there is no button.
  - The ride card links to `/cab/ride/<id>`.
- Review fixes (Codex on PR #22): homestays are placed only when their location has both lat and lng. Items at the same spot share one pin with a count, and the card shows "Also here:" so each one stays selectable (harness: 2 stays at one spot, switching works both ways).
- `next build`, CI and the Vercel preview are the build evidence.

## Area 4: Trip Planner and Trip Report, as implemented

### What changed for the traveller (`/plan`)

- **4 steps instead of 5:** Plan & route → Day plan → Cost → Report.
- **Plan & route is map-first:**
  - The map sits on top on phones and is a sticky panel on the right on laptops.
  - Layer buttons on the map: Fuel, Toll, Stays.
  - The road route is fetched automatically about 0.7 s after the start and every stop are chosen. There is no separate "See the route" step.
  - Each stop row shows the leg's km and drive time.
- **Who's going:** Solo, Couple, Family, Friends, Group. Picking one sets the default adults and children; the counters can still be changed. When 8 or more people travel by car or taxi, a note says one car is not enough.
- **Vehicle:**
  - Mode, plus a body type (Hatchback, Sedan, SUV) for a car or taxi.
  - Fuel type (Petrol, Diesel, CNG) and optional own mileage for a car or bike.
  - Bus and train fares are not guessed; the traveller adds them on the Cost step.
- **Location picker** (start or any stop; "Use my location" / "Pick on map"):
  - A fixed red pin sits in the middle of an OpenStreetMap map.
  - High-accuracy GPS keeps the best reading within about 12 s and stops early at ±15 m or better.
  - An accuracy circle and band are shown: Precise ≤ 30 m, Approximate ≤ 200 m, Rough above that. "Use this spot" is blocked while the pin sits on a Rough fix.
  - The nearest place name comes from Nominatim.
  - The saved place keeps `accuracy` and `source` (`gps` or `pin`). If the map fails to load, GPS still works.
  - GPS is never claimed as 100 %: the pin, which the person can move, decides the spot.
- **Live cost card** (dark card on laptops, sticky bottom bar above the tab bar on phones): total, per person, per day, and five groups. It shows "—" when nothing can be worked out yet.
- **Cost step:**
  - Every line shows its formula, a source chip (Your value, Live price with area and date, Admin default, Typical mileage, Needs a rate) and "Change" / "Back to auto".
  - Overrides are stored in `d.assumptions`.
  - Budget, budget left and actual spend tracking are kept.
- **Report:**
  - Who's going, vehicle type and fuel appear in the summary.
  - The map shows fuel, toll and stay markers.
  - A "Fuel pumps & toll plazas on the way" list appears when live data exists, with a toll total that counts plazas whose rate is unknown.
  - The header actions now wrap on phones. This was an existing squeeze bug from the shared `.tr-head`.

### Data shapes (no schema change)

- **Who's going:** stored as one of `solo|couple|family|friends|group` inside `preferences` (two new PREFS keys, `friends` and `group`, with no theme).
- **Vehicle and fuel:** `assumptions.vehicle` (`hatch|sedan|suv`) and `assumptions.fuel_type` (`petrol|diesel|cng`).
- **Start and stop places:** `accuracy` and `source` are added to the place jsonb (`slim()`).
- **On save:** `assumptions` stores the effective rates (admin defaults + live values + overrides), as before, plus `auto_sources: { fuel: { area, date }, tolls: { count, unknown } }`. A saved trip therefore keeps the prices used on the day it was saved.

### Live data contract for Codex (owner chose option B: paid fuel-price API, 27 Nov 2026)

`web/lib/trip/live.js` is the only place the planner gets live prices, pumps and tolls. Both functions return `{ status: 'not_connected' }` today, and the UI says so; it never shows a guessed price.

| Function | Server route to build | Result shape the UI reads |
|---|---|---|
| `fetchFuelPrices(place)` | `GET /api/trip/fuel-price?lat&lng`, which calls the paid provider with a **server-only key** (Vercel/Supabase secret, never in the browser or git) and caches per district per day | `{ status: 'ok', area, source, prices: { petrol: { price, date }, diesel: { price, date }, cng: { price, date, unit: 'kg' } } }` |
| `fetchRoutePois(route, vehicle)` | `POST /api/trip/route-pois` with the chosen legs' coords. Pumps and toll booths come from OpenStreetMap (Overpass), snapped to the route. Toll rates come from an admin-maintained NHAI rate table (or the provider, if it has tolls) for the vehicle class, one way | `{ status: 'ok', source, legs: { [legKey]: [{ kind: 'fuel'\|'toll', km, name, lat, lng, brand?, rate?, rateDate? }] }, gaps: { [legKey]: [{ fromKm, toKm }] } }`. `km` counts from the start of that leg. Use `status: 'error'` on failure. |

How the UI uses these values:
- The live fuel price fills `fuel_price` for the chosen fuel type.
- Tolls are summed from `rate` into `tolls`.
- Plazas with a `null` rate are counted as unknown and flagged.
- A traveller's own value always wins.

### Pending Codex items: Trip Planner

- **T1.** Choose and buy the fuel-price provider (owner pays). Build `/api/trip/fuel-price` with the key as a server secret, cache it, and return dates. Fill `fetchFuelPrices`.
- **T2.** Build `/api/trip/route-pois`: OSM pumps and toll booths along the chosen legs, no-fuel gaps (for example over 50 km), and toll rates per vehicle class with the date they were checked. Fill `fetchRoutePois`.
- **T3.** Mileage by vehicle body type (`assumptions.vehicle`). Today the engine uses `DEFAULT_MILEAGE` per mode. Decide typical values or keep the per-mode default.
- **T4.** Verify the toll total, the shown fuel price and the remaining cost calculations (engine `computeBudget`) against the chosen data. Optionally place fuel and toll stops into the day plan items (the v2 design shows them on the right day).
- **T5.** Optional: a stay estimate from approved listings near each night stop when there is no admin default.

### Trip live-data integration

- T1: Server-only SSR Innovation Lab adapter caches successful prices by state, district and IST date. Configure `TRIP_FUEL_API_URL`, `TRIP_FUEL_API_KEY`, and an approved HTTPS `TRIP_REVERSE_GEOCODER_URL` with a Nominatim-compatible response. The provider must specify the observation date and confirm coverage in the target districts. Its public example has no price date, so that response is deliberately rejected. Missing configuration returns `not_connected`; no placeholder price is displayed.
- T2: `/api/trip/route-pois` queries OpenStreetMap through Overpass for bounded route geometries, snaps and deduplicates the results, and flags stretches over 50 km with no **mapped** fuel stop. Set `TRIP_OVERPASS_URL` to a suitable hosted instance if needed. In `TRIP_TOLL_RATES_JSON`, each entry is keyed by OSM element ID (such as `node/123`) and contains `date`, `source` and `classes`, using the `car`, `motorcycle` and `bus` keys. Populate entries only from checked one-way tariffs. Missing rates remain unknown. The toll total uses known rates only and retains the count of unknown rates.
- T3–T4: Body and fuel type set a typical mileage estimate. CNG uses km/kg, private fares are kept separate from bus/train, incomplete road routes cannot produce a fuel total, and user rate overrides still take precedence.
- T5: Deferred. No room estimate is inferred from list prices without checking availability.
- Verified: `node tests/web/trip-live.mjs` passed the dated district parser, bounded route and POI logic, tariff class and deduplication, fuel gap and CNG budget tests. The paid key, dated district response and actual toll tariff catalogue remain staging dependencies.

- Staging-oriented local HTTP smoke: the credential-free fuel endpoint returned `not_connected`, invalid route input returned HTTP 400, and a valid route returned HTTP 502 when the Overpass upstream was not reachable. The live provider and POI network path still require staging acceptance. The fallback admin price matches the selected fuel only.

- Review fixes before merge (Claude, PR #20, 27 Nov 2026), for the 3 Codex review findings:
  - A successful "Try missing parts again" now refetches POIs, because leg availability is part of the request identity.
  - Repeated endpoints with different chosen roads (A → B → A → B) get their own result key (`poiLegKey`, `key@index`) and go in separate requests, so the server no longer rejects them.
  - Long itineraries are split into batches (at most 3 legs and 2,000 points per request). Any failed batch fails the whole lookup, so tolls are never silently undercounted.
  - Unit run against the real `validateRoute`/`snapRoutePois`: the repeat case gave 2 requests with 0 rejected; 9 legs × 350 points gave 3 requests with 0 rejected; a batch failure returned `error`. The planner harness still passes.

**Provider shortlist (27 Nov 2026).** SSR Innovation Lab is the first district-level option to trial. It advertises petrol, diesel and CNG for Uttarakhand districts, but a monthly quote and a dated response for Almora, Nainital and Pithoragarh are needed before purchase. API Express advertises daily city or PIN-code data and lists Growth at ₹4,999/month, or a free sandbox. Energy API advertises daily city data on Professional at US$49.99/month. Neither alternative has verified district-wide prices for those districts. Do not substitute a city or statewide price silently.


- Overpass failover uses one bounded alternate request on a network error, timeout, 5xx or incomplete response. It stops on 4xx, returns HTTP 502 if both providers fail, and does not invent POIs. Set `TRIP_OVERPASS_FALLBACK_URL` explicitly when `TRIP_OVERPASS_URL` is configured. `node tests/web/trip-overpass.mjs` passed the failure-path tests with controlled upstream responses.

### Changed and new files (area 4)

| File | What |
|---|---|
| `web/app/plan/Planner.jsx` | Rewritten UI on the same engine, save, share and itinerary logic. |
| `web/app/plan/planner.css` | All `tp2-` styles, including the report header fix. |
| `web/components/trip/LocationPicker.jsx` | GPS + pin picker. |
| `web/components/trip/RouteLegs.jsx` | Legs, road options, fuel / toll / gap list. |
| `web/components/trip/LiveCost.jsx` | Live cost card and phone bar. |
| `web/components/trip/CostStep.jsx` | Auto cost with sources, overrides, budget and actuals. |
| `web/components/trip/RouteMap.jsx` | Optional `pois` + `layers` markers (escaped popups). |
| `web/components/trip/TripReport.jsx` | Who and vehicle in the summary, POI markers and list. |
| `web/lib/trip/common.js` | `WHO`, `VEHICLES`, `FUELS`, `whoOf`; `slim()` keeps `accuracy` and `source`. |
| `web/lib/trip/live.js` | Live data contract (not connected yet). |

### Checks run: Trip Planner

- TypeScript transpile check of all changed files: OK.
- Local harness (not committed). The real Planner was bundled with esbuild. OSRM, Open-Meteo and Nominatim were faked by intercepting `fetch`, Leaflet was stubbed, and `live.js` was switched between not-connected and invented test data. It was run in Chrome via Playwright at 360px and 1280px, in English and Hindi. Results:
  - No horizontal overflow on Plan, Cost, Report or the picker. The report header overflow was found and fixed.
  - Route auto-runs: 3 legs with road options.
  - With live data on: the petrol price shows on the fuel chip, the fuel line uses it ("Petrol · Test area · 27 Nov"), tolls total with 1 unknown plaza flagged, the no-fuel gap row shows, and the report lists 3 POIs.
  - With live data off: "Price needed" and "Toll data not connected yet" show, and the total reads "—" until rates exist.
  - Override then "Back to auto" restores the auto value.
  - Friends sets 4 adults; Group shows the 8+ note.
  - Picker with a mocked GPS fix (±9 m) shows "Precise ±9 m", and the picked start shows "Pin near …".
  - A blank trip shows 5 validation errors.
  - A failed OSRM route shows the per-leg error.
  - No page errors.
- Review fixes (Codex on PR #19): save writes the resolved rates (a cleared override no longer saves `''`), and only a map drag counts as a manual pin move, so later GPS readings never replace a moved pin.
- Not run here: `next build` (no packages in this sandbox). Real Leaflet tiles and real GPS were not exercised (sandbox blocks the network). CI and the Vercel preview are the build evidence.

## Area 3: Dashboards, as implemented

### What is live on this branch and what is not

- **Admin (live data, existing guard).** `/admin` gets the dashboard switcher and a new **Booking monitor** at `/admin/bookings`. These use only existing tables, read through the admin's own session, so the current admin policies decide what is visible.
- **Founder, CEO and Co-founder (routes added, owner view, 27 Nov 2026 at the owner's request).**
  - New routes: `/founder` (+ `/access`, `/approvals`, `/audit`), `/ceo` (+ `/tasks`, `/reviews`, `/requests`) and `/co-founder` (+ `/locations`, `/onboarding`, `/releases`).
  - **Temporary guard:** `requireAdmin`. Only the owner-set admin role can open them, and every page shows an "Owner view" note. `ADMIN_OPENS_MANAGEMENT = true` in `web/lib/dashboards.js` adds these three to an admin's switcher.
  - **Live data, existing tables only:**
    - Founder overview: `admin_homestay_stats` (homestay booking value and commission, labelled "records").
    - Access: admin profiles, read-only, with no add or edit.
    - Audit: latest 30 rows of `audit_log`.
    - CEO operations: check-ins today, rides today, live seat holds, open SOS; alerts for stay requests waiting over 12 h and support tickets open over 24 h.
    - Co-founder website: `home_sections`.
    - Onboarding: steps derived from `partners`, `homestays`, `homestay_rooms` and `partner_kyc`, with links to admin approvals.
    - Releases: `APP_VERSION`.
  - **"Not connected yet"** (no sample rows): team members and MFA, every work queue (approvals, tasks, reviews, sent requests, releases), village offices, and location matching.
  - Loaders: `web/lib/dash/management-data.js`. Each one returns `{ data, error }`; on error the page shows the error state with retry.
  - **Conflict note:** Codex's branch `feature/thh-management-security-foundation` also creates `web/app/founder|ceo|co-founder/page.jsx` (rendering `Workspace`). When it lands, keep these pages and feed them from `management_*` + MFA. Then switch the guard to the management guard, set `ADMIN_OPENS_MANAGEMENT = false`, and pass `managementRole` into `DashLayout` (D1).
  - Codex's `management_*` tables, MFA and RPCs are still not in production (no `management%` tables in prod as of 27 Nov 2026).
- **Unchanged:** authentication, schema, RLS, role permissions and booking transactions. There are no new tables, RPCs or migrations.

### Changed and new files

| File | What |
|---|---|
| `web/lib/dashboards.js` | Dashboard registry. `authorisedDashboards({ roles, managementRole })` and `switcherItems()`. Today it offers Admin (`profiles.role = 'admin'`) and My account only. |
| `web/components/dash/DashSwitcher.jsx` | Client menu of authorised dashboards (Esc and outside-click close it). It grants nothing; every target route re-checks access. |
| `web/components/dash/DashLayout.jsx` | Shared frame: the existing `AccountNav` sidebar and phone chips, plus the switcher on top. |
| `web/components/dash/DashStates.jsx` | `DashSkeleton`, `DashEmpty`, `DashError` (retry = `router.refresh()`), `DashNotConnected`, `DashMfaNeeded`. |
| `web/components/dash/parts.jsx` | `Tag`, `Kpi`, `KpiRow`, `Panel`, `ListRow`, `FilterChips` (filters are links, so they live in the URL). |
| `web/components/dash/BookingMonitor.jsx` | Table on laptops, cards on phones. Live hold countdown via the existing `Countdown`. |
| `web/lib/dash/bookings.js` | `parseFeedQuery`, `loadBookingFeed`, `normaliseStay`, `normaliseCab`, `feedTone`. |
| `web/app/admin/bookings/page.jsx`, `loading.jsx` | Booking monitor route and skeleton. |
| `web/app/admin/layout.jsx` | Uses `DashLayout`. Adds the nav item "Booking monitor". The admin guard is unchanged. |
| `web/app/admin/page.jsx` | Adds a "Bookings waiting" stat (`booking_requests.status = requested` + `cab_bookings.status = pending`). |
| `web/lib/dash/management-data.js` | Server loaders for the three role dashboards (existing tables only). |
| `web/components/dash/ManagementFrame.jsx` | Frame + temporary `requireAdmin` guard + owner note + nav for `/founder`, `/ceo`, `/co-founder`. |
| `web/app/founder/**`, `web/app/ceo/**`, `web/app/co-founder/**` | Role dashboard routes (layout, loading, pages). |
| `web/components/account/AccountNav.jsx` | Optional `exact` on nav items so "Overview" is only highlighted on its own page (also fixes `/admin`). |
| `web/components/dash/management/*` | `AccessManagement`, `WorkQueue`, `LocationReview`, `FounderOverview`, `OpsToday`, `CmsSections`, `OnboardingQueue`, `NoteDialog`, helpers in `ui.js`. |
| `web/app/dash.css` | All `dsx-` styles. Also a phone-only fix so the section chips keep their height on short dashboard pages (scoped to dashboards). |

### Booking monitor data (live)

- **Reads:**
  - `booking_requests`: `id, kind, booking_code, status, created_at, start_date, end_date, guests, rooms_booked, guest_name`, plus `homestays(name)`, `village_tours(title)` and `workspaces(name)`.
  - `cab_bookings`: `id, booking_code, booking_ref, seats, status, created_at, hold_expires_at, pickup_geo, drop_geo`, plus booking and ride place names through the existing FK names (`cab_bookings_from_place_id_fkey`, `cab_rides_from_place_id_fkey`, `cab_rides_from_location_id_fkey`, and the matching `to_` keys).
- **Ordering and limits:** each table is ordered by `created_at desc, id desc` and limited to `limit + 1`, then the two lists are merged. `?limit=` accepts 25, 50, 100 or 200.
- **Filters:** `?type=all|stay|cab` and `?status=all|waiting|confirmed|done|closed`.

  | Group | Stay statuses | Cab statuses |
  |---|---|---|
  | waiting | requested | pending |
  | confirmed | confirmed, checked_in | confirmed |
  | done | completed | completed |
  | closed | declined, cancelled | declined, cancelled, expired |

- **"Held":** a cab booking whose `status = pending` and whose `hold_expires_at` is in the future. This is a UI reading of existing columns only. Codex should confirm it matches the booking rules (see C1).
- **Failures:** on any query error the page shows the error state with retry. It never shows partial or sample rows.

### Founder / CEO / Co-founder: data contract for Codex

All props are plain, serialisable values loaded on the server after the management guard (role + `aal2`). Actions are server actions that **must re-validate** and return `{ ok: true }` or `{ ok: false, message }`. The UI only shows success after `ok: true`.

| Screen (component) | Props it needs | Source |
|---|---|---|
| Founder overview (`FounderOverview`) | `finance: { booking_value, commission }` or `null`, `waiting`, `mfaReady`, `teamSize` | `management_finance()` (branch); count of open critical/finance/expense work; MFA factor status per member (**new, server only**) |
| Access management (`AccessManagement`) | `members: [{ userId, name, role, office, mfa: 'verified'\|'not_set'\|null, lastActive }]`, `currentUserId`, `setMember(formData)`, `connected` | `management_members` + `profiles.role = 'admin'` rows (shown read-only). **New action:** `setMember` gets `user_id` or `email`, `role` (`ceo`/`co_founder`/`employee`/`none`), `office`, `note` (1–500 characters). It must be Founder-only, require MFA and be audited; it must block changes to the Founder's own role and to admin rows; for `email` it invites. |
| Founder approvals, CEO reviews, CEO "sent to Founder", team tasks (`WorkQueue`) | `items: [{ id, kind, subject, from, amount, when, status, actions }]`, `decide(formData{ id, decision, note })`, `connected` | `management_work` + `management_events`. `actions` must come from `catalog.decisions()` on the server. `decide` maps to `management_decide(id, approved\|returned\|completed, note)`. |
| CEO operations (`OpsToday`) | `counts: { checkins, rides, holds, sos }`, `alerts: [{ id, icon, tone, title, sub, href, action }]`, `offices`, `officesConnected` | Existing `booking_requests`, `cab_rides`, `cab_bookings` (pending + live hold), `sos_incidents`, `support_tickets` (IST day). Offices: `management_members` role employee + attendance work (branch). |
| Co-founder website (`CmsSections`) | `sections: [{ id, title, enabled, position, note }]` | `home_sections` (existing) |
| Co-founder onboarding (`OnboardingQueue`) | `partners: [{ id, name, sub, done: ['basic','rooms','photos','policies','kyc','review'], href }]`, `sendAction(formData{ partner_id })` | Derived from `partners`, `homestays`, `homestay_rooms`, `partner_kyc`. Send = `management_submit(partner, …)` (branch). |
| Co-founder add location (`LocationReview`) | `districts: [{ value, label }]`, `findMatches(formData{ name, district })`, `saveDraft(formData)`, `publish(formData)` | **New, Codex owns matching and autofill.** See below. |

**`findMatches` result.** It returns either:

```
{ status: 'ok',
  matches: [{ id, score: 0–100, name, sub, distanceKm|null, lat|null, lng|null,
              fields: { [key]: { value, source } } }],
  duplicate: { name, distanceKm|null } | null }
```

or `{ status: 'not_connected' }`.

- **Field keys:** `name, name_hi, district, region, kind, lat_lng, nearest_town, altitude_m, best_season, image_url`.
- **Sources:** `places | locations | osm | derived | suggested`. A field the person edits becomes `manual`.
- **What the UI sends** to `saveDraft` and `publish`: every field value, `field_sources` (JSON), `match_id`, and for publish `show_on_home` and `featured`.
- **Storing it:** there is no `field_sources` column today; it needs a schema decision. `publish` writes `locations` + `home_sections` and logs it via `management_cms_event` (branch).

### PR #18 review follow-up

- Apply `20261127160000_management_review_fixes.sql` after #18's existing migrations. Offboarding releases foreign-key assignments and returns an active assigned initiative to Planning. Reinviting updates the existing pending request, and the invitation page establishes the email session before calling the authenticated acceptance action.
- Location drafts are readable and editable only by their creating Co-founder after MFA. Place provenance uses table-specific columns. The Co-founder can send a completed homestay draft to Admin → Approvals → Homestays. KYC exposes only status within onboarding scope, and older open work is loaded before recent history.

### Codex backend integration (27 Nov 2026; review branch `codex/management-dashboards-integration`)

- Preserved Claude's role routes and admin layout. The temporary admin guard is replaced with `requireManagement`: member role is checked on every layout and page, and the Supabase authenticator assurance level must be `aal2`. A mismatched role is denied; the MFA gate displays `DashMfaNeeded` and the authenticator form. The admin switcher no longer offers other management roles; legacy admin profiles carrying a management membership cannot open `/admin`.
- Founder finance uses `management_finance`; team count and MFA readiness come from the Founder-only `management_people()` RPC. The RPC reads verified factors and last sign-in server-side. Founder audit merges the existing audit log with management events. Work queues read `management_work` with `catalog.decisions()` actions; `decide` re-checks membership, `aal2`, note length and current work state before `management_decide`. CEO offices use employee memberships and today's attendance in IST; the new `/employee` route lets an MFA-verified staff member check in once per day. Onboarding submission calls `management_submit` after checking the partner queue. UI acknowledgements are gated on `{ ok: true }`.
- Founder access changes call `management_set_member`, a transactionally audited, Founder-only, MFA-checked RPC. It rejects changes to Founder/admin roles and requires a 1–500 character reason. Email invitations need a server-only `SUPABASE_SERVICE_ROLE_KEY` and a Supabase redirect allowlist entry for `/management/invite`; if unset or email delivery fails, the action reports failure. New email invitees accept at `/management/invite` before MFA setup. Existing email accounts are assigned directly.
- Location drafts and publication use `management_location_draft`/`management_location_publish`. The latter atomically writes `locations`, `location_details`, the destinations `home_sections.data.hidden_location_ids` when hidden from home, and immutable `management_events`. Per-field provenance is stored as JSONB in `location_details.field_sources`; `nearest_town`, `altitude_m`, and the home flag live there too. Draft values and sources live in `management_location_drafts`. Local matches query `places` and `locations`; the server also requests OpenStreetMap Nominatim for user initiated searches. Missing values stay empty; publication requires a valid region and kind, and rejects exact name/district duplicates. A missing OpenStreetMap response is disclosed in the UI. Public Nominatim requires an application-wide limit of one request per second, caching, and attribution; the current per-process limiter does not guarantee a global bound across serverless instances. Configure a controlled geocoder before broad rollout. Official API and policy: https://nominatim.org/release-docs/latest/api/Search/ and https://operations.osmfoundation.org/policies/nominatim/ .
- D4/C1: a booking reads as **held** only while `status = pending` and `hold_expires_at > now()` in the admin monitor. The expiry job runs each minute and releases its active `cab_seat_holds`. An unreleased pending seat is still unavailable until that job runs. `cab_ride_seat_status` returns `{seat_no,status}` for active holds (`held` for pending, `confirmed` for confirmed). The legacy integer-array RPC remains available. Cab seat UI wiring is in the separate Cab and public-pages follow-up PR.

**Migrations:** `20261124185212_management.sql`, `20261125032017_leadership_invitations.sql`, `20261125033652_leadership_handoff.sql` are brought over from the management branch and were already present on staging; `20261127030300_dashboard_integration.sql`, `20261127030721_dashboard_privacy.sql`, `20261127031107_dashboard_validation.sql`, and `20261127031223_dashboard_audit.sql` were applied on staging `gboxcnxgdkcewstkxogt`. Production was not changed. Other older repository migration filenames still differ from historical staging migration versions; reconcile migration history before a CLI push or production release.

**Checks actually run:** Supabase staging returned success for all four new migrations. Five dashboard/seat RPC names were found afterward. With a transaction-scoped Founder identity and simulated `aal2`, `management_people()` returned two rows; the same simulated identity at `aal1` raised SQLSTATE 42501. With a transaction-scoped Co-founder identity, the restricted KYC summary read returned zero rows and draft/publish RPCs succeeded. The test transaction rolled back; follow-up counts showed zero temporary members, drafts, and locations. Staging has only one permanent Founder member, so signed-in CEO/Co-founder UI and the email delivery flow are not verified. Cab staging currently has zero live pending holds, pending bookings, and confirmed seats, so status mapping was checked against SQL and code rather than live seat transitions. `node --check` passed for the edited JS modules; `git diff --check` passed. `npm ci` could not run because this repository lacks `web/package-lock.json`; `npm install --offline` failed because the Supabase package was not cached. GitHub Actions Web build check run #53 completed successfully on the PR head: npm install, next build, public-page smoke, and account redirect checks all passed. A 360px signed-in browser run remains open.

**Known access gaps:** Founder and CEO operational monitors currently show counts without links to admin-only detail pages; dedicated management detail routes are still needed. Co-founder homepage content editing uses `/co-founder/cms`, while location additions use the source-tracked review flow. Onboarding links to admin-only pages are hidden. MFA status in the roster means a verified factor is enrolled; it does not assert that the person is currently at `aal2`.

**Current-main review:** PR #18 was reconciled with the squash-merged dashboard and Trip Planner changes, preserving the PR #17 fixes. A staged transaction with an `aal2` CEO verified that the Founder route membership condition and Founder directory RPC both deny this identity. The fixture rolled back. The Next.js production build passed locally after the role and MFA changes. Signed-in 360px acceptance and actual invitation delivery remain open. The Admin switcher only advertises a leadership destination when the same account also holds the matching team role and has completed MFA.

**Owner dual-role decision (27 Nov):** The same account can retain its existing Admin profile role and its independent Founder membership. Admin uses `requireAdmin` and its database permission continues to work at `aal1`. Founder remains gated by `requireManagement` and `aal2`. The staging-only migration `20261127043916_retain_independent_admin_access.sql` restored independent DB permissions. All three checks passed with a transaction-scoped Founder + Admin identity and the transaction was rolled back. The CEO alert again says “booking request(s)” in both languages. Production release still requires backup, history reconciliation, migration-first deployment, and signed-in staging acceptance.

### Original dashboard handoff items (see integration status above)

- D1. Replace the temporary `requireAdmin` guard in `ManagementFrame` (and each role page) with the management guard (`management_members` role + `aal2`). Wire `authorisedDashboards({ managementRole })` from that read and set `ADMIN_OPENS_MANAGEMENT = false`. Feed the "Not connected yet" parts from `management_*`.
- D2. Add the Founder-only `setMember` action and invite flow, plus the server-side MFA factor and last-sign-in read for the people list.
- D3. Location matching (`findMatches`), field-source storage, `saveDraft` and `publish`.
- D4. Confirm the "held" reading in the Booking monitor (pending + future `hold_expires_at`) against the booking rules.
- D5. Optional: a realtime refresh for `/admin/bookings`. Today it is server-rendered; the hold countdown refreshes the page when a hold ends.
- D6. Codex's branch also edits `web/app/admin/cms/page.jsx` and `web/lib/admin.js`; expect small merge conflicts with `web/app/admin/layout.jsx` (now uses `DashLayout`).

### Checks run: dashboards

- TypeScript transpile check of every new or changed JSX/JS file: all OK.
- Loader test (tsx, mock database): onboarding steps derive correctly (a pending stay with a room, 3 photos, rules and KYC gives 6/6; a draft gives basic only; a partner without a stay gives basic). Any query error returns `{ error: true }` with no rows. The IST day range for 08:00 IST is 26 Nov 18:30Z – 27 Nov 18:30Z.
- Harness, owner-view screens at 360px and 1280px in English and Hindi: no overflow. Access has no add or edit buttons when the action is not connected. Onboarding shows "Open in Approvals" for complete listings and "Help finish" otherwise.
- Local browser harness (not committed). The real components were bundled with esbuild, using stubs for `next/link` and `next/navigation` and invented test rows. It was run in Chrome via Playwright at 360px and 1280px, in English and Hindi, across 15 screens. Results:
  - No horizontal page overflow on any screen.
  - The switcher lists only allowed dashboards, and Esc or an outside click closes it.
  - An empty reason or note is blocked with an error.
  - When the server action returns `ok: false`, its message is shown and the dialog stays open.
  - The dialog closes and the page refreshes only after `ok: true`.
  - Founder and admin rows have no edit button.
  - Location flow: "Use this" stays disabled until a match is picked; missing fields are marked "needs you"; an edited field's chip changes to "entered by you"; draft and publish messages appear only after `ok: true`; "create new" starts with 9 empty fields.
  - The only console errors were the brand image and fonts, which do not exist in the harness.
- Not run here: `next build` (no packages in this sandbox). The GitHub "Web build check" and the Vercel preview on the PR are the build evidence.
- The admin pages need an admin sign-in, so they were not opened on the Vercel preview by me.

## Area 2: Homepage and public pages, as implemented

### Screens and routes

| Route | Change |
|---|---|
| `/` | Shorter hero (CMS `home_sections` hero title, subtitle and image still win). Tabbed search card. Four-icon services row. Theme photo cards. Place photo cards. Village-stay band with photo. Workation split with photo. Blue Instant Cab band. Culture (6 cards). Why us. Seasons. Photo closing banner. Photo credits. |
| `/destinations` | Photo header, filter panel (place search, region, kind, theme pills), result count, empty state with "clear filters" |
| `/villages` | Photo header, village tours, villages, partner call to action |
| `/homestays`, `/workspaces`, `/village-tours` | Photo header, filter panel, result count, empty state |
| `/about`, `/our-story` | Photo header and side photo. CMS text from `site_settings.pages`, or "coming soon" |
| `/our-office` | Photo header, CMS text if set, contact cards from `site_settings.contact` only, link to `/contact` |
| `/privacy`, `/terms` | Unchanged (plain layout) |

### Changed and new files

- `web/app/page.jsx`: rewritten around the same CMS blocks (`hero`, `themes`, `destinations`, `villages`, `itineraries`, `stays`, `workspaces`, `cabs`, `partner_cta`, `text`).
- `web/app/public-refresh.css`: all new styles, prefixed `rf-`.
- `web/app/destinations/page.jsx`, `web/app/villages/page.jsx`, `web/components/ListingPages.jsx` (`ListingList` only), `web/components/InfoPage.jsx`.
- New: `web/components/home/HomeSearch.jsx`, `web/components/PageHero.jsx`, `web/components/Photo.jsx`, `web/components/PhotoCredits.jsx`, `web/lib/photos.js`.
- New images: `web/public/img/thh/*.webp`, supplied by the owner and saved at their native size.

### Search card wiring (client only, existing routes)

| Tab | Asks for | Goes to |
|---|---|---|
| Stays | Place (PlaceSearch), guests | `/homestays?district=<place.district>&guests=N`. District is only set for listed places, not OpenStreetMap results. |
| Cab | From, to, date, seats | `/cab/find?date=&n=&from=<places.id>` or `&fromg=lat,lng|name` (same format as the cab search) |
| Trip plan | Destination | `/plan?place=<slug>` or `/plan?to=&lat=&lng=` (both already read by the planner) |

There is no Dates field on the Stays tab, because `/homestays` has no date or availability filter.

### Photos

- `web/lib/photos.js` lists every photo.
  - Wikimedia Commons files are used as remote URLs, with a fallback image from `/img`. Each licence (CC BY-SA 4.0 / 3.0 / 2.0, CC BY 2.0) was read from the Commons file page text via search. Attribution is shown by `<PhotoCredits>` on each page.
  - THH photos are files the owner supplied in chat.
- `Photo` switches to the fallback when a remote file fails to load, including when it fails before hydration.

### Data each screen uses (unchanged queries)

`getHomeSections`, `getThemes`, `getLocations`, `getItineraries`, `getListings(kind)`, `getSettings()` (`pages`, `contact`), PlaceSearch (`places`, `locations`). No new tables, columns or RPCs.

### Pending Codex and owner items: public pages

- **P1. Photo rights.** The owner supplied 9 photos (`/img/thh`) and has not yet confirmed rights for public use. A tenth (a thali with another business's logo) was left out. Get confirmation from the owner, or replace the photos.
- **P2. Self-host the Wikimedia photos (optional).** Download the listed files at the referenced widths into `/img`, keep the credits, and point `src` at the local copies. This removes the dependency on Wikimedia hotlinks.
- **P3. Homestay date and availability search.** If wanted, `/homestays` needs date filtering against `room_rates` and bookings. Then the Stays tab can add Dates.
- **P4. Our Office map.** `site_settings.contact` has no coordinates. Add `lat` and `lng` to show an OpenStreetMap pin.
- **P5. Theme images.** `themes` has no image column, so photos are mapped by slug in `THEME_PHOTO`. Add `image_url` to `themes` if admins should choose them.

### Checks run: public pages

- TypeScript `transpileModule` syntax check on all 10 changed or new JS and JSX files: passed.
- Vercel preview build for `1dc54f6`: success. This is the real `next build`.
- **Not run:** browser checks of the live preview from this session (vercel.app is not reachable here), and `npm install` / `next build` locally (no package network access). The same layout was checked at 360px and 1280px in the HD design preview (no horizontal scroll, no broken images, fallbacks work), but the Next.js pages themselves need checking on the Vercel preview.

## Area 1: Instant Cab, as implemented

### Screens and routes

| Route | Screen | Change |
|---|---|---|
| `/cab/find` | Ride results | Blue route details and pickup distance, green seat pill (CSS only). Card markup is unchanged. |
| `/cab/ride/:id?step=seats` | Seat selection | New top-view cabin, seat states, legend and desktop two-column layout |
| `/cab/ride/:id` (driver's own ride) | Ride details | New read-only "Seat map (passenger view)" with live taken seats. No booking controls; the existing "This is your ride" action is unchanged. |
| `/cab/ride/:id?step=confirm` | Review and book | Unchanged |
| Booking receipt popup | Opens after a successful booking reply | Adds Ride ID and a driver contact section |

### Changed files

- `web/lib/cab/pages/cab.js`
  - `seatsStep()` renders `vehicleCabin()` for every ride. It replaces both the photo-marker cabin (`/img/cab/seat-cabin-132.webp`, which this screen no longer uses; the file is kept) and the old schematic grid.
  - `loadTaken()` parses the RPC reply through `takenSeats()`.
  - `showBookingReceipt()` adds the Ride ID row and `receiptContact()`.
  - New helpers: `takenSeats`, `cabinBody`, `vehicleCabin`, `receiptContact`, and `ownSeatMap()` inside `ride()`.
- `web/app/cab/cab-booking.css`
  - Removed the photo-marker and schematic cabin rules.
  - Added the legend, top-view vehicle, seat states, desktop layout and receipt contact styles.
- `web/app/cab/cab-discovery.css`: colour accents for ride cards.

### Components and data each one reads

**`vehicleCabin(rows, { body, documented, seat })`**
- `rows` come from `seatLayoutFor(catalogue, variantId, ride.seats_total)` in `web/lib/cab/cab/seat-layouts.js`. When that returns null, they come from `illustrativeSeatRows(ride.seats_total)`.
- Each row is an array of `'driver'`, `null` (aisle) or a booking seat number.
- The driver cell is not a button and cannot be selected.

**`cabinBody(catalogue, variantId, rows)`**
- Picks the body outline from the model:
  - `van`: `vehicle_models.category` is `van` or `tempo_traveller`, or the layout has more than 3 columns.
  - `suv`: the category is `suv`.
  - `car`: everything else.

**Seat states**

| State | When it shows |
|---|---|
| `available` | Seat is not in the taken list |
| `selected` | Seat is in `st.seats` |
| `booked` | Seat is in the taken list |
| `held` | Only when the server reports seat status (see Codex item C1) |

Each state uses colour plus a mark (✓, ✕ or "Held"), and the seat's `aria-label` names the state.

**`takenSeats(reply)`**
- Today `cab_ride_taken_seats` returns `integer[]`. Booked and held seats arrive together, so the legend says "Booked or held".
- If the reply becomes `[{ seat_no, status }]`, seats with status `held` or `pending` show as Held, and the legend splits into Booked and Held.

**`receiptContact(booking, pending)`**
- Pending booking: no contact data is requested. The section says contact appears after the driver accepts.
- Confirmed booking: calls the existing `cab_booking_contact(p_booking)` and shows `name`, `phone` and `registration`.
- If that call fails or returns nothing, the section points to the booking page.

### Existing APIs used (contracts unchanged)

| API | Used for |
|---|---|
| `cab_rides` select | Ride |
| `cab_ride_taken_seats(p_ride)` → `integer[]` | Taken seats |
| `cab_driver_cards(p_ids)` | Driver card |
| `driver_reliability(p_driver)` | Trust panel |
| `cab_ride_vehicle_variants` (through `rideVehicleVariants`) | Variant lookup |
| `catalog()` (`vehicle_models`, `vehicle_variants`) | Seat layout and body outline |
| `request_cab_ride_idempotent(...)` | Booking. Unchanged: same arguments, same error handling for `P0001` and `23505`, same retry path. |
| `cab_booking_contact(p_booking)` | Driver contact. Now also called from the receipt for confirmed bookings, as the booking page already does. |

The popup still opens only after `request_cab_ride_idempotent` returns a booking with an `id` and status `confirmed` or `pending`. Authentication, schema, RLS, permissions and booking transactions are not changed.

### Pending Codex integration: Instant Cab

- **C0. Preview database.** The Vercel preview for this branch uses the live Supabase project (`kjuboknsxlsotzoibdnv`), because no preview environment variables are set. On 26 Nov 2026 the owner published a test ride (`50f4a1dd…`) from the preview. Point Vercel Preview to `thh-staging`, or agree on a test-data clean-up step. Rides and bookings made on the preview are real records.

- **C1. Held vs booked.** Return each taken seat's status, either from `cab_ride_taken_seats` or from a new RPC, as `[{ seat_no, status }]`. Status is `held` for pending requests and `confirmed` for booked seats. The UI already handles this shape. If you change the return type of the existing RPC, check other callers first (`drive.js`, admin).
- **C2. Ride rules.** The PRD lists luggage, smoking and pets rules per ride, and the approved preview shows them. `cab_rides` has no rules field, so the live UI does not show rules yet. Add a field and expose it, and the UI will render it on the card and the ride page.
- **C3. Mini seat-availability strip on result cards.** This is in the preview but not built, because it needs taken seats for many rides in one call. It would need a batched RPC, for example `cab_rides_taken_seats(p_ride_ids uuid[])`.
- **C4. Booking IDs in production.** The receipt shows `refOf(booking)` and `ride.ride_ref`. Confirm the server issues `THH-DDMMYYYY-NNNN` and `UK07-DDMM-YYYY-THH-NNNN` for new records.

### Checks actually run

- `node --check` on `web/lib/cab/pages/cab.js`: passed.
- **Browser harness:**
  - Setup: the real `cab.js`, `ui.js`, `i18n.js`, `seat-layouts.js` and the three stylesheets, loaded in Chrome through a local static server. Supabase, the store, places and the vehicle catalogue were replaced with test stubs.
  - Rides tested: Ertiga 7-seater, Urbania 12+D, Bolero (no documented layout) and a 9-seat Force Traveller (no documented layout, 5-column illustrative cabin).
  - Server replies tested: confirmed, pending, seat taken (`23505`) and timeout.
  - Result: 90 of 90 checks passed at 360px and 1280px. The checks covered:
    - seats placed from the layout rows, with the correct column count;
    - the driver cell;
    - disabled booked seats;
    - the selection limit message;
    - the total fare;
    - wide cabins staying inside the seat panel, not overlapping the summary, with seats at least 44px wide;
    - no horizontal scroll;
    - Booking ID and Ride ID in the popup;
    - contact shown only for confirmed bookings;
    - "seat taken" returning to the seat step with no popup;
    - timeout showing retry with no popup;
    - the driver's own ride showing a read-only seat map, with no seat buttons and no booking request.
  - One request returned 404 in the harness. It is a missing static asset in the test page (favicon or a stylesheet image), not app code.
- **Not run:**
  - `npm install` and `next build`, because this session has no network access for packages.
  - Tests against a real Supabase database.
  - Signed-in end-to-end runs on a Netlify preview.
  - Codex should run the build and the cab regression suite (`tests/db`) on this branch.

### Known issues

- **Fixed after Codex review (PR #14):** 5-column illustrative cabins overflowed at 360px and overlapped the summary on desktop. Seat size now follows the panel width (container query units), aisle-only columns get a 20px track, and the desktop ride page is widened to 1012px for the seat step.

- **Pre-existing, fixed for the new cabin only:** `h()` in `web/lib/cab/ui.js` assigns `style` objects with `Object.assign`, which ignores CSS custom properties. The old schematic seat grid's `--cabin-tracks` and `--cabin-columns` were never applied. The new cabin sets its variable with `style.setProperty`. Other callers that pass `--*` in `style` are unchanged.
- **Hindi:** new labels use the existing `L(en, hi)` helper. Hindi wording should be reviewed by a native speaker.
- **Popup checkmark:** in the harness screenshots the receipt popup's check mark looked empty. The popup's `cele-mark` styling and animation were not changed in this work. Check it on a real device.

---

## THH Work: Task Management slice (leadership dashboards)

**Branch:** `claude/thh-leadership-tasks` (from `claude/thh-phase-1-ui`, PR #30). Not merged. `main` not touched.
**Status:** Frontend only, running on sample data. Not connected to any backend.

### Scope

Founder, CEO and Co-Founder each get a `/work` page with the same workspace: Board, List and Activity tabs; filters for scope (mine, created, review), status, priority and search; a create dialog; and a detail dialog with the actions allowed for the current actor.

- Routes: `web/app/founder/work/page.jsx`, `web/app/ceo/work/page.jsx`, `web/app/co-founder/work/page.jsx` (each calls `requireAdmin`).
- Nav items added in `web/components/dash/ManagementFrame.jsx`.
- Demo: `web/app/ui-kit/work/` (gated by `ENABLE_UI_KIT=1` and not production).
- Components: `web/components/work/` (`WorkWorkspace.jsx`, `TaskViews.jsx`, `TaskForm.jsx`, `ActionDialog.jsx`, `i18n.js`).
- Model: `web/lib/work/task-model.js` (state machine, relations, review gate, version checks; UI mirror only, the server must enforce all of it), `web/lib/work/sample-tasks.js` (fictional people and tasks, labelled as sample data).
- Shared fixes: `Dialog.jsx` Escape now uses a document-level stacked listener, so only the top dialog closes.
- Styles: THH Work block appended to `web/styles/ui.css`.
- Tests: `web/test/work-model.test.js`.

### Contracts

See `docs/DATA-CONTRACTS.md`. It lists the entities, the status model, the action table, the error codes, the adapter interface and the proposed tables for Codex.

### Codex requirements

1. Tables: `work_tasks` and `work_task_events` (append-only), plus the people/relation source (Codex to decide).
2. One RPC per action, each checking relation, `expectedVersion`, status, input and review gate in one transaction, and writing the event.
3. Idempotency on (actor, idempotencyKey).
4. RLS: read only for creator, assignee, reviewer or an allowed dashboard role; no direct writes.
5. Notifications on each state change.
6. Middleware protection for `/founder/work`, `/ceo/work`, `/co-founder/work`.
7. Service worker must not cache task responses or management pages.
8. Decide what counts as a sensitive task for Founder final approval.
9. Decide what to do with the existing `management_work` table (not compatible; see DATA-CONTRACTS section 10).

### Blockers

- **No staging deploy.** Codex deploys. Nothing has been deployed.
- **No package install.** Network access for packages is off in this session. The tests run on a stand-in runner, not real Vitest.
- **No real Vitest or axe run.** Accessibility checks were manual and in the browser harness only.
- **No `next build`.** Codex should run build and the Playwright spec against `next dev` or a preview.
- **No backend.** The UI shows a "not connected" state when `source` is null, and sample data when it is `'demo'`.

### Checks actually run (stand-in harness)

- Unit: 138 of 138 passed (stand-in runner).
- UI kit browser checks: 59 of 59 passed.
- Work flow browser checks: 31 of 31 passed. These cover desktop light and mobile dark board views, and the create, act and reset flow.
- Screenshots: `docs/ui-previews/task-slice/`.

### Phase-order note

The master spec places THH Work (Module 07) after the Phase 3 gate, and says Phase 0 is read-only. The Founder approved this Task slice explicitly on 2026-11-28, so it proceeds. The sample-data state is clearly labelled, and nothing is saved.

### Next slice

Awaiting approval. Proposed next: Task and project management (per the approved sequence), or Activity Center if preferred.

---

## Step 02: Leadership & company management (frontend)

**Branch:** `claude/thh-step02-leadership`, created from `integration/thh-unified-baseline-v1` (f5505c7) with `claude/thh-leadership-tasks` (bc8b374, which contains Phase 1 `093628f`) merged in. Draft PR targets `integration/thh-unified-baseline-v1`. `main`, PR #30 and the task branch are untouched.
**Status:** frontend complete for every Step 02 module, running on **not-connected** adapters on real routes. Only five read-only views use live data (existing RPCs). **Not functionally complete** until Codex ships the contracts in `docs/DATA-CONTRACTS.md` §13–26 and they pass integration tests.

### What was built

- **Module engine** (`web/lib/modules/`, `web/components/modules/`): one declarative registry of 15 modules → role-scoped sections (table, form, timeline, calendar, ID card, chat, integrations, preferences, permission matrix, reports, research, attendance, emergency, hierarchy, live views). Shared table section: filters, search, sorting, phone card layout, pagination, record dialog with version comparison and history, server-provided actions with required notes, create dialogs with validation, CSV export (formula-injection safe), offline drafts for village forms.
- **Adapters:** `notConnectedAdapter` (real routes; returns `INTEGRATION_UNAVAILABLE`, never shows or saves anything), demo adapter (only `/ui-kit/modules`, labelled sample), and the `backend` adapter slot for Codex (same 4 methods).
- **Routes:** 35 module pages under `/founder`, `/ceo`, `/co-founder` (list in DATA-CONTRACTS §26), each via `ModuleRoute` → `requireManagement(role, path)` + aal2. Sidebar gets a "Company tools" group after the approved items (built from the registry). Approved pages are unchanged.
- **THH Work:** Calendar, Projects (THH-PRJ IDs, milestones), Reports tabs; task detail adds subtasks, comments, collaborators, attachment/reminder placeholders. Work pages now use `requireManagement` (was the temporary `requireAdmin`) and pass the session user as actor.
- **Live (real) data, read-only:** approval Live queue (`management_work` via approved `WorkQueue` + existing `decide` action), Founder leadership list (`management_people`), Founder/CEO management events, office staff today (`loadOffices`), Founder booking-value totals (`management_finance`, labelled not a ledger).
- **Surface:** module content wraps in `data-surface="enterprise"` (Navy/Blue/Teal) inside the approved dashboard shell, per the Phase 1 decision.
- **Fixes:** Work demo reset now resets; module timeline class renamed `.ui-feed` (it had collided with Work's `.ui-timeline`); grid columns `minmax(0,1fr)` stop wide tables pushing pages sideways on phones.

### Shared-file changes to note (Codex coordination)

`web/components/account/AccountNav.jsx` (optional `{ heading }` items; chips skip them), `web/components/dash/ManagementFrame.jsx` (nav append), `web/lib/privacy/clear-private-caches.js` (`DRAFT_PREFIX`, `clearOfflineDrafts`), `web/styles/ui.css` (appended Step 02 block), `web/app/{founder,ceo,co-founder}/work/page.jsx` (guard). No migrations, RLS, auth or API files were changed.

### Codex requirements (in priority order)

1. Approval engine (`approval_requests`, decide with version + no self-approval + Founder stage, separate execution + audit). Decide the sensitive-category list with the Founder.
2. Task tables + action RPCs; return `allowedActions` per row (§11a reconciliation with `transitionTask`).
3. People (`employees` with THH-EMP IDs, departments, personnel actions via approval, session revoke on suspension).
4. Workforce (attendance server time, leave + balances — policy decision needed), Connect (participant-only RLS, realtime), Activity feed + notifications.
5. Village tables (first office Surmoli, Deghat, Almora, Uttarakhand via approved request), Capital accounting APIs, Growth, Control (sessions, emergency suspension), integrations status endpoint, storage bucket with signed URLs, report/PDF export.
6. Wire `clearPrivateCaches()` and `clearOfflineDrafts()` into sign-out; confirm the service worker never caches the 35 new routes.
7. Build the `backend` adapter (or tell me the endpoint shapes and I will build it) and run the checks below on staging.

### Checks actually run (this session — no network, no package installs)

- Unit (stand-in runner on esbuild, not real Vitest): **171/171** — includes 43 new tests for validation, IDs, CSV safety, adapters (version, transition, note, approval routing, idempotency, scope) and registry integrity (every role/module route exists and is guarded, no sample imports on real routes, labels bilingual, nav icons exist).
- Bundle check of all 90 new/changed source files with esbuild (stand-in for `next build`): **90/90**.
- Contracts typecheck (`tsc -p tsconfig.contracts.json`): pass. `check:dark`: up to date.
- Browser (Chromium via Playwright library, sample-data route): **53/53** modules checks (all 3 roles × every module × every tab = 140 panels at 1280 light and 360 dark: sample banner, no horizontal overflow, basic a11y checks, no console errors; plus approval, people, leave, attendance, CSV, offline draft, chat, integrations, research, suspension, ID, Hindi flows), **31/31** Work, **59/59** UI kit.
- **Not run:** `npm install`, ESLint, real Vitest, `next build`, `@playwright/test` specs (`web/e2e/leadership-modules.spec.js` added, unrun), axe, auth/MFA, RLS/role access, database persistence, staging preview, PWA security, website regression. These need Codex's environment.

### Blockers

- No backend contracts for any Step 02 module yet → management tools are not functional on real routes (they show "Not connected yet").
- No package install / network in this session → no real lint, test, build or axe runs.
- No staging deploy access from this session.
- Business decisions pending: sensitive approval categories, leave policy and balances, who may publish company-wide announcements, office creation authority.
- Providers not configured (email, WhatsApp, push, Maps, AI, calendar, storage) — shown as "status unknown/not configured", never simulated.

Screenshots: `docs/ui-previews/step-02/`.
