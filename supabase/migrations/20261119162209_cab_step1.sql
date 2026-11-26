-- =====================================================================
-- Instant Book Cab, step 1: drivers, vehicles, place search list,
-- seat-level booking with request/accept, booking codes.
-- Additive only: no existing table, column or row is removed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profile photo (Google sign-in fills it) and Google name support.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text not null default ''
  check (char_length(avatar_url) <= 500);

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone, role, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 120),
    left(new.raw_user_meta_data->>'phone', 20),
    case when exists (select 1 from public.admin_emails a where a.email = lower(new.email))
         then 'admin' else 'traveler' end,
    left(coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''), 500)
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Places: towns, villages and hubs used for ride search (with spelling
-- variants for typo-tolerant search). Admins manage the list.
-- ---------------------------------------------------------------------
create table public.places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  name_hi     text not null default '' check (char_length(name_hi) <= 80),
  district    text not null default '' check (char_length(district) <= 60),
  region      text not null default 'Other' check (region in ('Garhwal','Kumaon','Other')),
  kind        text not null default 'town' check (kind in ('city','town','village','hub')),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  aliases     text[] not null default '{}',
  location_id uuid references public.locations(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index places_name_uidx on public.places (lower(name));
create index places_location_idx on public.places (location_id);
create trigger places_updated before update on public.places for each row execute function private.set_updated_at();

alter table public.places enable row level security;
create policy "places: public read" on public.places for select to anon, authenticated
  using (is_active or (select private.is_admin()));
create policy "places: admin insert" on public.places for insert to authenticated with check ((select private.is_admin()));
create policy "places: admin update" on public.places for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "places: admin delete" on public.places for delete to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- Driver profiles: any signed-in user can become a driver (owner's choice:
-- publish immediately). "Verified" and "suspended" are set by admins only.
-- Phone is private; public details come from cab_driver_cards().
-- ---------------------------------------------------------------------
create table public.driver_profiles (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 2 and 120),
  phone       text not null check (char_length(phone) between 7 and 20),
  photo_url   text not null default '' check (char_length(photo_url) <= 500),
  about       text not null default '' check (char_length(about) <= 500),
  is_verified boolean not null default false,
  status      text not null default 'active' check (status in ('active','suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger driver_profiles_updated before update on public.driver_profiles for each row execute function private.set_updated_at();

create or replace function private.guard_driver_profile()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or private.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_verified := false;
    new.status := 'active';
  else
    new.user_id := old.user_id;
    new.is_verified := old.is_verified;
    new.status := old.status;
  end if;
  return new;
end $$;
create trigger driver_profiles_guard before insert or update on public.driver_profiles
  for each row execute function private.guard_driver_profile();

alter table public.driver_profiles enable row level security;
create policy "driver_profiles: read own or admin" on public.driver_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "driver_profiles: insert own" on public.driver_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "driver_profiles: update own or admin" on public.driver_profiles for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------------
-- Vehicles: owned by a driver. Registration number is private and only
-- shown to confirmed passengers through cab_booking_contact().
-- Vehicles are switched off, never deleted.
-- ---------------------------------------------------------------------
create table public.vehicles (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  vehicle_type    text not null check (vehicle_type in ('swift','wagonr','ertiga','bolero','eeco','other')),
  model           text not null check (char_length(model) between 2 and 80),
  registration_no text not null check (char_length(registration_no) between 4 and 15),
  seats           integer not null check (seats between 1 and 12),
  color           text not null default '' check (char_length(color) <= 30),
  has_ac          boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index vehicles_owner_idx on public.vehicles (owner_id);
create trigger vehicles_updated before update on public.vehicles for each row execute function private.set_updated_at();

create or replace function private.guard_vehicle()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.registration_no := upper(regexp_replace(new.registration_no, '[^A-Za-z0-9]', '', 'g'));
  if current_user not in ('authenticated', 'anon') or private.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.owner_id := old.owner_id;
  end if;
  return new;
end $$;
create trigger vehicles_guard before insert or update on public.vehicles
  for each row execute function private.guard_vehicle();

alter table public.vehicles enable row level security;
create policy "vehicles: read own or admin" on public.vehicles for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()));
create policy "vehicles: insert own" on public.vehicles for insert to authenticated
  with check (owner_id = (select auth.uid()) or (select private.is_admin()));
create policy "vehicles: update own or admin" on public.vehicles for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()))
  with check (owner_id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------------
-- Rides: a ride is published either by an approved cab partner (old way)
-- or by a driver for themselves (new way).
-- ---------------------------------------------------------------------
alter table public.cab_rides alter column partner_id drop not null;
alter table public.cab_rides alter column from_location_id drop not null;
alter table public.cab_rides alter column to_location_id drop not null;
alter table public.cab_rides
  add column if not exists driver_id     uuid references public.profiles(id) on delete cascade,
  add column if not exists vehicle_id    uuid references public.vehicles(id),
  add column if not exists from_place_id uuid references public.places(id),
  add column if not exists to_place_id   uuid references public.places(id),
  add column if not exists stops         jsonb not null default '[]'::jsonb,
  add column if not exists is_test       boolean not null default false;

alter table public.cab_rides drop constraint if exists cab_rides_vehicle_type_check;
alter table public.cab_rides add constraint cab_rides_vehicle_type_check check (vehicle_type in
  ('hatchback','sedan','suv','tempo_traveller','other','swift','wagonr','ertiga','bolero','eeco'));
alter table public.cab_rides add constraint cab_rides_owner_check check (partner_id is not null or driver_id is not null);
alter table public.cab_rides add constraint cab_rides_from_check check (from_location_id is not null or from_place_id is not null);
alter table public.cab_rides add constraint cab_rides_to_check check (to_location_id is not null or to_place_id is not null);
alter table public.cab_rides add constraint cab_rides_places_differ check (from_place_id is null or from_place_id <> to_place_id);
alter table public.cab_rides add constraint cab_rides_stops_check check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) <= 8);

