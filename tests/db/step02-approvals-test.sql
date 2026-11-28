-- Step 02 database security fixture: approval engine, org core, hardening.
-- Run against STAGING only, after step02_* migrations. Everything is rolled back; no data is kept.
-- Every row of the final select must have ok = true.
begin;
create temp table qa_results(n serial, test text, ok boolean, detail text);
create temp table qa_ids(name text primary key, id uuid, version int);
grant all on qa_results, qa_ids to authenticated, anon;
grant usage on sequence qa_results_n_seq to authenticated, anon;

-- Returns the error message raised by p_sql ('' if it succeeded).
create function pg_temp.qa_err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return '';
exception when others then
  return sqlerrm;
end $$;
grant execute on function pg_temp.qa_err(text) to authenticated, anon;

create function pg_temp.qa_as(p_user uuid, p_aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;
grant execute on function pg_temp.qa_as(uuid, text) to authenticated, anon;

insert into auth.users(id, email, email_confirmed_at) values
  ('02a00000-0000-4000-8000-000000000001', 'qa-step02-founder@example.com', now()),
  ('02a00000-0000-4000-8000-000000000002', 'qa-step02-ceo@example.com', now()),
  ('02a00000-0000-4000-8000-000000000003', 'qa-step02-cofounder@example.com', now()),
  ('02a00000-0000-4000-8000-000000000004', 'qa-step02-coo@example.com', now()),
  ('02a00000-0000-4000-8000-000000000005', 'qa-step02-employee@example.com', now()),
  ('02a00000-0000-4000-8000-000000000006', 'qa-step02-cofounder2@example.com', now());
insert into public.management_members(user_id, role, office, display_name) values
  ('02a00000-0000-4000-8000-000000000001', 'founder', 'QA', 'QA Founder'),
  ('02a00000-0000-4000-8000-000000000002', 'ceo', 'QA', 'QA CEO'),
  ('02a00000-0000-4000-8000-000000000003', 'co_founder', 'QA', 'QA Co-Founder'),
  ('02a00000-0000-4000-8000-000000000004', 'coo', 'QA', 'QA COO'),
  ('02a00000-0000-4000-8000-000000000005', 'employee', 'QA', 'QA Employee'),
  ('02a00000-0000-4000-8000-000000000006', 'co_founder', 'QA', 'QA Co-Founder 2');

-- ── Identity ──
insert into qa_results(test, ok, detail) select 'I1 employees created for new members with role-specific permanent IDs',
  count(*) = 6 and bool_and(employee_id ~ '^THH-(FDR|CEO|COF|COO|EMP)-[0-9]{4}$'), string_agg(employee_id, ',')
  from public.employees where email like 'qa-step02-%';
insert into qa_results(test, ok, detail) select 'I2 employee code cannot change',
  pg_temp.qa_err($$update public.employees set employee_id = 'THH-EMP-9999' where email = 'qa-step02-coo@example.com'$$) = 'Employee identity is permanent', null;
insert into qa_results(test, ok, detail) select 'I3 employees cannot be deleted',
  pg_temp.qa_err($$delete from public.employees where email = 'qa-step02-coo@example.com'$$) like 'Records are retained%', null;
delete from public.management_members where user_id = '02a00000-0000-4000-8000-000000000006';
insert into qa_results(test, ok, detail) select 'I4 removing membership revokes access and keeps the record',
  exists (select from public.employees where email = 'qa-step02-cofounder2@example.com' and access_status = 'revoked' and employment_status = 'ended'), null;

-- ── Auth gates ──
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000003', 'aal1'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'A1 no MFA (aal1) is rejected',
  pg_temp.qa_err($$select public.approval_submit('website_cms','QA hero text change','QA reason long enough','low',null,null,null,'{}','[]','qa-key-0001')$$) = 'MFA_REQUIRED', null;
reset role;
select set_config('request.jwt.claims', '{}', true); set local role anon;
insert into qa_results(test, ok, detail) select 'A2 anonymous cannot call the approval API',
  pg_temp.qa_err($$select public.approval_list('all',null,null,null,20,0)$$) like 'permission denied%', null;
reset role;

-- ── Co-Founder routine request → CEO ──
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000003', 'aal2'); set local role authenticated;
insert into qa_ids select 'cms', (r ->> 'uuid')::uuid, (r ->> 'version')::int
  from (select public.approval_submit('website_cms', 'QA hero text change', 'QA reason long enough', 'low', null, null, null,
        '{"field":"hero"}', '[{"field":"hero","label":"Hero","kind":"changed","before":"A","after":"B"}]', 'qa-key-0002') r) x;
insert into qa_results(test, ok, detail) select 'R1 Co-Founder request goes to CEO review with a permanent ID',
  r.status = 'pending_ceo' and r.public_id ~ '^THH-APR-[0-9]{6}$' and not r.requires_founder, r.public_id
  from public.approval_requests r where r.id = (select id from qa_ids where name = 'cms');
insert into qa_results(test, ok, detail) select 'R2 idempotent replay returns the same request',
  (public.approval_submit('website_cms', 'QA hero text change', 'QA reason long enough', 'low', null, null, null,
     '{"field":"hero"}', '[]', 'qa-key-0002') ->> 'uuid')::uuid = (select id from qa_ids where name = 'cms'), null;
insert into qa_results(test, ok, detail) select 'R3 duplicate open request is refused',
  pg_temp.qa_err($$select public.approval_submit('website_cms','QA hero text change','QA reason long enough','low',null,null,null,'{"field":"hero"}','[]','qa-key-0003')$$) = 'DUPLICATE_REQUEST', null;
insert into qa_results(test, ok, detail) select 'R4 requester cannot approve own request',
  pg_temp.qa_err(format($$select public.approval_decide(%L,'approve',null,1,'qa-key-0004')$$, (select id from qa_ids where name = 'cms'))) = 'PERMISSION_DENIED', null;
reset role;
insert into qa_results(test, ok, detail) select 'R5 CEO was notified',
  exists (select from public.notifications where user_id = '02a00000-0000-4000-8000-000000000002' and title like 'Approval waiting: THH-APR-%'), null;

select pg_temp.qa_as('02a00000-0000-4000-8000-000000000002', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'R6 stale version is refused',
  pg_temp.qa_err(format($$select public.approval_decide(%L,'approve',null,7,'qa-key-0005')$$, (select id from qa_ids where name = 'cms'))) = 'STALE_VERSION', null;
insert into qa_results(test, ok, detail) select 'R7 CEO approves routine change (no Founder stage)',
  public.approval_decide((select id from qa_ids where name = 'cms'), 'approve', 'Looks good', 1, 'qa-key-0006') ->> 'status' = 'approved', null;
insert into qa_results(test, ok, detail) select 'R8 second decision with the old version is refused (concurrent reviewer)',
  pg_temp.qa_err(format($$select public.approval_decide(%L,'reject','Too late',1,'qa-key-0007')$$, (select id from qa_ids where name = 'cms'))) = 'STALE_VERSION', null;
reset role;

-- Approval and execution are separate: still not applied.
insert into qa_results(test, ok, detail) select 'R9 approval does not execute anything by itself',
  status = 'approved' and applied_at is null, status from public.approval_requests where id = (select id from qa_ids where name = 'cms');

select pg_temp.qa_as('02a00000-0000-4000-8000-000000000003', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'R10 authorised executor applies separately; no payment implied',
  (x ->> 'status') = 'applied' and (x -> 'executionResult' ->> 'recorded')::boolean, x ->> 'status'
  from (select public.approval_apply((select id from qa_ids where name = 'cms'), 2, 'qa-key-0008') x) y;
reset role;

-- ── Office creation: CEO request → Founder approval → execution creates the office ──
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000002', 'aal2'); set local role authenticated;
insert into qa_ids select 'office', (r ->> 'uuid')::uuid, (r ->> 'version')::int
  from (select public.approval_submit('office', 'QA open village office', 'QA first office for village operations', 'medium', null, null, null,
        '{"name":"QA Village Office","village":"QA Village","post":"QA Post","district":"QA District","state":"Uttarakhand","country":"India"}', '[]', 'qa-key-0101') r) x;
insert into qa_results(test, ok, detail) select 'O1 CEO office request goes straight to Founder',
  status = 'pending_founder' and requires_founder, status from public.approval_requests where id = (select id from qa_ids where name = 'office');
insert into qa_results(test, ok, detail) select 'O2 CEO cannot approve own office request',
  pg_temp.qa_err(format($$select public.approval_decide(%L,'approve',null,1,'qa-key-0102')$$, (select id from qa_ids where name = 'office'))) = 'PERMISSION_DENIED', null;
insert into qa_results(test, ok, detail) select 'O3 CEO cannot execute before approval',
  pg_temp.qa_err(format($$select public.approval_apply(%L,1,'qa-key-0103')$$, (select id from qa_ids where name = 'office'))) = 'APPROVAL_REQUIRED', null;
reset role;
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000001', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'O4 Founder approves',
  public.approval_decide((select id from qa_ids where name = 'office'), 'approve', 'Approved', 1, 'qa-key-0104') ->> 'status' = 'approved', null;
reset role;
insert into qa_results(test, ok, detail) select 'O5 no office exists until execution',
  not exists (select from public.offices where name = 'QA Village Office'), null;
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000002', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'O6 CEO executes; office created with permanent ID and approval link',
  (x ->> 'status') = 'applied' and (x -> 'executionResult' ->> 'officePublicId') ~ '^THH-OFF-[0-9]{3}$', x -> 'executionResult' ->> 'officePublicId'
  from (select public.approval_apply((select id from qa_ids where name = 'office'), 2, 'qa-key-0105') x) y;
insert into qa_results(test, ok, detail) select 'O7 the same office cannot be requested again',
  pg_temp.qa_err($$select public.approval_submit('office','QA open village office again','QA duplicate office attempt','medium',null,null,null,'{"name":"QA Village Office","village":"QA Village","district":"QA District","state":"Uttarakhand"}','[]','qa-key-0106')$$) = 'DUPLICATE_REQUEST', null;
reset role;
insert into qa_results(test, ok, detail) select 'O8 office row links back to its approval',
  exists (select from public.offices o join public.approval_requests r on r.id = o.approval_id where o.name = 'QA Village Office' and r.status = 'applied'), null;

-- ── Spending needs the Founder even in a routine category; revision loop ──
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000003', 'aal2'); set local role authenticated;
insert into qa_ids select 'spend', (r ->> 'uuid')::uuid, 1
  from (select public.approval_submit('marketing', 'QA winter campaign budget', 'QA paid social campaign for winter', 'medium', 1500000, null, null, '{}', '[]', 'qa-key-0201') r) x;
reset role;
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000002', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'F1 CEO approval of a spend moves it to Founder, not approved',
  public.approval_decide((select id from qa_ids where name = 'spend'), 'approve', 'Fine by operations', 1, 'qa-key-0202') ->> 'status' = 'pending_founder', null;
reset role;
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000001', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'F2 revision needs a note',
  pg_temp.qa_err(format($$select public.approval_decide(%L,'request_revision','',2,'qa-key-0203')$$, (select id from qa_ids where name = 'spend'))) = 'VALIDATION_FAILED', null;
insert into qa_results(test, ok, detail) select 'F3 Founder returns for correction',
  public.approval_decide((select id from qa_ids where name = 'spend'), 'request_revision', 'Reduce the budget', 2, 'qa-key-0204') ->> 'status' = 'revision_required', null;
reset role;
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000003', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'F4 requester resubmits; routing restarts at CEO with a new version',
  (x ->> 'status') = 'pending_ceo' and (x ->> 'version')::int = 4, x ->> 'version'
  from (select public.approval_resubmit((select id from qa_ids where name = 'spend'), 'Budget reduced', 3, 'qa-key-0205', null, null, null, null, 1000000) x) y;
insert into qa_results(test, ok, detail) select 'F5 requester can withdraw an open request',
  public.approval_decide((select id from qa_ids where name = 'spend'), 'withdraw', 'Not needed now', 4, 'qa-key-0206') ->> 'status' = 'withdrawn', null;
reset role;

-- ── Visibility and role isolation ──
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000004', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'V1 COO sees no one else''s requests',
  (public.approval_list('all', null, null, 'QA', 50, 0) ->> 'total')::int = 0 and not exists (select from public.approval_requests where title like 'QA %'), null;
insert into qa_results(test, ok, detail) select 'V2 COO directory shows only own record',
  (select count(*) from public.employees) = 1, (select count(*)::text from public.employees);
reset role;
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000003', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'V3 Co-Founder cannot open the CEO''s office request',
  pg_temp.qa_err(format($$select public.approval_get(%L)$$, (select id from qa_ids where name = 'office'))) = 'NOT_FOUND', null;
reset role;
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000001', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'V4 Founder sees full history with actors',
  jsonb_array_length(public.approval_get((select id from qa_ids where name = 'spend')) -> 'history') = 5, null;
insert into qa_results(test, ok, detail) select 'V5 counts endpoint works',
  public.approval_counts() ? 'waitingForMe', null;
reset role;

-- ── Append-only history and hardened grants ──
insert into qa_results(test, ok, detail) select 'H1 approval history cannot be edited (even by the owner role)',
  pg_temp.qa_err($$update public.approval_decisions set note = 'x' where request_id in (select id from qa_ids)$$) = 'History is append-only', null;
insert into qa_results(test, ok, detail) select 'H2 audit log cannot be deleted',
  pg_temp.qa_err($$delete from public.audit_log where table_name = 'approval_requests'$$) = 'History is append-only', null;
insert into qa_results(test, ok, detail) select 'H3 audit trail recorded approval actions',
  (select count(*) from public.audit_log where table_name = 'approval_requests' and created_at >= now() - interval '5 minutes'
     and row_id in (select public_id from public.approval_requests where id in (select id from qa_ids))) >= 10, null;
select pg_temp.qa_as('02a00000-0000-4000-8000-000000000001', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'H4 signed-in users cannot truncate the audit log',
  pg_temp.qa_err($$truncate public.audit_log$$) like 'permission denied%', null;
insert into qa_results(test, ok, detail) select 'H5 signed-in users cannot insert notifications directly',
  pg_temp.qa_err($$insert into public.notifications(user_id,title,body) values (auth.uid(),'x','y')$$) like 'permission denied%', null;
insert into qa_results(test, ok, detail) select 'H6 direct writes to approval tables are blocked',
  pg_temp.qa_err($$update public.approval_requests set status = 'approved'$$) like 'permission denied%', null;
reset role;

select n, test, ok, detail from qa_results order by n;
rollback;
