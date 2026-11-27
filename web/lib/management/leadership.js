import { WORKSPACES } from './permissions.js';

// Only these three management roles use the leadership login. `employee` has its own flow.
export const LEADERSHIP_ROLES = Object.freeze(['founder', 'ceo', 'co_founder']);

/**
 * Where a signed-in user goes after the common leadership login.
 * `role` is the management_members.role of the authenticated user (null when none).
 * `aal` is the current Supabase assurance level. Only 'aal2' grants access.
 * Dashboards re-check role and MFA on every request (requireManagement), and the database
 * enforces both again in private.management_role(); this only decides the redirect.
 */
export function leadershipDestination({ role, aal }) {
  if (!LEADERSHIP_ROLES.includes(role)) return { status: 'denied' };
  if (aal !== 'aal2') return { status: 'mfa' };
  return { status: 'go', path: WORKSPACES[role] };
}
