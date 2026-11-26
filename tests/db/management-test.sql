\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) select ('10000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,'staff'||i||'@example.invalid' from generate_series(1,6) i;
insert into public.management_members(user_id,role,office)
select id,case email when 'staff1@example.invalid' then 'founder' when 'staff2@example.invalid' then 'ceo'
 when 'staff3@example.invalid' then 'co_founder' else 'employee' end,'Almora' from auth.users where email like 'staff%@example.invalid' and email<>'staff6@example.invalid';
create function pg_temp.login(n int,level text default 'aal2') returns void language sql as $$
 select set_config('request.jwt.claims',json_build_object('sub','10000000-0000-0000-0000-'||lpad(n::text,12,'0'),'role','authenticated','aal',level)::text,true)::text;
$$;
create function pg_temp.check_true(ok boolean, msg text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',msg; end if; end $$;
create function pg_temp.denied(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when insufficient_privilege or unique_violation then return true; end $$;
insert into public.partners(business_name,contact_name,phone,categories,owner_id)
 values('Village stay','Test owner','9999999999','{homestay}','10000000-0000-0000-0000-000000000006') returning id as partner_id \gset
set local role authenticated;
select pg_temp.login(4,'aal1');
select pg_temp.check_true(pg_temp.denied($q$select public.management_submit('attendance','Present')$q$),'MFA bypass');
select pg_temp.login(4);
select public.management_submit('attendance','Present');
select pg_temp.check_true(pg_temp.denied($q$select public.management_submit('attendance','Retry')$q$),'Duplicate attendance');
select public.management_submit('expense','Office supplies',130) as expense_id \gset
select pg_temp.check_true(pg_temp.denied(format('select public.management_decide(%L,%L,%L)',:'expense_id','approved','Self')),'Self approval');
select pg_temp.check_true(pg_temp.denied($q$update public.management_members set role='founder'$q$),'Direct membership update');
select pg_temp.login(5);
select pg_temp.check_true(not exists(select from public.management_work),'Other employee work visible');
select pg_temp.login(1);
select public.management_decide(:'expense_id','approved','Receipt verified');
select pg_temp.check_true((select count(*)=2 from public.management_events where work_id=:'expense_id'),'Expense audit trail');
select * from public.management_finance();
select pg_temp.login(2);
select public.management_employee('staff6@example.invalid','Surmoli','New employee');
select public.management_submit('task','Confirm office booking',null,'10000000-0000-0000-0000-000000000006') as task_id \gset
select pg_temp.login(6);
select public.management_decide(:'task_id','completed','Called guest');
select pg_temp.login(3);
select public.management_submit('release','App icon',p_icon=>'classic') as release_id \gset
select public.management_submit('partner','Check documents',p_partner=>:'partner_id') as review_id \gset
select pg_temp.login(2);
select public.management_decide(:'release_id','approved','Brand reviewed');
select pg_temp.check_true((select value='"classic"'::jsonb from public.site_settings where key='pwa_icon'),'Approved icon not applied');
select public.management_decide(:'review_id','approved','Checked');
reset role;
select pg_temp.check_true((select status='approved' from public.partners where id=:'partner_id'),'Partner approval did not apply');
select pg_temp.check_true((select role='partner' from public.profiles where id='10000000-0000-0000-0000-000000000006'),'Partner profile did not update');
select set_config('request.jwt.claims','{}',true);
insert into public.homestays(partner_id,name,village,summary,description,rooms,max_guests,price_per_night,status)
 values(:'partner_id','Test office stay','Surmoli','Summary','Description',1,2,1000,'approved') returning id as stay_id \gset
insert into public.homestay_rooms(homestay_id,room_type,base_price,total_inventory)
 values(:'stay_id','Double',1000,1) returning id as room_id \gset
set local role authenticated;
select pg_temp.login(4);
select gen_random_uuid() as request_key \gset
select public.management_book_stay(:'request_key',:'room_id','Walk-in guest','9999999999',current_date+2,current_date+3,1) as office_work \gset
select pg_temp.check_true(public.management_book_stay(:'request_key',:'room_id','Walk-in guest','9999999999',current_date+2,current_date+3,1)=:'office_work'::uuid,'Retry made another booking');
select pg_temp.check_true((select count(*)=1 from public.booking_requests b join public.management_work w on b.booking_code=w.booking_code where w.id=:'office_work' and b.status='requested'),'Office request missing');
rollback;
