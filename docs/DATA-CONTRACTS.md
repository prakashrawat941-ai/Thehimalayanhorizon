# DATA-CONTRACTS: THH Work (Task Management slice)

Status: PROPOSED for Codex review. Nothing here is implemented in the database or API yet.
Branch: `claude/thh-leadership-tasks` (frontend only). Owner of schema, RLS, RPCs and business logic: Codex.

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

Codes used by the Task slice (message text is localised en/hi in the UI; the server sends the code):

`STALE_VERSION`, `INVALID_TRANSITION`, `PERMISSION_DENIED`, `VALIDATION_FAILED`, `APPROVAL_REQUIRED`, `NOT_FOUND`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `UNAUTHENTICATED`, `INTERNAL`, `NETWORK_TIMEOUT` (client-side only).

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

## 12. Open questions for Codex

1. Confirm the table names and whether `work_task_people` is needed.
2. Confirm the RPC naming and the error envelope shape.
3. Decide evidence format for `submit`.
4. Decide which tasks are "sensitive" for Founder final approval.
5. Confirm the IST date source for overdue (server side or client side).
