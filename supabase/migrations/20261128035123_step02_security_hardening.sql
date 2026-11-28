-- Step 02 · 01 · Security hardening (audit findings S1, S5).
-- Staging first. Production only with Founder approval.

-- S1: audit history is read-only for API roles and append-only for everyone.
revoke all on public.audit_log from anon;
revoke insert, update, delete, truncate, references, trigger on public.audit_log from authenticated;
grant select on public.audit_log to authenticated; -- still limited by the Founder/admin read policies

-- Notifications: API roles may read their own rows, mark them read and delete them (existing policies).
-- Rows are created only by private.notify (security definer).
revoke all on public.notifications from anon;
revoke insert, update, truncate, references, trigger on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function private.forbid_history_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'History is append-only' using errcode = '42501';
end $$;

drop trigger if exists audit_log_append_only on public.audit_log;
create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function private.forbid_history_change();
drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.forbid_history_change();

drop trigger if exists management_events_append_only on public.management_events;
create trigger management_events_append_only before update or delete on public.management_events
  for each row execute function private.forbid_history_change();
drop trigger if exists management_events_no_truncate on public.management_events;
create trigger management_events_no_truncate before truncate on public.management_events
  for each statement execute function private.forbid_history_change();

-- S5: counters table gets RLS (it is only used by the security definer private.next_counter, owned by postgres).
alter table private.id_counters enable row level security;
revoke all on private.id_counters from anon, authenticated;
