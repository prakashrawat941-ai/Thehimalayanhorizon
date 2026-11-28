# DATA-CONTRACTS: Leadership & Company Management (Step 02)

Status: PROPOSED v0 for Codex review. Nothing in sections 1–12 or 13+ (except where marked LIVE) is implemented in the database or API yet.
Branches: task slice `claude/thh-leadership-tasks` (bc8b374); Step 02 frontend `claude/thh-step02-leadership`. Owner of schema, RLS, RPCs and business logic: Codex.

Sections 1–12 cover THH Work (tasks). Section 13 onward covers every other Step 02 module.

The UI currently runs on in-memory sample data (`web/lib/work/sample-tasks.js`) and labels itself as sample data. The `source` prop on `WorkWorkspace` is `null` (not connected), `'demo'` (sample data) or `'backend'` (the adapter below, not yet built).

## 1. Entities

### Task

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Internal primary key. |
| `publicId` | text | `THH-TSK-NNNNNN`, unique, server-issued. |
| `title` | text | Required, 3 to 160 chars. |
| `description` | text | Optional, up to 4000 chars. |
| `status` | enum | See section 2. |
| `priority` | enum | `low`, `medium`, `high`, `urgent`. |
| `creatorId` | uuid to people | Set on create. |
| `assigneeId` | uuid to people | Nullable until assigned. |
| `reviewerId` | uuid to people | Nullable. Required when `reviewRequired` is true. |
| `reviewRequired` | boolean | Enables the review gate (section 3). |
| `progress` | integer | 0 to 100. |
| `startDate`, `dueDate` | date | `dueDate >= startDate`. Overdue is computed, not stored. |
| `version` | integer | Starts at 1. Incremented on every accepted action. Used for optimistic concurrency. |
| `createdAt`, `updatedAt` | timestamptz | Server time. |
| `deletedAt` | timestamptz | Soft delete only, if at all. Not used by the UI. |

Overdue is a computed flag: `dueDate < today (IST)` and status is not `completed` or `cancelled`. Do not store it as a status.

### TaskEvent (append-only history)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `taskId` | uuid | |
| `action` | text | One of the action keys in section 4, or `create`, `update`. |
| `fromStatus`, `toStatus` | enum | |
| `actorId` | uuid | |
| `actorRelation` | text[] | Relations the actor held at the time: `creator`, `assignee`, `reviewer`. |
| `note` | text | Required for block, hold, cancel and request_revision (min 3 chars). |
| `evidence` | text or jsonb | Required for submit. Shape to be agreed (links or file refs). |
| `progress` | integer | Set by the progress action. |
| `version` | integer | Task version after this event. |
| `idempotencyKey` | text | Unique per actor. |
| `createdAt` | timestamptz | |

Events are never updated or deleted.

### People and relations

The UI reads `{ id, name, role, dept }` for each person. Roles used in the sample: Founder, CEO, Co-Founder. The UI does not decide who may act. It calls the server, which must check the relation (creator, assignee, reviewer) and the caller's dashboard permission.

## 2. Status model

Statuses: `draft`, `assigned`, `accepted`, `in_progress`, `submitted`, `revision_required`, `blocked`, `on_hold`, `approved`, `completed`, `cancelled`.

Board columns (UI grouping only): To do (draft, assigned, accepted), In progress (in_progress, revision_required, blocked, on_hold), In review (submitted), Done (approved, completed), Closed (cancelled).

## 3. Review gate

If `reviewRequired` is true, `complete` from `submitted` is rejected with `APPROVAL_REQUIRED` until the reviewer has moved the task to `approved`. The UI mirrors this, but the server is the authority.

## 4. Action endpoints

Every write is one of the actions below. Each call is a single RPC (or endpoint) that:

1. checks the caller's permission and relation,
2. checks `expectedVersion` against `version`,
3. checks the current status is in `from`,
4. validates the input (note, evidence, progress),
5. writes the new task row, one TaskEvent, and any notifications, in one transaction,
6. returns the updated task.

