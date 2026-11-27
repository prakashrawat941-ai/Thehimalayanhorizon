alter table public.cab_rides add column if not exists luggage_rule text,
  add column if not exists smoking_allowed boolean,
  add column if not exists pets_allowed boolean;
alter table public.cab_rides add constraint cab_ride_luggage_rule_length
  check (char_length(luggage_rule) <= 120);

alter table public.themes add column if not exists image_url text;

-- Bounded public seat snapshot. Only seats on rides visible under the cab ride read policy are returned.
create or replace function public.cab_rides_seat_snapshot(p_ride_ids uuid[])
returns table(ride_id uuid,seat_no integer,status text)
language sql stable security definer set search_path='' as $$
  select h.ride_id, h.seat_no,
    case when b.status = 'pending' then 'held' else 'confirmed' end
  from public.cab_seat_holds h
  join public.cab_rides r on r.id = h.ride_id
  join public.cab_bookings b on b.id = h.booking_id
  where cardinality(p_ride_ids) between 1 and 100
    and h.ride_id = any(p_ride_ids) and h.released_at is null
    and (not r.is_test or r.driver_id = (select auth.uid())
      or private.owns_partner(r.partner_id) or (select private.is_admin()));
$$;
revoke all on function public.cab_rides_seat_snapshot(uuid[]) from public, anon, authenticated;
grant execute on function public.cab_rides_seat_snapshot(uuid[]) to anon, authenticated;

-- Emits only approved listing IDs, using the same blocked-unit and booking logic as quotes.
create or replace function public.find_available_homestays(p_ids uuid[],p_start date,p_end date,p_guests integer)
returns table(homestay_id uuid)
language sql stable security definer set search_path='' as $$
  select h.id from public.homestays h
  where cardinality(p_ids) between 1 and 100 and h.id = any(p_ids)
    and p_start >= (now() at time zone 'Asia/Kolkata')::date
    and p_end - p_start between 1 and 60 and p_guests between 1 and 50
    and h.status = 'approved' and exists (
      select 1 from public.homestay_rooms r where r.homestay_id = h.id and r.is_active
        and r.max_guests > 0 and private.rooms_free(r.id, p_start, p_end)
          >= ceil(p_guests::numeric / nullif(r.max_guests, 0))
    );
$$;
revoke all on function public.find_available_homestays(uuid[],date,date,integer) from public, anon, authenticated;
grant execute on function public.find_available_homestays(uuid[],date,date,integer) to anon, authenticated;
