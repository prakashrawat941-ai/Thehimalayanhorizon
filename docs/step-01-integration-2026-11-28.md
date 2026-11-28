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

## Follow-up acceptance checkpoint

Integration base `02e35dcd61510a125fbf73aba6e6705b12face85` includes PR #38. This follow-up restores the staged employee login migration to the repository and documents the ledger mapping. The restored migration has normalized MD5 `aba907ea6ea15526dff34876bf87417e` on both the repo and staging ledger after trimming terminal delimiters. No migration has been replayed during this checkpoint.

- Staging rollback regressions passed: Cab 84/84, Homestay 41/41, Management 11/11. Local Next.js build, contracts typecheck and Vitest 21/21 passed.
- Invitation landing now opens before sign-in so the browser can receive the Auth fragment. Account acceptance still requires a valid verified identity through the existing server action and RPC. The landing and private redirects remain no-store.
- The service worker now precaches a static bilingual offline page. Navigation uses no-store network requests, while only eligible public assets are persisted. The previous dynamic offline route stays available for existing links.
- Signed-in acceptance remains open. Staging has 2 Founder, 2 CEO and 3 Co-Founder memberships with verified MFA factors. This aggregate shows enrollment only. It does not verify the owner-designated accounts' fresh sessions, MFA challenges or cross-role isolation. Verify using authorized role holders without changing identities.
- The staging security advisor still reports exposed security-definer RPC warnings and leaked-password protection. Review active grants and provider configuration before deployment approval. A callable RPC warning is not by itself a demonstrated access-control defect.
- Staging contains Claude's six Step 02 migrations. PR #39 contains the frontend reconciliation, independently of this foundation fix. The task store and live task adapter, company workflow acceptance and independent management shell are outside this checkpoint.

### Role-holder acceptance

On the exact staging candidate, each role holder signs in and completes MFA, opens the intended dashboard, refreshes, and checks that disallowed role routes return denial. The existing Founder and Admin account should switch between /founder and /admin. Run an invite for a designated staging test inbox and verify the role assignment and audit record. Report roles and outcomes without credentials. Public, PWA and booking regression evidence is supplemental to this signed-in acceptance.
