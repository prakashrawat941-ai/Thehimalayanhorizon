-- Admin remains an independent profile permission. Leadership still requires MFA.
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