| Action | From | To | Allowed relation | Input |
|---|---|---|---|---|
| `create` | (new) | `draft` or `assigned` | any authorised manager | title, description, priority, dueDate, assigneeId, reviewerId, reviewRequired |
| `assign` | draft | assigned | creator | assigneeId |
| `accept` | assigned | accepted | assignee | |
| `start` | accepted | in_progress | assignee | |
| `progress` | accepted, in_progress, revision_required | (unchanged) | assignee | progress 0 to 100 |
| `submit` | in_progress, revision_required | submitted | assignee | evidence |
| `request_revision` | submitted | revision_required | reviewer | note |
| `approve` | submitted | approved | reviewer | |
| `complete` | submitted (no review gate), approved | completed | creator, reviewer | |
| `block` | accepted, in_progress, submitted, revision_required | blocked | assignee, creator | note |
| `unblock` | blocked | in_progress | assignee, creator | |
| `hold` | open states except draft, approved | on_hold | creator | note |
| `resume` | on_hold | in_progress | creator | |
| `cancel` | any open state | cancelled | creator | note |

Common write fields (`WriteMeta`):

- `expectedVersion` (integer, required for every action except `create`)
- `idempotencyKey` (string, required for every write; replays return the original result)
- `approvalRef` (uuid, optional; required only when the action needs approval under section 6)

Read endpoints: `list tasks` (filters: scope mine/created/review, status, priority, search by publicId or title, page, pageSize max 50), `get task` (with events), `list events for task`.

## 5. Error envelope and codes

Response: `{ success: true, data }` or `{ success: false, error: { code, message }, requestId }`.

Codes are the shared list in `web/lib/contracts/errors.ts` (message text is localised en/hi in the UI; the server sends only the code):

`AUTH_REQUIRED`, `MFA_REQUIRED`, `PERMISSION_DENIED`, `VALIDATION_FAILED`, `NOT_FOUND`, `CONFLICT`, `STALE_VERSION`, `APPROVAL_REQUIRED`, `INVALID_TRANSITION`, `DUPLICATE_REQUEST`, `INTEGRATION_UNAVAILABLE`, `INTERNAL_ERROR`.

