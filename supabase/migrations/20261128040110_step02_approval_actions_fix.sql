-- Step 02 · 04 · Fix: appending a single action to text[] needs an explicit text value
-- (found by tests/db/step02-approvals-test.sql: "malformed array literal: withdraw").
create or replace function private.approval_allowed_actions(r public.approval_requests, p_uid uuid, p_role text) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare acts text[] := '{}'; own boolean := r.requester_id = p_uid; execs text[];
begin
  if own then
    if r.status in ('pending_ceo', 'pending_founder', 'revision_required') then acts := array_append(acts, 'withdraw'::text); end if;
    if r.status = 'revision_required' then acts := array_append(acts, 'resubmit'::text); end if;
  else
    -- Independent review only: a requester never decides their own request.
    if r.status = 'pending_ceo' and p_role in ('ceo', 'founder') then
      acts := acts || array['approve', 'request_revision', 'reject']::text[];
      if p_role = 'ceo' and not r.requires_founder and r.requester_role <> 'founder' then acts := array_append(acts, 'escalate'::text); end if;
    elsif r.status = 'pending_founder' and p_role = 'founder' then
      acts := acts || array['approve', 'request_revision', 'reject']::text[];
    end if;
  end if;
  if r.status in ('approved', 'failed') then
    select executor_roles into execs from public.approval_policies where category = r.category;
    if p_role = any(execs) then acts := array_append(acts, 'apply'::text); end if;
  end if;
  return acts;
end $$;
revoke all on function private.approval_allowed_actions(public.approval_requests, uuid, text) from public, anon, authenticated;
