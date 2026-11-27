-- Dashboard integration. All privileged reads and membership changes require a Founder aal2 session.
create or replace function public.management_people()
returns table(user_id uuid, display_name text, role text, office text, mfa text, last_active timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
 if private.management_role() is distinct from 'founder' then raise exception 'Founder verification required' using errcode='42501'; end if;
 return query
 select u.id,coalesce(nullif(m.display_name,''),nullif(p.full_name,''),u.email),
        coalesce(m.role,'admin'),m.office,
        case when exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified') then 'verified' else 'not_set' end,
        u.last_sign_in_at
 from auth.users u left join public.management_members m on m.user_id=u.id
 left join public.profiles p on p.id=u.id
 where m.user_id is not null or p.role='admin'
 order by coalesce(m.display_name,p.full_name,u.email);
end $$;
revoke all on function public.management_people() from public,anon;
grant execute on function public.management_people() to authenticated;

alter table public.leadership_invitations drop constraint leadership_invitations_role_check;
alter table public.leadership_invitations add constraint leadership_invitations_role_check check(role in ('ceo','co_founder','employee'));
alter table public.leadership_invitations add column office text;
alter table public.leadership_invitations add column reason text;

create function public.management_set_member(p_user uuid,p_email text,p_role text,p_office text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; address text := lower(trim(p_email)); event_id uuid; founder_office text;
begin
 if private.management_role() is distinct from 'founder' then raise exception 'Founder verification required' using errcode='42501'; end if;
 if p_role not in ('ceo','co_founder','employee','none') or coalesce(length(trim(p_note)),0) not between 1 and 500
 or (p_role <> 'none' and coalesce(length(trim(p_office)),0) not between 1 and 120)
 or (p_user is null and (address is null or length(address)>254 or address !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
 then raise exception 'Invalid membership change'; end if;
 if p_user is not null and nullif(address,'') is not null then raise exception 'Specify one person'; end if;
 if p_user is null then select id into target from auth.users where lower(email)=address; else target := p_user; end if;
 if target=auth.uid() or exists(select from public.profiles where id=target and role='admin')
 or exists(select from public.management_members where user_id=target and role='founder') then raise exception 'Protected account' using errcode='42501'; end if;
 select office into founder_office from public.management_members where user_id=auth.uid();
 if target is null then
   if p_role='none' then raise exception 'No account to remove'; end if;
   insert into public.leadership_invitations(email,role,office,reason,invited_by)
   values(address,p_role,trim(p_office),trim(p_note),auth.uid())
   on conflict(email) where accepted_at is null do update set role=excluded.role,office=excluded.office,reason=excluded.reason,invited_by=excluded.invited_by,created_at=now();
 else
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
revoke all on function public.management_set_member(uuid,text,text,text,text) from public,anon;
grant execute on function public.management_set_member(uuid,text,text,text,text) to authenticated;

-- Respect the office the Founder chose for an invited person.
create or replace function public.accept_leadership_invitation() returns void
language plpgsql security definer set search_path='' as $$
declare invitation public.leadership_invitations; assigned_office text;
begin
 select i.* into invitation from public.leadership_invitations i join auth.users u on lower(u.email)=i.email
 where u.id=auth.uid() and u.email_confirmed_at is not null and u.deleted_at is null
 and i.accepted_at is null and i.created_at>now()-interval '7 days' for update of i;
 if not found then raise exception 'No active invitation'; end if;
 select office into strict assigned_office from public.management_members where user_id=invitation.invited_by and role='founder';
 insert into public.management_members(user_id,role,office) values(auth.uid(),invitation.role,coalesce(nullif(invitation.office,''),assigned_office));
 update public.leadership_invitations set accepted_by=auth.uid(),accepted_at=now() where id=invitation.id;
end $$;
create function public.management_invitation_pending(p_email text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if private.management_role() is distinct from 'founder' then raise exception 'Founder verification required' using errcode='42501'; end if;
 return exists(select from public.leadership_invitations where email=lower(trim(p_email)) and accepted_at is null);
end $$;
revoke all on function public.management_invitation_pending(text) from public,anon;
grant execute on function public.management_invitation_pending(text) to authenticated;
-- Let each dashboard read the operational records it actually displays, only with aal2.
create policy management_ceo_bookings on public.booking_requests for select to authenticated using (private.management_role()='ceo');
create policy management_ceo_cab_bookings on public.cab_bookings for select to authenticated using (private.management_role()='ceo');
create policy management_ceo_sos on public.sos_incidents for select to authenticated using (private.management_role()='ceo');
create policy management_ceo_tickets on public.support_tickets for select to authenticated using (private.management_role()='ceo');
create policy management_cofounder_partners on public.partners for select to authenticated using (private.management_role()='co_founder' and status='pending');
create policy management_cofounder_stays on public.homestays for select to authenticated using (private.management_role()='co_founder' and status in ('pending','draft'));
create policy management_cofounder_rooms on public.homestay_rooms for select to authenticated using (private.management_role()='co_founder' and exists(select from public.homestays h where h.id=homestay_id and h.status in ('pending','draft')));
create policy management_cofounder_kyc on public.partner_kyc for select to authenticated using (private.management_role()='co_founder');
create policy management_founder_audit on public.audit_log for select to authenticated using (private.management_role()='founder');
create policy management_ceo_directory on public.management_members for select to authenticated using (private.management_role()='ceo');
-- Preserve fields that have no column on locations and the source of every entered field.
create table public.management_location_drafts (
 id uuid primary key default gen_random_uuid(), created_by uuid not null references auth.users(id),
 fields jsonb not null, field_sources jsonb not null, match_id text,
 created_at timestamptz not null default now()
);
create table public.location_details (
 location_id uuid primary key references public.locations(id) on delete cascade,
 nearest_town text, altitude_m integer, field_sources jsonb not null default '{}'::jsonb,
 show_on_home boolean not null default true
);
alter table public.management_location_drafts enable row level security;
alter table public.location_details enable row level security;
revoke all on public.management_location_drafts,public.location_details from public,anon,authenticated;
grant select on public.location_details to authenticated;
create policy location_details_management on public.location_details for select to authenticated using (private.management_role()='co_founder');

create function private.validate_location_fields(p_fields jsonb,p_sources jsonb) returns void language plpgsql set search_path='' as $$
declare k text; v text;
begin
 if jsonb_typeof(p_fields)<>'object' or jsonb_typeof(p_sources)<>'object' then raise exception 'Invalid place details'; end if;
 if coalesce(length(trim(p_fields->>'name')),0) not between 2 and 120 then raise exception 'Place name required'; end if;
 for k,v in select key,value from jsonb_each_text(p_fields) loop
  if k not in ('name','name_hi','district','region','kind','lat_lng','nearest_town','altitude_m','best_season','image_url') or length(v)>500 then raise exception 'Invalid place field'; end if;
 end loop;
 for k,v in select key,value from jsonb_each_text(p_sources) loop
  if k not in ('name','name_hi','district','region','kind','lat_lng','nearest_town','altitude_m','best_season','image_url')
     or v not in ('places','locations','osm','derived','suggested','manual') then raise exception 'Invalid field source'; end if;
 end loop;
end $$;
revoke all on function private.validate_location_fields(jsonb,jsonb) from public,anon,authenticated;
create function public.management_location_draft(p_fields jsonb,p_sources jsonb,p_match text)
returns uuid language plpgsql security definer set search_path='' as $$
declare draft uuid; event_id uuid;
begin
 if private.management_role() is distinct from 'co_founder' then raise exception 'Verification required' using errcode='42501'; end if;
 perform private.validate_location_fields(p_fields,p_sources);
 insert into public.management_location_drafts(created_by,fields,field_sources,match_id) values(auth.uid(),p_fields,p_sources,p_match) returning id into draft;
 insert into public.management_work(owner_id,office,kind,subject,status)
 select user_id,office,'cms','Location draft: '||left(p_fields->>'name',120),'completed' from public.management_members where user_id=auth.uid() returning id into event_id;
 insert into public.management_events(work_id,actor,action,note) values(event_id,auth.uid(),'draft_saved',draft::text);
 return draft;
end $$;
create function public.management_location_publish(p_fields jsonb,p_sources jsonb,p_match text,p_home boolean,p_featured boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare place uuid; coords text[]; slug_name text; event_id uuid; section_id uuid;
begin
 if private.management_role() is distinct from 'co_founder' then raise exception 'Verification required' using errcode='42501'; end if;
 perform private.validate_location_fields(p_fields,p_sources);
 if coalesce(p_fields->>'region','') not in ('Garhwal','Kumaon') or coalesce(p_fields->>'kind','') not in ('destination','village','town','transport_hub')
 or length(coalesce(p_fields->>'district',''))>60 or length(coalesce(p_fields->>'name_hi',''))>120 or length(coalesce(p_fields->>'best_season',''))>120
 or (nullif(p_fields->>'altitude_m','') is not null and (p_fields->>'altitude_m') !~ '^[0-9]{1,5}$')
 then raise exception 'Set a valid region, kind, district and altitude before publishing'; end if;
 if nullif(p_fields->>'image_url','') is not null and (p_fields->>'image_url') !~ '^(https://|/)' then raise exception 'Use an HTTPS or site photo URL'; end if;
 if nullif(p_fields->>'lat_lng','') is not null then
  if (p_fields->>'lat_lng') !~ '^([0-9]+([.][0-9]+)?),[ ]*([0-9]+([.][0-9]+)?)$' then raise exception 'Enter latitude, longitude'; end if;
  coords:=regexp_split_to_array(p_fields->>'lat_lng',',[ ]*');
  if coords[1]::double precision not between 28 and 32 or coords[2]::double precision not between 77 and 82 then raise exception 'Coordinates outside Uttarakhand'; end if;
 end if;
 if exists(select from public.locations l where lower(l.name)=lower(trim(p_fields->>'name')) and lower(l.district)=lower(coalesce(p_fields->>'district','')))
 then raise exception 'Location with this name and district already exists'; end if;
 slug_name:=trim(both '-' from regexp_replace(lower(trim(p_fields->>'name')),'[^a-z0-9]+','-','g'));
 if slug_name='' then raise exception 'A Latin spelling is needed for the URL'; end if;
 insert into public.locations(slug,name,name_hi,kind,region,district,lat,lng,best_season,image_url,is_published,is_featured)
 values(left(slug_name,64)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8),trim(p_fields->>'name'),coalesce(p_fields->>'name_hi',''),p_fields->>'kind',p_fields->>'region',coalesce(p_fields->>'district',''),coords[1]::double precision,coords[2]::double precision,coalesce(p_fields->>'best_season',''),nullif(p_fields->>'image_url',''),true,p_featured)
 returning id into place;
 insert into public.location_details(location_id,nearest_town,altitude_m,field_sources,show_on_home)
 values(place,nullif(p_fields->>'nearest_town',''),nullif(p_fields->>'altitude_m','')::integer,p_sources,p_home);
 if not p_home then
  select id into section_id from public.home_sections where kind='destinations' order by position limit 1 for update;
  if section_id is null then raise exception 'Homepage destinations section unavailable'; end if;
  update public.home_sections set data=jsonb_set(coalesce(data,'{}'::jsonb),'{hidden_location_ids}',coalesce(data->'hidden_location_ids','[]'::jsonb)||to_jsonb(place::text)) where id=section_id;
 end if;
 -- The management_cms_event trigger records the locations/home_sections changes as well.
 insert into public.management_work(owner_id,office,kind,subject,status)
 select user_id,office,'cms','Published location: '||left(p_fields->>'name',120),'completed' from public.management_members where user_id=auth.uid() returning id into event_id;
 insert into public.management_events(work_id,actor,action,note) values(event_id,auth.uid(),'published',place::text||coalesce(' from '||p_match,''));
 return place;
end $$;
revoke all on function public.management_location_draft(jsonb,jsonb,text),public.management_location_publish(jsonb,jsonb,text,boolean,boolean) from public,anon;
grant execute on function public.management_location_draft(jsonb,jsonb,text),public.management_location_publish(jsonb,jsonb,text,boolean,boolean) to authenticated;
-- C1: leave the integer[] RPC intact for older clients; new clients get status per active seat.
create function public.cab_ride_seat_status(p_ride uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('seat_no',h.seat_no,'status',case when b.status='pending' then 'held' else 'confirmed' end) order by h.seat_no),'[]'::jsonb)
 from public.cab_seat_holds h join public.cab_bookings b on b.id=h.booking_id
 join public.cab_rides r on r.id=h.ride_id
 where h.ride_id=p_ride and h.released_at is null
 and (not r.is_test or r.driver_id=auth.uid() or private.is_admin());
$$;
revoke all on function public.cab_ride_seat_status(uuid) from public,anon;
grant execute on function public.cab_ride_seat_status(uuid) to anon,authenticated;
