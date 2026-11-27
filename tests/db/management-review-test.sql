-- Run against a staging database after applying the management review migration.
-- The fixture transaction is rolled back. Every qa_results row must be true.
begin;
create temp table qa_results(test text,ok boolean);
create temp table qa_draft(id uuid);
grant all on qa_results,qa_draft to authenticated;
insert into auth.users(id,email,email_confirmed_at) values ('18fa0000-0000-4000-8000-000000000001','thh-18-f@example.com',now()),('18fa0000-0000-4000-8000-000000000002','thh-18-c@example.com',now()),('18fa0000-0000-4000-8000-000000000003','thh-18-other@example.com',now()),('18fa0000-0000-4000-8000-000000000004','thh-18-emp@example.com',now()),('18fa0000-0000-4000-8000-000000000005','thh-18-host@example.com',now());
insert into public.management_members(user_id,role,office,display_name) values
 ('18fa0000-0000-4000-8000-000000000001','founder','QA','QA founder'),('18fa0000-0000-4000-8000-000000000002','co_founder','QA','QA cofounder'),('18fa0000-0000-4000-8000-000000000003','co_founder','QA','QA other'),('18fa0000-0000-4000-8000-000000000004','employee','QA','QA employee');
insert into public.management_work(id,owner_id,office,kind,subject,assignee,status,initiative_stage)
values ('18fa0000-0000-4000-8000-000000000009','18fa0000-0000-4000-8000-000000000001','QA','initiative','QA assigned initiative','18fa0000-0000-4000-8000-000000000004','open','assigned');
insert into public.partners(id,owner_id,business_name,contact_name,phone,categories,status)
values ('18fa0000-0000-4000-8000-000000000007','18fa0000-0000-4000-8000-000000000005','QA approved host','QA host','9999900000','{homestay}','approved');
insert into public.homestays(id,partner_id,name,status,images,house_rules)
values ('18fa0000-0000-4000-8000-000000000008','18fa0000-0000-4000-8000-000000000007','QA onboarding draft','draft',array['https://example.com/1.webp','https://example.com/2.webp','https://example.com/3.webp'],'Check-in: 12:00');
insert into public.homestay_rooms(homestay_id,room_type,base_price) values ('18fa0000-0000-4000-8000-000000000008','QA room',1900);
insert into public.partner_kyc(partner_id,status,upi_id) values ('18fa0000-0000-4000-8000-000000000007','verified','QA@example');
select set_config('request.jwt.claims',json_build_object('sub','18fa0000-0000-4000-8000-000000000001','role','authenticated','aal','aal2')::text,true); set local role authenticated;
select public.management_set_member('18fa0000-0000-4000-8000-000000000004',null,'none',null,'QA offboard');
select public.management_set_member(null,'thh-18-invite@example.com','employee','Office One','QA initial invite');
reset role;
insert into qa_results select 'P1 removed assigned member and reopened initiative', not exists(select from public.management_members where user_id='18fa0000-0000-4000-8000-000000000004') and exists(select from public.management_work where id='18fa0000-0000-4000-8000-000000000009' and initiative_stage='planning' and assignee is null);
select set_config('request.jwt.claims',json_build_object('sub','18fa0000-0000-4000-8000-000000000004','role','authenticated','aal','aal2')::text,true); set local role authenticated;
insert into qa_results select 'P1 revoked member role is gone at AAL2',private.management_role() is null;
reset role;
select set_config('request.jwt.claims','{}',true);
insert into auth.users(id,email,email_confirmed_at) values ('18fa0000-0000-4000-8000-000000000006','thh-18-invite@example.com',now());
select set_config('request.jwt.claims',json_build_object('sub','18fa0000-0000-4000-8000-000000000001','role','authenticated','aal','aal2')::text,true); set local role authenticated;
select public.management_set_member(null,'thh-18-invite@example.com','employee','Office Two','QA resend');
insert into qa_results select 'P2 resend retains pending invitation',public.management_invitation_pending('thh-18-invite@example.com');
reset role;
insert into qa_results select 'P2 no membership before accepting resend',not exists(select from public.management_members where user_id='18fa0000-0000-4000-8000-000000000006');
select set_config('request.jwt.claims',json_build_object('sub','18fa0000-0000-4000-8000-000000000006','role','authenticated','aal','aal1')::text,true); set local role authenticated;
select public.accept_leadership_invitation();
select public.accept_leadership_invitation();
reset role;
insert into qa_results select 'P2 invitation acceptance applies latest office and is retry-safe',exists(select from public.management_members where user_id='18fa0000-0000-4000-8000-000000000006' and role='employee' and office='Office Two')
  and exists(select from public.leadership_invitations where accepted_by='18fa0000-0000-4000-8000-000000000006' and accepted_at is not null);
select set_config('request.jwt.claims',json_build_object('sub','18fa0000-0000-4000-8000-000000000002','role','authenticated','aal','aal2')::text,true); set local role authenticated;
insert into qa_draft select public.management_location_save(null,'{"name":"QA draft"}','{"name":"manual"}',null);
select public.management_location_save((select id from qa_draft),'{"name":"QA draft edited"}','{"name":"manual"}',null);
insert into qa_results select 'P2 creator can reload edited draft',exists(select from public.management_location_drafts where id=(select id from qa_draft) and fields->>'name'='QA draft edited');
insert into qa_results select 'P2 places projection contains only existing fields', count(*) >= 0 from (select name,name_hi,district,region,kind,lat,lng from public.places limit 1) p;
insert into qa_results select 'P2 approved onboarding host verified KYC is visible',exists(select from public.management_onboarding_kyc() where partner_id='18fa0000-0000-4000-8000-000000000007' and status='verified');
select public.management_submit_homestay('18fa0000-0000-4000-8000-000000000008');
select public.management_submit_homestay('18fa0000-0000-4000-8000-000000000008');
reset role;
insert into qa_results select 'P2 homestay enters Admin listing queue without changing host approval',exists(select from public.homestays where id='18fa0000-0000-4000-8000-000000000008' and status='pending') and exists(select from public.partners where id='18fa0000-0000-4000-8000-000000000007' and status='approved');
select set_config('request.jwt.claims',json_build_object('sub','18fa0000-0000-4000-8000-000000000003','role','authenticated','aal','aal2')::text,true); set local role authenticated;
insert into qa_results select 'P2 other Co-founder cannot reload draft',not exists(select from public.management_location_drafts where id=(select id from qa_draft));
reset role;
select set_config('request.jwt.claims',json_build_object('sub','18fa0000-0000-4000-8000-000000000002','role','authenticated','aal','aal1')::text,true); set local role authenticated;
insert into qa_results select 'P2 no draft read without MFA',not exists(select from public.management_location_drafts where id=(select id from qa_draft));
reset role;
select * from qa_results order by test;
rollback;