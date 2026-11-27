// Pure domain validation. Call only after server-side membership and MFA checks.
// Persistence must lock the row and compare its version in the same transaction.
export function transitionTask(task, actorId, command) {
  const fail = code => ({success:false,error:{code}});
  if (!actorId) return fail('AUTH_REQUIRED');
  if (!task || !command || !Number.isInteger(command.expectedVersion)) return fail('VALIDATION_FAILED');
  if (task.version !== command.expectedVersion) return fail('STALE_VERSION');
  const assignee = actorId === task.assigneeId;
  const reviewer = actorId === task.reviewerId && !assignee;
  let status = task.status, progress = task.progress;
  const action = command.action;
  if (['approve','revise'].includes(action) ? !reviewer : !assignee) return fail('PERMISSION_DENIED');
  switch(action) {
    case 'accept':
      if(status !== 'assigned') return fail('INVALID_TRANSITION');
      status='accepted'; break;
    case 'progress':
      if(!['accepted','in_progress','revision_required'].includes(status)) return fail('INVALID_TRANSITION');
      if(!Number.isInteger(command.progress)||command.progress<0||command.progress>100) return fail('VALIDATION_FAILED');
      status='in_progress'; progress=command.progress; break;
    case 'submit':
      if(status!=='in_progress'||progress!==100) return fail('INVALID_TRANSITION');
      status=task.reviewRequired?'submitted':'completed'; break;
    case 'approve':
      if(status!=='submitted') return fail('INVALID_TRANSITION');
      status='completed'; break;
    case 'revise':
      if(status!=='submitted') return fail('INVALID_TRANSITION');
      if(typeof command.note!=='string'||!command.note.trim()) return fail('VALIDATION_FAILED');
      status='revision_required'; break;
    default: return fail('VALIDATION_FAILED');
  }
  return {success:true,data:{...task,status,progress,version:task.version+1}};
}
