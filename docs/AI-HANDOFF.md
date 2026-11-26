# AI handoff: THH UI refresh

Owner: Prakash Singh. Frontend and UI: Claude. Backend integration, permissions, booking correctness, data validation and final verification: Codex.

| Item | Value |
|---|---|
| Branch | `claude/thh-ui-refresh` (from `main` at `8e6291c`) |
| Instant Cab code commit | `1f62b603876105b5d41919cb8e67b9a9f935784c` |
| Pull request | Not opened yet. One review PR is opened after all four approved areas are on this branch. |
| Merge or deploy | Not done. Needs the owner's approval. |

## Design previews (claude.ai artifacts, private to the owner)

Every value in these previews is demo data, and each preview is labelled as such.

| Area | Preview | Approval |
|---|---|---|
| 1. Instant Cab booking | https://claude.ai/artifact/VRH2V9ftq3ZKPLGJx278bp | Approved 26 Nov 2026; implemented (see below) |
| 2. Homepage and public pages | Not started | — |
| 3. Founder, CEO, Co-founder and Admin dashboards | Not started | — |
| 4. Trip Planner and Trip Report | Not started | — |

An earlier all-in-one preview (https://claude.ai/artifact/K2uJ3wuzDYM4LBo6qvoYr3) was rejected and is superseded.

## Area 1: Instant Cab, as implemented

### Screens and routes

| Route | Screen | Change |
|---|---|---|
| `/cab/find` | Ride results | Blue route details and pickup distance, green seat pill (CSS only). Card markup is unchanged. |
| `/cab/ride/:id?step=seats` | Seat selection | New top-view cabin, seat states, legend and desktop two-column layout |
| `/cab/ride/:id?step=confirm` | Review and book | Unchanged |
| Booking receipt popup | Opens after a successful booking reply | Adds Ride ID and a driver contact section |

### Changed files

- `web/lib/cab/pages/cab.js`
  - `seatsStep()` renders `vehicleCabin()` for every ride. It replaces both the photo-marker cabin (`/img/cab/seat-cabin-132.webp`, which this screen no longer uses; the file is kept) and the old schematic grid.
  - `loadTaken()` parses the RPC reply through `takenSeats()`.
  - `showBookingReceipt()` adds the Ride ID row and `receiptContact()`.
  - New helpers: `takenSeats`, `cabinBody`, `vehicleCabin`, `receiptContact`.
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

- **C1. Held vs booked.** Return each taken seat's status, either from `cab_ride_taken_seats` or from a new RPC, as `[{ seat_no, status }]`. Status is `held` for pending requests and `confirmed` for booked seats. The UI already handles this shape. If you change the return type of the existing RPC, check other callers first (`drive.js`, admin).
- **C2. Ride rules.** The PRD lists luggage, smoking and pets rules per ride, and the approved preview shows them. `cab_rides` has no rules field, so the live UI does not show rules yet. Add a field and expose it, and the UI will render it on the card and the ride page.
- **C3. Mini seat-availability strip on result cards.** This is in the preview but not built, because it needs taken seats for many rides in one call. It would need a batched RPC, for example `cab_rides_taken_seats(p_ride_ids uuid[])`.
- **C4. Booking IDs in production.** The receipt shows `refOf(booking)` and `ride.ride_ref`. Confirm the server issues `THH-DDMMYYYY-NNNN` and `UK07-DDMM-YYYY-THH-NNNN` for new records.

### Checks actually run

- `node --check` on `web/lib/cab/pages/cab.js`: passed.
- **Browser harness:**
  - Setup: the real `cab.js`, `ui.js`, `i18n.js`, `seat-layouts.js` and the three stylesheets, loaded in Chrome through a local static server. Supabase, the store, places and the vehicle catalogue were replaced with test stubs.
  - Rides tested: Ertiga 7-seater, Urbania 12+D and Bolero (no documented layout).
  - Server replies tested: confirmed, pending, seat taken (`23505`) and timeout.
  - Result: 54 of 54 checks passed at 360px and 1280px. The checks covered:
    - seats placed from the layout rows, with the correct column count;
    - the driver cell;
    - disabled booked seats;
    - the selection limit message;
    - the total fare;
    - no horizontal scroll;
    - Booking ID and Ride ID in the popup;
    - contact shown only for confirmed bookings;
    - "seat taken" returning to the seat step with no popup;
    - timeout showing retry with no popup.
  - One request returned 404 in the harness. It is a missing static asset in the test page (favicon or a stylesheet image), not app code.
- **Not run:**
  - `npm install` and `next build`, because this session has no network access for packages.
  - Tests against a real Supabase database.
  - Signed-in end-to-end runs on a Netlify preview.
  - Codex should run the build and the cab regression suite (`tests/db`) on this branch.

### Known issues

- **Pre-existing, fixed for the new cabin only:** `h()` in `web/lib/cab/ui.js` assigns `style` objects with `Object.assign`, which ignores CSS custom properties. The old schematic seat grid's `--cabin-tracks` and `--cabin-columns` were never applied. The new cabin sets its variable with `style.setProperty`. Other callers that pass `--*` in `style` are unchanged.
- **Hindi:** new labels use the existing `L(en, hi)` helper. Hindi wording should be reviewed by a native speaker.
- **Popup checkmark:** in the harness screenshots the receipt popup's check mark looked empty. The popup's `cele-mark` styling and animation were not changed in this work. Check it on a real device.
