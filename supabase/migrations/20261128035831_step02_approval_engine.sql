-- Step 02 · 03 · Central approval engine.
-- Pipeline: request → CEO review → Founder approval where required → separate authorised execution → audit.
-- Rules enforced here (not in the browser): routing, permitted actions, no self-approval, expected version,
-- idempotency keys, duplicate prevention, append-only history, notifications. Approval never moves money.
-- Status vocabulary follows web/contracts/management.ts (ApprovalStatus).

-- ───────────── Policies (which decisions need the Founder) ─────────────
create table public.approval_policies (
  category text primary key check (category ~ '^[a-z_]{3,40}$'),
  label text not null,
  label_hi text,
  requires_founder boolean not null,
  executor text not null default 'record' check (executor in ('record', 'office_create')),
  executor_roles text[] not null,
  updated_at timestamptz not null default now()
);
-- Founder decision (28 Nov 2026): Founder final approval for spending and investment, new village offices,
-- hiring and termination, leadership appointments and removals, policy, security and permissions, production
-- deployments, critical business and contractual decisions. Routine operations stay with CEO / Co-Founder.
-- Any request that carries an amount also requires the Founder (financial expenditure).
insert into public.approval_policies(category, label, label_hi, requires_founder, executor, executor_roles) values
  ('website_cms',        'Website & CMS change',            'वेबसाइट और CMS बदलाव',        false, 'record', '{co_founder,ceo,founder}'),
  ('destination',        'New destination',                 'नया गंतव्य',                   false, 'record', '{co_founder,ceo,founder}'),
  ('partner_onboarding', 'Homestay & partner onboarding',   'होमस्टे और पार्टनर पंजीकरण', false, 'record', '{co_founder,ceo,founder}'),
  ('listing',            'Listing activation or change',    'लिस्टिंग चालू या बदलाव',       false, 'record', '{co_founder,ceo,founder}'),
  ('marketing',          'Marketing campaign',              'मार्केटिंग अभियान',            false, 'record', '{co_founder,ceo,founder}'),
  ('operations',         'Operational change',              'संचालन बदलाव',                false, 'record', '{ceo,founder}'),
  ('expenditure',        'Financial expenditure',           'वित्तीय खर्च',                 true,  'record', '{ceo,founder}'),
  ('investment',         'Capital investment',              'पूंजी निवेश',                  true,  'record', '{founder}'),
  ('office',             'New village office',              'नया ग्राम कार्यालय',           true,  'office_create', '{ceo,founder}'),
  ('hiring',             'Employee hiring',                 'कर्मचारी भर्ती',               true,  'record', '{ceo,founder}'),
  ('termination',        'Employee termination',            'कर्मचारी सेवा समाप्ति',         true,  'record', '{ceo,founder}'),
  ('leadership',         'Leadership appointment or removal','नेतृत्व नियुक्ति या हटाना',    true,  'record', '{founder}'),
  ('policy',             'Company policy change',           'कंपनी नीति बदलाव',             true,  'record', '{founder}'),
  ('security',           'Security & permission change',    'सुरक्षा और अनुमति बदलाव',      true,  'record', '{founder}'),
  ('production',         'Production deployment',           'प्रोडक्शन डिप्लॉयमेंट',         true,  'record', '{founder}'),
  ('contract',           'Critical business or contract decision', 'महत्वपूर्ण व्यावसायिक या अनुबंध निर्णय', true, 'record', '{founder}');

-- ───────────── Requests and decisions ─────────────
create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^THH-APR-[0-9]{6,}$'),
  category text not null references public.approval_policies(category),
  title text not null check (length(trim(title)) between 5 and 160),
  reason text not null check (length(trim(reason)) between 10 and 3000),
  risk text not null check (risk in ('low', 'medium', 'high', 'critical')),
  amount_paise bigint check (amount_paise is null or amount_paise > 0),
  resource_type text check (resource_type is null or resource_type ~ '^[a-z_]{2,40}$'),
  resource_id uuid,
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object' and length(payload::text) <= 20000),
  changes jsonb not null default '[]' check (jsonb_typeof(changes) = 'array' and jsonb_array_length(changes) <= 50),
  requester_id uuid not null references auth.users(id),
  requester_role text not null,
  requires_founder boolean not null,
  status text not null check (status in ('pending_ceo', 'pending_founder', 'approved', 'applying', 'applied',
                                         'revision_required', 'rejected', 'withdrawn', 'failed')),
  dedupe_key text not null,
  version int not null default 1,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  applied_at timestamptz,
  applied_by uuid references auth.users(id),
  execution_result jsonb,
  execution_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index approval_requests_open_duplicate on public.approval_requests(dedupe_key)
  where status in ('pending_ceo', 'pending_founder', 'approved', 'applying', 'revision_required', 'failed');
