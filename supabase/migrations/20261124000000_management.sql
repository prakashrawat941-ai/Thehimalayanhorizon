begin;
create table public.management_members (
 user_id uuid primary key references auth.users(id), role text not null check(role in ('founder','ceo','co_founder','employee')),
 display_name text, office text not null check(length(trim(office)) between 1 and 120)
);
create table public.management_work (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 office text not null, kind text not null, subject text not null check(length(trim(subject)) between 1 and 240),
 request_key uuid, unique(owner_id,request_key), partner_id uuid references public.partners(id), booking_code text, email_to text, due_date date,
 amount numeric(12,2), assignee uuid references public.management_members(user_id),
 status text not null default 'open' check(status in ('open','completed','approved','returned')),
 created_at timestamptz not null default now(), work_day date not null default (now() at time zone 'Asia/Kolkata')::date
);
create unique index management_daily on public.management_work(owner_id,kind,work_day) where kind in ('attendance','report');
create unique index management_partner_open on public.management_work(partner_id) where kind='partner' and status='open';
create index management_work_office on public.management_work(office, created_at desc);
create table public.management_events (
 id bigint generated always as identity primary key, work_id uuid not null references public.management_work(id),
 actor uuid not null references auth.users(id), action text not null, note text, happened_at timestamptz not null default now()
);
alter table public.management_members enable row level security;
alter table public.management_work enable row level security;
alter table public.management_events enable row level security;
revoke all on public.management_members, public.management_work, public.management_events from public, anon, authenticated;
grant select on public.management_members, public.management_work, public.management_events to authenticated;
create function private.management_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.management_members where user_id=auth.uid() and auth.jwt()->>'aal'='aal2'
$$;
revoke all on function private.management_role() from public,anon;
grant execute on function private.management_role() to authenticated;
create policy management_directory on public.management_members for select to authenticated using
(user_id=auth.uid() or private.management_role()='ceo');
create policy management_inbox on public.management_work for select to authenticated using
(private.management_role() is not null and (owner_id=auth.uid() or assignee=auth.uid()
 or private.management_role()='founder' and kind in ('strategy','finance','expense','critical')
 or private.management_role()='ceo' and kind not in ('strategy','finance')
 or private.management_role()='co_founder' and kind in ('partner','cms','release')));
create policy management_history on public.management_events for select to authenticated using
(exists(select 1 from public.management_work w where w.id=work_id));

