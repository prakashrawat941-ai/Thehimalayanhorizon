create table public.leadership_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('ceo','co_founder')),
  invited_by uuid not null references public.management_members(user_id),
  created_at timestamptz not null default now(),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz
);
alter table public.leadership_invitations enable row level security;
revoke all on public.leadership_invitations from public, anon, authenticated;
create unique index leadership_invitation_pending on public.leadership_invitations(email) where accepted_at is null;

create function public.invite_leadership(p_email text,p_role text) returns void
language plpgsql security definer set search_path='' as $$
declare address text := lower(trim(p_email));
begin
  if private.management_role() is distinct from 'founder' then raise exception 'Founder verification required'; end if;
  if address !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(address)>254
    or p_role not in ('ceo','co_founder') then raise exception 'Invalid invitation'; end if;
  if exists(select from auth.users u join public.management_members m on m.user_id=u.id where lower(u.email)=address)
    then raise exception 'Account already has a role'; end if;
  insert into public.leadership_invitations(email,role,invited_by) values(address,p_role,auth.uid())
    on conflict(email) where accepted_at is null do update set role=excluded.role,invited_by=excluded.invited_by,created_at=now();
end $$;

create function public.accept_leadership_invitation() returns void
language plpgsql security definer set search_path='' as $$
declare invitation public.leadership_invitations; assigned_office text;
begin
  select i.* into invitation from public.leadership_invitations i join auth.users u on lower(u.email)=i.email
    where u.id=auth.uid() and u.email_confirmed_at is not null and u.deleted_at is null
      and i.accepted_at is null and i.created_at>now()-interval '7 days' for update of i;
  if not found then raise exception 'No active invitation'; end if;
  select office into strict assigned_office from public.management_members where user_id=invitation.invited_by and role='founder';
  insert into public.management_members(user_id,role,office) values(auth.uid(),invitation.role,assigned_office);
  update public.leadership_invitations set accepted_by=auth.uid(),accepted_at=now() where id=invitation.id;
end $$;
revoke all on function public.invite_leadership(text,text), public.accept_leadership_invitation() from public,anon;
grant execute on function public.invite_leadership(text,text), public.accept_leadership_invitation() to authenticated;
