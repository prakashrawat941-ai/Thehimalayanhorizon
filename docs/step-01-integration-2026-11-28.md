# Step 01 integration verification — 28 November 2026

Branch: `integration/thh-unified-baseline-v1`; baseline: `f5505c72a0d8ba3152e739be16402052c267b207`.

## Nine pull requests

| PR | Treatment |
| --- | --- |
| #4 | Management foundation already represented by #18; old migrations and old Workspace UI deliberately excluded. |
| #11 | Responsive management workspaces already superseded by #18; old dashboard UI excluded. |
| #16 | Publication predicate and approval validation cherry-picked; production data change in PR body was not repeated. |
| #18 | Included in baseline, not applied again. |
| #21 | Cab inventory and public listing changes cherry-picked; preserved the approved refreshed homestay card in the date-filter conflict. |
| #27 | Contact privacy and room closure changes cherry-picked; staging migration applied and fixture rerun. |
| #28 | Included in baseline, not applied again. |
| #29 | Frontend foundation integrated; UI-facing contracts are proposed, not proof that backend resources exist. |
| #30 | Alternative frontend foundation remains draft: its theme, primitives and contracts overlap #29. Needs Claude/Founder visual comparison and a single canonical contract before selected additions can be taken. |

## Staging database

Staging project `gboxcnxgdkcewstkxogt` only. Migration `cab_public_followups` was already recorded under `20261127041210`, so it was not rerun. `partner_booking_privacy_room_caps` applied successfully under ledger version `20261128022625`; the integrated SQL filename matches that actual ledger version. Contact table, masking trigger and anonymous RPC denial checked after application. The staging ledger and local historical migration filenames still diverge: 19 ledger-only versions (including `20261127172011_leadership_employee_login`) and 20 local-only versions. Do not replay or repair migration history by guessing; recover the canonical original migration source and compare schema effects before any release migration.

## Checks and release gates

- `npm ci`, `npm test` (21/21), contracts typecheck, Next.js build and leadership routing check passed locally with explicit staging configuration. The middleware now requires sessions for all management route prefixes and marks private responses `no-store`.
- Staging rollback fixtures: cab 84/84, homestay 41/41, management review 11/11. Homestay contact masking, room inventory and cab seat/retry rules passed in these single-transaction fixtures. Simultaneous client concurrency and real user sessions were not exercised.
- RLS is enabled on every public table; `driver-docs` and `partner-docs` storage buckets are private. Supabase security advisor reports callable security-definer functions; review public RPC bodies and grants before sign-off. The `private.id_counters` table has no RLS and is outside exposed schemas.
- Actual Founder, CEO and Co-Founder browser login, Google callback, TOTP, role isolation, customer/partner/employee onboarding, notification delivery, staging E2E and manual 360 px visual checks remain unverified. Leadership memberships currently count Founder 2, CEO 2, Co-Founder 3; do not identify accounts by assumption.
- Playwright browser execution was blocked: its Chromium binary is absent and browser download returned HTTP 403. Unit and DB fixtures do not replace signed-in browser acceptance.
- No main merge, production database change or production deployment. Step 02 remains gated on Founder approval.