create function public.management_submit(p_kind text,p_subject text,p_amount numeric default null,p_assignee uuid default null,p_partner uuid default null,p_booking text default null,p_email text default null,p_due date default null,p_request uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare member public.management_members; work uuid; target_office text;
begin
 select * into member from public.management_members where user_id=auth.uid();
 if private.management_role() is null or not (case member.role
 when 'founder' then p_kind='strategy'
 when 'ceo' then p_kind in ('finance','critical','task','email','operation')
 when 'co_founder' then p_kind in ('partner','cms','release','critical')
 when 'employee' then p_kind in ('attendance','booking','service','expense','report') else false end)
 then raise exception 'Not permitted' using errcode='42501'; end if;
 if (p_kind in ('expense','finance')) <> (p_amount is not null) or p_amount <= 0 or p_amount::text='NaN' then raise exception 'Invalid amount'; end if;
 if p_assignee is not null then
 select office into target_office from public.management_members where user_id=p_assignee and role='employee';
 if member.role <> 'ceo' or p_kind not in ('task','email','operation') or target_office is null then raise exception 'Invalid assignment'; end if;
 end if;
 if (p_kind='partner') <> (p_partner is not null) or (p_partner is not null and not exists
 (select from public.partners where id=p_partner and status='pending' and owner_id is distinct from auth.uid())) then raise exception 'Invalid partner'; end if;
 if p_booking is not null and (p_kind <> 'booking' or not exists(select from public.booking_requests where booking_code=p_booking)
 and not exists(select from public.cab_bookings where booking_code=p_booking)) then raise exception 'Unknown booking'; end if;
 if (p_kind='email') <> (p_email is not null) or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Invalid email'; end if;
 insert into public.management_work(owner_id,office,kind,subject,amount,assignee,partner_id,booking_code,email_to,due_date,request_key,status)
 values(auth.uid(),coalesce(target_office,member.office),p_kind,trim(p_subject),p_amount,p_assignee,p_partner,p_booking,p_email,p_due,p_request,
 case when p_kind in ('attendance','report') then 'completed' else 'open' end) returning id into work;
 insert into public.management_events(work_id,actor,action) values(work,auth.uid(),'submitted');
 return work;
end $$;
create function public.management_counts() returns table(status text,total bigint) language sql stable security invoker set search_path='' as $$
 select w.status,count(*) from public.management_work w group by w.status order by w.status
$$;
revoke all on function public.management_counts() from public,anon;
grant execute on function public.management_counts() to authenticated;
create function public.management_decide(p_id uuid,p_action text,p_note text) returns void
 language plpgsql security definer set search_path='' as $$
declare w public.management_work; r text := private.management_role();
begin
 if r is null then raise exception 'Not permitted' using errcode='42501'; end if;
 select * into w from public.management_work where id=p_id for update;
 if not found or w.status <> 'open' then raise exception 'Unavailable'; end if;
 if p_action='completed' and w.kind in ('task','email','operation','booking','service','strategy') and
 (w.assignee=auth.uid() or w.owner_id=auth.uid() or r='ceo' and w.kind <> 'strategy') then null;
 elsif p_action in ('approved','returned') and w.owner_id<>auth.uid() and
 ((r='founder' and w.kind in ('critical','finance','expense')) or (r='ceo' and w.kind in ('partner','cms','release'))) then null;
 else raise exception 'Not permitted' using errcode='42501'; end if;
 if coalesce(length(trim(p_note)),0) not between 1 and 500 then raise exception 'Decision note required'; end if;
 update public.management_work set status=p_action where id=p_id;
 insert into public.management_events(work_id,actor,action,note) values(p_id,auth.uid(),p_action,trim(p_note));
end $$;
create function public.management_finance() returns table(booking_value bigint,commission bigint)
 language plpgsql stable security definer set search_path='' as $$
begin
 if private.management_role() is distinct from 'founder' then raise exception 'Not permitted' using errcode='42501'; end if;
 return query select coalesce(sum(total_amount),0)::bigint,coalesce(sum(platform_commission),0)::bigint from public.booking_requests
 where kind='homestay' and status in ('confirmed','checked_in','completed');
end $$;
revoke all on function public.management_submit(text,text,numeric,uuid,uuid,text,text,date,uuid),public.management_decide(uuid,text,text),public.management_finance() from public,anon;
grant execute on function public.management_submit(text,text,numeric,uuid,uuid,text,text,date,uuid),public.management_decide(uuid,text,text),public.management_finance() to authenticated;
-- Record direct CMS edits in the same immutable history as submissions.
create function private.management_cms_event() returns trigger language plpgsql security definer set search_path='' as $$
declare work uuid;
begin
 if private.management_role()='co_founder' then
 insert into public.management_work(owner_id,office,kind,subject,status)
 select user_id,office,'cms',tg_op || ' ' || tg_table_name || ' ' || coalesce(new.id,old.id)::text,'completed'
 from public.management_members where user_id=auth.uid() returning id into work;
 insert into public.management_events(work_id,actor,action) values(work,auth.uid(),'completed');
 end if;
 return null;
end $$;
do $$
declare t text;
begin
 foreach t in array array['home_sections','themes','locations','itineraries'] loop
 execute format('create policy management_cms on public.%I for all to authenticated using (private.management_role()=''co_founder'') with check (private.management_role()=''co_founder'')',t);
 execute format('create trigger management_cms_log after insert or update or delete on public.%I for each row execute function private.management_cms_event()',t);
 end loop;
end $$;
create or replace function private.guard_partner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' and pg_trigger_depth()>1 and private.management_role()='ceo' and old.status='pending'
    and new.status='approved' and old.owner_id is distinct from auth.uid() then return new; end if;
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
  if pg_trigger_depth()>2 and private.management_role()='ceo' and old.role='traveler' and new.role='partner'
     and exists(select from public.partners where owner_id=new.id and status='approved') then return new; end if;
  if new.role is distinct from old.role and auth.uid() is not null and not private.is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end $$;

create function private.apply_partner_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='partner' and new.status='approved' and old.status='open' then
 update public.partners set status='approved' where id=new.partner_id and status='pending' and owner_id is distinct from auth.uid();
 if not found then raise exception 'Partner no longer eligible'; end if;
 end if;
 return null;
end $$;
create trigger management_partner_decision after update of status on public.management_work for each row execute function private.apply_partner_review();
create function public.management_partner_queue() returns table(id uuid,business_name text,village text)
 language sql stable security definer set search_path='' as $$
 select p.id,p.business_name,p.village from public.partners p where private.management_role()='co_founder'
 and p.status='pending' and p.owner_id is distinct from auth.uid() order by p.created_at
$$;
create function public.management_employee(p_email text,p_office text,p_name text) returns void
 language plpgsql security definer set search_path='' as $$
declare employee_id uuid; entry uuid;
begin
 if private.management_role() is distinct from 'ceo' then raise exception 'Not permitted' using errcode='42501'; end if;
 if coalesce(length(trim(p_name)),0) not between 1 and 120 then raise exception 'Name required'; end if;
 select u.id into strict employee_id from auth.users u where lower(u.email)=lower(trim(p_email));
 if exists(select from public.profiles where id=employee_id and role='admin') then raise exception 'Existing administrator'; end if;
 insert into public.management_members(user_id,role,office,display_name) values(employee_id,'employee',trim(p_office),trim(p_name))
 on conflict(user_id) do update set office=excluded.office,display_name=excluded.display_name where management_members.role='employee';
 if not found then raise exception 'Leadership membership protected'; end if;
 insert into public.management_work(owner_id,office,kind,subject,status) values(auth.uid(),trim(p_office),'operation','Employee · '||trim(p_name),'completed') returning id into entry;
 insert into public.management_events(work_id,actor,action,note) values(entry,auth.uid(),'completed',employee_id::text);
end $$;
revoke all on function public.management_employee(text,text,text),public.management_partner_queue() from public,anon;
grant execute on function public.management_employee(text,text,text),public.management_partner_queue() to authenticated;
-- Explicit workspace membership scopes access even for a former legacy administrator.
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.profiles p where p.id=auth.uid() and p.role='admin')
 and not exists(select from public.management_members where user_id=auth.uid())
