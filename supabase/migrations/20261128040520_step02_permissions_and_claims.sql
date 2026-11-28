-- Step 02 · 06 · Role & permission matrix, and one-time claim codes for new accounts.
-- Extends (does not duplicate) the existing invitation flow: management_set_member → leadership_invitations
-- → accept_leadership_invitation. MFA stays mandatory: every management RPC and page requires aal2.

-- ───────────── Permission matrix (single source of truth) ─────────────
create table public.role_permissions (
  role text not null check (role in ('founder', 'ceo', 'co_founder', 'coo', 'manager', 'employee')),
  permission text not null check (permission ~ '^[a-z_]+\.[a-z_]+$'),
  scope text not null check (scope in ('own', 'assigned', 'department', 'office', 'company')),
  primary key (role, permission)
);
insert into public.role_permissions(role, permission, scope)
select v.role, v.permission, v.scope from (values
  -- Founder: company-wide visibility, final approvals, leadership, finance, security.
  ('founder','approvals.submit','own'), ('founder','approvals.view','company'), ('founder','approvals.final_approve','company'),
  ('founder','people.view','company'), ('founder','people.manage','company'), ('founder','leadership.appoint','company'),
  ('founder','workforce.view','company'), ('founder','tasks.assign','company'), ('founder','tasks.view','company'),
  ('founder','finance.view','company'), ('founder','finance.approve','company'), ('founder','offices.manage','company'),
  ('founder','strategy.manage','company'), ('founder','security.manage','company'), ('founder','audit.view','company'),
  ('founder','reports.view','company'), ('founder','support.view','company'), ('founder','growth.view','company'),
  -- CEO: daily operations, people and workforce, tasks, support, village offices, operational reports.
  ('ceo','approvals.submit','own'), ('ceo','approvals.view','company'), ('ceo','approvals.review','company'),
  ('ceo','people.view','company'), ('ceo','people.manage','company'), ('ceo','workforce.view','company'),
  ('ceo','workforce.manage','company'), ('ceo','tasks.assign','company'), ('ceo','tasks.view','company'),
  ('ceo','finance.expenses_view','company'), ('ceo','offices.manage','company'), ('ceo','support.manage','company'),
  ('ceo','partners.verify','company'), ('ceo','reports.view','company'), ('ceo','workforce.self','own'),
  -- Co-Founder: website & PWA, destinations, homestay/partner onboarding, growth, content and listings.
  ('co_founder','approvals.submit','own'), ('co_founder','approvals.view','own'), ('co_founder','people.view','department'),
  ('co_founder','tasks.assign','department'), ('co_founder','tasks.view','department'), ('co_founder','cms.edit','company'),
  ('co_founder','pwa.manage','company'), ('co_founder','destinations.publish','company'), ('co_founder','partners.onboard','company'),
  ('co_founder','listings.manage','company'), ('co_founder','growth.manage','company'), ('co_founder','reports.view','department'),
  ('co_founder','workforce.self','own'),
  -- COO and Manager: own scope only until the Founder defines their responsibilities.
  ('coo','approvals.submit','own'), ('coo','approvals.view','own'), ('coo','people.view','own'), ('coo','tasks.view','assigned'), ('coo','workforce.self','own'),
  ('manager','approvals.submit','own'), ('manager','approvals.view','own'), ('manager','people.view','own'), ('manager','tasks.view','assigned'), ('manager','workforce.self','own'),
  ('employee','approvals.submit','own'), ('employee','approvals.view','own'), ('employee','people.view','own'), ('employee','tasks.view','assigned'), ('employee','workforce.self','own')
) as v(role, permission, scope);

alter table public.role_permissions enable row level security;
revoke all on public.role_permissions from anon, authenticated;
grant select on public.role_permissions to authenticated;
create policy role_permissions_read on public.role_permissions for select to authenticated
  using (private.management_role() is not null and (role = private.management_role() or private.management_role() = 'founder'));
create trigger role_permissions_audit after insert or update or delete on public.role_permissions
  for each row execute function private.audit_mgmt_row();

-- Server-side permission check for RPCs (Phase 3 modules call this).
create or replace function private.has_permission(p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select from public.role_permissions rp where rp.role = private.management_role() and rp.permission = p_permission);
$$;

-- Matches web/contracts/management.ts EffectivePermissions.
create or replace function public.my_permissions() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text := private.require_member();
begin
  return jsonb_build_object('actorId', auth.uid(), 'role', v_role, 'aal', auth.jwt() ->> 'aal',
    'permissions', coalesce((select jsonb_agg(jsonb_build_object('permission', rp.permission, 'scope', rp.scope, 'allowed', true, 'expiresAt', null)
      order by rp.permission) from public.role_permissions rp where rp.role = v_role), '[]'::jsonb));
