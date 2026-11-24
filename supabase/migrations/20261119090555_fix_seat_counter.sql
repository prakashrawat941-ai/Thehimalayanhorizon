-- Fix: the ride guard was undoing seat counts written by book_cab_seats().
-- The guard now runs as the caller (SECURITY INVOKER): direct edits from the app
-- (role authenticated) are guarded, while the trusted booking functions
-- (which run as the database owner) can update seats_booked.
create or replace function private.guard_cab_ride()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or private.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.seats_booked := 0;
    new.status := 'open';
    if new.departure_at < now() then raise exception 'Departure must be in the future'; end if;
  else
    new.partner_id   := old.partner_id;
    new.seats_booked := old.seats_booked;
    if new.seats_total < old.seats_booked then
      raise exception 'Seats cannot be fewer than already booked (%)', old.seats_booked;
    end if;
    if new.status = 'full' and new.seats_booked < new.seats_total then new.status := 'open'; end if;
  end if;
  return new;
end $$;