create index cab_rides_driver_idx on public.cab_rides (driver_id, departure_at desc);
create index cab_rides_place_route_idx on public.cab_rides (from_place_id, to_place_id, departure_at);
create index cab_rides_vehicle_idx on public.cab_rides (vehicle_id);

create or replace function private.guard_cab_ride()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_active integer;
  v_owner  uuid;
  v_seats  integer;
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
    new.driver_id    := old.driver_id;
    new.seats_booked := old.seats_booked;
    new.is_test      := old.is_test;
    select count(*) into v_active from public.cab_bookings b
     where b.ride_id = old.id and b.status in ('pending', 'confirmed');
    if v_active > 0 then
      if new.departure_at is distinct from old.departure_at
         or new.price_per_seat is distinct from old.price_per_seat
         or new.from_place_id is distinct from old.from_place_id
         or new.to_place_id is distinct from old.to_place_id
         or new.from_location_id is distinct from old.from_location_id
         or new.to_location_id is distinct from old.to_location_id
         or new.vehicle_id is distinct from old.vehicle_id
         or new.stops is distinct from old.stops then
        raise exception 'Passengers have already booked this ride. Route, time, price and vehicle cannot change now. Cancel the ride instead.';
      end if;
      if new.status = 'cancelled' and old.status <> 'cancelled' then
        raise exception 'Please use "Cancel ride" so your passengers are told';
      end if;
    end if;
    if new.seats_total < old.seats_booked then
      raise exception 'Seats cannot be fewer than already booked (%)', old.seats_booked;
    end if;
    if new.departure_at is distinct from old.departure_at and new.departure_at < now() then
      raise exception 'Departure must be in the future';
    end if;
    if new.status = 'full' and new.seats_booked < new.seats_total then new.status := 'open'; end if;
  end if;

  -- Rides published by a driver: own profile, own vehicle, seats within the vehicle.
  if new.driver_id is not null then
    if new.driver_id <> auth.uid() then raise exception 'You can publish rides only for yourself'; end if;
    if new.partner_id is not null then raise exception 'A ride belongs to a driver or a partner, not both'; end if;
    if not exists (select 1 from public.driver_profiles d where d.user_id = new.driver_id and d.status = 'active') then
      raise exception 'Please complete your driver profile first';
    end if;
    select v.owner_id, v.seats into v_owner, v_seats from public.vehicles v where v.id = new.vehicle_id and v.is_active;
    if v_owner is distinct from new.driver_id then raise exception 'Choose one of your own vehicles'; end if;
    if new.seats_total > v_seats then raise exception 'This vehicle has only % passenger seats', v_seats; end if;
    if new.from_place_id is null or new.to_place_id is null then raise exception 'Choose the start and the destination'; end if;
  end if;
  return new;
end $$;

drop policy if exists "cab_rides: public read" on public.cab_rides;
drop policy if exists "cab_rides: cab partner insert" on public.cab_rides;
drop policy if exists "cab_rides: cab partner update" on public.cab_rides;
create policy "cab_rides: read" on public.cab_rides for select to anon, authenticated
  using (not is_test or driver_id = (select auth.uid()) or private.owns_partner(partner_id) or (select private.is_admin()));
