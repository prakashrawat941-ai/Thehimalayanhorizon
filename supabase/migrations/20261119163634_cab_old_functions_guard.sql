-- The older seat functions (book_cab_seats, set_cab_booking_status) know nothing
-- about seat numbers. Keep them for partner rides only, so driver rides always go
-- through request_cab_ride / respond_cab_request / cancel_cab_booking.
create or replace function private.only_partner_ride(p_ride uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.cab_rides where id = p_ride and driver_id is not null) then
    raise exception 'Please book this ride from the Instant Book Cab page';
  end if;
end $$;
revoke execute on function private.only_partner_ride(uuid) from public, anon, authenticated;

create or replace function private.guard_old_cab_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Rows written by the new functions always carry a booking code.
  if new.booking_code is null then
    perform private.only_partner_ride(new.ride_id);
  end if;
  return new;
end $$;

create trigger cab_bookings_old_guard before insert on public.cab_bookings
  for each row execute function private.guard_old_cab_booking();

-- The old status function also refuses driver-ride bookings.
create or replace function public.set_cab_booking_status(p_booking uuid, p_status text)
returns public.cab_bookings
language plpgsql security definer set search_path = '' as $$
declare
  b    public.cab_bookings;
  ride public.cab_rides;
  v_driver boolean;
begin
  select * into b from public.cab_bookings where id = p_booking for update;
  if not found then raise exception 'Booking not found'; end if;
  perform private.only_partner_ride(b.ride_id);
  select * into ride from public.cab_rides where id = b.ride_id for update;
  v_driver := private.owns_partner(ride.partner_id);

  if private.is_admin() then
    null;
  elsif v_driver and b.status = 'pending' and p_status in ('confirmed','declined') then
    null;
  elsif v_driver and b.status = 'confirmed' and p_status = 'cancelled' then
    null;
  elsif b.user_id = auth.uid() and b.status in ('pending','confirmed') and p_status = 'cancelled' then
    null;
  else
    raise exception 'You cannot change this booking to %', p_status;
  end if;

  if b.status in ('pending','confirmed') and p_status in ('declined','cancelled') then
    update public.cab_rides
       set seats_booked = greatest(seats_booked - b.seats, 0),
           status = case when status = 'full' then 'open' else status end
     where id = ride.id;
  elsif b.status in ('declined','cancelled') and p_status in ('pending','confirmed') then
    if ride.seats_total - ride.seats_booked < b.seats then raise exception 'Not enough seats left'; end if;
    update public.cab_rides set seats_booked = seats_booked + b.seats where id = ride.id;
  end if;

  update public.cab_bookings set status = p_status where id = p_booking returning * into b;

  if auth.uid() is distinct from b.user_id then
    perform private.notify(b.user_id, 'Cab booking ' || p_status, 'Ride on ' ||
      to_char(ride.departure_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'), '#/account');
  end if;
  return b;
end $$;
