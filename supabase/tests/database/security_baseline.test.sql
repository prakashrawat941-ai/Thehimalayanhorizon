begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(3);
select has_table('public', 'management_members', 'Management membership schema exists');
select is((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity), 0::bigint, 'All public tables enforce RLS');
select ok(not exists (select 1 from pg_roles where rolname in ('anon','authenticated') and (rolbypassrls or rolsuper)), 'API roles cannot bypass RLS');
select * from finish();
rollback;