end $$;

create or replace function public.permission_matrix() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text := private.require_member();
begin
  if v_role not in ('founder', 'co_founder') then perform private.api_error('PERMISSION_DENIED'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('role', rp.role, 'permission', rp.permission, 'scope', rp.scope)
    order by rp.permission, rp.role) from public.role_permissions rp), '[]'::jsonb);
end $$;

-- ───────────── COO and Manager can be invited (same Founder-only path, same checks) ─────────────
create or replace function public.management_set_member(p_user uuid, p_email text, p_role text, p_office text, p_note text)
returns void language plpgsql security definer set search_path = '' as $function$
declare target uuid; address text := lower(trim(p_email)); event_id uuid; founder_office text;
begin
 if private.management_role() is distinct from 'founder' then raise exception 'Founder verification required' using errcode='42501'; end if;
 if p_role not in ('ceo','co_founder','coo','manager','employee','none') or coalesce(length(trim(p_note)),0) not between 1 and 500
 or (p_role <> 'none' and coalesce(length(trim(p_office)),0) not between 1 and 120)
 or (p_user is null and (address is null or length(address)>254 or address !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
 then raise exception 'Invalid membership change'; end if;
 if p_user is not null and nullif(address,'') is not null then raise exception 'Specify one person'; end if;
 if p_user is not null then
   select lower(email) into address from auth.users where id=p_user;
 end if;
 if address is not null then
   perform pg_advisory_xact_lock(hashtextextended(address, 0));
 end if;
 if p_user is null then
   select id into target from auth.users where lower(email)=address and deleted_at is null;
 else
   target := p_user;
 end if;
 if target=auth.uid() or exists(select from public.profiles where id=target and role='admin')
 or exists(select from public.management_members where user_id=target and role='founder') then raise exception 'Protected account' using errcode='42501'; end if;
 select office into founder_office from public.management_members where user_id=auth.uid();
 if target is null or (p_user is null and exists(select from public.leadership_invitations where email=address and accepted_at is null)) then
   if p_role='none' then raise exception 'No account to remove'; end if;
   insert into public.leadership_invitations(email,role,office,reason,invited_by)
   values(address,p_role,trim(p_office),trim(p_note),auth.uid())
   on conflict(email) where accepted_at is null do update set role=excluded.role,office=excluded.office,reason=excluded.reason,invited_by=excluded.invited_by,created_at=now();
 else
   if p_user is not null then
     delete from public.leadership_invitations where email=address and accepted_at is null;
   end if;
   if p_role='none' then
     delete from public.management_members where user_id=target and role <> 'founder';
     if not found then raise exception 'Membership not found'; end if;
   else
     insert into public.management_members(user_id,role,office) values(target,p_role,trim(p_office))
     on conflict(user_id) do update set role=excluded.role,office=excluded.office;
   end if;
 end if;
 insert into public.management_work(owner_id,office,kind,subject,status)
 values(auth.uid(),founder_office,'strategy','Access change: '||coalesce(target::text,address)||' → '||p_role,'completed') returning id into event_id;
 insert into public.management_events(work_id,actor,action,note) values(event_id,auth.uid(),'access_changed',trim(p_note));
end $function$;

-- ───────────── One-time claim codes ─────────────
create table private.invitation_claims (
  invitation_id uuid primary key references public.leadership_invitations(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  verified_at timestamptz,
  issued_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table private.invitation_claims enable row level security;
revoke all on private.invitation_claims from anon, authenticated;

-- Founder issues (or re-issues) a code for an open invitation. The code is returned once and stored only as a hash.
create or replace function public.management_issue_claim_code(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare inv public.leadership_invitations; code text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea; i int;
begin
  if private.management_role() is distinct from 'founder' then perform private.api_error('PERMISSION_DENIED', 'Founder verification required'); end if;
  select * into inv from public.leadership_invitations where email = lower(trim(p_email)) and accepted_at is null
    and created_at > now() - interval '7 days';
  if not found then perform private.api_error('NOT_FOUND', 'No open invitation for this email'); end if;
  b := extensions.gen_random_bytes(12); code := '';
  for i in 0..11 loop code := code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1); end loop;
  code := substr(code, 1, 4) || '-' || substr(code, 5, 4) || '-' || substr(code, 9, 4);
  insert into private.invitation_claims(invitation_id, code_hash, expires_at, issued_by)
  values (inv.id, encode(extensions.digest(code, 'sha256'), 'hex'), now() + interval '72 hours', auth.uid())
  on conflict (invitation_id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at,
    attempts = 0, verified_at = null, issued_by = excluded.issued_by, created_at = now();
  perform private.audit_event('claim_code_issued', 'leadership_invitations', inv.id::text, null,
    jsonb_build_object('email', inv.email, 'role', inv.role, 'expires', now() + interval '72 hours'));
  return code;
end $$;

-- The invited person, signed in with the invited email, enters the code. Five wrong attempts lock the code.
-- Returns {ok, attemptsLeft}; a wrong code is recorded (not rolled back) so attempts really count.
create or replace function public.claim_leadership_account(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare address text; inv public.leadership_invitations; c private.invitation_claims; ok boolean;
begin
  if auth.uid() is null then perform private.api_error('AUTH_REQUIRED'); end if;
  select lower(email) into address from auth.users where id = auth.uid() and email_confirmed_at is not null and deleted_at is null;
  if address is null then perform private.api_error('PERMISSION_DENIED', 'Confirm your email first'); end if;
  select * into inv from public.leadership_invitations where email = address and accepted_at is null and created_at > now() - interval '7 days';
  if not found then perform private.api_error('NOT_FOUND', 'No open invitation'); end if;
  select * into c from private.invitation_claims where invitation_id = inv.id for update;
  if not found then perform private.api_error('NOT_FOUND', 'No claim code was issued'); end if;
  if c.verified_at is null and (c.expires_at < now() or c.attempts >= 5) then
    return jsonb_build_object('ok', false, 'attemptsLeft', 0, 'reason', 'expired_or_locked');
  end if;
  ok := c.verified_at is not null
        or encode(extensions.digest(upper(trim(coalesce(p_code, ''))), 'sha256'), 'hex') = c.code_hash;
  if not ok then
    update private.invitation_claims set attempts = attempts + 1 where invitation_id = inv.id;
    perform private.audit_event('claim_code_failed', 'leadership_invitations', inv.id::text, null, jsonb_build_object('attempt', c.attempts + 1));
    return jsonb_build_object('ok', false, 'attemptsLeft', greatest(0, 4 - c.attempts), 'reason', 'wrong_code');
  end if;
  update private.invitation_claims set verified_at = coalesce(verified_at, now()) where invitation_id = inv.id;
  perform public.accept_leadership_invitation();
  perform private.audit_event('account_claimed', 'leadership_invitations', inv.id::text, null, jsonb_build_object('role', inv.role));
  return jsonb_build_object('ok', true, 'attemptsLeft', null, 'reason', null);
end $$;

-- Existing acceptance, plus one rule: if a claim code was issued, it must be verified first.
create or replace function public.accept_leadership_invitation() returns void
language plpgsql security definer set search_path = '' as $function$
declare invitation public.leadership_invitations; assigned_office text; address text;
begin
 select lower(email) into address from auth.users where id=auth.uid() and deleted_at is null;
 if address is not null then perform pg_advisory_xact_lock(hashtextextended(address, 0)); end if;
 select i.* into invitation from public.leadership_invitations i join auth.users u on lower(u.email)=i.email
 where u.id=auth.uid() and u.email_confirmed_at is not null and u.deleted_at is null
 and i.accepted_at is null and i.created_at>now()-interval '7 days' for update of i;
 if not found then
   if exists(select from public.leadership_invitations where accepted_by=auth.uid() and accepted_at is not null)
      and exists(select from public.management_members where user_id=auth.uid()) then return; end if;
   raise exception 'No active invitation';
 end if;
 if exists(select from private.invitation_claims c where c.invitation_id = invitation.id and c.verified_at is null) then
   raise exception 'CLAIM_CODE_REQUIRED' using errcode = '42501', hint = 'Enter the one-time claim code you were given.';
 end if;
 if exists(select from public.profiles where id=auth.uid() and role='admin')
   or exists(select from public.management_members where user_id=auth.uid() and role='founder') then
   raise exception 'Protected account' using errcode='42501';
 end if;
 select office into strict assigned_office from public.management_members where user_id=invitation.invited_by and role='founder';
 insert into public.management_members(user_id,role,office) values(auth.uid(),invitation.role,coalesce(nullif(invitation.office,''),assigned_office)) on conflict(user_id) do nothing;
 update public.leadership_invitations set accepted_by=auth.uid(),accepted_at=now() where id=invitation.id;
end $function$;

revoke all on function private.has_permission(text) from public, anon, authenticated;
revoke all on function public.my_permissions(), public.permission_matrix(), public.management_issue_claim_code(text),
  public.claim_leadership_account(text) from public, anon;
grant execute on function public.my_permissions(), public.permission_matrix(), public.management_issue_claim_code(text),
  public.claim_leadership_account(text) to authenticated;
