-- Run in a transaction with the employee-ID migration installed. Fixtures are rolled back.
begin;
create temp table employee_login_checks (test text, ok boolean);
grant insert on employee_login_checks to authenticated, service_role;

insert into auth.users(id, email, email_confirmed_at) values
  ('e1d00000-0000-4000-8000-000000000001', 'qa-employee-login-founder@example.com', now()),
  ('e1d00000-0000-4000-8000-000000000002', 'qa-employee-login-ceo@example.com', now());
insert into public.management_members(user_id, role, office) values
  ('e1d00000-0000-4000-8000-000000000001', 'founder', 'QA');

select set_config('request.jwt.claims', '{"sub":"e1d00000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
do $$
begin
  perform public.management_set_leadership_employee_id('qa-employee-login-ceo@example.com','ceo','QA','QA add','THH-QA-CEO');
  insert into employee_login_checks values ('Founder without MFA cannot assign an ID', false);
exception when insufficient_privilege then
  insert into employee_login_checks values ('Founder without MFA cannot assign an ID', true);
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"e1d00000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select public.management_set_leadership_employee_id('qa-employee-login-ceo@example.com','ceo','QA','QA add','thh-qa-ceo');
select public.management_set_leadership_employee_id('qa-employee-login-invite@example.com','co_founder','QA','QA invite','THH-QA-CO');
insert into employee_login_checks select 'Founder can read assigned ID', count(*) = 1
from public.management_leadership_employee_ids() where employee_id = 'THH-QA-CEO';
do $$
begin
  perform public.management_set_leadership_employee_id('qa-employee-login-duplicate@example.com','co_founder','QA','QA duplicate','THH-QA-CEO');
  insert into employee_login_checks values ('Duplicate ID is blocked', false);
exception when raise_exception then
  insert into employee_login_checks values ('Duplicate ID is blocked', sqlerrm = 'This employee ID is already in use.');
end $$;
reset role;
insert into employee_login_checks select 'Duplicate leaves no pending invitation', not exists(
  select from public.leadership_invitations where email = 'qa-employee-login-duplicate@example.com'
);
insert into employee_login_checks values ('Auth users cannot resolve an ID to email',
  not has_function_privilege('authenticated', 'public.management_employee_login_email(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.management_employee_login_email(text)', 'EXECUTE'));

set local role service_role;
insert into employee_login_checks values ('Server lookup matches case-insensitive ID',
  public.management_employee_login_email(' thh-qa-ceo ') = 'qa-employee-login-ceo@example.com');
insert into employee_login_checks values ('Unaccepted alias cannot sign in',
  public.management_employee_login_email('THH-QA-CO') is null);
reset role;

select set_config('request.jwt.claims', '{}', true);
insert into auth.users(id, email, email_confirmed_at) values
  ('e1d00000-0000-4000-8000-000000000003', 'qa-employee-login-invite@example.com', now());
select set_config('request.jwt.claims', '{"sub":"e1d00000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
insert into employee_login_checks values ('Recipient can see their own pending ID',
  public.management_pending_employee_id() = 'THH-QA-CO');
select public.accept_leadership_invitation();
insert into employee_login_checks values ('Accepted invitation is no longer pending', public.management_pending_employee_id() is null);
reset role;

select set_config('request.jwt.claims', '{"sub":"e1d00000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select public.management_set_member('e1d00000-0000-4000-8000-000000000002', null, 'none', null, 'QA revoke');
reset role;

set local role service_role;
insert into employee_login_checks values ('Accepted Co-founder can resolve own ID',
  public.management_employee_login_email('THH-QA-CO') = 'qa-employee-login-invite@example.com');
insert into employee_login_checks values ('Revoked member ID cannot sign in', public.management_employee_login_email('THH-QA-CEO') is null);
reset role;
select * from employee_login_checks order by test;
rollback;