create policy "cab_rides: insert" on public.cab_rides for insert to authenticated
  with check (
    (partner_id is not null and private.partner_can(partner_id, 'cab'))
    or (driver_id = (select auth.uid()))
    or (select private.is_admin()));
create policy "cab_rides: update" on public.cab_rides for update to authenticated
  using (private.owns_partner(partner_id) or driver_id = (select auth.uid()) or (select private.is_admin()))
  with check (private.owns_partner(partner_id) or driver_id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------------
-- Bookings: booking code, chosen seat numbers, optional part-route.
-- 'pending' = request waiting for the driver.
-- ---------------------------------------------------------------------
alter table public.cab_bookings
  add column if not exists booking_code  text,
  add column if not exists seat_numbers  integer[] not null default '{}',
  add column if not exists from_place_id uuid references public.places(id),
  add column if not exists to_place_id   uuid references public.places(id);
create unique index cab_bookings_code_uidx on public.cab_bookings (booking_code) where booking_code is not null;
alter table public.cab_bookings drop constraint if exists cab_bookings_status_check;
alter table public.cab_bookings add constraint cab_bookings_status_check
  check (status in ('pending','confirmed','declined','cancelled','completed'));

drop policy if exists "cab_bookings: read own / driver / admin" on public.cab_bookings;
create policy "cab_bookings: read own / driver / admin" on public.cab_bookings for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin())
    or exists (select 1 from public.cab_rides r
                where r.id = ride_id and (r.driver_id = (select auth.uid()) or private.owns_partner(r.partner_id))));