Correction: an earlier draft of this file listed `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `UNAUTHENTICATED`, `INTERNAL` and `NETWORK_TIMEOUT`. Those are not in the shared list; use `DUPLICATE_REQUEST`, `AUTH_REQUIRED` and `INTERNAL_ERROR`. A rate-limit code needs agreement before it is added.

`VALIDATION_FAILED` may carry `error.fields: { [fieldKey]: errorKey }` so the UI can mark fields. `INTEGRATION_UNAVAILABLE` is what the UI's not-connected adapter returns until an endpoint exists.

`STALE_VERSION` means the UI must reload the task and show the message. It must not retry blindly.

## 6. Approval policy (applies to Task actions)

- Every Co-Founder operational change goes to CEO approval.
- Sensitive changes need Founder final approval.
- No self-approval: a person cannot approve or complete a task they both created and were assigned. The server must enforce this.

Which tasks count as sensitive is not decided yet. The UI does not yet show approval state beyond the review gate. This needs a decision before the Central Approvals slice.

## 7. Notifications and Activity Center (requirements, not built)

Each action that changes state creates notifications for the affected people (assignee, creator, reviewer). The Activity Center reads TaskEvents plus notifications, filtered by dashboard scope:

- Founder: company-wide.
- CEO: operations, employee work, Co-Founder change requests.
- Co-Founder: own department, website changes, technical tasks, partner onboarding.

Audit records are visible only to authorised roles.

## 8. Adapter interface (frontend side)

The workspace takes a `source` prop. For `'backend'` it must be given an adapter with this shape. The adapter is not built yet.

```ts
interface WorkAdapter {
  list(query: { scope: 'mine' | 'created' | 'review'; status?: string; priority?: string; q?: string; page: number; pageSize: number }): Promise<ApiEnvelope<{ items: Task[]; total: number }>>;
  get(id: string): Promise<ApiEnvelope<{ task: Task; events: TaskEvent[] }>>;
  create(input: TaskCreateInput, meta: WriteMeta): Promise<ApiEnvelope<Task>>;
  act(taskId: string, action: ActionKey, input: ActionInput, meta: WriteMeta): Promise<ApiEnvelope<Task>>;
}
```

`act` must never be called with a version the UI has not just read. On `STALE_VERSION` the UI reloads.

## 9. Proposed database objects (for Codex)

- `work_tasks` (section 1, with `public_id` sequence `THH-TSK-`).
- `work_task_events` (append-only; no update or delete grants).
- `work_task_people` or reuse of the existing people table, to be decided by Codex.
- RPCs: one per action in section 4, plus `work_task_create`, `work_task_list`, `work_task_get`.
- RLS: a user sees a task only if they are creator, assignee, reviewer, or hold a dashboard role that allows it. Writes go only through the RPCs.
- Idempotency table keyed by (actor, idempotencyKey).
- Notifications: reuse or extend the existing notifications mechanism if one exists.

## 10. Existing table incompatibility

The existing `management_work` table does not match this model. It has no version column, no event history, no reviewer relation, no review gate, and no public ID scheme. Do not reuse it for the Task slice without a decision. It may be migrated or left as-is, but the decision belongs to Codex.

## 11. Privacy and caching (Codex requirements)

- Task data is private. The service worker must not cache any `/founder`, `/ceo`, `/co-founder`, or `/api` response that contains task data.
- Middleware must protect the management prefixes (`/founder/work`, `/ceo/work`, `/co-founder/work`) as it does the rest of those dashboards.
- Clear private caches on sign-out (the existing `web/lib/privacy/clear-private-caches.js` should cover the new routes; verify).

## 11a. Reconciliation with Codex's `transitionTask` (branch `codex/thh-task-management-backend`, 8c0a5c0)

Codex's validator and this UI model agree on: version check, `accept`, `progress` (0–100 integer), note required for revision, reviewer-only approve/revise, and the review gate. They differ on:

| Topic | Codex `transitionTask` | UI model (`web/lib/work/task-model.js`) |
|---|---|---|
| Revision action name | `revise` | `request_revision` |
| Starting work | `progress` moves accepted → in_progress | separate `start` action |
| Submit | only at progress 100; without review → `completed` directly | at any progress; evidence required; `complete` is separate |
| Approve | `submitted` → `completed` | `submitted` → `approved`, then `complete` |
| Assignee as reviewer | reviewer must not be assignee | not checked (should be — add to UI mirror) |
| Creator actions | none (assign, hold, resume, cancel, block missing) | assign, block/unblock, hold/resume, cancel |
| No-auth code | `AUTH_REQUIRED` | n/a (UI never calls without session) |

Proposal: Codex's server is the authority. Each task row returned by the API carries `allowedActions: string[]` computed on the server, and the UI renders only those buttons (the UI mirror is then only for instant form validation). Please confirm the final action list; the UI will rename `request_revision` → `revise` and drop `start` if that is the decision.

## 12. Open questions for Codex

1. Confirm the table names and whether `work_task_people` is needed.
2. Confirm the RPC naming and the error envelope shape.
3. Decide evidence format for `submit`.
4. Decide which tasks are "sensitive" for Founder final approval.
5. Confirm the IST date source for overdue (server side or client side).


---

# Step 02 modules (sections 13+)

## 13. Shared rules for every module

- Every list read: `list(entity, { scope, filters, q, page, pageSize ≤ 50 })` → `{ items, total }`. Scope (`inbox`, `mine`, `history`, own department, etc.) is applied on the server from the session, never trusted from the browser.
- Every row carries `id` (public ID where the entity has one), `version`, `status`, `allowedActions[]` (server-computed) and optionally `history[]` (`{ action, from, to, note, at, actorName }`) and `pendingApproval` (action key waiting on approval).
- Every write: `create(entity, values, { idempotencyKey })` or `act(entity, id, action, { note, ... }, { expectedVersion, idempotencyKey, approvalRef? })`. Same envelope and codes as section 5.
- Actions marked **via approval** below do not change the record. The server creates an `approval_requests` row (section 14), sets `pendingApproval`, and executes only after approval.
- Files are never sent through these calls: the UI will request a signed upload URL (storage), upload, then send the storage path. Until storage exists, file fields return `INTEGRATION_UNAVAILABLE`.
- Money values are numbers in rupees from the accounting service. The UI never totals a ledger.
- Frontend implementation: `web/lib/modules/entities.js` (fields, forms, actions per entity), `web/lib/modules/modules.js` (sections per role), `web/lib/modules/core.js` (adapters, validation). Codex's adapter must implement the same four methods (`list`, `get`, `create`, `act`) and is passed to `ModuleWorkspace` as `adapter`.

## 14. Central approvals (`approval`)

Pipeline: Co-Founder controlled request → CEO review → Founder approval where required → authorised execution → audit log.

Fields: `id` (THH-APR-NNNNNN), `category` (website_cms, destination, partner_onboarding, appointment, finance, investment, expense, marketing, policy, security, production), `title`, `reason`, `risk` (low…critical), `stage` (ceo_review, founder_review, execution, closed), `status` (pending, revision_requested, approved, rejected, executed, execution_failed, cancelled), `requesterName`, `changes[]` (`{ field, label, kind: changed|added|removed, before, after }`), `executionStatus`, `version`.

Actions: approve, request_revision (note), reject (note), escalate to Founder (CEO, note), resubmit (requester, note), withdraw (requester, note).

Server rules: no self-approval; `expectedVersion` must match (stale approvals rejected); sensitive categories require the Founder stage (list to be decided by the Founder — business decision); approval does not execute — a separate execution step records `executionStatus` and an audit event; execution of a financial approval does not mean payment.

LIVE today: the existing `management_work` queue is shown read-only in the "Live queue" tab through the approved `WorkQueue` component and the existing `decide` server action. It should be migrated into, or mirrored by, `approval_requests`.

## 15. People

| Entity | ID | Key fields | Actions |
|---|---|---|---|
| employee | THH-EMP-NNNN | name, email, designation, department, office, reportsTo, joining, status (invited, active, suspended, resigned, terminated), mfa | create via approval; suspend / reactivate / promote via approval (note) |
| department | code | name, head, headcount | read |
| candidate | THH-CAN-NNNNN | name, role, department, email, phone, status (new→screening→interview→offer→joined / rejected) | screen, interview, offer via approval, join, reject (note) |
| personnel_action | THH-PAC-NNNNN | employeeName, type (appointment, promotion, transfer, activation, suspension, resignation, termination), effective, reason, status | create via approval, withdraw |
| employee_document | — | employee, type, uploaded, status | upload (storage), verify |

LIVE today: Founder sees `management_people()` (leadership & staff, MFA, last active).
Suspension, termination and revocation must revoke sessions server-side.

## 16. Workforce

`attendance_entry` create `{ kind: in|out, mode: office|wfh|field|travel, note }` — server time is authoritative; no location collected. `attendance` list (date, employee, mode, in, out, status). `leave` (THH-LV-NNNNNN; type casual/sick/earned/comp_off/unpaid; from ≤ to; reason; status pending/approved/rejected/cancelled; days computed server-side; approve, reject (note), cancel (note)). `holiday`, `schedule`, `performance` (server-computed) read-only. Reports: `get('report', '<key>:<period>')` → `{ columns, rows }` for CSV; `get('report_pdf', …)` → file URL. Leave approval rule and balances are a business decision.

## 17. Connect

`conversation` (kind direct/leadership/department, title, unread, messages[]) with `act(id, 'send', { text })` and `mark_read`. **Participant-only RLS: the Founder role grants no access to private conversations.** Realtime per conversation. `meeting` (THH-MTG; title, date, time, duration, attendees, agenda; record_notes, cancel). `announcement` (THH-ANN; company-wide audience via approval; publish after approval). Email workflow status via the integrations endpoint (section 24).

## 18. Activity Center & notifications

`activity` (at, summary, category task/approval/employee/partner/booking/cms/finance/security, actorName, read) scoped by role: Founder company-wide; CEO operations, employee work, Co-Founder change requests; Co-Founder own department, website, technical tasks, partner onboarding. `mark_read`; authorised CSV export. `notification` (at, title, category, status unread/read). `notification_preferences` create with `{ [category]: { in_app, email, whatsapp, push } }` — channels whose provider is not configured must be rejected server-side.

LIVE today: Founder and CEO see the latest `management_events` (read-only).

## 19. Village Connect

`office` (THH-OFF-NNN; name, village, block, district, state, staff, status; create/close via approval). First office **Surmoli, Deghat, Almora, Uttarakhand** — created through an approved request, not seeded by the frontend. `office_assignment`, `tourist` (THH-TRS; phone stored protected, listed masked), `service_request` (THH-SRV), `verification` (THH-FVR; pass/fail with note), `business` (THH-LBZ), `office_ledger` (receipt/expense records; submit via approval; feeds Capital — not a ledger), `daily_report` (THH-RPT), `emergency_alert` create.

Offline: the UI keeps drafts in `localStorage` under `thh.draft.<entity>` (no files) and never submits while offline. Anything submitted after reconnecting is a normal server call; nothing is confirmed, booked, approved or paid without a server response. Drafts are cleared by `clearOfflineDrafts()` (call on sign-out — Codex wiring).

LIVE today: `loadOffices` (employee members + today's attendance from `management_work` kind attendance).

## 20. THH Capital

Read models from Codex accounting APIs: `revenue`, `investment` (THH-INV; create via approval), `expense` (THH-EXP; approval `status` and separate `payment` paid/unpaid), `budget`, `commission`, `payable`, `settlement`, `refund`, `transaction`, `finance_request` (THH-FIN; via approval), reports (P&L monthly/annual, commission, payables; CSV + PDF). The frontend never computes authoritative totals. Approval ≠ payment.

LIVE today: Founder sees `management_finance()` booking value and commission totals, labelled as booking-record totals, not a ledger.

## 21. THH Growth

`campaign` (THH-CMP; channel, budget, start ≤ end, goal; created via approval; pause request), `advertisement` (THH-ADV), `sponsored_listing`, `content` (THH-CNT; draft → in_review → approved → published by a person; `source` marks AI drafts), `acquisition`, `referral`, `seo_page`. AI never publishes, spends money or changes approved prices.

## 21a. Customers & support (CEO) and Partners & listings (Co-Founder)

`ticket` (THH-TKT-NNNNNN; customer, phone masked, type query/complaint/refund/safety, priority, subject, details, assignee, status open/in_progress/waiting/resolved/closed; start, wait (note), resolve (note), escalate to Founder via approval, close). `booking` read model for the CEO with masked customer contact (Step 03 owns booking logic). `partner` (THH-PTR; list over the existing `partners` table; send for CEO verification via approval). `listing_change` (THH-LCR; activate/deactivate/edit; via CEO approval; executed only after approval). Reports: daily/weekly/monthly operations and tickets.

## 22. Strategy & policies (Founder)

`initiative` (expose existing `create_initiative` / `advance_initiative` as a list), `expansion_plan`, `policy` (THH-POL; versioned; created and retired via Founder approval).

## 23. Control center

`role`, `get('permissions','matrix')` → `{ roles[], permissions[{ key, label, roles[] }] }` (read-only; changes are approval requests, category security), `session` (revoke with note), `security_alert` (resolve), `form:suspension` create `{ person, scope: all|finance|sessions, reason }` — Founder only, aal2 re-check, immediate session revoke, audit event, reversible only by the Founder. `incident` (THH-INC), `backup`, `get('health','summary')` → `{ uptime, errors, build, pwa }`. Co-Founder sees health, incidents and integrations only.

## 24. Integrations

`get('integration_status','all')` → `{ email, whatsapp, push, maps, ai, calendar, storage: 'connected' | 'not_configured' | 'failing' }`. Never simulated: the UI shows "Status unknown" when this endpoint is missing. Credentials stay in server secrets. Destination research: `create('research_job', { place, district })` → `{ place, district, facts[{ id, label, value, source }] }`; facts without a source cannot be submitted; submission creates an approval (category destination).

## 25. Profile & digital ID

Profile update via `create('form:profile', { displayName, bio, phone, photo, cover })` (photos via storage). Employee ID issued by the server (THH-EMP-NNNN). `get('id_verification','me')` → `{ svg }`: a QR for a signed, expiring token; the public verify page shows only name, role and validity. Until then the card shows "Not issued yet" and no QR.

## 26. Routes added (all guarded by `requireManagement(role, path)` with aal2)

Founder: `/founder/{profile, approval-center, people, workforce, operations, village, capital, growth, strategy, connect, activity, control, notifications}`.
CEO: `/ceo/{profile, approval-center, people, workforce, operations, village, capital, connect, activity, notifications}`.
Co-Founder: `/co-founder/{profile, approval-center, destinations, partners, growth, workforce, people, village, connect, activity, control, notifications}`.
Middleware and the service worker must treat all of these as private (they are under existing private prefixes).
