begin;

-- Offboarding clears assignments without blocking removal or leaving active initiatives stranded.
alter table public.management_work drop constraint management_work_assignee_fkey;
alter table public.management_work add constraint management_work_assignee_fkey
  foreign key (assignee) references public.management_members(user_id) on delete set null;

create function private.reopen_unassigned_initiative()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.assignee is not null and new.assignee is null and new.initiative_stage='assigned' then
    new.initiative_stage := 'planning';
    new.due_date := null;
  end if;
  return new;
end $$;
revoke all on function private.reopen_unassigned_initiative() from public,anon,authenticated;
create trigger management_work_reopen_unassigned
  before update of assignee on public.management_work
  for each row execute function private.reopen_unassigned_initiative();

-- Keep pending invitations pending on resend and serialize invitations by email.
create or replace function public.management_set_member(p_user uuid,p_email text,p_role text,p_office text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; address text := lower(trim(p_email)); event_id uuid; founder_office text;
begin
 if private.management_role() is distinct from 'founder' then raise exception 'Founder verification required' using errcode='42501'; end if;
 if p_role not in ('ceo','co_founder','employee','none') or coalesce(length(trim(p_note)),0) not between 1 and 500
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
end $$;

create or replace function public.accept_leadership_invitation() returns void
language plpgsql security definer set search_path='' as $$
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
 if exists(select from public.profiles where id=auth.uid() and role='admin')
   or exists(select from public.management_members where user_id=auth.uid() and role='founder') then
   raise exception 'Protected account' using errcode='42501';
 end if;
 select office into strict assigned_office from public.management_members where user_id=invitation.invited_by and role='founder';
 insert into public.management_members(user_id,role,office) values(auth.uid(),invitation.role,coalesce(nullif(invitation.office,''),assigned_office)) on conflict(user_id) do nothing;
 update public.leadership_invitations set accepted_by=auth.uid(),accepted_at=now() where id=invitation.id;
end $$;

create or replace function public.management_onboarding_kyc() returns table(partner_id uuid,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if private.management_role() is distinct from 'co_founder' then raise exception 'Verification required' using errcode='42501'; end if;
 return query select k.partner_id,k.status from public.partner_kyc k
 join public.partners p on p.id=k.partner_id where (p.status='pending' and 'homestay'=any(p.categories))
    or (p.status='approved' and exists (
      select from public.homestays h where h.partner_id=p.id and h.status in ('draft','pending')
    ));
end $$;

-- A Co-founder can resume their own draft from the editor after MFA.
grant select on public.management_location_drafts to authenticated;
create policy management_location_drafts_owner on public.management_location_drafts
  for select to authenticated using (created_by=(select auth.uid()) and (select private.management_role())='co_founder');

create function public.management_location_save(p_id uuid,p_fields jsonb,p_sources jsonb,p_match text)
returns uuid language plpgsql security definer set search_path='' as $$
declare draft uuid; event_id uuid;
begin
  if private.management_role() is distinct from 'co_founder' then raise exception 'Verification required' using errcode='42501'; end if;
  if p_id is null then return public.management_location_draft(p_fields,p_sources,p_match); end if;
  perform private.validate_location_fields(p_fields,p_sources);
  update public.management_location_drafts set fields=p_fields,field_sources=p_sources,match_id=p_match
  where id=p_id and created_by=auth.uid() returning id into draft;
  if draft is null then raise exception 'Draft unavailable'; end if;
  insert into public.management_work(owner_id,office,kind,subject,status)
  select user_id,office,'cms','Location draft updated: '||left(p_fields->>'name',120),'completed'
  from public.management_members where user_id=auth.uid() returning id into event_id;
  insert into public.management_events(work_id,actor,action,note) values(event_id,auth.uid(),'draft_saved',draft::text);
  return draft;
end $$;
revoke all on function public.management_location_save(uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.management_location_save(uuid,jsonb,jsonb,text) to authenticated;

-- Send complete listings to the existing Admin Homestays approval queue.
create function public.management_submit_homestay(p_homestay uuid)
returns void language plpgsql security definer set search_path='' as $$
declare listing public.homestays; event_id uuid;
begin
  if private.management_role() is distinct from 'co_founder' then raise exception 'Verification required' using errcode='42501'; end if;
  select h.* into listing from public.homestays h join public.partners p on p.id=h.partner_id
    where h.id=p_homestay and h.status in ('draft','pending') and p.status='approved'
      and p.owner_id is distinct from auth.uid() for update of h;
  if not found then raise exception 'Listing is not eligible for review'; end if;
  if listing.status='pending' then return; end if;
  if coalesce(cardinality(listing.images),0)<3 or nullif(trim(listing.house_rules),'') is null
    or not exists(select from public.homestay_rooms r where r.homestay_id=listing.id and r.is_active)
    or not exists(select from public.partner_kyc k where k.partner_id=listing.partner_id and k.status in ('pending','verified'))
    then raise exception 'Complete rooms, photos, house rules and KYC before review'; end if;
  update public.homestays set status='pending' where id=listing.id;
  if not exists(select from public.homestays where id=listing.id and status='pending') then
    raise exception 'Listing status could not be changed';
  end if;
  insert into public.management_work(owner_id,office,kind,subject,status)
  select user_id,office,'cms','Homestay sent for review: '||left(listing.name,120),'completed'
  from public.management_members where user_id=auth.uid() returning id into event_id;
  insert into public.management_events(work_id,actor,action,note) values(event_id,auth.uid(),'homestay_submitted',listing.id::text);
end $$;
revoke all on function public.management_submit_homestay(uuid) from public,anon;
grant execute on function public.management_submit_homestay(uuid) to authenticated;

commit;
