-- Step 02 database fixture: one-time claim codes, COO/Manager invitations, permission matrix.
-- STAGING only, after step02_* migrations. Rolled back. Every row must have ok = true.
begin;
create temp table qa_results(n serial, test text, ok boolean, detail text);
create temp table qa_codes(name text primary key, code text);
grant all on qa_results, qa_codes to authenticated;
grant usage on sequence qa_results_n_seq to authenticated;
create function pg_temp.qa_err(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlerrm; end $$;
grant execute on function pg_temp.qa_err(text) to authenticated;
create function pg_temp.qa_as(p_user uuid, p_aal text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true); end $$;
grant execute on function pg_temp.qa_as(uuid, text) to authenticated;

insert into auth.users(id, email, email_confirmed_at) values
  ('02c00000-0000-4000-8000-000000000001', 'qa-claim-founder@example.com', now()),
  ('02c00000-0000-4000-8000-000000000002', 'qa-claim-ceo@example.com', now());
insert into public.management_members(user_id, role, office, display_name) values
  ('02c00000-0000-4000-8000-000000000001', 'founder', 'QA', 'QA Founder'),
  ('02c00000-0000-4000-8000-000000000002', 'ceo', 'QA', 'QA CEO');

select pg_temp.qa_as('02c00000-0000-4000-8000-000000000001', 'aal2'); set local role authenticated;
select public.management_set_member(null, 'qa-claim-manager@example.com', 'manager', 'QA Office', 'QA manager invite');
select public.management_set_member(null, 'qa-claim-coo@example.com', 'coo', 'QA Office', 'QA COO invite');
insert into qa_codes values ('manager', public.management_issue_claim_code('qa-claim-manager@example.com'));
insert into qa_codes values ('coo', public.management_issue_claim_code('qa-claim-coo@example.com'));
reset role;
insert into qa_results(test, ok, detail) select 'C1 Founder can invite Manager and COO',
  (select count(*) from public.leadership_invitations where email in ('qa-claim-manager@example.com', 'qa-claim-coo@example.com') and accepted_at is null) = 2, null;
insert into qa_results(test, ok, detail) select 'C2 claim code format and only a hash is stored',
  (select bool_and(code ~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$') from qa_codes)
  and not exists (select from private.invitation_claims c join qa_codes q on c.code_hash = q.code), null;

select pg_temp.qa_as('02c00000-0000-4000-8000-000000000002', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'C3 CEO cannot issue claim codes',
  pg_temp.qa_err($$select public.management_issue_claim_code('qa-claim-manager@example.com')$$) = 'PERMISSION_DENIED', null;
reset role;

insert into auth.users(id, email, email_confirmed_at) values
  ('02c00000-0000-4000-8000-000000000003', 'qa-claim-manager@example.com', now()),
  ('02c00000-0000-4000-8000-000000000004', 'qa-claim-coo@example.com', now());

select pg_temp.qa_as('02c00000-0000-4000-8000-000000000003', 'aal1'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'C4 invitation cannot be accepted without the claim code',
  pg_temp.qa_err($$select public.accept_leadership_invitation()$$) = 'CLAIM_CODE_REQUIRED', null;
insert into qa_results(test, ok, detail) select 'C5 wrong code is refused and counted',
  (public.claim_leadership_account('AAAA-BBBB-CCCC') ->> 'ok')::boolean = false, null;
reset role;
insert into qa_results(test, ok, detail) select 'C6 failed attempt persisted',
  (select attempts from private.invitation_claims c join public.leadership_invitations i on i.id = c.invitation_id where i.email = 'qa-claim-manager@example.com') = 1, null;
select pg_temp.qa_as('02c00000-0000-4000-8000-000000000003', 'aal1'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'C7 correct code claims the account',
  (public.claim_leadership_account((select lower(code) from qa_codes where name = 'manager')) ->> 'ok')::boolean, null;
reset role;
insert into qa_results(test, ok, detail) select 'C8 claimed account is a Manager with a THH-MGR permanent ID',
  exists (select from public.management_members where user_id = '02c00000-0000-4000-8000-000000000003' and role = 'manager')
  and exists (select from public.employees where user_id = '02c00000-0000-4000-8000-000000000003' and employee_id ~ '^THH-MGR-[0-9]{4}$'),
  (select employee_id from public.employees where user_id = '02c00000-0000-4000-8000-000000000003');
select pg_temp.qa_as('02c00000-0000-4000-8000-000000000003', 'aal1'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'C9 new member still needs MFA for any management API',
  pg_temp.qa_err($$select public.my_permissions()$$) = 'MFA_REQUIRED', null;
reset role;

select pg_temp.qa_as('02c00000-0000-4000-8000-000000000004', 'aal1'); set local role authenticated;
select public.claim_leadership_account('WRNG-WRNG-WRN1'); select public.claim_leadership_account('WRNG-WRNG-WRN2');
select public.claim_leadership_account('WRNG-WRNG-WRN3'); select public.claim_leadership_account('WRNG-WRNG-WRN4');
select public.claim_leadership_account('WRNG-WRNG-WRN5');
insert into qa_results(test, ok, detail) select 'C10 five wrong attempts lock the code, even for the right one',
  (public.claim_leadership_account((select code from qa_codes where name = 'coo')) ->> 'reason') = 'expired_or_locked', null;
reset role;
insert into qa_results(test, ok, detail) select 'C11 locked invitation is not accepted',
  not exists (select from public.management_members where user_id = '02c00000-0000-4000-8000-000000000004'), null;

select pg_temp.qa_as('02c00000-0000-4000-8000-000000000002', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'P1 CEO effective permissions include review, not final approval',
  (public.my_permissions() -> 'permissions') @> '[{"permission":"approvals.review"}]'
  and not (public.my_permissions() -> 'permissions') @> '[{"permission":"approvals.final_approve"}]', null;
insert into qa_results(test, ok, detail) select 'P2 CEO cannot read the full matrix',
  pg_temp.qa_err($$select public.permission_matrix()$$) = 'PERMISSION_DENIED', null;
insert into qa_results(test, ok, detail) select 'P3 CEO sees only own role rows in role_permissions',
  (select bool_and(role = 'ceo') from public.role_permissions), null;
reset role;
select pg_temp.qa_as('02c00000-0000-4000-8000-000000000001', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'P4 Founder reads the full matrix',
  jsonb_array_length(public.permission_matrix()) >= 60, jsonb_array_length(public.permission_matrix())::text;
reset role;
select pg_temp.qa_as('02c00000-0000-4000-8000-000000000003', 'aal2'); set local role authenticated;
insert into qa_results(test, ok, detail) select 'P5 Manager has own-scope permissions only',
  (select bool_and(e ->> 'scope' in ('own', 'assigned')) from jsonb_array_elements(public.my_permissions() -> 'permissions') e), null;
reset role;

select n, test, ok, detail from qa_results order by n;
rollback;
