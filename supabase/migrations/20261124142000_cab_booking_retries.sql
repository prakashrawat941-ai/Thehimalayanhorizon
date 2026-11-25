-- Map each customer's retry key to the booking created by the existing atomic RPC.
create table private.cab_booking_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  booking_id uuid not null unique references public.cab_bookings(id) on delete cascade,
  primary key (user_id, request_id)
);

alter table private.cab_booking_attempts enable row level security;
revoke all on private.cab_booking_attempts from public, anon, authenticated;

create function public.request_cab_ride_idempotent(
  p_request_id uuid, p_ride uuid, p_seat_numbers integer[], p_name text, p_phone text,
  p_note text default '', p_from_place uuid default null, p_to_place uuid default null
)
returns public.cab_bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_booking public.cab_bookings;
  v_booked_seats integer[];
begin
  if v_user is null then raise exception 'Please sign in to book'; end if;
  if p_request_id is null then raise exception 'Booking request ID is required'; end if;

  -- Same-key retries wait for the first transaction. Seat competition between distinct requests
  -- is still handled by the existing ride row lock and unique active-seat constraint.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cab_booking_attempt:' || v_user::text || ':' || p_request_id::text, 0)
  );

  select b.* into v_booking
  from private.cab_booking_attempts a
  join public.cab_bookings b on b.id = a.booking_id
  where a.user_id = v_user and a.request_id = p_request_id and b.user_id = v_user;
  if found then
    select array_agg(s order by s) into v_booked_seats from unnest(p_seat_numbers) as seats(s);
    if v_booking.ride_id is distinct from p_ride or v_booking.seat_numbers is distinct from v_booked_seats then
      raise exception 'This request ID already belongs to another seat selection';
    end if;
    return v_booking;
  end if;

  v_booking := public.request_cab_ride(p_ride, p_seat_numbers, p_name, p_phone, p_note, p_from_place, p_to_place);
  insert into private.cab_booking_attempts (user_id, request_id, booking_id)
  values (v_user, p_request_id, v_booking.id);
  return v_booking;
end $$;

revoke all on function public.request_cab_ride_idempotent(uuid, uuid, integer[], text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_cab_ride_idempotent(uuid, uuid, integer[], text, text, text, uuid, uuid) to authenticated;
