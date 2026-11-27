-- STAGING ONLY (project gboxcnxgdkcewstkxogt). NOT a migration: run by hand in the SQL editor.
-- Maps the three verified Google accounts to leadership roles in the existing management_members table.
-- Prerequisite: each person has signed in with Google once (so auth.users has the row).
-- Roles can only be set here (service role / SQL editor) or by the Founder-only RPC management_set_member.
-- management_members has SELECT-only grants for authenticated users, so nobody can assign their own role.
-- Replace every REPLACE_* value first; the script stops while any placeholder is left.
do $$
declare
  m record;
  uid uuid;
begin
  for m in
    select * from (values
      ('REPLACE_FOUNDER_EMAIL',    'founder',    'Prakash Rawat',    'Surmoli'),
      ('REPLACE_CEO_EMAIL',        'ceo',        'Dharmendra Rawat', 'REPLACE_CEO_OFFICE'),
      ('REPLACE_COFOUNDER_EMAIL',  'co_founder', 'Suraj Bangari',    'Surmoli')
    ) as t(email, role, display_name, office)
  loop
    if m.email like 'REPLACE\_%' escape '\' or m.office like 'REPLACE\_%' escape '\' then
      raise exception 'Replace the placeholder for % before running', m.role;
    end if;
    select id into uid from auth.users where lower(email) = lower(m.email);
    if uid is null then
      raise exception 'No auth user for % (%): sign in with Google once first', m.role, m.email;
    end if;
    insert into public.management_members (user_id, role, display_name, office)
    values (uid, m.role, m.display_name, m.office)
    on conflict (user_id) do update
      set role = excluded.role, display_name = excluded.display_name, office = excluded.office;
  end loop;
end $$;

-- Check (expect exactly one founder, ceo and co_founder from this script):
-- select role, display_name, office from public.management_members order by role;
