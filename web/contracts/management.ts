/** Phase 1 frontend contract. Backend adapters remain on PR #18 until reviewed. */
export type Uuid = string;
export type IsoDateTime = string;
export type PublicId = string;
export type LeadershipRole = 'founder' | 'ceo' | 'co_founder' | 'employee';
export type Scope = 'own' | 'assigned' | 'department' | 'office' | 'company';
export type Action = 'view' | 'create' | 'edit' | 'assign' | 'verify' | 'review' |
  'approve' | 'publish' | 'export' | 'deactivate' | 'delete';
export type Permission = `${string}.${Action}`;
export type UiState = 'loading' | 'ready' | 'empty' | 'error' | 'success';

export interface VersionedRecord {
  id: Uuid;
  publicId: PublicId;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface EmployeeProfile extends VersionedRecord {
  authUserId: Uuid;
  employeeId: PublicId;
  name: string;
  designation: string;
  departmentId: Uuid | null;
  officeId: Uuid | null;
  managerId: Uuid | null;
  employmentStatus: 'invited' | 'active' | 'on_leave' | 'ended';
  accessStatus: 'pending' | 'active' | 'suspended' | 'revoked';
  avatarUrl: string | null;
  joinedOn: string | null;
  mfaEnrolled: boolean;
}

export interface EffectivePermission {
  permission: Permission;
  scope: Scope;
  allowed: boolean;
  expiresAt: IsoDateTime | null;
}

export interface EffectivePermissions {
  actorId: Uuid;
  role: LeadershipRole;
  aal: 'aal1' | 'aal2';
  permissions: EffectivePermission[];
}

export type TaskStatus = 'draft' | 'assigned' | 'accepted' | 'in_progress' |
  'submitted' | 'revision_required' | 'blocked' | 'on_hold' | 'approved' |
  'completed' | 'cancelled';
export interface Task extends VersionedRecord {
  title: string;
  status: TaskStatus;
  ownerId: Uuid;
  primaryAssigneeId: Uuid | null;
  collaboratorIds: Uuid[];
  departmentId: Uuid | null;
  officeId: Uuid | null;
  dueAt: IsoDateTime | null;
  reviewRequired: boolean;
}

export type ApprovalStatus = 'draft' | 'pending_ceo' | 'under_review' |
  'pending_founder' | 'approved' | 'applying' | 'applied' |
  'revision_required' | 'rejected' | 'withdrawn' | 'failed' | 'rolled_back';
export interface ApprovalRequest extends VersionedRecord {
  resourceType: string;
  resourceId: Uuid;
  requesterId: Uuid;
  status: ApprovalStatus;
  currentVersion: number;
  proposedVersion: number;
  summary: string;
  reviewerIds: Uuid[];
  submittedAt: IsoDateTime | null;
}
export interface ApprovalDecision {
  requestId: Uuid;
  reviewerId: Uuid;
  decision: 'approve' | 'reject' | 'request_revision';
  reason: string;
  expectedVersion: number;
  decidedAt: IsoDateTime;
}

export interface AttendanceRecord extends VersionedRecord {
  employeeId: Uuid;
  officeId: Uuid | null;
  mode: 'office' | 'wfh' | 'field' | 'travel';
  checkedInAt: IsoDateTime;
  checkedOutAt: IsoDateTime | null;
}
export interface LeaveRequest extends VersionedRecord {
  employeeId: Uuid;
  from: string;
  to: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  approverId: Uuid | null;
}
export interface OfficeRecord extends VersionedRecord {
  name: string;
  village: string;
  district: string;
  state: string;
  managerId: Uuid | null;
  status: 'draft' | 'active' | 'suspended';
}
export interface DestinationDraft extends VersionedRecord {
  name: string;
  district: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceUrls: string[];
  missingFields: string[];
  approvalId: Uuid | null;
}
export interface PartnerApplication extends VersionedRecord {
  ownerId: Uuid;
  kind: 'homestay' | 'cab' | 'guide' | 'other';
  status: 'draft' | 'pending' | 'verified' | 'rejected';
  approvalId: Uuid | null;
}
export interface JournalEntry extends VersionedRecord {
  status: 'draft' | 'verified' | 'approved' | 'posted' | 'reconciled' | 'reversed';
  currency: 'INR';
  debitPaise: number;
  creditPaise: number;
}
export interface BudgetRequest extends VersionedRecord {
  amountPaise: number;
  status: ApprovalStatus;
  approvalId: Uuid | null;
}
export interface Advertisement extends VersionedRecord {
  advertiserId: Uuid;
  status: 'draft' | 'pending_ceo' | 'pending_founder' | 'scheduled' |
    'live' | 'completed' | 'expired' | 'paused' | 'rejected';
  sponsored: true;
  approvalId: Uuid | null;
}
export interface Campaign extends VersionedRecord {
  name: string;
  status: Advertisement['status'];
  budgetPaise: number;
  approvalId: Uuid | null;
}
export interface Notification extends VersionedRecord {
  recipientId: Uuid;
  title: string;
  body: string;
  readAt: IsoDateTime | null;
}
export interface AuditEvent {
  id: Uuid;
  actorId: Uuid;
  action: string;
  resourceId: Uuid;
  happenedAt: IsoDateTime;
  requestId: string;
}

export type ApiErrorCode = 'AUTH_REQUIRED' | 'MFA_REQUIRED' | 'PERMISSION_DENIED' |
  'VALIDATION_FAILED' | 'NOT_FOUND' | 'CONFLICT' | 'STALE_VERSION' |
  'APPROVAL_REQUIRED' | 'INVALID_TRANSITION' | 'DUPLICATE_REQUEST' |
  'INTEGRATION_UNAVAILABLE' | 'INTERNAL_ERROR';
export type ApiResult<T> =
  | { success: true; data: T; requestId: string }
  | { success: false; error: { code: ApiErrorCode; message: string }; requestId: string };
export interface ConsequentialWrite<T> {
  resourceId: Uuid;
  payload: T;
  expectedVersion: number;
  idempotencyKey: string;
  approvalId?: Uuid;
}
