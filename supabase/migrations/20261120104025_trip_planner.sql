-- Trip Planner (phase 5). Additive only: new columns on trips, four new tables,
-- share-link and analytics functions. No existing data is changed or removed.

-- 1. trips: more detail about each plan --------------------------------------
alter table public.trips
  add column if not exists status            text not null default 'planning'
    check (status in ('draft','planning','ready','upcoming','ongoing','completed','cancelled')),
  add column if not exists end_date          date,
  add column if not exists adults            integer not null default 2 check (adults between 1 and 50),
  add column if not exists children          integer not null default 0 check (children between 0 and 50),
  add column if not exists pace              text not null default 'balanced' check (pace in ('relaxed','balanced','adventure')),
  add column if not exists travel_mode       text not null default 'car' check (travel_mode in ('car','bike','taxi','bus','train','shared')),
  add column if not exists preferences       text[] not null default '{}' check (cardinality(preferences) <= 20),
  add column if not exists round_trip        boolean not null default true,
  add column if not exists start_place       jsonb check (start_place is null or jsonb_typeof(start_place) = 'object'),
  add column if not exists route             jsonb check (route is null or jsonb_typeof(route) = 'object'),
  add column if not exists assumptions       jsonb not null default '{}'::jsonb check (jsonb_typeof(assumptions) = 'object'),
  add column if not exists share_token       text unique check (share_token is null or char_length(share_token) between 16 and 64),
  add column if not exists client_request_id uuid unique;

alter table public.trips drop constraint if exists trips_dates_check;
alter table public.trips add constraint trips_dates_check check (end_date is null or start_date is null or end_date >= start_date);
-- Keep plans to a sensible size (route lines included).
alter table public.trips drop constraint if exists trips_size_check;
alter table public.trips add constraint trips_size_check check (pg_column_size(route) is null or pg_column_size(route) < 400000);

-- 2. Destinations of a trip, in order ----------------------------------------
create table if not exists public.trip_destinations (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  position    integer not null check (position between 0 and 20),
  place       jsonb not null check (jsonb_typeof(place) = 'object'),
  place_id    uuid references public.places(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (trip_id, position)
);
create index if not exists trip_destinations_location_idx on public.trip_destinations (location_id);
create index if not exists trip_destinations_place_idx on public.trip_destinations (place_id);

-- 3. Costs: estimate vs actual per category -----------------------------------
create table if not exists public.trip_expenses (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  category   text not null check (category in ('transport','fuel','stay','food','activities','permits','local','tolls','other','reserve')),
  label      text not null default '' check (char_length(label) <= 120),
  estimated  integer check (estimated is null or estimated between 0 and 100000000),
  actual     integer check (actual is null or actual between 0 and 100000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, category)
);
create trigger trip_expenses_updated before update on public.trip_expenses for each row execute function private.set_updated_at();

-- 4. Saved destinations ---------------------------------------------------------
create table if not exists public.saved_destinations (
  user_id     uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, location_id)
);
create index if not exists saved_destinations_location_idx on public.saved_destinations (location_id);

-- 5. Destination reviews (shown only after admin approval) ---------------------
create table if not exists public.destination_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  body        text not null default '' check (char_length(body) <= 2000),
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, location_id)
);
create index if not exists destination_reviews_location_idx on public.destination_reviews (location_id, status);
create trigger destination_reviews_updated before update on public.destination_reviews for each row execute function private.set_updated_at();

-- Reviewers cannot approve their own review; only admins change status.
create or replace function private.guard_review()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not private.is_admin() then
    if tg_op = 'INSERT' then new.status := 'pending';
    elsif new.status is distinct from old.status then new.status := 'pending';
    end if;
    if tg_op = 'UPDATE' and (new.body is distinct from old.body or new.rating is distinct from old.rating) then new.status := 'pending'; end if;
  end if;
  return new;
end $$;
create trigger destination_reviews_guard before insert or update on public.destination_reviews for each row execute function private.guard_review();

-- Share tokens are only made by the function below, never typed in by the client.
create or replace function private.guard_trip()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('app.trip_share', true), '') <> '1' then
    if tg_op = 'INSERT' then new.share_token := null;
    elsif new.share_token is distinct from old.share_token then new.share_token := old.share_token;
    end if;
  end if;
  if tg_op = 'UPDATE' then new.user_id := old.user_id; end if;
  return new;
end $$;
drop trigger if exists trips_guard on public.trips;
create trigger trips_guard before insert or update on public.trips for each row execute function private.guard_trip();

-- 6. Row Level Security ----------------------------------------------------------
alter table public.trip_destinations   enable row level security;
alter table public.trip_expenses       enable row level security;
alter table public.saved_destinations  enable row level security;
alter table public.destination_reviews enable row level security;

create or replace function private.owns_trip(p_trip uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trips where id = p_trip and user_id = auth.uid());
$$;

create policy "trip_destinations: read"   on public.trip_destinations for select to authenticated using (private.owns_trip(trip_id) or private.is_admin());
create policy "trip_destinations: insert" on public.trip_destinations for insert to authenticated with check (private.owns_trip(trip_id));
create policy "trip_destinations: update" on public.trip_destinations for update to authenticated using (private.owns_trip(trip_id)) with check (private.owns_trip(trip_id));
create policy "trip_destinations: delete" on public.trip_destinations for delete to authenticated using (private.owns_trip(trip_id));

