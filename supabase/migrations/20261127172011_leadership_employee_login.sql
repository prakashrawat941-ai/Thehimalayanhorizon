-- Employee IDs are private sign-in aliases. The email remains the Auth identity.
create table private.leadership_employee_ids (
  email text primary key check (email = lower(trim(email))),
  employee_id text not null unique check (employee_id ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$')
);
alter table private.leadership_employee_ids enable row level security;
revoke all on private.leadership_employee_ids from public, anon, authenticated;

create function public.management_set_leadership_employee_id(
  p_email text, p_role text, p_office text, p_note text, p_employee_id text
) returns void
language plpgsql security definer set search_path = '' as $$
declare address text := lower(trim(p_email)); code text := upper(trim(p_employee_id));
begin
  if private.management_role() is distinct from 'founder' then
    raise exception 'Founder verification required' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('ceo', 'co_founder') or code is null
     or code !~ '^[A-Z0-9][A-Z0-9_-]{2,31}$' then
    raise exception 'Choose CEO or Co-founder and enter a valid employee ID.';
  end if;
  -- The existing function validates and locks the email and records the audit event.
  -- A duplicate employee ID rolls back that change and its audit event together.
  perform public.management_set_member(null, address, p_role, p_office, p_note);
  insert into private.leadership_employee_ids(email, employee_id) values (address, code)
  on conflict (email) do update set employee_id = excluded.employee_id;
exception when unique_violation then
  raise exception 'This employee ID is already in use.';
end $$;

create function public.management_leadership_employee_ids()
returns table(user_id uuid, employee_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.management_role() is distinct from 'founder' then
    raise exception 'Founder verification required' using errcode = '42501';
  end if;
  return query select u.id, ids.employee_id
  from private.leadership_employee_ids ids
  join auth.users u on lower(u.email) = ids.email and u.deleted_at is null
  join public.management_members m on m.user_id = u.id and m.role in ('ceo', 'co_founder');
end $$;

create function public.management_pending_employee_id() returns text
language sql stable security definer set search_path = '' as $$
  select ids.employee_id from auth.users u
  join public.leadership_invitations i on i.email = lower(u.email)
  join private.leadership_employee_ids ids on ids.email = i.email
  where u.id = auth.uid() and u.deleted_at is null and u.email_confirmed_at is not null
    and i.role in ('ceo', 'co_founder') and i.accepted_at is null
    and i.created_at > now() - interval '7 days';
$$;

create function public.management_employee_login_email(p_employee_id text) returns text
language sql stable security definer set search_path = '' as $$
  select u.email from private.leadership_employee_ids ids
  join auth.users u on lower(u.email) = ids.email
  join public.management_members m on m.user_id = u.id
  where ids.employee_id = upper(trim(p_employee_id))
    and u.email_confirmed_at is not null and u.deleted_at is null
    and coalesce(u.banned_until, '-infinity') < now()
    and m.role in ('ceo', 'co_founder');
$$;

revoke all on function public.management_set_leadership_employee_id(text,text,text,text,text),
  public.management_leadership_employee_ids(), public.management_pending_employee_id(),
  public.management_employee_login_email(text) from public, anon, authenticated;
grant execute on function public.management_set_leadership_employee_id(text,text,text,text,text),
  public.management_leadership_employee_ids(), public.management_pending_employee_id() to authenticated;
grant execute on function public.management_employee_login_email(text) to service_role;
