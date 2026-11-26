-- Phase 2 RBAC negative tests for the management workspace. Runs inside a transaction that is ROLLED BACK.
-- Run after management-test.sql is green and after 20261125000000_rbac_guards.sql is applied.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) select ('20000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,'rbac'||i||'@example.invalid' from generate_series(1,6) i;
insert into public.management_members(user_id,role,office)
select id,case email when 'rbac1@example.invalid' then 'founder' when 'rbac2@example.invalid' then 'ceo'
 when 'rbac3@example.invalid' then 'co_founder' else 'employee' end,'Almora' from auth.users where email like 'rbac%@example.invalid' and email<>'rbac6@example.invalid';

create function pg_temp.login(n int,level text default 'aal2') returns void language sql as $$
 select set_config('request.jwt.claims',json_build_object('sub','20000000-0000-0000-0000-'||lpad(n::text,12,'0'),'role','authenticated','aal',level)::text,true)::text;
$$;
create function pg_temp.check_true(ok boolean, msg text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',msg; end if; end $$;
-- Any refusal counts as denied: the guards raise plain exceptions as well as privilege errors.
create function pg_temp.refused(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then return true; end $$;

insert into public.partners(business_name,contact_name,phone,categories,owner_id)
 values('RBAC stay','Test owner','9999999998','{homestay}','20000000-0000-0000-0000-000000000006') returning id as partner_id \gset

-- Founder strategy item: the CEO must not be able to decide it.
set local role authenticated;
select pg_temp.login(1);
select public.management_submit('strategy','Expand to Kumaon') as strategy_id \gset
select pg_temp.login(2);
select pg_temp.check_true(pg_temp.refused(format('select public.management_decide(%L,%L,%L)',:'strategy_id','completed','Not mine')),'CEO decided a founder strategy item');

-- Partner review: the founder must not be able to approve it.
select pg_temp.login(3);
select public.management_submit('partner','Check documents',p_partner=>:'partner_id') as review_id \gset
select pg_temp.login(1);
select pg_temp.check_true(pg_temp.refused(format('select public.management_decide(%L,%L,%L)',:'review_id','approved','Founder ruling')),'Founder approved a partner review');

-- Direct partner status change outside the approval path: the guard reverts the status silently.
select pg_temp.login(2);
update public.partners set status = 'approved' where id = :'partner_id';
reset role;
select pg_temp.check_true((select status = 'pending' from public.partners where id = :'partner_id'),'Direct partner status change was not reverted');

-- Direct profile role change to partner outside the approval path: refused.
set local role authenticated;
select pg_temp.login(2);
select pg_temp.check_true(pg_temp.refused($q$update public.profiles set role = 'partner' where id = '20000000-0000-0000-0000-000000000006'$q$),'CEO changed a profile role directly');

-- Leadership protection: the CEO cannot overwrite a Co-Founder membership through the employee function.
select pg_temp.check_true(pg_temp.refused($q$select public.management_employee('rbac3@example.invalid','Almora','Overwrite')$q$),'CEO overwrote a leadership membership');

-- Approval path still works: CEO approves the co-founder's review, partner becomes approved and owner becomes partner.
select pg_temp.login(2);
select public.management_decide(:'review_id','approved','Checked');
reset role;
select pg_temp.check_true((select status = 'approved' from public.partners where id = :'partner_id'),'Approved partner review did not apply');
select pg_temp.check_true((select role = 'partner' from public.profiles where id = '20000000-0000-0000-0000-000000000006'),'Approved owner did not become a partner');

rollback;