create policy "trip_expenses: read"   on public.trip_expenses for select to authenticated using (private.owns_trip(trip_id) or private.is_admin());
create policy "trip_expenses: insert" on public.trip_expenses for insert to authenticated with check (private.owns_trip(trip_id));
create policy "trip_expenses: update" on public.trip_expenses for update to authenticated using (private.owns_trip(trip_id)) with check (private.owns_trip(trip_id));
create policy "trip_expenses: delete" on public.trip_expenses for delete to authenticated using (private.owns_trip(trip_id));

create policy "saved_destinations: read"   on public.saved_destinations for select to authenticated using (user_id = (select auth.uid()));
create policy "saved_destinations: insert" on public.saved_destinations for insert to authenticated with check (user_id = (select auth.uid()));
create policy "saved_destinations: delete" on public.saved_destinations for delete to authenticated using (user_id = (select auth.uid()));

create policy "destination_reviews: read"   on public.destination_reviews for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()) or private.is_admin());
create policy "destination_reviews: insert" on public.destination_reviews for insert to authenticated with check (user_id = (select auth.uid()));
create policy "destination_reviews: update" on public.destination_reviews for update to authenticated
  using (user_id = (select auth.uid()) or private.is_admin()) with check (user_id = (select auth.uid()) or private.is_admin());
create policy "destination_reviews: delete" on public.destination_reviews for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());

-- 7. Share link -------------------------------------------------------------------
-- Owner turns sharing on (returns the token) or off (returns null).
create or replace function public.set_trip_share(p_trip uuid, p_on boolean default true)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if not exists (select 1 from public.trips where id = p_trip and user_id = auth.uid()) then
    raise exception 'Trip not found' using errcode = '42501';
  end if;
  perform set_config('app.trip_share', '1', true);
  if p_on then
    select share_token into v_token from public.trips where id = p_trip;
    if v_token is null then
      v_token := replace(replace(rtrim(encode(extensions.gen_random_bytes(18), 'base64'), '='), '+', '-'), '/', '_');
      update public.trips set share_token = v_token where id = p_trip;
    end if;
  else
    update public.trips set share_token = null where id = p_trip;
    v_token := null;
  end if;
  perform set_config('app.trip_share', '', true);
  return v_token;
end $$;

-- Anyone with the link can read that one trip (no owner id, no notes).
create or replace function public.get_shared_trip(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'title', t.title, 'start_date', t.start_date, 'end_date', t.end_date, 'days_count', t.days_count,
    'travellers', t.travellers, 'adults', t.adults, 'children', t.children, 'budget', t.budget, 'pace', t.pace,
    'travel_mode', t.travel_mode, 'preferences', t.preferences, 'round_trip', t.round_trip, 'start_place', t.start_place,
    'route', t.route, 'assumptions', t.assumptions, 'days', t.days, 'status', t.status,
    'destinations', coalesce((select jsonb_agg(jsonb_build_object('position', d.position, 'place', d.place) order by d.position)
                              from public.trip_destinations d where d.trip_id = t.id), '[]'::jsonb))
  from public.trips t
  where p_token is not null and char_length(p_token) between 16 and 64 and t.share_token = p_token and t.status <> 'cancelled';
$$;

-- 8. Admin analytics (real data only) ---------------------------------------------
create or replace function public.admin_trip_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not private.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total_trips', (select count(*) from public.trips),
    'trips_last_30_days', (select count(*) from public.trips where created_at >= now() - interval '30 days'),
    'avg_days', (select round(avg(days_count)::numeric, 1) from public.trips),
    'avg_budget', (select round(avg(budget)) from public.trips where budget is not null),
    'avg_travellers', (select round(avg(travellers)::numeric, 1) from public.trips),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.trips group by status) s), '{}'::jsonb),
    'by_mode', coalesce((select jsonb_object_agg(travel_mode, n) from (select travel_mode, count(*) n from public.trips group by travel_mode) s), '{}'::jsonb),
    'by_pace', coalesce((select jsonb_object_agg(pace, n) from (select pace, count(*) n from public.trips group by pace) s), '{}'::jsonb),
    'top_destinations', coalesce((select jsonb_agg(x order by (x->>'n')::int desc) from (
        select jsonb_build_object('name', coalesce(d.place->>'name', '?'), 'n', count(*)) x
        from public.trip_destinations d group by d.place->>'name' order by count(*) desc limit 10) s), '[]'::jsonb),
    'top_preferences', coalesce((select jsonb_agg(jsonb_build_object('pref', p, 'n', n) order by n desc) from (
        select unnest(preferences) p, count(*) n from public.trips group by 1 order by 2 desc limit 12) s), '[]'::jsonb),
    'by_start_month', coalesce((select jsonb_agg(jsonb_build_object('month', m, 'n', n) order by m) from (
        select extract(month from start_date)::int m, count(*) n from public.trips where start_date is not null group by 1) s), '[]'::jsonb),
    'created_by_month', coalesce((select jsonb_agg(jsonb_build_object('month', m, 'n', n) order by m) from (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') m, count(*) n from public.trips
        where created_at >= date_trunc('month', now()) - interval '11 months' group by 1) s), '[]'::jsonb),
    'pending_reviews', (select count(*) from public.destination_reviews where status = 'pending'),
    'saved_destinations', (select count(*) from public.saved_destinations)
  ) into v;
  return v;
end $$;

revoke all on function public.set_trip_share(uuid, boolean) from public, anon;
grant execute on function public.set_trip_share(uuid, boolean) to authenticated;
revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;
revoke all on function public.admin_trip_stats() from public, anon;
grant execute on function public.admin_trip_stats() to authenticated;
revoke all on function private.owns_trip(uuid) from public, anon;
grant execute on function private.owns_trip(uuid) to authenticated;
