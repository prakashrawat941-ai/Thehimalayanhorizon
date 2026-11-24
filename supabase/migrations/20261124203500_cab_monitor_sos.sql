-- Deliver incident changes to authorized sessions through the existing RLS policies.
grant select on public.sos_incidents to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sos_incidents'
     ) then
    alter publication supabase_realtime add table public.sos_incidents;
  end if;
end $$;

-- Enforce the expected previous status in the UPDATE. Concurrent staff actions
-- can only succeed once and cannot send duplicate acknowledgement notifications.
create or replace function public.admin_update_sos(p_id uuid, p_status text, p_note text default null)
returns public.sos_incidents
language plpgsql security definer set search_path = '' as $$
declare
  s public.sos_incidents;
  expected_status text;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  case p_status
    when 'acknowledged' then expected_status := 'open';
    when 'resolved' then expected_status := 'acknowledged';
    else raise exception 'Unknown status';
  end case;

  update public.sos_incidents
     set status = p_status, handled_by = auth.uid(),
         acknowledged_at = coalesce(acknowledged_at, now()),
         resolved_at = case when p_status = 'resolved' then now() else resolved_at end,
         admin_note = coalesce(left(p_note, 1000), admin_note)
   where id = p_id and status = expected_status returning * into s;
  if not found then raise exception 'SOS not found or status has changed'; end if;

  perform private.notify(s.user_id,
    case when p_status = 'acknowledged' then 'THH support has seen your SOS' else 'Your SOS has been closed by THH support' end,
    '', '/cab/bookings');
  return s;
end $$;

revoke execute on function public.admin_update_sos(uuid, text, text) from public, anon;
grant execute on function public.admin_update_sos(uuid, text, text) to authenticated;
