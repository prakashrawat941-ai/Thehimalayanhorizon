import type { ErrorCode } from './errors';

/**
 * Approval view-models (Master Spec, module 08).
 *
 * STATUS: PROPOSED v0 (frontend). These are the shapes the approval UI components read.
 * Codex defines the physical schema, the state machine and the SLA rules; nothing here grants
 * or applies an approval. The UI never auto-approves and never treats chat text as approval.
 */
export const APPROVAL_STATUSES = [
  'draft', 'pending_ceo', 'under_review', 'pending_founder', 'approved', 'applying', 'applied',
  'revision_required', 'rejected', 'withdrawn', 'failed', 'rolled_back',
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_RISKS = ['low', 'medium', 'high', 'critical'] as const;
export type ApprovalRisk = (typeof APPROVAL_RISKS)[number];

export const APPROVAL_DECISIONS = ['approve', 'revise', 'reject'] as const;
export type ApprovalDecisionKind = (typeof APPROVAL_DECISIONS)[number];

/** Spec SLA proposal (not approved live policy): critical 2h, high 12h, medium 24h, low 72h. */
export const PROPOSED_SLA_HOURS: Record<ApprovalRisk, number> = { critical: 2, high: 12, medium: 24, low: 72 };

export interface FieldChange {
  /** Stable key, e.g. 'room_price.deluxe'. */
  field: string;
  /** Human label already translated by the server or caller. */
  label: string;
  kind: 'changed' | 'added' | 'removed';
  before?: unknown;
  after?: unknown;
}

export interface ApprovalHistoryItem {
  at: string; // ISO UTC
  actor: string; // display name
  action: string; // display text, e.g. 'Submitted', 'Sent for revision'
  note?: string;
}

export interface ApprovalReviewer {
  name: string;
  role: string;
  decision?: 'approved' | 'revision' | 'rejected' | 'pending';
  decidedAt?: string;
}

export interface ApprovalRequest {
  schemaVersion: 1;
  /** Public id, e.g. THH-APR-000012. */
  id: string;
  type: string; // display, e.g. 'Homepage change'
  title: string;
  resource?: { kind: string; id: string; label?: string };
  requester: { name: string; designation?: string };
  department?: string;
  status: ApprovalStatus;
  risk: ApprovalRisk;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  submittedAt: string; // ISO UTC
  /** SLA deadline calculated by the server. The UI shows time left and never auto-approves. */
  deadlineAt?: string;
  /** Version of the request the viewer is looking at; decisions bind to it. */
  version: number;
  /** Latest version on the server, when known. A higher number means this screen is stale. */
  currentVersion?: number;
  changes: FieldChange[];
  reviewers?: ApprovalReviewer[];
  evidence?: { label: string; href?: string }[];
  history?: ApprovalHistoryItem[];
}

export interface ApprovalDecisionInput {
  decision: ApprovalDecisionKind;
  /** Required for revise and reject (min 3 characters). Optional for approve. */
  note: string;
  /** Exact version binding. A mismatch comes back as STALE_VERSION. */
  expectedVersion: number;
  idempotencyKey: string;
}

export interface ApprovalDecisionResult {
  ok: boolean;
  code?: ErrorCode;
  message?: string;
}

/** Statuses in which a reviewer may still decide. The server remains the authority. */
export const DECIDABLE_STATUSES: readonly ApprovalStatus[] = ['pending_ceo', 'under_review', 'pending_founder'];

export function isDecidable(status: ApprovalStatus): boolean {
  return DECIDABLE_STATUSES.includes(status);
}

export function isStale(req: Pick<ApprovalRequest, 'version' | 'currentVersion'>): boolean {
  return typeof req.currentVersion === 'number' && req.currentVersion !== req.version;
}

/** Minimum characters for a reject / revise note. */
export const MIN_NOTE_LENGTH = 3;

export function noteError(decision: ApprovalDecisionKind, note: string): 'required' | null {
  if (decision === 'approve') return null;
  return note.trim().length >= MIN_NOTE_LENGTH ? null : 'required';
}
