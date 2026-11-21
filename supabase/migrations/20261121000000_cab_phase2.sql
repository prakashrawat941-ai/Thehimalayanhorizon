-- Instant Cab Phase 2 (approved by the owner 21 Nov 2026, "DB approved").
-- Additive only: no table or row is removed. Plan: Project doc claude/instant-cab-db-plan.md
--  1 booking / ride IDs        2 15-minute holds + expiry job   3 realtime seats
--  4 route line + 50 km match  5 vehicle catalog + images       6 driver documents
--  7 start / complete ride     8 feedback                       9 reliability
-- 10 SOS                      11 live trip sharing             12 notification log
-- 13 audit log                14 cab rules in settings

-- ───────────────────────── 14. Rules (admin can change) ─────────────────────────
insert into public.site_settings (key, value)
values ('cab_rules', jsonb_build_object('corridor_km', 50, 'hold_minutes', 15, 'min_rides', 5, 'min_reviews', 3, 'share_hours', 12))
on conflict (key) do nothing;

create or replace function private.cab_rule(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((select case when jsonb_typeof(s.value -> p_key) = 'number' then (s.value ->> p_key)::numeric end
                     from public.site_settings s where s.key = 'cab_rules'), p_default);
$$;

-- Distance helpers (km). seg_dist returns {km, t}: distance from a point to segment A-B and how far along it (0..1).
create or replace function private.km(a_lat float8, a_lng float8, b_lat float8, b_lng float8)
returns float8 language sql immutable parallel safe set search_path = '' as $$
  select 2 * 6371 * asin(least(1, sqrt(power(sin(radians(b_lat - a_lat) / 2), 2)
         + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))));
$$;

create or replace function private.seg_dist(p_lat float8, p_lng float8, a_lat float8, a_lng float8, b_lat float8, b_lng float8)
returns float8[] language plpgsql immutable parallel safe set search_path = '' as $$
declare kx float8; ky float8 := 110.574; bx float8; by_ float8; px float8; py float8; l2 float8; t float8 := 0;
begin
  if b_lat is null then return array[private.km(p_lat, p_lng, a_lat, a_lng), 0]; end if;
  kx := 111.32 * cos(radians((a_lat + b_lat) / 2));
  bx := (b_lng - a_lng) * kx; by_ := (b_lat - a_lat) * ky;
  px := (p_lng - a_lng) * kx; py := (p_lat - a_lat) * ky;
  l2 := bx * bx + by_ * by_;
  if l2 > 0 then t := greatest(0, least(1, (px * bx + py * by_) / l2)); end if;
  return array[sqrt(power(px - t * bx, 2) + power(py - t * by_, 2)), t];
end $$;

-- ───────────────────────── 1. Booking ID and Ride ID ─────────────────────────
create table if not exists private.id_counters (
  kind       text primary key,
  last_value bigint not null default 0 check (last_value >= 0)
);
insert into private.id_counters (kind) values ('booking'), ('ride') on conflict do nothing;

create or replace function private.next_counter(p_kind text)
returns bigint language plpgsql volatile security definer set search_path = '' as $$
declare v bigint;
begin
  -- The row lock makes two simultaneous callers wait for each other: numbers never repeat.
  update private.id_counters set last_value = last_value + 1 where kind = p_kind returning last_value into v;
  if v is null then raise exception 'Unknown counter %', p_kind; end if;
  return v;
end $$;

alter table public.cab_bookings
  add column if not exists booking_ref     text,
  add column if not exists hold_expires_at timestamptz,
  add column if not exists pickup_geo      jsonb,
  add column if not exists drop_geo        jsonb;

alter table public.cab_rides
  add column if not exists ride_ref     text,
  add column if not exists from_geo     jsonb,
  add column if not exists to_geo       jsonb,
  add column if not exists route_line   jsonb,
  add column if not exists distance_km  numeric(7,1) check (distance_km is null or distance_km between 0 and 5000),
  add column if not exists duration_min integer check (duration_min is null or duration_min between 0 and 6000),
  add column if not exists started_at   timestamptz,
  add column if not exists completed_at timestamptz;

-- Existing rows get IDs once (ordered by creation), before the triggers exist.
do $$
declare r record; v_reg text;
begin
  for r in select c.id, c.created_at, v.registration_no from public.cab_rides c left join public.vehicles v on v.id = c.vehicle_id
            where c.ride_ref is null order by c.created_at loop
    v_reg := rpad(coalesce(nullif(left(upper(regexp_replace(coalesce(r.registration_no, ''), '[^A-Za-z0-9]', '', 'g')), 4), ''), 'THHX'), 4, 'X');
    update public.cab_rides set ride_ref = v_reg || '-' || to_char(r.created_at at time zone 'Asia/Kolkata', 'DDMM') || '-'
           || to_char(r.created_at at time zone 'Asia/Kolkata', 'YYYY') || '-THH-' || lpad(private.next_counter('ride')::text, 4, '0')
     where id = r.id;
  end loop;
  for r in select id, created_at from public.cab_bookings where booking_ref is null order by created_at loop
    update public.cab_bookings set booking_ref = 'THH-' || to_char(r.created_at at time zone 'Asia/Kolkata', 'DDMMYYYY') || '-'
           || lpad(private.next_counter('booking')::text, 4, '0')
     where id = r.id;
  end loop;
end $$;

create unique index if not exists cab_bookings_ref_uidx on public.cab_bookings (booking_ref) where booking_ref is not null;
create unique index if not exists cab_rides_ref_uidx on public.cab_rides (ride_ref) where ride_ref is not null;
create index if not exists cab_bookings_hold_idx on public.cab_bookings (hold_expires_at) where status = 'pending';
create index if not exists cab_rides_open_day_idx on public.cab_rides (departure_at) where status = 'open';

-- Statuses: bookings can expire, rides can be started.
alter table public.cab_bookings drop constraint if exists cab_bookings_status_check;
alter table public.cab_bookings add constraint cab_bookings_status_check
  check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed', 'expired'));
alter table public.cab_rides drop constraint if exists cab_rides_status_check;
alter table public.cab_rides add constraint cab_rides_status_check
  check (status in ('open', 'full', 'started', 'cancelled', 'completed'));

-- Any Indian village can be a start/end (name + coordinates), not only listed places.
alter table public.cab_rides drop constraint if exists cab_rides_from_check;
alter table public.cab_rides add constraint cab_rides_from_check
  check (from_location_id is not null or from_place_id is not null or from_geo is not null);
alter table public.cab_rides drop constraint if exists cab_rides_to_check;
alter table public.cab_rides add constraint cab_rides_to_check
  check (to_location_id is not null or to_place_id is not null or to_geo is not null);