-- Seat holds: one active hold per seat per ride (no double booking).
-- Released seats keep their row with released_at set.
create table public.cab_seat_holds (
  id          uuid primary key default gen_random_uuid(),
  ride_id     uuid not null references public.cab_rides(id) on delete cascade,
  booking_id  uuid not null references public.cab_bookings(id) on delete cascade,
  seat_no     integer not null check (seat_no between 1 and 20),
  released_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index cab_seat_holds_active_uidx on public.cab_seat_holds (ride_id, seat_no) where released_at is null;
create index cab_seat_holds_booking_idx on public.cab_seat_holds (booking_id);
alter table public.cab_seat_holds enable row level security;
create policy "cab_seat_holds: admin read" on public.cab_seat_holds for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------
create or replace function private.new_booking_code()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v text;
begin
  loop
    v := 'THH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.cab_bookings where booking_code = v);
  end loop;
  return v;
end $$;

create or replace function private.ride_owner(r public.cab_rides)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(r.driver_id, (select p.owner_id from public.partners p where p.id = r.partner_id));
$$;

create or replace function private.release_booking_seats(p_booking uuid, p_ride uuid, p_seats integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.cab_seat_holds set released_at = now() where booking_id = p_booking and released_at is null;
  update public.cab_rides
     set seats_booked = greatest(seats_booked - p_seats, 0),
         status = case when status = 'full' then 'open' else status end
   where id = p_ride;
end $$;

-- Customer: request seats (or book at once when the driver has Instant Book on).
create or replace function public.request_cab_ride(
  p_ride uuid, p_seat_numbers integer[], p_name text, p_phone text,
  p_note text default '', p_from_place uuid default null, p_to_place uuid default null)
returns public.cab_bookings
language plpgsql security definer set search_path = '' as $$
declare
  ride   public.cab_rides;
  b      public.cab_bookings;
  v_n    integer;
  v_seat integer;
  v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in to book'; end if;
  v_n := coalesce(array_length(p_seat_numbers, 1), 0);
  if v_n < 1 then raise exception 'Choose at least one seat'; end if;
  if v_n <> (select count(distinct s) from unnest(p_seat_numbers) s) then raise exception 'Each seat can be chosen once'; end if;
  if char_length(coalesce(p_name, '')) < 2 then raise exception 'Please enter your name'; end if;
  if char_length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 10 then raise exception 'Please enter a 10-digit mobile number'; end if;

  select * into ride from public.cab_rides where id = p_ride for update;
  if not found or (ride.is_test and not private.is_admin()) then raise exception 'Ride not found'; end if;
  if ride.status <> 'open' or ride.departure_at <= now() then raise exception 'This ride is no longer open'; end if;
  v_owner := private.ride_owner(ride);
  if v_owner = auth.uid() then raise exception 'You cannot book your own ride'; end if;
  if exists (select 1 from public.cab_bookings where ride_id = p_ride and user_id = auth.uid() and status in ('pending','confirmed')) then
    raise exception 'You already have a booking on this ride';
  end if;
  foreach v_seat in array p_seat_numbers loop
    if v_seat < 1 or v_seat > ride.seats_total then raise exception 'Seat % does not exist in this car', v_seat; end if;
    if exists (select 1 from public.cab_seat_holds h where h.ride_id = p_ride and h.seat_no = v_seat and h.released_at is null) then
      raise exception 'Seat % has just been taken. Please choose another seat.', v_seat;
    end if;
  end loop;

  insert into public.cab_bookings (ride_id, user_id, seats, passenger_name, phone, note, status,
                                   booking_code, seat_numbers, from_place_id, to_place_id)
  values (p_ride, auth.uid(), v_n, left(trim(p_name), 120), left(trim(p_phone), 20), left(coalesce(p_note, ''), 300),
          case when ride.auto_confirm then 'confirmed' else 'pending' end,
          private.new_booking_code(), (select array_agg(s order by s) from unnest(p_seat_numbers) s),
          coalesce(p_from_place, ride.from_place_id), coalesce(p_to_place, ride.to_place_id))
  returning * into b;

  insert into public.cab_seat_holds (ride_id, booking_id, seat_no)
  select p_ride, b.id, s from unnest(p_seat_numbers) s;

  update public.cab_rides
     set seats_booked = seats_booked + v_n,
         status = case when seats_booked + v_n >= seats_total then 'full' else status end
   where id = p_ride;

  perform private.notify(v_owner,
    case when b.status = 'confirmed' then 'New booking ' else 'New ride request ' end || b.booking_code,
    left(b.passenger_name, 60) || ' · ' || v_n || ' seat(s) · ' || to_char(ride.departure_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'),
    case when ride.driver_id is not null then '#/drive/requests' else '#/partner/rides' end);
  return b;
end $$;

-- Driver: accept or decline a request.
create or replace function public.respond_cab_request(p_booking uuid, p_accept boolean)
returns public.cab_bookings
language plpgsql security definer set search_path = '' as $$
declare
  b    public.cab_bookings;
  ride public.cab_rides;
begin
  select * into b from public.cab_bookings where id = p_booking for update;
  if not found then raise exception 'Request not found'; end if;
  select * into ride from public.cab_rides where id = b.ride_id for update;
  if private.ride_owner(ride) is distinct from auth.uid() and not private.is_admin() then
    raise exception 'Only the driver of this ride can answer this request';
  end if;
  if b.status <> 'pending' then raise exception 'This request has already been answered'; end if;

  if p_accept then
    if ride.status = 'cancelled' or ride.departure_at <= now() then raise exception 'This ride is no longer open'; end if;
    update public.cab_bookings set status = 'confirmed' where id = p_booking returning * into b;
  else
    perform private.release_booking_seats(b.id, ride.id, b.seats);
    update public.cab_bookings set status = 'declined' where id = p_booking returning * into b;
  end if;

  perform private.notify(b.user_id,
    case when p_accept then 'Ride confirmed ' else 'Ride request declined ' end || b.booking_code,
    'Ride on ' || to_char(ride.departure_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'),
    '#/cab/booking/' || b.id);
  return b;
end $$;

-- Customer: cancel own booking or request before departure.
create or replace function public.cancel_cab_booking(p_booking uuid)
returns public.cab_bookings
language plpgsql security definer set search_path = '' as $$
declare
  b    public.cab_bookings;
  ride public.cab_rides;
begin
  select * into b from public.cab_bookings where id = p_booking for update;
  if not found or (b.user_id <> auth.uid() and not private.is_admin()) then raise exception 'Booking not found'; end if;
  if b.status not in ('pending', 'confirmed') then raise exception 'This booking cannot be cancelled'; end if;
  select * into ride from public.cab_rides where id = b.ride_id for update;
  if ride.departure_at <= now() then raise exception 'The ride has already left'; end if;
  perform private.release_booking_seats(b.id, ride.id, b.seats);
  update public.cab_bookings set status = 'cancelled' where id = p_booking returning * into b;
  perform private.notify(private.ride_owner(ride), 'Booking cancelled ' || b.booking_code,
    left(b.passenger_name, 60) || ' · ' || b.seats || ' seat(s)',
    case when ride.driver_id is not null then '#/drive/rides' else '#/partner/rides' end);
  return b;
end $$;

-- Driver: cancel a ride; every passenger is told and seats are released.
create or replace function public.cancel_cab_ride(p_ride uuid)
returns public.cab_rides
language plpgsql security definer set search_path = '' as $$
declare
  ride public.cab_rides;
  b    public.cab_bookings;
begin
  select * into ride from public.cab_rides where id = p_ride for update;
  if not found or (private.ride_owner(ride) is distinct from auth.uid() and not private.is_admin()) then
    raise exception 'Ride not found';
  end if;
  if ride.status not in ('open', 'full') then raise exception 'This ride is already closed'; end if;
  for b in select * from public.cab_bookings where ride_id = p_ride and status in ('pending', 'confirmed') for update loop
    update public.cab_seat_holds set released_at = now() where booking_id = b.id and released_at is null;
    update public.cab_bookings set status = 'cancelled' where id = b.id;
    perform private.notify(b.user_id, 'Ride cancelled by the driver ' || coalesce(b.booking_code, ''),
      'Ride on ' || to_char(ride.departure_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI') || '. Please find another ride.',
      '#/cab/booking/' || b.id);
  end loop;
  update public.cab_rides set status = 'cancelled', seats_booked = 0 where id = p_ride returning * into ride;
  return ride;
end $$;

-- Seat map: which seat numbers are taken (no names).
create or replace function public.cab_ride_taken_seats(p_ride uuid)
returns integer[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(h.seat_no order by h.seat_no), '{}')
    from public.cab_seat_holds h
    join public.cab_rides r on r.id = h.ride_id
   where h.ride_id = p_ride and h.released_at is null
     and (not r.is_test or r.driver_id = auth.uid() or private.is_admin());
$$;

-- Public driver details for ride cards (no phone).
create or replace function public.cab_driver_cards(p_ids uuid[])
returns table (user_id uuid, full_name text, photo_url text, about text, is_verified boolean, trips integer, member_since date)
language sql stable security definer set search_path = '' as $$
  select d.user_id, d.full_name,
         coalesce(nullif(d.photo_url, ''), p.avatar_url, ''),
         d.about, d.is_verified,
         (select count(*)::integer from public.cab_rides r
           where r.driver_id = d.user_id and r.status <> 'cancelled' and r.departure_at < now() and r.seats_booked > 0),
         d.created_at::date
    from public.driver_profiles d
    join public.profiles p on p.id = d.user_id
   where d.user_id = any(p_ids) and d.status = 'active';
$$;

-- Contact details: driver phone and registration number for a confirmed passenger.
create or replace function public.cab_booking_contact(p_booking uuid)
returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  b    public.cab_bookings;
  ride public.cab_rides;
  v    json;
begin
  select * into b from public.cab_bookings where id = p_booking;
  if not found or (b.user_id <> auth.uid() and not private.is_admin()) then raise exception 'Booking not found'; end if;
  if b.status <> 'confirmed' then return null; end if;
  select * into ride from public.cab_rides where id = b.ride_id;
  if ride.driver_id is not null then
    select json_build_object('name', d.full_name, 'phone', d.phone,
                             'vehicle', coalesce(vh.model, ride.vehicle_model), 'registration', coalesce(vh.registration_no, ''))
      into v
      from public.driver_profiles d left join public.vehicles vh on vh.id = ride.vehicle_id
     where d.user_id = ride.driver_id;
  else
    select json_build_object('name', p.contact_name, 'phone', coalesce(nullif(p.whatsapp, ''), p.phone),
                             'vehicle', ride.vehicle_model, 'registration', '')
      into v from public.partners p where p.id = ride.partner_id;
  end if;
  return v;
end $$;

revoke execute on function public.request_cab_ride(uuid, integer[], text, text, text, uuid, uuid) from public, anon;
revoke execute on function public.respond_cab_request(uuid, boolean) from public, anon;
revoke execute on function public.cancel_cab_booking(uuid) from public, anon;
revoke execute on function public.cancel_cab_ride(uuid) from public, anon;
revoke execute on function public.cab_booking_contact(uuid) from public, anon;
grant execute on function public.request_cab_ride(uuid, integer[], text, text, text, uuid, uuid) to authenticated;
grant execute on function public.respond_cab_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_cab_booking(uuid) to authenticated;
grant execute on function public.cancel_cab_ride(uuid) to authenticated;
grant execute on function public.cab_booking_contact(uuid) to authenticated;
grant execute on function public.cab_ride_taken_seats(uuid) to anon, authenticated;
grant execute on function public.cab_driver_cards(uuid[]) to anon, authenticated;
revoke execute on function private.new_booking_code() from public, anon, authenticated;
revoke execute on function private.ride_owner(public.cab_rides) from public, anon, authenticated;
revoke execute on function private.release_booking_seats(uuid, uuid, integer) from public, anon, authenticated;