create index approval_requests_status on public.approval_requests(status, submitted_at desc);
create index approval_requests_requester on public.approval_requests(requester_id, submitted_at desc);

create table public.approval_decisions (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.approval_requests(id),
  actor_id uuid not null references auth.users(id),
  actor_role text not null,
  action text not null check (action in ('submit', 'approve', 'reject', 'request_revision', 'escalate', 'withdraw', 'resubmit', 'apply', 'apply_failed')),
  from_status text,
  to_status text not null,
  note text check (note is null or length(note) <= 1000),
  version_after int not null,
  created_at timestamptz not null default now()
);
create index approval_decisions_request on public.approval_decisions(request_id, id);
create trigger approval_decisions_append_only before update or delete on public.approval_decisions
  for each row execute function private.forbid_history_change();
create trigger approval_decisions_no_truncate before truncate on public.approval_decisions
  for each statement execute function private.forbid_history_change();
create trigger approval_requests_no_delete before delete on public.approval_requests
  for each row execute function private.forbid_delete();
create trigger approval_requests_touch before update on public.approval_requests
  for each row execute function private.touch_version();

-- Idempotency: replaying the same key returns the first response, nothing runs twice.
create table private.idempotency (
  actor_id uuid not null,
  scope text not null,
  key text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, scope, key)
);
alter table private.idempotency enable row level security;

-- ───────────── Rules ─────────────
create or replace function private.approval_first_status(p_role text) returns text
language sql immutable set search_path = '' as $$
  -- Co-Founder, COO, Manager, Employee → CEO first. CEO → Founder (nobody else above). Founder → CEO countersign.
  select case p_role when 'ceo' then 'pending_founder' else 'pending_ceo' end;
$$;

create or replace function private.approval_allowed_actions(r public.approval_requests, p_uid uuid, p_role text) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare acts text[] := '{}'; own boolean := r.requester_id = p_uid; execs text[];
begin
  if own then
    if r.status in ('pending_ceo', 'pending_founder', 'revision_required') then acts := acts || 'withdraw'; end if;
    if r.status = 'revision_required' then acts := acts || 'resubmit'; end if;
  else
    -- Independent review only: a requester never decides their own request.
    if r.status = 'pending_ceo' and p_role in ('ceo', 'founder') then
      acts := acts || array['approve', 'request_revision', 'reject'];
      if p_role = 'ceo' and not r.requires_founder and r.requester_role <> 'founder' then acts := acts || 'escalate'; end if;
    elsif r.status = 'pending_founder' and p_role = 'founder' then
      acts := acts || array['approve', 'request_revision', 'reject'];
    end if;
  end if;
  if r.status in ('approved', 'failed') then
    select executor_roles into execs from public.approval_policies where category = r.category;
    if p_role = any(execs) then acts := acts || 'apply'; end if;
  end if;
  return acts;
end $$;

-- Visibility: Founder and CEO see all requests; everyone else sees their own.
create or replace function private.approval_visible(r public.approval_requests, p_uid uuid, p_role text) returns boolean
language sql stable set search_path = '' as $$
  select r.requester_id = p_uid or p_role in ('founder', 'ceo');
$$;

create or replace function private.approval_stage(p_status text) returns text
language sql immutable set search_path = '' as $$
  select case p_status when 'pending_ceo' then 'ceo_review' when 'pending_founder' then 'founder_review'
    when 'approved' then 'execution' when 'applying' then 'execution' when 'failed' then 'execution' else 'closed' end;
$$;

