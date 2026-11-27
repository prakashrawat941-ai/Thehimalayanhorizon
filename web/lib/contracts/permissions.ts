/**
 * Permission view-model used to show or hide controls.
 *
 * STATUS: PROPOSED v0 (frontend). This is NOT enforcement. The server and RLS decide every action
 * (Master Spec, module 06: deny by default, never trust client claims). The UI only hides or disables
 * controls so people do not click things that will be refused. The physical schema is Codex's to define.
 */
export const PERMISSION_ACTIONS = [
  'view', 'create', 'edit', 'assign', 'verify', 'review', 'approve', 'publish', 'export', 'deactivate', 'delete',
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_SCOPES = ['own', 'assigned', 'department', 'office', 'company'] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export interface PermissionGrant {
  /** Resource family, e.g. 'task', 'approval', 'homepage', 'journal'. */
  resource: string;
  action: PermissionAction;
  scope: PermissionScope;
  /** ISO time for temporary grants; absent = no expiry. */
  expiresAt?: string;
}

export interface EffectivePermissions {
  /** Version of this schema, so the UI can refuse shapes it does not know. */
  schemaVersion: 1;
  employeeId: string; // public id, e.g. THH-EMP-0001
  grants: PermissionGrant[];
  /** Set by the server when it has resolved role + overrides + temporary grants. */
  resolvedAt: string;
}

export interface ResourceContext {
  /** Scope facts about the record, supplied by the server alongside it. */
  ownerIsMe?: boolean;
  assignedToMe?: boolean;
  departmentId?: string | null;
  officeId?: string | null;
}

export interface ActorContext {
  departmentId?: string | null;
  officeId?: string | null;
}

const RANK: Record<PermissionScope, number> = { own: 0, assigned: 1, department: 2, office: 3, company: 4 };

function scopeCovers(scope: PermissionScope, actor: ActorContext, resource: ResourceContext): boolean {
  switch (scope) {
    case 'company':
      return true;
    case 'office':
      return !!actor.officeId && actor.officeId === resource.officeId;
    case 'department':
      return !!actor.departmentId && actor.departmentId === resource.departmentId;
    case 'assigned':
      return !!resource.assignedToMe || !!resource.ownerIsMe;
    case 'own':
      return !!resource.ownerIsMe;
    default:
      return false;
  }
}

/** UI hint only. Deny by default: no permissions object, unknown schema or expired grant means false. */
export function canShow(
  perms: EffectivePermissions | null | undefined,
  resource: string,
  action: PermissionAction,
  actor: ActorContext = {},
  record: ResourceContext = {},
  now: Date = new Date(),
): boolean {
  if (!perms || perms.schemaVersion !== 1) return false;
  return perms.grants.some((g) => {
    if (g.resource !== resource || g.action !== action) return false;
    if (g.expiresAt && new Date(g.expiresAt).getTime() <= now.getTime()) return false;
    return scopeCovers(g.scope, actor, record);
  });
}

/** Widest scope the user holds for an action, or null. Useful for labelling list screens. */
export function widestScope(perms: EffectivePermissions | null | undefined, resource: string, action: PermissionAction, now: Date = new Date()): PermissionScope | null {
  if (!perms || perms.schemaVersion !== 1) return null;
  let best: PermissionScope | null = null;
  for (const g of perms.grants) {
    if (g.resource !== resource || g.action !== action) continue;
    if (g.expiresAt && new Date(g.expiresAt).getTime() <= now.getTime()) continue;
    if (best === null || RANK[g.scope] > RANK[best]) best = g.scope;
  }
  return best;
}
