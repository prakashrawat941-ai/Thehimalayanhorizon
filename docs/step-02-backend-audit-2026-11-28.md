# Step 02 backend — Phase 1 audit and gap analysis (28 November 2026)

Read-only phase. No migration, RLS, data or deployment change was made. Staging (`gboxcnxgdkcewstkxogt`) and production (`kjuboknsxlsotzoibdnv`) were only queried.

Branch for the backend work: `claude/thh-step02-backend`, from `integration/thh-unified-baseline-v1` @ `1a09450`.

## 1. Repository state

| Ref | Head | Note |
|---|---|---|
| `integration/thh-unified-baseline-v1` | `1a09450` | Step 01: PR #29 frontend foundation + #18/#28 + #16/#21/#27. Canonical per owner. |
| `claude/thh-step02-leadership` (PR #31, draft) | `d5637fd` | Step 02 frontend, built on PR #30's foundation. **Conflicts with integration** (AI-HANDOFF, `app/layout.jsx`, `DashLayout.jsx`, `package.json`). |
| `claude/thh-phase-1-ui` (PR #30, draft, base `main`) | `093628f` | Owner: keep draft; take only non-duplicative pieces onto integration. |
| `codex/thh-task-management-backend` | `8c0a5c0` | One pure validator (`web/lib/management/task-transitions.mjs`); no tables or RPCs. |
| `phase-2/rbac-guards`, `feature/thh-management-security-foundation` | Nov 24–26 | PR #4/#11 lineage, deliberately excluded in Step 01. Ideas only. |

## 2. What already exists and will be reused

Server-side MFA is already real: `private.management_role()` returns a role only when `auth.jwt()->>'aal' = 'aal2'`, and every management RPC goes through it. `requireManagement()` repeats the check in Next.js.

| Area | Existing (staging) | Reuse plan |
|---|---|---|
| Leadership identity | `management_members` (founder/ceo/co_founder/employee + office), `leadership_invitations` + `invite_leadership` / `accept_leadership_invitation` (7-day, email-confirmed, advisory lock, protected Founder/admin), `management_set_member`, `private.leadership_employee_ids` + `management_set_leadership_employee_id` | Keep as the account/claiming backbone; extend to employees table. |
| Work queue / approvals v0 | `management_work` (kinds, open/approved/returned/completed, request_key idempotency), `management_events` (append-only via RPC), `management_submit`, `management_decide` (no self-approval, note required, row lock) | Becomes the compatibility layer; new approval engine supersedes it with versioning and stages. |
| Initiatives | `create_initiative`, `advance_initiative` (Founder → CEO plan → assignee → CEO review → Founder) | Expose as Strategy list. |
| Destinations | `location_details`, `management_location_drafts`, `management_location_draft/save/publish`, `validate_location_fields` (sources required) | Destinations & research module. |
| Partners | `partners`, `partner_kyc`, `homestays`, `homestay_rooms`, `management_partner_queue`, `management_onboarding_kyc`, `management_submit_homestay` | Partners & listings module. |
| Support | `support_tickets`, `ticket_messages`, `open_ticket`, `post_ticket_message`, CEO read policy | Customers & support (extend with priority/assignee/SLA). |
| Finance | `management_finance` (booking totals), `payout_requests`, `admin_process_payout` | Capital read models; payouts stay admin-only. |
| Notifications / audit | `notifications` (own read/update/delete), `notification_log`, `audit_log` (Founder/admin read) | Reuse; harden grants. |
| Canonical contract | `web/contracts/management.ts` (#29): `ApprovalRequest`, `ApprovalStatus`, `EmployeeProfile`, `JournalEntry` (paise), `ConsequentialWrite`, same 12 error codes | Backend follows this contract; the Step 02 UI adapter maps to it. |

## 3. Gaps (nothing exists today)

| Module | Missing backend |
|---|---|
| Approval engine | `approval_requests` (versioned, stage routing, before/after snapshot), decisions table, execution step separated from approval, pending counts, notifications, duplicate prevention, `allowedActions` per row |
| THH Work | tasks, projects, milestones, subtasks, dependencies, comments, attachments (storage), task events, performance view, realtime |
| People | employees (permanent ID, department, manager, status), departments, candidates, personnel actions, employee documents, suspension → session revoke |
| Workforce | attendance (server time), leave + balances, holidays, schedules, performance view, report export |
| Connect | conversations, participants (participant-only RLS), messages, meetings, announcements, realtime |
| Activity | role-scoped activity view, per-user read state, export |
| Village Connect | offices (create via approval), office assignments, tourist registrations (protected phone), service requests, field verifications, local businesses, office ledger, daily reports, emergency alerts |
| Capital | journal/ledger tables in paise, budgets, expenses (approval ≠ payment), finance requests, commissions/payables/settlements/refunds read models, P&L |
| Growth | campaigns, ads, sponsored listings, content posts, referrals, SEO pages |
| Control | role/permission read model, session list + revoke, security alerts, incidents, backups status, health, emergency suspension |
| Integrations | provider status endpoint; storage bucket for leadership files |

## 4. Conflicts to resolve before building

1. **Two frontend foundations.** Integration uses PR #29 (`components/ui/index.jsx`, `styles/theme.css`, `contracts/management.ts`, tests in `tests/unit`). Step 02 UI uses PR #30 (`components/ui/index.js` + 18 files, `styles/tokens.css`, `lib/contracts/*`, tests in `test/`). Merged as-is, `@/components/ui` would resolve to `index.js` and shadow #29's exports, and integration's Vitest config would silently skip all `test/` files. Dependencies differ: lucide-react 0.468 vs 1.82, Vitest 2 vs 5, TypeScript 5 vs 7, @playwright/test 1.49 vs 1.65.
2. **Contract vocabulary.** Canonical `ApprovalStatus` (`pending_ceo`, `pending_founder`, `applying`, `applied`, `rolled_back`, …) and paise money differ from my DATA-CONTRACTS draft (`stage` + `status`, rupees). Backend will follow the canonical contract; DATA-CONTRACTS will be updated to match.
3. **Task rules.** Codex `transitionTask` vs UI model (DATA-CONTRACTS §11a): `revise` vs `request_revision`, no `start`, submit only at 100 %, approve → completed, reviewer ≠ assignee, no creator actions. Proposal: server is authority and returns `allowedActions`.
4. **Employee ID format.** Staging stores Founder-entered free-form codes (`^[A-Z0-9][A-Z0-9_-]{2,31}$`); my UI assumed sequential `THH-EMP-NNNN`.
5. **Migration history drift.** Staging ledger has 31 versions with different timestamps from repo filenames; `leadership_employee_login` (20261127172011) exists only in the ledger — its source is not in git. Repo has `remove_old_site`, which staging lacks. Codex's note: do not replay or repair by guessing.
6. **Production is far behind.** Production has 23 versions and none of: management, leadership_invitations, leadership_handoff, dashboard_*, management_review_fixes, leadership_employee_login, partner privacy, home extras. Any release needs a reviewed migration plan and Founder approval.

## 5. Security findings (staging)

| # | Severity | Finding | Proposed fix (Phase 2) |
|---|---|---|---|
| S1 | High | `audit_log` and `notifications` grant `anon` and `authenticated` INSERT/UPDATE/DELETE/**TRUNCATE**. RLS blocks row writes, but TRUNCATE bypasses RLS; audit is not immutable at privilege level. | Revoke all but SELECT from anon/authenticated; writes only via SECURITY DEFINER functions; block UPDATE/DELETE with a trigger. |
| S2 | Medium | `management_decide` has no version check (stale decisions possible) and no idempotency key. | New engine requires `expectedVersion` + idempotency; old RPC kept for compatibility, then retired. |
| S3 | Medium | 61 SECURITY DEFINER functions callable by `authenticated`, 13 by `anon`. Most guard internally; needs a per-function review. | Review list; revoke where not needed; new functions in `private` with thin public wrappers. |
| S4 | Medium | `public.table_name` — stray empty table (no policies). | Drop on staging (needs your OK — destructive). |
| S5 | Low | `private.id_counters` has RLS disabled (not in exposed schema). | Enable RLS, no policies. |
| S6 | Low | Leaked-password protection disabled in Auth. | Enable in Supabase Auth settings (dashboard toggle). |
| S7 | Info | `leadership_invitations`, `private.*` tables RLS-on with no policies (intended: RPC-only). | Keep; document. |

## 6. Testing and deployment capability

- **This session cannot install packages** (npm registry blocked), so local `npm ci`, ESLint, Vitest, `next build` and `@playwright/test` cannot run here. Chromium binaries exist locally.
- **GitHub Actions can run them.** `web-build.yml` (npm install + build + smoke) and `web-test.yml` (install, typecheck, Vitest, Playwright) run on pull requests touching `web/`; `web-build` is also dispatchable. A pull request with merge conflicts does not run them — PR #31 is currently `dirty`.
- **Real CI result I had not reported before:** on `claude/thh-phase-1-ui` (run 46066822522) install and typecheck passed and 69/69 tests passed, but 2 test files failed to load (`components.test.jsx` JSX parse; `contracts.test.js` because my Vitest config forces the JSX loader onto `.ts`). My earlier "all passing" figures came from a stand-in runner and were incomplete.
- **Previews:** Vercel and Netlify bots comment preview links on PRs; staging preview configuration exists (commit `d6fc026`). Which Supabase project each preview uses must be confirmed before acceptance.
- **Signed-in tests** need dedicated staging test accounts for Founder, CEO, Co-Founder and employee, with TOTP enrolled. Staging currently has 9 management members (Founder 2, CEO 2, Co-Founder 3 per Codex) — real people may be among them, so tests must not reuse them.

## 7. Proposed Phase 2 (database, security, approval engine) — for approval

1. Rebase plan: port Step 02 modules onto the #29 foundation (keep #30-only components that #29 lacks), one Vitest config, one contract.
2. Migrations (staging only, each with a rollback fixture in `tests/db`):
   - `step02_security_hardening`: S1, S5; drop `public.table_name` if approved.
   - `step02_core`: `employees`, `departments`, `offices`, `office_assignments`, public-ID counters (format per decision).
   - `step02_approvals`: `approval_requests`, `approval_decisions`, `approval_executions`, routing function (Co-Founder → CEO → Founder for designated categories), `allowed_actions()`; versioning, idempotency, no self-approval, immutable history, notifications, pending counts; bridge from `management_work`.
   - `step02_audit`: append-only `audit_events` with request IDs; triggers on all new tables.
3. pgTAP-style SQL fixtures (as Codex's `tests/db`) for role isolation, self-approval, stale version, duplicate request, Founder-stage routing, audit immutability.
4. Draft PR to integration so CI runs real install, build, Vitest and Playwright.