$$;
create function public.management_book_stay(p_request uuid,p_room uuid,p_guest text,p_phone text,p_start date,p_end date,p_guests integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare work uuid; stay uuid; code text;
begin
 if private.management_role() is distinct from 'employee' or p_request is null then raise exception 'Not permitted' using errcode='42501'; end if;
 select h.id into strict stay from public.homestay_rooms r join public.homestays h on h.id=r.homestay_id
 where r.id=p_room and r.is_active and h.status='approved';
 insert into public.management_work(owner_id,office,kind,subject,request_key)
 select user_id,office,'booking','Homestay',p_request from public.management_members where user_id=auth.uid()
 on conflict(owner_id,request_key) do nothing returning id into work;
 if work is null then
 select id into strict work from public.management_work where owner_id=auth.uid() and request_key=p_request and kind='booking' and booking_code is not null;
 return work;
 end if;
 -- Existing booking triggers validate inventory, quote the room and notify the host.
 insert into public.booking_requests(kind,homestay_id,room_id,rooms_booked,user_id,guest_name,guest_phone,start_date,end_date,guests)
 values('homestay',stay,p_room,1,auth.uid(),trim(p_guest),trim(p_phone),p_start,p_end,p_guests) returning booking_code into code;
 update public.management_work set booking_code=code,subject=code where id=work;
 insert into public.management_events(work_id,actor,action) values(work,auth.uid(),'submitted');
 return work;
end $$;
revoke all on function public.management_book_stay(uuid,uuid,text,text,date,date,integer) from public,anon;
grant execute on function public.management_book_stay(uuid,uuid,text,text,date,date,integer) to authenticated;
commit;