create or replace function private.approval_json(r public.approval_requests, p_uid uuid, p_role text, p_with_history boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare j jsonb; name text;
begin
  select coalesce(e.full_name, m.display_name) into name from public.management_members m
    left join public.employees e on e.user_id = m.user_id where m.user_id = r.requester_id;
  j := jsonb_build_object(
    'uuid', r.id, 'id', r.public_id, 'category', r.category, 'title', r.title, 'reason', r.reason, 'risk', r.risk,
    'amountPaise', r.amount_paise, 'resourceType', r.resource_type, 'resourceId', r.resource_id,
    'requesterName', name, 'requesterRole', r.requester_role, 'requesterIsMe', r.requester_id = p_uid,
    'requiresFounder', r.requires_founder, 'status', r.status, 'stage', private.approval_stage(r.status),
    'changes', r.changes, 'version', r.version, 'submittedAt', r.submitted_at, 'decidedAt', r.decided_at,
    'appliedAt', r.applied_at, 'executionResult', r.execution_result, 'executionError', r.execution_error,
    'allowedActions', to_jsonb(private.approval_allowed_actions(r, p_uid, p_role)));
  if p_with_history then
    j := j || jsonb_build_object('payload', r.payload, 'history', coalesce((
      select jsonb_agg(jsonb_build_object('action', d.action, 'from', d.from_status, 'to', d.to_status, 'note', d.note,
               'at', d.created_at, 'actorRole', d.actor_role,
               'actorName', (select coalesce(e.full_name, m.display_name) from public.management_members m
                             left join public.employees e on e.user_id = m.user_id where m.user_id = d.actor_id)) order by d.id)
      from public.approval_decisions d where d.request_id = r.id), '[]'::jsonb));
  end if;
  return j;
end $$;

create or replace function private.notify_role(p_role text, p_title text, p_body text, p_link text, p_except uuid) returns void
language sql security definer set search_path = '' as $$
  select private.notify(m.user_id, p_title, p_body, p_link) from public.management_members m
  where m.role = p_role and m.user_id is distinct from p_except;
$$;

create or replace function private.approval_link(p_role text) returns text
language sql immutable set search_path = '' as $$
  select case p_role when 'founder' then '/founder/approval-center' when 'ceo' then '/ceo/approval-center'
    when 'co_founder' then '/co-founder/approval-center' else '/management' end;
$$;

create or replace function private.approval_route_notify(r public.approval_requests) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if r.status = 'pending_ceo' then
    perform private.notify_role('ceo', 'Approval waiting: ' || r.public_id, r.title, '/ceo/approval-center', r.requester_id);
  elsif r.status = 'pending_founder' then
    perform private.notify_role('founder', 'Founder approval waiting: ' || r.public_id, r.title, '/founder/approval-center', r.requester_id);
  elsif r.status in ('approved', 'rejected', 'revision_required', 'applied', 'failed') then
    perform private.notify(r.requester_id, 'Request ' || r.public_id || ': ' || replace(r.status, '_', ' '), r.title,
      private.approval_link(r.requester_role));
  end if;
end $$;

create or replace function private.idem_get(p_scope text, p_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  if p_key is null or length(p_key) not between 8 and 100 then perform private.api_error('VALIDATION_FAILED', 'idempotencyKey'); end if;
  select response into res from private.idempotency where actor_id = auth.uid() and scope = p_scope and key = p_key;
  return res;
end $$;

create or replace function private.idem_put(p_scope text, p_key text, p_response jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  insert into private.idempotency(actor_id, scope, key, response) values (auth.uid(), p_scope, p_key, p_response)
  on conflict do nothing;
  select p_response;
$$;

-- Category-specific payload checks (only office creation has a structured payload today).
create or replace function private.approval_validate_payload(p_category text, p jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_category = 'office' then
    if length(trim(coalesce(p ->> 'name', ''))) not between 3 and 120
      or length(trim(coalesce(p ->> 'village', ''))) not between 2 and 80
      or length(trim(coalesce(p ->> 'district', ''))) not between 2 and 80
      or length(trim(coalesce(p ->> 'state', ''))) not between 2 and 80
      or length(coalesce(p ->> 'post', '')) > 80 or length(coalesce(p ->> 'block', '')) > 80
      or length(coalesce(p ->> 'country', '')) > 60 then
      perform private.api_error('VALIDATION_FAILED', 'office payload: name, village, district and state are required');
    end if;
    if exists (select from public.offices o where lower(trim(o.name)) = lower(trim(p ->> 'name'))
               and lower(trim(o.village)) = lower(trim(p ->> 'village')) and lower(trim(o.district)) = lower(trim(p ->> 'district'))) then
      perform private.api_error('DUPLICATE_REQUEST', 'This office already exists');
    end if;
  end if;
end $$;

-- ───────────── Executors (run only from approval_apply, after approval) ─────────────
create or replace function private.exec_office_create(r public.approval_requests) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.offices; p jsonb := r.payload;
begin
  insert into public.offices(public_id, name, village, post, block, district, state, country, status, approval_id, created_by)
  values (private.public_id('office', 'THH-OFF-', 3), trim(p ->> 'name'), trim(p ->> 'village'), nullif(trim(p ->> 'post'), ''),
          nullif(trim(p ->> 'block'), ''), trim(p ->> 'district'), trim(p ->> 'state'),
          coalesce(nullif(trim(p ->> 'country'), ''), 'India'), 'active', r.id, auth.uid())
  returning * into o;
  return jsonb_build_object('officeId', o.id, 'officePublicId', o.public_id);
end $$;

-- ───────────── API (RPCs) ─────────────
create or replace function public.approval_submit(
  p_category text, p_title text, p_reason text, p_risk text, p_amount_paise bigint default null,
  p_resource_type text default null, p_resource_id uuid default null, p_payload jsonb default '{}',
  p_changes jsonb default '[]', p_idempotency_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare role text := private.require_member(); pol public.approval_policies; r public.approval_requests; prior jsonb; needs boolean;
begin
  prior := private.idem_get('approval_submit', p_idempotency_key);
  if prior is not null then return prior; end if;
  select * into pol from public.approval_policies where category = p_category;
  if not found then perform private.api_error('VALIDATION_FAILED', 'category'); end if;
  if length(trim(coalesce(p_title, ''))) not between 5 and 160 then perform private.api_error('VALIDATION_FAILED', 'title'); end if;
  if length(trim(coalesce(p_reason, ''))) not between 10 and 3000 then perform private.api_error('VALIDATION_FAILED', 'reason'); end if;
  if p_risk is null or p_risk not in ('low', 'medium', 'high', 'critical') then perform private.api_error('VALIDATION_FAILED', 'risk'); end if;
  if p_amount_paise is not null and p_amount_paise <= 0 then perform private.api_error('VALIDATION_FAILED', 'amountPaise'); end if;
  if jsonb_typeof(coalesce(p_payload, '{}')) <> 'object' or jsonb_typeof(coalesce(p_changes, '[]')) <> 'array'
     or length(coalesce(p_payload, '{}')::text) > 20000 or jsonb_array_length(coalesce(p_changes, '[]')) > 50 then
    perform private.api_error('VALIDATION_FAILED', 'payload');
  end if;
  perform private.approval_validate_payload(p_category, coalesce(p_payload, '{}'));
  needs := pol.requires_founder or p_amount_paise is not null;
  begin
    insert into public.approval_requests(public_id, category, title, reason, risk, amount_paise, resource_type, resource_id,
      payload, changes, requester_id, requester_role, requires_founder, status, dedupe_key)
    values (private.public_id('approval', 'THH-APR-', 6), p_category, trim(p_title), trim(p_reason), p_risk, p_amount_paise,
      p_resource_type, p_resource_id, coalesce(p_payload, '{}'), coalesce(p_changes, '[]'), auth.uid(), role, needs,
      private.approval_first_status(role),
      md5(p_category || '|' || coalesce(p_resource_type, '') || '|' || coalesce(p_resource_id::text, '') || '|' ||
          lower(trim(p_title)) || '|' || coalesce(p_payload, '{}')::text))
    returning * into r;
  exception when unique_violation then
    perform private.api_error('DUPLICATE_REQUEST', 'An open request for the same change already exists');
  end;
  insert into public.approval_decisions(request_id, actor_id, actor_role, action, from_status, to_status, version_after)
  values (r.id, auth.uid(), role, 'submit', null, r.status, r.version);
  perform private.audit_event('approval_submit', 'approval_requests', r.public_id, null, to_jsonb(r));
  perform private.approval_route_notify(r);
  return private.idem_put('approval_submit', p_idempotency_key, private.approval_json(r, auth.uid(), role));
end $$;

create or replace function public.approval_decide(
  p_id uuid, p_decision text, p_note text, p_expected_version int, p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare role text := private.require_member(); r public.approval_requests; old public.approval_requests;
  acts text[]; nxt text; prior jsonb; note text := nullif(trim(coalesce(p_note, '')), '');
begin
  prior := private.idem_get('approval_decide', p_idempotency_key);
  if prior is not null then return prior; end if;
  if p_decision is null or p_decision not in ('approve', 'reject', 'request_revision', 'escalate', 'withdraw') then
    perform private.api_error('VALIDATION_FAILED', 'decision');
  end if;
  select * into r from public.approval_requests where id = p_id for update;
  if not found or not private.approval_visible(r, auth.uid(), role) then perform private.api_error('NOT_FOUND'); end if;
  if p_expected_version is null or r.version <> p_expected_version then perform private.api_error('STALE_VERSION'); end if;
  acts := private.approval_allowed_actions(r, auth.uid(), role);
  if not (p_decision = any(acts)) then
    if r.requester_id = auth.uid() and p_decision <> 'withdraw' then perform private.api_error('PERMISSION_DENIED', 'You cannot decide your own request');
    elsif r.status not in ('pending_ceo', 'pending_founder', 'revision_required') then perform private.api_error('INVALID_TRANSITION');
    else perform private.api_error('PERMISSION_DENIED'); end if;
  end if;
  if p_decision in ('reject', 'request_revision', 'escalate', 'withdraw') and length(coalesce(note, '')) < 3 then
    perform private.api_error('VALIDATION_FAILED', 'note');
  end if;
  if length(coalesce(note, '')) > 1000 then perform private.api_error('VALIDATION_FAILED', 'note'); end if;
  nxt := case p_decision
    when 'approve' then case when role = 'ceo' and r.requires_founder and r.requester_role <> 'founder' then 'pending_founder' else 'approved' end
    when 'escalate' then 'pending_founder'
    when 'request_revision' then 'revision_required'
    when 'reject' then 'rejected'
    when 'withdraw' then 'withdrawn' end;
  old := r;
  update public.approval_requests set status = nxt, version = version + 1,
    decided_at = case when nxt in ('approved', 'rejected') then now() else decided_at end
  where id = p_id returning * into r;
  insert into public.approval_decisions(request_id, actor_id, actor_role, action, from_status, to_status, note, version_after)
  values (r.id, auth.uid(), role, p_decision, old.status, r.status, note, r.version);
  perform private.audit_event('approval_' || p_decision, 'approval_requests', r.public_id, to_jsonb(old), to_jsonb(r));
  perform private.approval_route_notify(r);
  return private.idem_put('approval_decide', p_idempotency_key, private.approval_json(r, auth.uid(), role));
end $$;

create or replace function public.approval_resubmit(
  p_id uuid, p_note text, p_expected_version int, p_idempotency_key text,
  p_title text default null, p_reason text default null, p_payload jsonb default null, p_changes jsonb default null, p_amount_paise bigint default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare role text := private.require_member(); r public.approval_requests; old public.approval_requests; prior jsonb;
  note text := nullif(trim(coalesce(p_note, '')), ''); pol public.approval_policies;
begin
  prior := private.idem_get('approval_resubmit', p_idempotency_key);
  if prior is not null then return prior; end if;
  select * into r from public.approval_requests where id = p_id for update;
  if not found or r.requester_id <> auth.uid() then perform private.api_error('NOT_FOUND'); end if;
  if p_expected_version is null or r.version <> p_expected_version then perform private.api_error('STALE_VERSION'); end if;
  if r.status <> 'revision_required' then perform private.api_error('INVALID_TRANSITION'); end if;
  if length(coalesce(note, '')) not between 3 and 1000 then perform private.api_error('VALIDATION_FAILED', 'note'); end if;
  if p_payload is not null then perform private.approval_validate_payload(r.category, p_payload); end if;
  select * into pol from public.approval_policies where category = r.category;
  old := r;
  begin
    update public.approval_requests set
      title = coalesce(nullif(trim(p_title), ''), title), reason = coalesce(nullif(trim(p_reason), ''), reason),
      payload = coalesce(p_payload, payload), changes = coalesce(p_changes, changes),
      amount_paise = coalesce(p_amount_paise, amount_paise),
      requires_founder = pol.requires_founder or coalesce(p_amount_paise, amount_paise) is not null,
      status = private.approval_first_status(role), version = version + 1, submitted_at = now(), decided_at = null,
      dedupe_key = md5(category || '|' || coalesce(resource_type, '') || '|' || coalesce(resource_id::text, '') || '|' ||
        lower(coalesce(nullif(trim(p_title), ''), title)) || '|' || coalesce(p_payload, payload)::text)
    where id = p_id returning * into r;
  exception when unique_violation then
    perform private.api_error('DUPLICATE_REQUEST');
  end;
  insert into public.approval_decisions(request_id, actor_id, actor_role, action, from_status, to_status, note, version_after)
  values (r.id, auth.uid(), role, 'resubmit', old.status, r.status, note, r.version);
  perform private.audit_event('approval_resubmit', 'approval_requests', r.public_id, to_jsonb(old), to_jsonb(r));
  perform private.approval_route_notify(r);
  return private.idem_put('approval_resubmit', p_idempotency_key, private.approval_json(r, auth.uid(), role));
end $$;

-- Execution is a separate, explicit operation by an authorised role, after approval.
-- A failure is recorded (status failed, error kept) and can be retried; it never half-applies.
create or replace function public.approval_apply(p_id uuid, p_expected_version int, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare role text := private.require_member(); r public.approval_requests; old public.approval_requests; prior jsonb;
  pol public.approval_policies; result jsonb; err text;
begin
  prior := private.idem_get('approval_apply', p_idempotency_key);
  if prior is not null then return prior; end if;
  select * into r from public.approval_requests where id = p_id for update;
  if not found or not private.approval_visible(r, auth.uid(), role) then perform private.api_error('NOT_FOUND'); end if;
  if p_expected_version is null or r.version <> p_expected_version then perform private.api_error('STALE_VERSION'); end if;
  if not ('apply' = any(private.approval_allowed_actions(r, auth.uid(), role))) then
    if r.status not in ('approved', 'failed') then perform private.api_error('APPROVAL_REQUIRED'); end if;
    perform private.api_error('PERMISSION_DENIED');
  end if;
  select * into pol from public.approval_policies where category = r.category;
  old := r;
  begin
    if pol.executor = 'office_create' then
      result := private.exec_office_create(r);
    else
      result := jsonb_build_object('recorded', true,
        'note', 'Decision recorded for execution by the responsible team. No payment or external change was made by this step.');
    end if;
    update public.approval_requests set status = 'applied', version = version + 1, applied_at = now(), applied_by = auth.uid(),
      execution_result = result, execution_error = null where id = p_id returning * into r;
    insert into public.approval_decisions(request_id, actor_id, actor_role, action, from_status, to_status, version_after)
    values (r.id, auth.uid(), role, 'apply', old.status, r.status, r.version);
  exception when others then
    err := left(sqlerrm, 500);
    update public.approval_requests set status = 'failed', version = version + 1, execution_error = err where id = p_id returning * into r;
    insert into public.approval_decisions(request_id, actor_id, actor_role, action, from_status, to_status, note, version_after)
    values (r.id, auth.uid(), role, 'apply_failed', old.status, r.status, err, r.version);
  end;
  perform private.audit_event('approval_' || case when r.status = 'applied' then 'apply' else 'apply_failed' end,
    'approval_requests', r.public_id, to_jsonb(old), to_jsonb(r));
  perform private.approval_route_notify(r);
  return private.idem_put('approval_apply', p_idempotency_key, private.approval_json(r, auth.uid(), role));
end $$;

create or replace function public.approval_list(
  p_scope text default 'inbox', p_status text default null, p_category text default null, p_q text default null,
  p_limit int default 20, p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare role text := private.require_member(); uid uuid := auth.uid(); lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
  q text := nullif(lower(trim(coalesce(p_q, ''))), ''); res jsonb;
begin
  if p_scope is null or p_scope not in ('inbox', 'mine', 'history', 'all') then perform private.api_error('VALIDATION_FAILED', 'scope'); end if;
  with v as (
    select r as rec, private.approval_allowed_actions(r, uid, role) as acts from public.approval_requests r
    where private.approval_visible(r, uid, role)
      and (p_status is null or r.status = p_status) and (p_category is null or r.category = p_category)
      and (q is null or lower(r.public_id) like '%' || q || '%' or lower(r.title) like '%' || q || '%')
  ), s as (
    select rec from v where case p_scope
      when 'inbox' then acts && array['approve', 'reject', 'request_revision']
      when 'mine' then (rec).requester_id = uid
      when 'history' then (rec).status in ('applied', 'rejected', 'withdrawn', 'approved', 'failed')
      else true end
  ), page as (
    select rec from s order by (rec).submitted_at desc, (rec).id limit lim offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object('total', (select count(*) from s),
    'items', coalesce((select jsonb_agg(private.approval_json(rec, uid, role) order by (rec).submitted_at desc, (rec).id) from page), '[]'::jsonb))
  into res;
  return res;
end $$;

create or replace function public.approval_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare role text := private.require_member(); r public.approval_requests;
begin
  select * into r from public.approval_requests where id = p_id;
  if not found or not private.approval_visible(r, auth.uid(), role) then perform private.api_error('NOT_FOUND'); end if;
  return private.approval_json(r, auth.uid(), role, true);
end $$;

create or replace function public.approval_counts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare role text := private.require_member(); uid uuid := auth.uid();
begin
  return (select jsonb_build_object(
    'waitingForMe', count(*) filter (where private.approval_allowed_actions(r, uid, role) && array['approve']),
    'toApply', count(*) filter (where 'apply' = any(private.approval_allowed_actions(r, uid, role))),
    'mineOpen', count(*) filter (where r.requester_id = uid and r.status in ('pending_ceo', 'pending_founder', 'approved', 'failed')),
    'mineNeedsRevision', count(*) filter (where r.requester_id = uid and r.status = 'revision_required'))
    from public.approval_requests r where private.approval_visible(r, uid, role));
end $$;

create or replace function public.approval_policy_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_member();
  return coalesce((select jsonb_agg(jsonb_build_object('category', category, 'label', label, 'labelHi', label_hi,
    'requiresFounder', requires_founder, 'executorRoles', executor_roles) order by category) from public.approval_policies), '[]');
end $$;

-- ───────────── RLS and grants ─────────────
alter table public.approval_policies enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_decisions enable row level security;
revoke all on public.approval_policies, public.approval_requests, public.approval_decisions from anon, authenticated;
grant select on public.approval_policies, public.approval_requests, public.approval_decisions to authenticated;
create policy approval_policies_read on public.approval_policies for select to authenticated using (private.management_role() is not null);
create policy approval_requests_read on public.approval_requests for select to authenticated
  using (private.management_role() is not null and (requester_id = auth.uid() or private.management_role() in ('founder', 'ceo')));
create policy approval_decisions_read on public.approval_decisions for select to authenticated
  using (exists (select from public.approval_requests r where r.id = request_id));

revoke all on function private.approval_first_status(text), private.approval_allowed_actions(public.approval_requests, uuid, text),
  private.approval_visible(public.approval_requests, uuid, text), private.approval_stage(text),
  private.approval_json(public.approval_requests, uuid, text, boolean), private.notify_role(text, text, text, text, uuid),
  private.approval_link(text), private.approval_route_notify(public.approval_requests), private.idem_get(text, text),
  private.idem_put(text, text, jsonb), private.approval_validate_payload(text, jsonb), private.exec_office_create(public.approval_requests)
  from public, anon, authenticated;

revoke all on function public.approval_submit(text, text, text, text, bigint, text, uuid, jsonb, jsonb, text),
  public.approval_decide(uuid, text, text, int, text),
  public.approval_resubmit(uuid, text, int, text, text, text, jsonb, jsonb, bigint),
  public.approval_apply(uuid, int, text), public.approval_list(text, text, text, text, int, int),
  public.approval_get(uuid), public.approval_counts(), public.approval_policy_list() from public, anon;
grant execute on function public.approval_submit(text, text, text, text, bigint, text, uuid, jsonb, jsonb, text),
  public.approval_decide(uuid, text, text, int, text),
  public.approval_resubmit(uuid, text, int, text, text, text, jsonb, jsonb, bigint),
  public.approval_apply(uuid, int, text), public.approval_list(text, text, text, text, int, int),
  public.approval_get(uuid), public.approval_counts(), public.approval_policy_list() to authenticated;
