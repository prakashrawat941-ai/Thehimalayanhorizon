# Step 02 migrations — what changed and how to roll back (staging)

Applied to staging `gboxcnxgdkcewstkxogt` only, 28 November 2026. Production untouched.
Roll back in reverse order, inside one transaction, **after** taking a backup. Rolling back drops Step 02 data
(approvals, employees, offices, claim codes); export those tables first if they hold anything worth keeping.
Do not delete rows from `supabase_migrations.schema_migrations` by hand — record the rollback as a new migration.

| Version | Name | Changes | Rollback |
|---|---|---|---|
| 20261128040520 | step02_permissions_and_claims | `role_permissions`, `private.has_permission`, `my_permissions`, `permission_matrix`, `private.invitation_claims`, `management_issue_claim_code`, `claim_leadership_account`; `management_set_member` accepts coo/manager; `accept_leadership_invitation` refuses while an issued claim code is unverified | Drop the two new functions, `permission_matrix`, `my_permissions`, `private.has_permission`, `private.invitation_claims`, `public.role_permissions`. Restore `management_set_member` and `accept_leadership_invitation` from `20261127160000_management_review_fixes.sql` / `20261127030300_dashboard_integration.sql` (the definitions before this version). |
| 20261128040252 | step02_function_access_review | Revoked anon execute on `cab_ride_seat_status` | `grant execute on function public.cab_ride_seat_status(uuid) to anon;` |
| 20261128040110 | step02_approval_actions_fix | Corrected `private.approval_allowed_actions` | Superseded only; roll back together with the approval engine. |
| 20261128035831 | step02_approval_engine | `approval_policies`, `approval_requests`, `approval_decisions`, `private.idempotency`, approval RPCs and helpers | `drop function public.approval_*` (8), private approval helpers (12), then `drop table public.approval_decisions, public.approval_requests, public.approval_policies, private.idempotency;` (drop the append-only and no-delete triggers first). Offices created by approvals keep their rows but lose the `approval_id` link. |
| 20261128035510 | step02_org_core | coo/manager roles, `private.api_error`, `private.require_member`, `private.public_id`, `private.employee_code`, audit helpers, `departments`, `offices`, `employees`, `office_assignments`, member→employee sync trigger, `id_counters` kinds, dropped empty `public.table_name` | Drop trigger `management_members_sync_employee`; drop tables `office_assignments`, `employees`, `offices`, `departments` (drop their no-delete triggers first); drop the helper functions; delete counter rows `emp_*`, `office`, `approval` from `private.id_counters`; restore role checks to `('founder','ceo','co_founder','employee')` and `('ceo','co_founder','employee')` only after removing any coo/manager members. Recreate `public.table_name` with the DDL in the migration comment if ever needed (it had 0 rows). |
| 20261128035123 | step02_security_hardening | Revoked unsafe grants on `audit_log` and `notifications`; append-only triggers on `audit_log` and `management_events`; RLS on `private.id_counters` | Not recommended. If required: drop the four `*_append_only` / `*_no_truncate` triggers and `private.forbid_history_change`; re-grant only what a specific feature needs (never TRUNCATE to API roles). |

## Verification after any rollback

Run `tests/db/management-review-test.sql`, `tests/db/homestay-test.sql`, `tests/db/cab-phase2-test.sql` and the Supabase security advisor.
