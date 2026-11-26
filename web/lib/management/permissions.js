// Permission vocabulary only. Authorization must be enforced by database policies and server guards.
export const MANAGEMENT_ROLES = Object.freeze(['founder','ceo','co_founder','employee']);
export const WORKSPACES = Object.freeze({founder:'/founder',ceo:'/ceo',co_founder:'/co-founder',employee:'/employee'});
export const PERMISSIONS = Object.freeze({
  businessRead:'business.read', businessApprove:'business.approve',
  financeRead:'finance.read', financeApprove:'finance.approve',
  employeeManage:'employee.manage', officeManage:'office.manage',
  taskAssign:'task.assign', taskExecute:'task.execute', taskReview:'task.review',
  cmsPublish:'cms.publish', partnerVerify:'partner.verify',
  listingActivate:'listing.activate', releaseApprove:'release.approve',
  releaseExecute:'release.execute', auditRead:'audit.read',
  expenseSubmit:'expense.submit', attendanceSubmit:'attendance.submit'
});
export function workspaceForRole(role) {
  return MANAGEMENT_ROLES.includes(role) ? WORKSPACES[role] : null;
}
