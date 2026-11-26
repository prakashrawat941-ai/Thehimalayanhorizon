-- Phase 2: replace depth-based trigger trust with an explicit, transaction-local approval flag.
-- Only private.apply_partner_review sets the flag, and only after management_decide has checked the decision.
-- Apply after 20261124000000_management.sql. Not applied to any live database.
begin;

create or replace function private.guard_partner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Set only inside private.apply_partner_review, which runs after management_decide has checked the caller.
  if current_setting('thh.partner_review', true) = 'approve' then
    return new;
  end if;
  if private.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.owner_id   := auth.uid();
    new.created_by := auth.uid();
    new.status     := 'pending';
    new.admin_note := '';
  else
    new.owner_id   := old.owner_id;
    new.created_by := old.created_by;
    new.status     := old.status;
    new.admin_note := old.admin_note;
  end if;
  return new;
end $$;

create or replace function private.guard_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Only the approval flag allows the traveler -> partner change made by on_partner_approved.
  if current_setting('thh.partner_review', true) = 'approve'
     and old.role = 'traveler' and new.role = 'partner' then
    return new;
  end if;
  if new.role is distinct from old.role and auth.uid() is not null and not private.is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end $$;

create or replace function private.apply_partner_review() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'partner' and new.status = 'approved' and old.status = 'open' then
    perform set_config('thh.partner_review', 'approve', true);
    update public.partners set status = 'approved'
     where id = new.partner_id and status = 'pending' and owner_id is distinct from auth.uid();
    perform set_config('thh.partner_review', '', true);
    if not found then raise exception 'Partner no longer eligible'; end if;
  end if;
  return null;
end $$;

commit;
