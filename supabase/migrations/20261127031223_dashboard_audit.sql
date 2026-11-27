-- The Founder audit must include all team events, not only the Founder's own work.
create policy management_founder_work_read on public.management_work for select to authenticated using (private.management_role()='founder');
