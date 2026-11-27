# AI handoff: THH UI refresh

Owner: Prakash Singh. Frontend and UI: Claude. Backend integration, permissions, booking correctness, data validation and final verification: Codex.

| Item | Value |
|---|---|
| Instant Cab | Merged to main in PR #14 (`b2cd6fa`, 26 Nov 2026) at the owner's request |
| Public pages | Merged to main in PR #15 (`b11baa9`, 26 Nov 2026) at the owner's request |
| Trip Planner (area 4) | Branch `claude/thh-trip-planner`, now based on main after PR #17. Code commit `691339c`. Review PR: https://github.com/prakashrawat941-ai/Thehimalayanhorizon/pull/19 (base `main`). Not merged; needs the owner's approval. |
| Dashboards (area 3) | Merged to main in PR #17 (`a303710`, 27 Nov 2026) at the owner's request, after fixing 4 Codex review findings (booking route order, room counts for tours/workspaces, homestay-only check-in KPI, homestay-only onboarding queue). |

## Design previews (claude.ai artifacts, private to the owner)

Every value in these previews is demo data, and each preview is labelled as such.

| Area | Preview | Approval |
|---|---|---|
| 1. Instant Cab booking | https://claude.ai/artifact/VRH2V9ftq3ZKPLGJx278bp | Approved 26 Nov 2026; implemented (see below) |
| 2. Homepage and public pages | https://claude.ai/artifact/5J12rL8aEzxvExJgaZT3n5 (layout) and the HD preview at `/design-preview/public-pages.html` on branch `claude/thh-public-preview` | Approved 26 Nov 2026; implemented (see below) |
| 3. Founder, CEO, Co-founder and Admin dashboards | https://claude.ai/artifact/7N3W4hcriB1nS2MBwniViw | Approved 27 Nov 2026; implemented (see below) |
| 4. Trip Planner and Trip Report | https://claude.ai/artifact/TjyUeTJMSW1ueGfotfDR6G (v2) | v1 changed at the owner's request; v2 approved 27 Nov 2026 with price option B (paid fuel-price API); implemented (see below) |

An earlier all-in-one preview (https://claude.ai/artifact/K2uJ3wuzDYM4LBo6qvoYr3) was rejected and is superseded.

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

### Pending Codex items: dashboards

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

### Trip live-data integration

- T1: Server-only SSR Innovation Lab adapter caches successful prices by state, district and IST date. Configure `TRIP_FUEL_API_URL`, `TRIP_FUEL_API_KEY`, and an approved HTTPS `TRIP_REVERSE_GEOCODER_URL` with a Nominatim-compatible response. The provider must specify the observation date and confirm coverage in the target districts. Its public example has no price date, so that response is deliberately rejected. Missing configuration returns `not_connected`; no placeholder price is displayed.
- T2: `/api/trip/route-pois` queries OpenStreetMap through Overpass for bounded route geometries, snaps and deduplicates the results, and flags stretches over 50 km with no **mapped** fuel stop. Set `TRIP_OVERPASS_URL` to a suitable hosted instance if needed. In `TRIP_TOLL_RATES_JSON`, each entry is keyed by OSM element ID (such as `node/123`) and contains `date`, `source` and `classes`, using the `car`, `motorcycle` and `bus` keys. Populate entries only from checked one-way tariffs. Missing rates remain unknown. The toll total uses known rates only and retains the count of unknown rates.
- T3–T4: Body and fuel type set a typical mileage estimate. CNG uses km/kg, private fares are kept separate from bus/train, incomplete road routes cannot produce a fuel total, and user rate overrides still take precedence.
- T5: Deferred. No room estimate is inferred from list prices without checking availability.
- Verified: `node tests/web/trip-live.mjs` passed the dated district parser, bounded route and POI logic, tariff class and deduplication, fuel gap and CNG budget tests. The paid key, dated district response and actual toll tariff catalogue remain staging dependencies.

- Staging-oriented local HTTP smoke: the credential-free fuel endpoint returned `not_connected`, invalid route input returned HTTP 400, and a valid route returned HTTP 502 when the Overpass upstream was not reachable. The live provider and POI network path still require staging acceptance. The fallback admin price matches the selected fuel only.

**Provider shortlist (27 Nov 2026).** SSR Innovation Lab is the first district-level option to trial. It advertises petrol, diesel and CNG for Uttarakhand districts, but a monthly quote and a dated response for Almora, Nainital and Pithoragarh are needed before purchase. API Express advertises daily city or PIN-code data and lists Growth at ₹4,999/month, or a free sandbox. Energy API advertises daily city data on Professional at US$49.99/month. Neither alternative has verified district-wide prices for those districts. Do not substitute a city or statewide price silently.