create or replace function private.valid_geo(j jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select j is null or (
    jsonb_typeof(j) = 'object'
    and jsonb_typeof(j -> 'lat') = 'number' and jsonb_typeof(j -> 'lng') = 'number'
    and (j ->> 'lat')::float8 between 6 and 37.6 and (j ->> 'lng')::float8 between 68 and 97.5
    and coalesce(jsonb_typeof(j -> 'name'), 'string') = 'string' and char_length(coalesce(j ->> 'name', '')) <= 200);
$$;

alter table public.cab_rides add constraint cab_rides_from_geo_check check (private.valid_geo(from_geo));
alter table public.cab_rides add constraint cab_rides_to_geo_check check (private.valid_geo(to_geo));
alter table public.cab_rides add constraint cab_rides_route_line_check
  check (route_line is null or (jsonb_typeof(route_line) = 'array' and jsonb_array_length(route_line) between 2 and 600));
alter table public.cab_bookings add constraint cab_bookings_pickup_geo_check check (private.valid_geo(pickup_geo));
alter table public.cab_bookings add constraint cab_bookings_drop_geo_check check (private.valid_geo(drop_geo));

-- Ride ID on every insert (any role); never changes afterwards.
create or replace function private.set_ride_ref()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_reg text; v_now timestamp := now() at time zone 'Asia/Kolkata';
begin
  if tg_op = 'INSERT' then
    select upper(regexp_replace(v.registration_no, '[^A-Za-z0-9]', '', 'g')) into v_reg from public.vehicles v where v.id = new.vehicle_id;
    v_reg := rpad(coalesce(nullif(left(v_reg, 4), ''), 'THHX'), 4, 'X');
    new.ride_ref := v_reg || '-' || to_char(v_now, 'DDMM') || '-' || to_char(v_now, 'YYYY') || '-THH-'
                    || lpad(private.next_counter('ride')::text, 4, '0');
  else
    new.ride_ref := old.ride_ref;
  end if;
  return new;
end $$;
drop trigger if exists cab_rides_ref on public.cab_rides;
create trigger cab_rides_ref before insert or update on public.cab_rides
  for each row execute function private.set_ride_ref();

-- Booking ID, 15-minute hold, and booking rules that apply however a booking is changed.
create or replace function private.cab_booking_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  if tg_op = 'INSERT' then
    new.booking_ref := 'THH-' || to_char(now() at time zone 'Asia/Kolkata', 'DDMMYYYY') || '-'
                       || lpad(private.next_counter('booking')::text, 4, '0');
    new.booking_code := new.booking_ref;
    new.hold_expires_at := case when new.status = 'pending'
      then now() + make_interval(mins => greatest(1, least(1440, private.cab_rule('hold_minutes', 15)::int))) end;
    return new;
  end if;

  new.booking_ref := old.booking_ref;
  new.booking_code := old.booking_code;
  new.hold_expires_at := old.hold_expires_at;
  if new.status is distinct from old.status then
    select r.status into v_status from public.cab_rides r where r.id = old.ride_id;
    if old.status = 'pending' and new.status = 'confirmed' then
      if old.hold_expires_at is not null and old.hold_expires_at <= now() then
        raise exception 'This request has expired. The seats were released.';
      end if;
      if v_status not in ('open', 'full') then raise exception 'This ride is no longer open'; end if;
    end if;
    if new.status = 'cancelled' and v_status in ('started', 'completed') then
      raise exception 'The ride has already started';
    end if;
    if old.status in ('declined', 'cancelled', 'completed', 'expired') then
      raise exception 'This booking is already closed';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists cab_bookings_ref on public.cab_bookings;
create trigger cab_bookings_ref before insert or update on public.cab_bookings
  for each row execute function private.cab_booking_rules();

-- Driver rides: same rules as before, plus: admin-verified drivers only, start/end may be any
-- village (name + coordinates), and start/complete happen only through their functions.
create or replace function private.guard_cab_ride()
returns trigger language plpgsql set search_path = '' as $$
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
    new.started_at := null;
    new.completed_at := null;
    if new.departure_at < now() then raise exception 'Departure must be in the future'; end if;
  else
    new.partner_id   := old.partner_id;
    new.driver_id    := old.driver_id;
    new.seats_booked := old.seats_booked;
    new.is_test      := old.is_test;
    new.started_at   := old.started_at;
    new.completed_at := old.completed_at;
    if new.status is distinct from old.status
       and (new.status in ('started', 'completed') or old.status in ('started', 'completed', 'cancelled')) then
      raise exception 'Use Start ride / Complete ride for this';
    end if;
    select count(*) into v_active from public.cab_bookings b
     where b.ride_id = old.id and b.status in ('pending', 'confirmed');
    if v_active > 0 then
      if new.departure_at is distinct from old.departure_at
         or new.price_per_seat is distinct from old.price_per_seat
         or new.from_place_id is distinct from old.from_place_id
         or new.to_place_id is distinct from old.to_place_id
         or new.from_location_id is distinct from old.from_location_id
         or new.to_location_id is distinct from old.to_location_id
         or new.from_geo is distinct from old.from_geo
         or new.to_geo is distinct from old.to_geo
         or new.route_line is distinct from old.route_line
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

  if new.driver_id is not null then
    if new.driver_id <> auth.uid() then raise exception 'You can publish rides only for yourself'; end if;
    if new.partner_id is not null then raise exception 'A ride belongs to a driver or a partner, not both'; end if;
    if not exists (select 1 from public.driver_profiles d where d.user_id = new.driver_id and d.status = 'active') then
      raise exception 'Please complete your driver profile first';
    end if;
    if tg_op = 'INSERT' and not exists (select 1 from public.driver_profiles d where d.user_id = new.driver_id and d.is_verified) then
      raise exception 'Your driver profile is waiting for verification by The Himalayan Horizon team';
    end if;
    select v.owner_id, v.seats into v_owner, v_seats from public.vehicles v where v.id = new.vehicle_id and v.is_active;
    if v_owner is distinct from new.driver_id then raise exception 'Choose one of your own vehicles'; end if;
    if new.seats_total > v_seats then raise exception 'This vehicle has only % passenger seats', v_seats; end if;
    if (new.from_place_id is null and new.from_geo is null) or (new.to_place_id is null and new.to_geo is null) then
      raise exception 'Choose the start and the destination';
    end if;
  end if;
  return new;
end $$;

-- ───────────────────────── 2. Expiry job (every minute) ─────────────────────────
create or replace function private.expire_cab_holds()
returns integer language plpgsql security definer set search_path = '' as $$
declare b public.cab_bookings; ride public.cab_rides; n integer := 0;
begin
  for b in select * from public.cab_bookings
            where status = 'pending' and hold_expires_at is not null and hold_expires_at <= now()
            order by hold_expires_at for update skip locked loop
    select * into ride from public.cab_rides where id = b.ride_id for update;
    perform private.release_booking_seats(b.id, b.ride_id, b.seats);
    update public.cab_bookings set status = 'expired' where id = b.id;
    perform private.notify(b.user_id, 'Ride request expired ' || coalesce(b.booking_code, ''),
      'The driver did not answer in time, so your seats were released. Please choose another ride.', '#/cab/booking/' || b.id);
    perform private.notify(private.ride_owner(ride), 'Request expired ' || coalesce(b.booking_code, ''),
      left(b.passenger_name, 60) || ' · ' || b.seats || ' seat(s) · not answered in time',
      case when ride.driver_id is not null then '#/drive/requests' else '#/partner/rides' end);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ───────────────────────── 3. Realtime seat counts ─────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cab_rides') then
    alter publication supabase_realtime add table public.cab_rides;
  end if;
end $$;

-- ───────────────────────── 4. Route matching (50 km corridor) ─────────────────────────
-- A ride's line: stored road route, or (older rides) start → end.
create or replace function private.ride_segments(r public.cab_rides)
returns table (pos integer, a_lat float8, a_lng float8, b_lat float8, b_lng float8)
language sql stable security definer set search_path = '' as $$
  with pts as (
    select (e.n - 1)::int as idx, (e.p ->> 0)::float8 as lat, (e.p ->> 1)::float8 as lng
      from jsonb_array_elements(r.route_line) with ordinality as e(p, n)
     where r.route_line is not null and jsonb_array_length(r.route_line) >= 2
    union all
    select x.idx, x.lat, x.lng from (
      select 0 as idx, coalesce((r.from_geo ->> 'lat')::float8, fp.lat::float8) as lat, coalesce((r.from_geo ->> 'lng')::float8, fp.lng::float8) as lng
        from (select 1) one left join public.places fp on fp.id = r.from_place_id
      union all
      select 1, coalesce((r.to_geo ->> 'lat')::float8, tp.lat::float8), coalesce((r.to_geo ->> 'lng')::float8, tp.lng::float8)
        from (select 1) one left join public.places tp on tp.id = r.to_place_id
    ) x where r.route_line is null or jsonb_array_length(r.route_line) < 2
  )
  select idx, lat, lng, lead(lat) over (order by idx), lead(lng) over (order by idx)
    from pts where lat is not null and lng is not null;
$$;

create or replace function public.match_cab_rides(
  p_pick_lat float8, p_pick_lng float8, p_drop_lat float8, p_drop_lng float8,
  p_date date, p_seats integer default 1, p_time time default null)
returns table (ride_id uuid, ride_ref text, departure_at timestamptz, seats_left integer, price_per_seat integer,
               pickup_km numeric, drop_km numeric, detour_km numeric, route_km numeric, minutes_off integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_radius float8 := greatest(1, least(100, private.cab_rule('corridor_km', 50)))::float8;
begin
  if p_pick_lat is null or p_drop_lat is null or p_date is null then raise exception 'Choose pickup, destination and date'; end if;
  if not (p_pick_lat between 6 and 37.6 and p_pick_lng between 68 and 97.5 and p_drop_lat between 6 and 37.6 and p_drop_lng between 68 and 97.5) then
    raise exception 'Places must be in India';
  end if;
  if coalesce(p_seats, 1) not between 1 and 12 then raise exception 'Seats must be between 1 and 12'; end if;

  return query
  with cand as (
    select r.* from public.cab_rides r
     where r.status = 'open' and not r.is_test and r.departure_at > now()
       and (r.departure_at at time zone 'Asia/Kolkata')::date = p_date
       and r.seats_total - r.seats_booked >= coalesce(p_seats, 1)
  ), m as (
    select c.id, c.ride_ref, c.departure_at, c.seats_total - c.seats_booked as left_, c.price_per_seat, c.distance_km,
           pk.km as pk_km, pk.pos as pk_pos, dk.km as dk_km, dk.pos as dk_pos,
           case when p_time is null then null
                else abs(extract(epoch from ((c.departure_at at time zone 'Asia/Kolkata')::time - p_time)) / 60)::int end as off_
      from cand c
      cross join lateral (
        select x.d[1] as km, s.pos + x.d[2] as pos
          from private.ride_segments(c) s
          cross join lateral (select private.seg_dist(p_pick_lat, p_pick_lng, s.a_lat, s.a_lng, s.b_lat, s.b_lng) as d) x
         order by x.d[1] limit 1) pk
      cross join lateral (
        select x.d[1] as km, s.pos + x.d[2] as pos
          from private.ride_segments(c) s
          cross join lateral (select private.seg_dist(p_drop_lat, p_drop_lng, s.a_lat, s.a_lng, s.b_lat, s.b_lng) as d) x
         order by x.d[1] limit 1) dk
  )
  select m.id, m.ride_ref, m.departure_at, m.left_, m.price_per_seat,
         round(m.pk_km::numeric, 1), round(m.dk_km::numeric, 1), round((2 * (m.pk_km + m.dk_km))::numeric, 1),
         m.distance_km, m.off_
    from m
   where m.pk_km <= v_radius and m.dk_km <= v_radius and m.dk_pos > m.pk_pos
   order by round(m.dk_km / 5), m.pk_km, (m.pk_km + m.dk_km), coalesce(m.off_, 0), m.left_ desc
   limit 50;
end $$;

-- ───────────────────────── 5. Vehicle catalog and images ─────────────────────────
create table if not exists public.vehicle_makes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(name) between 2 and 60),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.vehicle_models (
  id         uuid primary key default gen_random_uuid(),
  make_id    uuid not null references public.vehicle_makes(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  category   text not null default 'other' check (category in ('hatchback', 'sedan', 'suv', 'muv', 'van', 'tempo_traveller', 'other')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (make_id, name)
);
create table if not exists public.vehicle_variants (
  id              uuid primary key default gen_random_uuid(),
  model_id        uuid not null references public.vehicle_models(id) on delete cascade,
  model_year      integer check (model_year is null or model_year between 1990 and 2035),
  variant         text not null default 'Standard' check (char_length(variant) between 1 and 60),
  seats_total     integer not null check (seats_total between 2 and 20),
  passenger_seats integer not null check (passenger_seats between 1 and 19),
  is_verified     boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  check (passenger_seats < seats_total)
);
create unique index if not exists vehicle_variants_uidx on public.vehicle_variants (model_id, coalesce(model_year, 0), variant);
create table if not exists public.vehicle_images (
  id          uuid primary key default gen_random_uuid(),
  model_id    uuid not null references public.vehicle_models(id) on delete cascade,
  variant_id  uuid references public.vehicle_variants(id) on delete cascade,
  model_year  integer check (model_year is null or model_year between 1990 and 2035),
  angle       text not null default 'front_34' check (angle in ('front_34', 'side', 'rear', 'interior', 'dashboard', 'other')),
  url         text not null check (url ~ '^https://' and char_length(url) <= 600),
  source_url  text not null default '' check (char_length(source_url) <= 600),
  author      text not null default '' check (char_length(author) <= 200),
  licence     text not null default '' check (char_length(licence) <= 120),
  is_generic  boolean not null default true,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists vehicle_models_make_idx on public.vehicle_models (make_id);
create index if not exists vehicle_images_model_idx on public.vehicle_images (model_id, status);

alter table public.vehicle_makes enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_variants enable row level security;
alter table public.vehicle_images enable row level security;

create policy "vehicle_makes: read" on public.vehicle_makes for select to anon, authenticated using (is_active or (select private.is_admin()));
create policy "vehicle_makes: admin write" on public.vehicle_makes for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "vehicle_models: read" on public.vehicle_models for select to anon, authenticated using (is_active or (select private.is_admin()));
create policy "vehicle_models: admin write" on public.vehicle_models for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "vehicle_variants: read" on public.vehicle_variants for select to anon, authenticated using (is_active or (select private.is_admin()));
create policy "vehicle_variants: admin write" on public.vehicle_variants for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "vehicle_images: read approved" on public.vehicle_images for select to anon, authenticated using (status = 'approved' or (select private.is_admin()));
create policy "vehicle_images: admin write" on public.vehicle_images for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

alter table public.vehicles add column if not exists variant_id uuid references public.vehicle_variants(id);
create index if not exists vehicles_variant_idx on public.vehicles (variant_id);

-- A vehicle picked from the catalog can't have more passenger seats than the catalog says.
create or replace function private.check_vehicle_variant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pass integer; v_name text;
begin
  if new.variant_id is not null then
    select vv.passenger_seats, mk.name || ' ' || mo.name into v_pass, v_name
      from public.vehicle_variants vv join public.vehicle_models mo on mo.id = vv.model_id join public.vehicle_makes mk on mk.id = mo.make_id
     where vv.id = new.variant_id and vv.is_active;
    if v_pass is null then raise exception 'Choose a vehicle from the list'; end if;
    if new.seats > v_pass then raise exception 'This vehicle has only % passenger seats', v_pass; end if;
    new.model := left(v_name, 80);
  end if;
  return new;
end $$;
drop trigger if exists vehicles_variant_check on public.vehicles;
create trigger vehicles_variant_check before insert or update on public.vehicles
  for each row execute function private.check_vehicle_variant();

-- Starter catalog: common Indian cars. Seat numbers are typical layouts and stay UNVERIFIED
-- until an admin checks them. Models sold with more than one layout get one row per layout.
with seed (make, model, category, layouts) as (values
  ('Maruti Suzuki','Swift','hatchback',array[5]), ('Maruti Suzuki','Dzire','sedan',array[5]), ('Maruti Suzuki','Wagon R','hatchback',array[5]),
  ('Maruti Suzuki','Baleno','hatchback',array[5]), ('Maruti Suzuki','Celerio','hatchback',array[5]), ('Maruti Suzuki','Alto K10','hatchback',array[5]),
  ('Maruti Suzuki','Ertiga','muv',array[7]), ('Maruti Suzuki','XL6','muv',array[6]), ('Maruti Suzuki','Eeco','van',array[5,7]),
  ('Maruti Suzuki','Brezza','suv',array[5]), ('Maruti Suzuki','Fronx','suv',array[5]), ('Maruti Suzuki','Grand Vitara','suv',array[5]),
  ('Maruti Suzuki','Invicto','muv',array[7,8]),
  ('Hyundai','i20','hatchback',array[5]), ('Hyundai','Aura','sedan',array[5]), ('Hyundai','Verna','sedan',array[5]), ('Hyundai','Creta','suv',array[5]),
  ('Hyundai','Venue','suv',array[5]), ('Hyundai','Exter','suv',array[5]), ('Hyundai','Alcazar','suv',array[6,7]),
  ('Tata','Tiago','hatchback',array[5]), ('Tata','Tigor','sedan',array[5]), ('Tata','Altroz','hatchback',array[5]), ('Tata','Punch','suv',array[5]),
  ('Tata','Nexon','suv',array[5]), ('Tata','Harrier','suv',array[5]), ('Tata','Safari','suv',array[6,7]),
  ('Mahindra','Bolero','suv',array[7]), ('Mahindra','Bolero Neo','suv',array[7]), ('Mahindra','Scorpio-N','suv',array[6,7]),
  ('Mahindra','Scorpio Classic','suv',array[7,9]), ('Mahindra','XUV700','suv',array[5,7]), ('Mahindra','XUV 3XO','suv',array[5]),
  ('Mahindra','Thar','suv',array[4]), ('Mahindra','Marazzo','muv',array[7,8]),
  ('Toyota','Innova Crysta','muv',array[7,8]), ('Toyota','Innova Hycross','muv',array[7,8]), ('Toyota','Fortuner','suv',array[7]),
  ('Toyota','Glanza','hatchback',array[5]), ('Toyota','Urban Cruiser Hyryder','suv',array[5]), ('Toyota','Rumion','muv',array[7]),
  ('Kia','Sonet','suv',array[5]), ('Kia','Seltos','suv',array[5]), ('Kia','Carens','muv',array[6,7]), ('Kia','Carnival','muv',array[7]),
  ('Honda','Amaze','sedan',array[5]), ('Honda','City','sedan',array[5]), ('Honda','Elevate','suv',array[5]),
  ('Renault','Kwid','hatchback',array[5]), ('Renault','Kiger','suv',array[5]), ('Renault','Triber','muv',array[7]),
  ('Nissan','Magnite','suv',array[5]),
  ('Volkswagen','Virtus','sedan',array[5]), ('Volkswagen','Taigun','suv',array[5]),
  ('Skoda','Slavia','sedan',array[5]), ('Skoda','Kushaq','suv',array[5]), ('Skoda','Kylaq','suv',array[5]),
  ('Force Motors','Traveller','tempo_traveller',array[12])
), mk as (
  insert into public.vehicle_makes (name) select distinct make from seed on conflict (name) do nothing returning id, name
), allmk as (
  select id, name from mk union select id, name from public.vehicle_makes
), mo as (
  insert into public.vehicle_models (make_id, name, category)
  select allmk.id, seed.model, seed.category from seed join allmk on allmk.name = seed.make
  on conflict (make_id, name) do nothing returning id, make_id, name
)
insert into public.vehicle_variants (model_id, variant, seats_total, passenger_seats)
select mo.id, case when cardinality(seed.layouts) = 1 then 'Standard' else l || '-seater' end, l, l - 1
  from seed join allmk on allmk.name = seed.make join mo on mo.make_id = allmk.id and mo.name = seed.model
  cross join lateral unnest(seed.layouts) as l
on conflict do nothing;

-- ───────────────────────── 6. Driver documents (private) ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('driver-docs', 'driver-docs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "driver-docs: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'driver-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "driver-docs: owner or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'driver-docs' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));
create policy "driver-docs: owner or admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'driver-docs' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));

create table if not exists public.driver_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  vehicle_id  uuid references public.vehicles(id) on delete set null,
  doc_type    text not null check (doc_type in ('driving_licence', 'vehicle_rc', 'insurance', 'permit', 'pollution', 'photo_id', 'other')),
  doc_number  text not null default '' check (char_length(doc_number) <= 40),
  file_path   text not null check (char_length(file_path) between 3 and 300),
  expires_on  date,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '' check (char_length(review_note) <= 300),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists driver_documents_user_idx on public.driver_documents (user_id);
create index if not exists driver_documents_pending_idx on public.driver_documents (created_at) where status = 'pending';
alter table public.driver_documents enable row level security;
create policy "driver_documents: read own or admin" on public.driver_documents for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "driver_documents: insert own" on public.driver_documents for insert to authenticated
  with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "driver_documents: update own or admin" on public.driver_documents for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin())) with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "driver_documents: admin delete" on public.driver_documents for delete to authenticated using ((select private.is_admin()));

create or replace function private.guard_driver_document()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if private.is_admin() then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then new.user_id := old.user_id; end if;
  if split_part(new.file_path, '/', 1) <> new.user_id::text then raise exception 'Upload the file to your own folder'; end if;
  if new.vehicle_id is not null and not exists (select 1 from public.vehicles v where v.id = new.vehicle_id and v.owner_id = new.user_id) then
    raise exception 'Choose one of your own vehicles';
  end if;
  -- Any change by the driver goes back to the review queue.
  new.status := 'pending'; new.review_note := ''; new.reviewed_by := null; new.reviewed_at := null;
  return new;
end $$;
create trigger driver_documents_guard before insert or update on public.driver_documents
  for each row execute function private.guard_driver_document();
create trigger driver_documents_updated before update on public.driver_documents
  for each row execute function private.set_updated_at();

-- Emergency contact (used by SOS).
alter table public.profiles
  add column if not exists emergency_contact_name  text not null default '' check (char_length(emergency_contact_name) <= 80),
  add column if not exists emergency_contact_phone text not null default '' check (char_length(emergency_contact_phone) <= 20);

-- Who is on a ride: 'driver', 'passenger' (confirmed/completed booking) or null.
create or replace function private.cab_role(p_ride uuid, p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.cab_rides r where r.id = p_ride and private.ride_owner(r) = p_user) then 'driver'
    when exists (select 1 from public.cab_bookings b where b.ride_id = p_ride and b.user_id = p_user and b.status in ('confirmed', 'completed')) then 'passenger'
  end;
$$;

-- ───────────────────────── 7. Start / complete ride ─────────────────────────
create or replace function public.start_cab_ride(p_ride uuid)
returns public.cab_rides language plpgsql security definer set search_path = '' as $$
declare ride public.cab_rides; b public.cab_bookings;
begin
  select * into ride from public.cab_rides where id = p_ride for update;
  if not found or (private.ride_owner(ride) is distinct from auth.uid() and not private.is_admin()) then raise exception 'Ride not found'; end if;
  if ride.status not in ('open', 'full') then raise exception 'This ride cannot be started now'; end if;
  if now() < ride.departure_at - interval '3 hours' then raise exception 'You can start the ride up to 3 hours before departure'; end if;
  if not exists (select 1 from public.cab_bookings where ride_id = p_ride and status = 'confirmed') then
    raise exception 'There are no confirmed passengers on this ride';
  end if;
  -- Requests not answered by now can't be accepted any more.
  for b in select * from public.cab_bookings where ride_id = p_ride and status = 'pending' for update loop
    perform private.release_booking_seats(b.id, p_ride, b.seats);
    update public.cab_bookings set status = 'expired' where id = b.id;
    perform private.notify(b.user_id, 'Ride request expired ' || coalesce(b.booking_code, ''),
      'The ride has started without your request being accepted. Your seats were released.', '#/cab/booking/' || b.id);
  end loop;
  update public.cab_rides set status = 'started', started_at = now() where id = p_ride returning * into ride;
  for b in select * from public.cab_bookings where ride_id = p_ride and status = 'confirmed' loop
    perform private.notify(b.user_id, 'Your ride has started ' || coalesce(b.booking_code, ''),
      'Have a safe journey. You can share your trip and use SOS from the booking page.', '#/cab/booking/' || b.id);
  end loop;
  return ride;
end $$;

create or replace function public.complete_cab_ride(p_ride uuid)
returns public.cab_rides language plpgsql security definer set search_path = '' as $$
declare ride public.cab_rides; b public.cab_bookings;
begin
  select * into ride from public.cab_rides where id = p_ride for update;
  if not found or (private.ride_owner(ride) is distinct from auth.uid() and not private.is_admin()) then raise exception 'Ride not found'; end if;
  if ride.status <> 'started' then raise exception 'Start the ride first'; end if;
  for b in select * from public.cab_bookings where ride_id = p_ride and status = 'confirmed' for update loop
    update public.cab_bookings set status = 'completed' where id = b.id;
    perform private.notify(b.user_id, 'Please rate your ride ' || coalesce(b.booking_code, ''),
      'Your journey is complete. Feedback is required before your next booking.', '#/cab/booking/' || b.id);
  end loop;
  update public.cab_rides set status = 'completed', completed_at = now() where id = p_ride returning * into ride;
  update public.cab_live_shares set revoked_at = now() where ride_id = p_ride and revoked_at is null;
  perform private.notify(private.ride_owner(ride), 'Ride completed ' || coalesce(ride.ride_ref, ''),
    'Please rate your passengers. Feedback is required before your next ride.', '#/drive/trip/' || ride.id);
  return ride;
end $$;

-- ───────────────────────── 8. Mandatory feedback ─────────────────────────
create table if not exists public.cab_feedback (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.cab_bookings(id) on delete cascade,
  ride_id    uuid not null references public.cab_rides(id) on delete cascade,
  from_user  uuid not null references public.profiles(id) on delete cascade,
  to_user    uuid not null references public.profiles(id) on delete cascade,
  from_role  text not null check (from_role in ('passenger', 'driver')),
  stars      smallint not null check (stars between 1 and 5),
  ratings    jsonb not null default '{}'::jsonb check (jsonb_typeof(ratings) = 'object'),
  comment    text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (booking_id, from_user)
);
create index if not exists cab_feedback_to_idx on public.cab_feedback (to_user, from_role);
create index if not exists cab_feedback_ride_idx on public.cab_feedback (ride_id);
alter table public.cab_feedback enable row level security;
create policy "cab_feedback: read own or admin" on public.cab_feedback for select to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()) or (select private.is_admin()));

create or replace function public.submit_cab_feedback(p_booking uuid, p_stars integer, p_ratings jsonb default '{}'::jsonb, p_comment text default '')
returns public.cab_feedback language plpgsql security definer set search_path = '' as $$
declare b public.cab_bookings; ride public.cab_rides; v_role text; v_to uuid; v_keys text[]; v_clean jsonb := '{}'::jsonb; k text; v jsonb; f public.cab_feedback;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  select * into b from public.cab_bookings where id = p_booking;
  if not found then raise exception 'Booking not found'; end if;
  select * into ride from public.cab_rides where id = b.ride_id;
  if b.user_id = auth.uid() then
    v_role := 'passenger'; v_to := private.ride_owner(ride);
    v_keys := array['behaviour', 'safety', 'punctuality', 'cleanliness', 'overall'];
  elsif private.ride_owner(ride) = auth.uid() then
    v_role := 'driver'; v_to := b.user_id;
    v_keys := array['behaviour', 'punctuality', 'communication', 'overall'];
  else
    raise exception 'Booking not found';
  end if;
  if b.status <> 'completed' then raise exception 'Feedback opens after the ride is completed'; end if;
  if p_stars is null or p_stars not between 1 and 5 then raise exception 'Choose 1 to 5 stars'; end if;
  if p_ratings is not null and jsonb_typeof(p_ratings) = 'object' then
    foreach k in array v_keys loop
      v := p_ratings -> k;
      if v is not null and jsonb_typeof(v) = 'number' and (v::text)::numeric in (1, 2, 3, 4, 5) then
        v_clean := v_clean || jsonb_build_object(k, (v::text)::int);
      end if;
    end loop;
  end if;
  begin
    insert into public.cab_feedback (booking_id, ride_id, from_user, to_user, from_role, stars, ratings, comment)
    values (b.id, ride.id, auth.uid(), v_to, v_role, p_stars, v_clean, left(trim(coalesce(p_comment, '')), 1000))
    returning * into f;
  exception when unique_violation then
    raise exception 'You have already given feedback for this ride';
  end;
  return f;
end $$;

-- Completed bookings I still have to rate (passenger side and driver side).
create or replace function public.my_pending_feedback()
returns table (booking_id uuid, booking_ref text, ride_id uuid, my_role text, other_name text, departure_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.id, b.booking_ref, r.id, 'passenger', coalesce(d.full_name, 'Driver'), r.departure_at
    from public.cab_bookings b join public.cab_rides r on r.id = b.ride_id
    left join public.driver_profiles d on d.user_id = r.driver_id
   where b.user_id = auth.uid() and b.status = 'completed'
     and not exists (select 1 from public.cab_feedback f where f.booking_id = b.id and f.from_user = auth.uid())
  union all
  select b.id, b.booking_ref, r.id, 'driver', b.passenger_name, r.departure_at
    from public.cab_bookings b join public.cab_rides r on r.id = b.ride_id
   where private.ride_owner(r) = auth.uid() and b.status = 'completed'
     and not exists (select 1 from public.cab_feedback f where f.booking_id = b.id and f.from_user = auth.uid())
  order by 6 desc;
$$;

-- ───────────────────────── 9. Driver reliability (real data only) ─────────────────────────
create or replace function public.driver_reliability(p_driver uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_done integer; v_served integer; v_cancelled integer; v_reviews integer; v_avg numeric; v_cats jsonb;
  v_min_rides integer := private.cab_rule('min_rides', 5)::int; v_min_reviews integer := private.cab_rule('min_reviews', 3)::int;
  v_rate numeric; v_score integer; v_level text; v_profile public.driver_profiles;
begin
  select * into v_profile from public.driver_profiles where user_id = p_driver and status = 'active';
  if not found then return null; end if;
  select count(*) into v_done from public.cab_rides r
   where r.driver_id = p_driver and not r.is_test and r.status = 'completed'
     and exists (select 1 from public.cab_bookings b where b.ride_id = r.id and b.status = 'completed');
  select coalesce(sum(b.seats), 0) into v_served from public.cab_bookings b join public.cab_rides r on r.id = b.ride_id
   where r.driver_id = p_driver and not r.is_test and b.status = 'completed';
  select count(*) into v_cancelled from public.cab_rides r
   where r.driver_id = p_driver and not r.is_test and r.status = 'cancelled'
     and exists (select 1 from public.cab_bookings b where b.ride_id = r.id and b.status = 'cancelled');
  select count(*), round(avg(stars), 2) into v_reviews, v_avg from public.cab_feedback where to_user = p_driver and from_role = 'passenger';
  select coalesce(jsonb_object_agg(k, a), '{}'::jsonb) into v_cats from (
    select e.key as k, round(avg((e.value::text)::numeric), 2) as a
      from public.cab_feedback f, jsonb_each(f.ratings) e
     where f.to_user = p_driver and f.from_role = 'passenger' group by e.key) s;
  v_rate := case when v_done + v_cancelled > 0 then round(v_cancelled::numeric / (v_done + v_cancelled), 3) end;
  if v_done >= v_min_rides and v_reviews >= v_min_reviews then
    v_score := round(70 * (v_avg / 5) + 30 * (1 - coalesce(v_rate, 0)));
    v_level := case when v_score >= 85 then 'excellent' when v_score >= 70 then 'good' when v_score >= 50 then 'fair' else 'low' end;
  else
    v_level := 'new';
  end if;
  return jsonb_build_object(
    'verified', v_profile.is_verified, 'member_since', v_profile.created_at::date,
    'completed_rides', v_done, 'passengers_served', v_served, 'cancelled_rides', v_cancelled, 'cancellation_rate', v_rate,
    'reviews', v_reviews, 'avg_rating', v_avg, 'category_avg', v_cats,
    'score', v_score, 'level', v_level, 'enough_history', v_score is not null,
    'method', jsonb_build_object('rating_weight', 70, 'reliability_weight', 30, 'min_rides', v_min_rides, 'min_reviews', v_min_reviews,
       'note', 'Score = 70 x (average stars / 5) + 30 x (1 - cancellation rate). Shown only after enough completed rides and reviews.'));
end $$;

-- ───────────────────────── 10. SOS ─────────────────────────
create table if not exists public.sos_incidents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null check (role in ('passenger', 'driver')),
  ride_id         uuid not null references public.cab_rides(id) on delete cascade,
  booking_id      uuid references public.cab_bookings(id) on delete set null,
  lat             float8 check (lat is null or lat between -90 and 90),
  lng             float8 check (lng is null or lng between -180 and 180),
  accuracy_m      real check (accuracy_m is null or accuracy_m >= 0),
  message         text not null default '' check (char_length(message) <= 500),
  emergency_name  text not null default '',
  emergency_phone text not null default '',
  status          text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'cancelled')),
  alerted_admins  integer not null default 0,
  admin_note      text not null default '' check (char_length(admin_note) <= 1000),
  cancel_reason   text not null default '' check (char_length(cancel_reason) <= 300),
  handled_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at     timestamptz,
  cancelled_at    timestamptz
);
create unique index if not exists sos_one_open_uidx on public.sos_incidents (user_id, ride_id) where status = 'open';
create index if not exists sos_status_idx on public.sos_incidents (status, created_at desc);
alter table public.sos_incidents enable row level security;
create policy "sos_incidents: read own or admin" on public.sos_incidents for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create or replace function public.raise_sos(p_ride uuid, p_lat float8 default null, p_lng float8 default null,
                                            p_accuracy float8 default null, p_message text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ride public.cab_rides; v_role text; v_booking uuid; v_prof public.profiles; s public.sos_incidents; a record; n integer := 0;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  select * into ride from public.cab_rides where id = p_ride;
  v_role := private.cab_role(p_ride, auth.uid());
  if ride.id is null or v_role is null then raise exception 'Only people on this ride can send SOS'; end if;
  if not (ride.status in ('open', 'full', 'started') and now() >= ride.departure_at - interval '6 hours'
          or ride.status = 'completed' and ride.completed_at > now() - interval '2 hours') then
    raise exception 'SOS works during an active ride';
  end if;
  if (p_lat is null) <> (p_lng is null) or (p_lat is not null and not (p_lat between -90 and 90 and p_lng between -180 and 180)) then
    raise exception 'Invalid location';
  end if;
  select * into s from public.sos_incidents where user_id = auth.uid() and ride_id = p_ride and status = 'open';
  if found then
    if p_lat is not null then update public.sos_incidents set lat = p_lat, lng = p_lng, accuracy_m = p_accuracy where id = s.id; end if;
    return jsonb_build_object('id', s.id, 'delivered', s.alerted_admins > 0, 'alerted', s.alerted_admins, 'repeat', true);
  end if;
  select * into v_prof from public.profiles where id = auth.uid();
  if v_role = 'passenger' then
    select b.id into v_booking from public.cab_bookings b
     where b.ride_id = p_ride and b.user_id = auth.uid() and b.status in ('confirmed', 'completed') order by b.created_at desc limit 1;
  end if;
  insert into public.sos_incidents (user_id, role, ride_id, booking_id, lat, lng, accuracy_m, message, emergency_name, emergency_phone)
  values (auth.uid(), v_role, p_ride, v_booking, p_lat, p_lng, p_accuracy, left(coalesce(p_message, ''), 500),
          coalesce(v_prof.emergency_contact_name, ''), coalesce(v_prof.emergency_contact_phone, ''))
  returning * into s;
  for a in select id from public.profiles where role = 'admin' loop
    perform private.notify(a.id, 'SOS: ' || v_role || ' on ride ' || coalesce(ride.ride_ref, ''),
      coalesce(nullif(v_prof.full_name, ''), 'User') || case when p_lat is not null then ' · location ' || round(p_lat::numeric, 5) || ',' || round(p_lng::numeric, 5) else ' · location not available' end,
      '#/admin/safety');
    n := n + 1;
  end loop;
  update public.sos_incidents set alerted_admins = n where id = s.id;
  return jsonb_build_object('id', s.id, 'delivered', n > 0, 'alerted', n, 'repeat', false,
    'emergency_name', coalesce(v_prof.emergency_contact_name, ''), 'emergency_phone', coalesce(v_prof.emergency_contact_phone, ''));
end $$;

create or replace function public.cancel_sos(p_id uuid, p_reason text default '')
returns public.sos_incidents language plpgsql security definer set search_path = '' as $$
declare s public.sos_incidents; a record;
begin
  select * into s from public.sos_incidents where id = p_id for update;
  if not found or s.user_id is distinct from auth.uid() then raise exception 'SOS not found'; end if;
  if s.status <> 'open' then raise exception 'This SOS is already being handled'; end if;
  update public.sos_incidents set status = 'cancelled', cancelled_at = now(), cancel_reason = left(coalesce(p_reason, ''), 300)
   where id = p_id returning * into s;
  for a in select id from public.profiles where role = 'admin' loop
    perform private.notify(a.id, 'SOS cancelled by the user', left(coalesce(p_reason, ''), 200), '#/admin/safety');
  end loop;
  return s;
end $$;

create or replace function public.admin_update_sos(p_id uuid, p_status text, p_note text default null)
returns public.sos_incidents language plpgsql security definer set search_path = '' as $$
declare s public.sos_incidents;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('acknowledged', 'resolved') then raise exception 'Unknown status'; end if;
  update public.sos_incidents
     set status = p_status, handled_by = auth.uid(),
         acknowledged_at = coalesce(acknowledged_at, now()),
         resolved_at = case when p_status = 'resolved' then now() else resolved_at end,
         admin_note = coalesce(left(p_note, 1000), admin_note)
   where id = p_id and status in ('open', 'acknowledged') returning * into s;
  if not found then raise exception 'SOS not found or already closed'; end if;
  perform private.notify(s.user_id,
    case when p_status = 'acknowledged' then 'THH support has seen your SOS' else 'Your SOS has been closed by THH support' end,
    '', '#/cab/bookings');
  return s;
end $$;

-- ───────────────────────── 11. Live trip sharing ─────────────────────────
create table if not exists public.cab_live_shares (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.cab_bookings(id) on delete cascade,
  ride_id    uuid not null references public.cab_rides(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  token      text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cab_live_shares_booking_idx on public.cab_live_shares (booking_id);
create index if not exists cab_live_shares_ride_idx on public.cab_live_shares (ride_id) where revoked_at is null;
alter table public.cab_live_shares enable row level security;
create policy "cab_live_shares: read own or admin" on public.cab_live_shares for select to authenticated
  using (created_by = (select auth.uid()) or (select private.is_admin()));

create table if not exists public.cab_live_positions (
  ride_id     uuid not null references public.cab_rides(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null check (role in ('passenger', 'driver')),
  lat         float8 not null check (lat between -90 and 90),
  lng         float8 not null check (lng between -180 and 180),
  accuracy_m  real,
  recorded_at timestamptz not null default now(),
  primary key (ride_id, user_id)
);
alter table public.cab_live_positions enable row level security;
create policy "cab_live_positions: ride people or admin" on public.cab_live_positions for select to authenticated
  using (private.cab_role(ride_id, (select auth.uid())) is not null or (select private.is_admin()));

create or replace function public.start_live_share(p_booking uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.cab_bookings; ride public.cab_rides; s public.cab_live_shares;
begin
  select * into b from public.cab_bookings where id = p_booking;
  if not found or b.user_id is distinct from auth.uid() then raise exception 'Booking not found'; end if;
  if b.status <> 'confirmed' then raise exception 'Trip sharing works for confirmed bookings'; end if;
  select * into ride from public.cab_rides where id = b.ride_id;
  if ride.status not in ('open', 'full', 'started') then raise exception 'This ride is not active'; end if;
  select * into s from public.cab_live_shares where booking_id = p_booking and revoked_at is null and expires_at > now()
   order by created_at desc limit 1;
  if not found then
    insert into public.cab_live_shares (booking_id, ride_id, created_by, expires_at)
    values (b.id, ride.id, auth.uid(),
            greatest(now(), ride.departure_at) + make_interval(hours => greatest(1, least(48, private.cab_rule('share_hours', 12)::int))))
    returning * into s;
  end if;
  return jsonb_build_object('token', s.token, 'expires_at', s.expires_at);
end $$;

create or replace function public.stop_live_share(p_booking uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.cab_live_shares set revoked_at = now()
   where booking_id = p_booking and created_by = auth.uid() and revoked_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.post_live_position(p_ride uuid, p_lat float8, p_lng float8, p_accuracy float8 default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare ride public.cab_rides; v_role text;
begin
  v_role := private.cab_role(p_ride, auth.uid());
  if v_role is null then raise exception 'Only people on this ride can share location'; end if;
  select * into ride from public.cab_rides where id = p_ride;
  if not (ride.status = 'started' or ride.status in ('open', 'full') and now() >= ride.departure_at - interval '1 hour') then
    return false;
  end if;
  if p_lat is null or p_lng is null or not (p_lat between -90 and 90 and p_lng between -180 and 180) then raise exception 'Invalid location'; end if;
  insert into public.cab_live_positions (ride_id, user_id, role, lat, lng, accuracy_m, recorded_at)
  values (p_ride, auth.uid(), v_role, p_lat, p_lng, p_accuracy, now())
  on conflict (ride_id, user_id) do update set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, recorded_at = now();
  return true;
end $$;

-- What a trusted contact sees with the link: no phone numbers, no registration number.
create or replace function public.get_live_share(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.cab_live_shares; b public.cab_bookings; ride public.cab_rides; pos public.cab_live_positions; v_driver text; v_from text; v_to text;
begin
  if p_token is null or char_length(p_token) <> 48 then return jsonb_build_object('active', false, 'reason', 'not_found'); end if;
  select * into s from public.cab_live_shares where token = p_token;
  if not found then return jsonb_build_object('active', false, 'reason', 'not_found'); end if;
  select * into b from public.cab_bookings where id = s.booking_id;
  select * into ride from public.cab_rides where id = s.ride_id;
  if s.revoked_at is not null or s.expires_at <= now() or ride.status in ('cancelled', 'completed') or b.status <> 'confirmed' then
    return jsonb_build_object('active', false, 'reason', case when ride.status = 'completed' or b.status = 'completed' then 'completed' else 'expired' end);
  end if;
  select * into pos from public.cab_live_positions where ride_id = ride.id order by (role = 'driver') desc, recorded_at desc limit 1;
  select split_part(full_name, ' ', 1) into v_driver from public.driver_profiles where user_id = ride.driver_id;
  select coalesce(b.pickup_geo ->> 'name', p.name) into v_from from (select 1) one left join public.places p on p.id = coalesce(b.from_place_id, ride.from_place_id);
  select coalesce(b.drop_geo ->> 'name', p.name) into v_to from (select 1) one left join public.places p on p.id = coalesce(b.to_place_id, ride.to_place_id);
  return jsonb_build_object('active', true, 'status', ride.status, 'ride_ref', ride.ride_ref, 'booking_ref', b.booking_ref,
    'departure_at', ride.departure_at, 'started_at', ride.started_at, 'expires_at', s.expires_at,
    'pickup', coalesce(v_from, ride.pickup_point), 'drop', coalesce(v_to, ride.drop_point),
    'route_line', ride.route_line, 'distance_km', ride.distance_km, 'duration_min', ride.duration_min,
    'vehicle', ride.vehicle_model, 'driver_first_name', coalesce(v_driver, ''),
    'position', case when pos.ride_id is null then null else jsonb_build_object('lat', pos.lat, 'lng', pos.lng, 'at', pos.recorded_at, 'from', pos.role) end);
end $$;

-- ───────────────────────── 12. Notification log (ready for WhatsApp) ─────────────────────────
create table if not exists public.notification_log (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete set null,
  booking_id          uuid references public.cab_bookings(id) on delete set null,
  channel             text not null check (channel in ('in_app', 'whatsapp', 'sms', 'email')),
  template            text not null check (char_length(template) between 1 and 80),
  payload             jsonb not null default '{}'::jsonb,
  status              text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  provider_message_id text,
  attempts            integer not null default 0 check (attempts between 0 and 20),
  last_error          text not null default '' check (char_length(last_error) <= 500),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists notification_log_once_uidx on public.notification_log (booking_id, user_id, channel, template) where booking_id is not null;
create index if not exists notification_log_status_idx on public.notification_log (status, created_at desc);
alter table public.notification_log enable row level security;
create policy "notification_log: admin read" on public.notification_log for select to authenticated using ((select private.is_admin()));
create trigger notification_log_updated before update on public.notification_log
  for each row execute function private.set_updated_at();

-- ───────────────────────── 13. Audit log (admin actions) ─────────────────────────
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  actor      uuid,
  action     text not null,
  table_name text not null,
  row_id     text,
  old_row    jsonb,
  new_row    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_time_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
create policy "audit_log: admin read" on public.audit_log for select to authenticated using ((select private.is_admin()));

create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare j jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  if auth.uid() is not null and private.is_admin() then
    insert into public.audit_log (actor, action, table_name, row_id, old_row, new_row)
    values (auth.uid(), lower(tg_op), tg_table_name, coalesce(j ->> 'id', j ->> 'user_id', j ->> 'key'),
            case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['driver_profiles', 'vehicles', 'driver_documents', 'vehicle_makes', 'vehicle_models', 'vehicle_variants',
                           'vehicle_images', 'sos_incidents', 'site_settings', 'partners', 'cab_rides', 'cab_bookings', 'profiles'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
end $$;

-- ───────────────────────── Housekeeping job ─────────────────────────
create or replace function private.cab_housekeeping()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.expire_cab_holds();
  -- Location points are kept only for a day after a ride ends.
  delete from public.cab_live_positions p using public.cab_rides r
   where r.id = p.ride_id and r.status in ('completed', 'cancelled') and p.recorded_at < now() - interval '1 day';
end $$;

create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'thh-cab-housekeeping') then
    perform cron.unschedule('thh-cab-housekeeping');
  end if;
  perform cron.schedule('thh-cab-housekeeping', '* * * * *', 'select private.cab_housekeeping()');
end $$;

-- ───────────────────────── Permissions ─────────────────────────
revoke execute on function private.next_counter(text), private.cab_rule(text, numeric), private.expire_cab_holds(),
  private.cab_housekeeping(), private.ride_segments(public.cab_rides), private.audit_row(),
  private.set_ride_ref(), private.cab_booking_rules(), private.check_vehicle_variant()
  from public, anon, authenticated;
-- cab_role is used inside a row policy, so signed-in users need it (it only answers about the caller's own rides).
revoke execute on function private.cab_role(uuid, uuid) from public, anon;
grant execute on function private.cab_role(uuid, uuid) to authenticated;

revoke execute on function public.match_cab_rides(float8, float8, float8, float8, date, integer, time),
  public.driver_reliability(uuid), public.get_live_share(text),
  public.start_cab_ride(uuid), public.complete_cab_ride(uuid),
  public.submit_cab_feedback(uuid, integer, jsonb, text), public.my_pending_feedback(),
  public.raise_sos(uuid, float8, float8, float8, text), public.cancel_sos(uuid, text), public.admin_update_sos(uuid, text, text),
  public.start_live_share(uuid), public.stop_live_share(uuid), public.post_live_position(uuid, float8, float8, float8)
  from public, anon;
grant execute on function public.match_cab_rides(float8, float8, float8, float8, date, integer, time),
  public.driver_reliability(uuid), public.get_live_share(text) to anon, authenticated;
grant execute on function public.start_cab_ride(uuid), public.complete_cab_ride(uuid),
  public.submit_cab_feedback(uuid, integer, jsonb, text), public.my_pending_feedback(),
  public.raise_sos(uuid, float8, float8, float8, text), public.cancel_sos(uuid, text), public.admin_update_sos(uuid, text, text),
  public.start_live_share(uuid), public.stop_live_share(uuid), public.post_live_position(uuid, float8, float8, float8)
  to authenticated;
