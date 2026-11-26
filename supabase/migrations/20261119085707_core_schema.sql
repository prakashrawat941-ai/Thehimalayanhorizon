-- =====================================================================
-- The Himalayan Horizon — core schema
-- Trip planner + village tourism + homestays + work-from-mountain
-- + instant cab (seat sharing) for Uttarakhand.
--
-- Roles:  traveler (default)  ·  partner (approved vendor)  ·  admin
-- Every table has Row Level Security; the rules are written below each
-- table so they can be read in one place.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Profiles (one row per signed-up user)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  phone       text check (phone is null or char_length(phone) <= 20),
  role        text not null default 'traveler' check (role in ('traveler','partner','admin')),
  lang        text not null default 'hi' check (lang in ('hi','en')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- New sign-up -> profile row. Emails listed in admin_emails become admin.
create table public.admin_emails (
  email text primary key check (email = lower(email))
);
alter table public.admin_emails enable row level security;
create policy "admin_emails: admins only" on public.admin_emails
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
    left(new.raw_user_meta_data->>'phone', 20),
    case when exists (select 1 from public.admin_emails a where a.email = lower(new.email))
         then 'admin' else 'traveler' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change a role (server-side SQL, where auth.uid() is null, is allowed).
create or replace function public.guard_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "profiles: update own or admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());
create policy "profiles: admin delete" on public.profiles
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- Site content the admin controls (home page, settings, themes, locations)
-- ---------------------------------------------------------------------
create table public.site_settings (
  key        text primary key check (char_length(key) <= 60),
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.home_sections (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in
                ('hero','themes','destinations','itineraries','villages','stays',
                 'workspaces','cabs','partner_cta','text')),
  position    integer not null default 0,
  enabled     boolean not null default true,
  title       text not null default '' check (char_length(title) <= 200),
  title_hi    text not null default '' check (char_length(title_hi) <= 200),
  subtitle    text not null default '' check (char_length(subtitle) <= 600),
  subtitle_hi text not null default '' check (char_length(subtitle_hi) <= 600),
  image_url   text check (image_url is null or image_url ~ '^(https://|\./|/)'),
  cta_label   text not null default '' check (char_length(cta_label) <= 60),
  cta_url     text not null default '' check (char_length(cta_url) <= 300),
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table public.themes (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (char_length(name) between 2 and 80),
  name_hi     text not null default '' check (char_length(name_hi) <= 80),
  summary     text not null default '' check (char_length(summary) <= 400),
  summary_hi  text not null default '' check (char_length(summary_hi) <= 400),
  icon        text not null default '⛰️' check (char_length(icon) <= 8),
  color       text not null default '#2f6b4f' check (color ~ '^#[0-9a-fA-F]{6}$'),
  image_url   text check (image_url is null or image_url ~ '^(https://|\./|/)'),
  position    integer not null default 0,
  is_published boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Locations: tourist destinations, villages, towns and cab pickup/drop points.
create table public.locations (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null check (char_length(name) between 2 and 120),
  name_hi      text not null default '' check (char_length(name_hi) <= 120),
  kind         text not null default 'destination'
                 check (kind in ('destination','village','town','transport_hub')),
  region       text not null check (region in ('Garhwal','Kumaon')),
  district     text not null default '' check (char_length(district) <= 60),
  summary      text not null default '' check (char_length(summary) <= 500),
  summary_hi   text not null default '' check (char_length(summary_hi) <= 500),
  description  text not null default '' check (char_length(description) <= 8000),
  best_season  text not null default '' check (char_length(best_season) <= 200),
  how_to_reach text not null default '' check (char_length(how_to_reach) <= 2000),
  image_url    text check (image_url is null or image_url ~ '^(https://|\./|/)'),
  gallery      text[] not null default '{}' check (cardinality(gallery) <= 20),
  lat          double precision check (lat is null or lat between 28 and 32),
  lng          double precision check (lng is null or lng between 77 and 82),
  theme_slugs  text[] not null default '{}' check (cardinality(theme_slugs) <= 12),
  is_cab_point boolean not null default false,
  is_featured  boolean not null default false,
  is_published boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index locations_published_idx on public.locations (is_published, kind);

-- Curated itineraries (admin-written), copied by travellers into their own trips.
create table public.itineraries (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null check (char_length(title) between 3 and 160),
  title_hi      text not null default '' check (char_length(title_hi) <= 160),
  summary       text not null default '' check (char_length(summary) <= 600),
  summary_hi    text not null default '' check (char_length(summary_hi) <= 600),
  region        text not null check (region in ('Garhwal','Kumaon','Both')),
  days_count    integer not null check (days_count between 1 and 30),
  difficulty    text not null default 'easy' check (difficulty in ('easy','moderate','challenging')),
  budget_min    integer not null default 0 check (budget_min >= 0),
  budget_max    integer not null default 0 check (budget_max >= 0),
  best_season   text not null default '' check (char_length(best_season) <= 200),
  theme_slugs   text[] not null default '{}' check (cardinality(theme_slugs) <= 12),
  location_ids  uuid[] not null default '{}' check (cardinality(location_ids) <= 30),
  days          jsonb not null default '[]'::jsonb check (jsonb_typeof(days) = 'array'),
  image_url     text check (image_url is null or image_url ~ '^(https://|\./|/)'),
  is_featured   boolean not null default false,
  is_published  boolean not null default false,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger site_settings_updated before update on public.site_settings for each row execute function public.set_updated_at();
create trigger home_sections_updated before update on public.home_sections for each row execute function public.set_updated_at();
create trigger themes_updated        before update on public.themes        for each row execute function public.set_updated_at();
create trigger locations_updated     before update on public.locations     for each row execute function public.set_updated_at();
create trigger itineraries_updated   before update on public.itineraries   for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;
alter table public.home_sections enable row level security;
alter table public.themes        enable row level security;
alter table public.locations     enable row level security;
alter table public.itineraries   enable row level security;

create policy "site_settings: public read" on public.site_settings for select to anon, authenticated using (true);
create policy "site_settings: admin write" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "home_sections: public read enabled" on public.home_sections for select to anon, authenticated using (enabled or public.is_admin());
create policy "home_sections: admin write" on public.home_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "themes: public read published" on public.themes for select to anon, authenticated using (is_published or public.is_admin());
create policy "themes: admin write" on public.themes for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "locations: public read published" on public.locations for select to anon, authenticated using (is_published or public.is_admin());
create policy "locations: admin write" on public.locations for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "itineraries: public read published" on public.itineraries for select to anon, authenticated using (is_published or public.is_admin());
create policy "itineraries: admin write" on public.itineraries for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Partners (vendors): homestay owners, cab drivers, workspace owners,
-- village tour hosts. They register themselves, or the admin adds them.
-- ---------------------------------------------------------------------
create table public.partners (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references public.profiles(id) on delete set null,
  business_name text not null check (char_length(business_name) between 2 and 120),
  contact_name  text not null check (char_length(contact_name) between 2 and 120),
  phone         text not null check (char_length(phone) between 7 and 20),
  whatsapp      text check (whatsapp is null or char_length(whatsapp) <= 20),
  email         text check (email is null or (char_length(email) <= 254 and email like '%_@_%')),
  categories    text[] not null check (
                  cardinality(categories) between 1 and 4
                  and categories <@ array['homestay','cab','workspace','village_tour']),
  village       text not null default '' check (char_length(village) <= 120),
  location_id   uuid references public.locations(id) on delete set null,
  address       text not null default '' check (char_length(address) <= 400),
  about         text not null default '' check (char_length(about) <= 2000),
  status        text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  admin_note    text not null default '' check (char_length(admin_note) <= 1000),
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index partners_owner_idx on public.partners (owner_id);
create index partners_location_idx on public.partners (location_id);
create index partners_created_by_idx on public.partners (created_by);
create index partners_status_idx on public.partners (status);

create or replace function public.owns_partner(p_partner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.partners where id = p_partner and owner_id = auth.uid());
$$;

create or replace function public.partner_can(p_partner uuid, p_category text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.partners
    where id = p_partner and owner_id = auth.uid()
      and status = 'approved' and p_category = any (categories)
  );
$$;

-- Non-admins can only register themselves as 'pending'; status and notes are admin-only.
create or replace function public.guard_partner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.owner_id   := auth.uid();
    new.created_by := auth.uid();
    new.status     := 'pending';
    new.admin_note := '';
  else
    new.owner_id   := old.owner_id;
    new.created_by := old.created_by;
    new.status     := old.status;
    new.admin_note := old.admin_note;
  end if;
  return new;
end $$;

-- When the admin approves a partner, the owner's account becomes a partner account.
create or replace function public.on_partner_approved()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' and new.owner_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    update public.profiles set role = 'partner' where id = new.owner_id and role = 'traveler';
  end if;
  return new;
end $$;

create trigger partners_guard    before insert or update on public.partners for each row execute function public.guard_partner();
create trigger partners_updated  before update on public.partners for each row execute function public.set_updated_at();
create trigger partners_approved after insert or update of status on public.partners for each row execute function public.on_partner_approved();

alter table public.partners enable row level security;
create policy "partners: owner or admin read" on public.partners for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());
create policy "partners: register self" on public.partners for insert to authenticated
  with check (public.is_admin() or owner_id = (select auth.uid()) or owner_id is null);
create policy "partners: owner or admin update" on public.partners for update to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());
create policy "partners: admin delete" on public.partners for delete to authenticated using (public.is_admin());

-- Public card of an approved partner (name + village only, no phone).
create or replace view public.partner_public with (security_invoker = false) as
  select id, business_name, village, location_id, categories
  from public.partners where status = 'approved';
grant select on public.partner_public to anon, authenticated;

-- ---------------------------------------------------------------------
-- Listings: homestays, workspaces, village tours.
-- A partner's new or edited listing waits for admin approval.
-- ---------------------------------------------------------------------
create or replace function public.guard_listing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status      := case when new.status = 'draft' then 'draft' else 'pending' end;
    new.is_featured := false;
    new.admin_note  := '';
  else
    new.partner_id  := old.partner_id;
    new.is_featured := old.is_featured;
    new.admin_note  := old.admin_note;
    if new.status not in ('draft','pending','hidden') then
      new.status := 'pending';     -- any edit by a partner goes back for approval
    end if;
  end if;
  return new;
end $$;

create table public.homestays (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partners(id) on delete cascade,
  location_id    uuid references public.locations(id) on delete set null,
  name           text not null check (char_length(name) between 2 and 120),
  village        text not null default '' check (char_length(village) <= 120),
  summary        text not null default '' check (char_length(summary) <= 400),
  description    text not null default '' check (char_length(description) <= 6000),
  rooms          integer not null default 1 check (rooms between 1 and 100),
  max_guests     integer not null default 2 check (max_guests between 1 and 200),
  price_per_night integer not null default 0 check (price_per_night between 0 and 1000000),
  meals          text not null default '' check (char_length(meals) <= 300),
  amenities      text[] not null default '{}' check (cardinality(amenities) <= 40),
  house_rules    text not null default '' check (char_length(house_rules) <= 2000),
  images         text[] not null default '{}' check (cardinality(images) <= 20),
  status         text not null default 'pending' check (status in ('draft','pending','approved','rejected','hidden')),
  is_featured    boolean not null default false,
  admin_note     text not null default '' check (char_length(admin_note) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.workspaces (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partners(id) on delete cascade,
  location_id    uuid references public.locations(id) on delete set null,
  name           text not null check (char_length(name) between 2 and 120),
  village        text not null default '' check (char_length(village) <= 120),
  summary        text not null default '' check (char_length(summary) <= 400),
  description    text not null default '' check (char_length(description) <= 6000),
  desks          integer not null default 1 check (desks between 1 and 500),
  wifi_mbps      integer check (wifi_mbps is null or wifi_mbps between 1 and 10000),
  power_backup   boolean not null default false,
  stay_available boolean not null default false,
  price_per_day  integer not null default 0 check (price_per_day between 0 and 1000000),
  price_per_month integer check (price_per_month is null or price_per_month between 0 and 10000000),
  amenities      text[] not null default '{}' check (cardinality(amenities) <= 40),
  images         text[] not null default '{}' check (cardinality(images) <= 20),
  status         text not null default 'pending' check (status in ('draft','pending','approved','rejected','hidden')),
  is_featured    boolean not null default false,
  admin_note     text not null default '' check (char_length(admin_note) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.village_tours (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partners(id) on delete cascade,
  location_id    uuid references public.locations(id) on delete set null,
  title          text not null check (char_length(title) between 3 and 160),
  village        text not null default '' check (char_length(village) <= 120),
  summary        text not null default '' check (char_length(summary) <= 400),
  description    text not null default '' check (char_length(description) <= 6000),
  culture_highlights text[] not null default '{}' check (cardinality(culture_highlights) <= 20),
  includes       text[] not null default '{}' check (cardinality(includes) <= 20),
  duration_hours numeric(5,1) not null default 3 check (duration_hours > 0 and duration_hours <= 240),
  price_per_person integer not null default 0 check (price_per_person between 0 and 1000000),
  max_group      integer not null default 10 check (max_group between 1 and 200),
  languages      text[] not null default '{Hindi,Garhwali}' check (cardinality(languages) <= 8),
  best_season    text not null default '' check (char_length(best_season) <= 200),
  images         text[] not null default '{}' check (cardinality(images) <= 20),
  status         text not null default 'pending' check (status in ('draft','pending','approved','rejected','hidden')),
  is_featured    boolean not null default false,
  admin_note     text not null default '' check (char_length(admin_note) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index homestays_partner_idx      on public.homestays (partner_id);
create index homestays_location_idx     on public.homestays (location_id);
create index workspaces_partner_idx     on public.workspaces (partner_id);
create index workspaces_location_idx    on public.workspaces (location_id);
create index village_tours_partner_idx  on public.village_tours (partner_id);
create index village_tours_location_idx on public.village_tours (location_id);

create trigger homestays_guard     before insert or update on public.homestays     for each row execute function public.guard_listing();
create trigger workspaces_guard    before insert or update on public.workspaces    for each row execute function public.guard_listing();
create trigger village_tours_guard before insert or update on public.village_tours for each row execute function public.guard_listing();
create trigger homestays_updated     before update on public.homestays     for each row execute function public.set_updated_at();
create trigger workspaces_updated    before update on public.workspaces    for each row execute function public.set_updated_at();
create trigger village_tours_updated before update on public.village_tours for each row execute function public.set_updated_at();

alter table public.homestays     enable row level security;
alter table public.workspaces    enable row level security;
alter table public.village_tours enable row level security;

-- Same rules for all three listing tables.
create policy "homestays: public read approved" on public.homestays for select to anon, authenticated
  using (status = 'approved' or public.owns_partner(partner_id) or public.is_admin());
create policy "homestays: partner insert" on public.homestays for insert to authenticated
  with check (public.partner_can(partner_id, 'homestay') or public.is_admin());
create policy "homestays: partner update" on public.homestays for update to authenticated
  using (public.owns_partner(partner_id) or public.is_admin())
  with check (public.owns_partner(partner_id) or public.is_admin());
create policy "homestays: delete" on public.homestays for delete to authenticated
  using (public.owns_partner(partner_id) or public.is_admin());

create policy "workspaces: public read approved" on public.workspaces for select to anon, authenticated
  using (status = 'approved' or public.owns_partner(partner_id) or public.is_admin());
create policy "workspaces: partner insert" on public.workspaces for insert to authenticated
  with check (public.partner_can(partner_id, 'workspace') or public.is_admin());
create policy "workspaces: partner update" on public.workspaces for update to authenticated
  using (public.owns_partner(partner_id) or public.is_admin())
  with check (public.owns_partner(partner_id) or public.is_admin());
create policy "workspaces: delete" on public.workspaces for delete to authenticated
  using (public.owns_partner(partner_id) or public.is_admin());

create policy "village_tours: public read approved" on public.village_tours for select to anon, authenticated
  using (status = 'approved' or public.owns_partner(partner_id) or public.is_admin());
create policy "village_tours: partner insert" on public.village_tours for insert to authenticated
  with check (public.partner_can(partner_id, 'village_tour') or public.is_admin());
create policy "village_tours: partner update" on public.village_tours for update to authenticated
  using (public.owns_partner(partner_id) or public.is_admin())
  with check (public.owns_partner(partner_id) or public.is_admin());
create policy "village_tours: delete" on public.village_tours for delete to authenticated
  using (public.owns_partner(partner_id) or public.is_admin());

-- ---------------------------------------------------------------------
-- Notifications (in-app inbox)
-- ---------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null check (char_length(title) <= 160),
  body       text not null default '' check (char_length(body) <= 600),
  link       text not null default '' check (char_length(link) <= 300),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "notifications: own read" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: own mark read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: own delete" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.notify(p_user uuid, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, title, body, link)
  select p_user, left(p_title, 160), left(coalesce(p_body, ''), 600), left(coalesce(p_link, ''), 300)
  where p_user is not null;
$$;
revoke execute on function public.notify(uuid, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Booking requests (homestay / village tour / workspace). No payment yet:
-- the traveller sends a request, the partner confirms or declines,
-- the admin can see and change everything.
-- ---------------------------------------------------------------------
create table public.booking_requests (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('homestay','village_tour','workspace')),
  homestay_id     uuid references public.homestays(id) on delete cascade,
  village_tour_id uuid references public.village_tours(id) on delete cascade,
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  partner_id      uuid references public.partners(id) on delete set null,
  user_id         uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  guest_name      text not null check (char_length(guest_name) between 2 and 120),
  guest_phone     text not null check (char_length(guest_phone) between 7 and 20),
  start_date      date not null,
  end_date        date not null,
  guests          integer not null default 1 check (guests between 1 and 50),
  message         text not null default '' check (char_length(message) <= 1000),
  status          text not null default 'requested'
                    check (status in ('requested','confirmed','declined','cancelled','completed')),
  partner_note    text not null default '' check (char_length(partner_note) <= 1000),
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_date >= start_date),
  check (
    (kind = 'homestay'     and homestay_id is not null and village_tour_id is null and workspace_id is null) or
    (kind = 'village_tour' and village_tour_id is not null and homestay_id is null and workspace_id is null) or
    (kind = 'workspace'    and workspace_id is not null and homestay_id is null and village_tour_id is null)
  )
);
create index booking_requests_user_idx     on public.booking_requests (user_id, created_at desc);
create index booking_requests_partner_idx  on public.booking_requests (partner_id, created_at desc);
create index booking_requests_homestay_idx on public.booking_requests (homestay_id);
create index booking_requests_tour_idx     on public.booking_requests (village_tour_id);
create index booking_requests_ws_idx       on public.booking_requests (workspace_id);

create or replace function public.prepare_booking_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_partner uuid;
  v_status  text;
  v_owner   uuid;
  v_name    text;
begin
  if new.kind = 'homestay' then
    select partner_id, status, name into v_partner, v_status, v_name from public.homestays where id = new.homestay_id;
  elsif new.kind = 'village_tour' then
    select partner_id, status, title into v_partner, v_status, v_name from public.village_tours where id = new.village_tour_id;
  else
    select partner_id, status, name into v_partner, v_status, v_name from public.workspaces where id = new.workspace_id;
  end if;

  if v_partner is null or v_status <> 'approved' then
    raise exception 'This listing is not open for requests';
  end if;
  if not public.is_admin() and new.start_date < current_date then
    raise exception 'Dates must be today or later';
  end if;

  new.partner_id   := v_partner;
  new.status       := 'requested';
  new.partner_note := '';
  new.decided_at   := null;
  if not public.is_admin() then
    new.user_id := auth.uid();
  end if;

  select owner_id into v_owner from public.partners where id = v_partner;
  perform public.notify(v_owner, 'New booking request',
    new.guest_name || ' · ' || v_name || ' · ' || to_char(new.start_date, 'DD Mon YYYY'),
    '#/partner/requests');
  return new;
end $$;

create trigger booking_requests_prepare before insert on public.booking_requests
  for each row execute function public.prepare_booking_request();
create trigger booking_requests_updated before update on public.booking_requests
  for each row execute function public.set_updated_at();

alter table public.booking_requests enable row level security;
create policy "booking_requests: read own / partner / admin" on public.booking_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.owns_partner(partner_id) or public.is_admin());
create policy "booking_requests: traveller creates" on public.booking_requests for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_admin());
-- Status changes only through set_booking_status() below (no direct UPDATE policy).
create policy "booking_requests: admin delete" on public.booking_requests for delete to authenticated
  using (public.is_admin());

create or replace function public.set_booking_status(p_id uuid, p_status text, p_note text default '')
returns public.booking_requests
language plpgsql security definer set search_path = '' as $$
declare
  r public.booking_requests;
  v_is_partner boolean;
begin
  select * into r from public.booking_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;

  v_is_partner := public.owns_partner(r.partner_id);

  if public.is_admin() then
    null; -- admin may set any status
  elsif v_is_partner and p_status in ('confirmed','declined','completed') and r.status in ('requested','confirmed') then
    null;
  elsif r.user_id = auth.uid() and p_status = 'cancelled' and r.status in ('requested','confirmed') then
    null;
  else
    raise exception 'You cannot change this request to %', p_status;
  end if;

  update public.booking_requests
     set status = p_status,
         partner_note = case when v_is_partner or public.is_admin() then left(coalesce(p_note, ''), 1000) else partner_note end,
         decided_at = now()
   where id = p_id
   returning * into r;

  if auth.uid() is distinct from r.user_id then
    perform public.notify(r.user_id, 'Booking ' || p_status, coalesce(nullif(p_note, ''), 'Your request was updated.'), '#/account');
  end if;
  return r;
end $$;
revoke execute on function public.set_booking_status(uuid, text, text) from public, anon;
grant execute on function public.set_booking_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Instant cab: approved cab partners publish a ride on a route
-- (from -> to, date/time, vehicle model, seats). Travellers book seats.
-- ---------------------------------------------------------------------
create table public.cab_rides (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid not null references public.partners(id) on delete cascade,
  from_location_id uuid not null references public.locations(id),
  to_location_id   uuid not null references public.locations(id),
  pickup_point     text not null default '' check (char_length(pickup_point) <= 200),
  drop_point       text not null default '' check (char_length(drop_point) <= 200),
  departure_at     timestamptz not null,
  vehicle_model    text not null check (char_length(vehicle_model) between 2 and 80),
  vehicle_type     text not null default 'suv' check (vehicle_type in ('hatchback','sedan','suv','tempo_traveller','other')),
  seats_total      integer not null check (seats_total between 1 and 20),
  seats_booked     integer not null default 0 check (seats_booked >= 0),
  price_per_seat   integer not null check (price_per_seat between 0 and 100000),
  auto_confirm     boolean not null default true,
  notes            text not null default '' check (char_length(notes) <= 500),
  status           text not null default 'open' check (status in ('open','full','cancelled','completed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (from_location_id <> to_location_id),
  check (seats_booked <= seats_total)
);
create index cab_rides_route_idx   on public.cab_rides (from_location_id, to_location_id, departure_at);
create index cab_rides_to_idx      on public.cab_rides (to_location_id);
create index cab_rides_partner_idx on public.cab_rides (partner_id);

-- Drivers cannot touch seats_booked directly; it is kept by the booking functions.
create or replace function public.guard_cab_ride()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() then
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

create trigger cab_rides_guard   before insert or update on public.cab_rides for each row execute function public.guard_cab_ride();
create trigger cab_rides_updated before update on public.cab_rides for each row execute function public.set_updated_at();

alter table public.cab_rides enable row level security;
create policy "cab_rides: public read" on public.cab_rides for select to anon, authenticated
  using (true);
create policy "cab_rides: cab partner insert" on public.cab_rides for insert to authenticated
  with check (public.partner_can(partner_id, 'cab') or public.is_admin());
create policy "cab_rides: cab partner update" on public.cab_rides for update to authenticated
  using (public.owns_partner(partner_id) or public.is_admin())
  with check (public.owns_partner(partner_id) or public.is_admin());
create policy "cab_rides: admin delete" on public.cab_rides for delete to authenticated
  using (public.is_admin());

create table public.cab_bookings (
  id             uuid primary key default gen_random_uuid(),
  ride_id        uuid not null references public.cab_rides(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  seats          integer not null check (seats between 1 and 20),
  passenger_name text not null check (char_length(passenger_name) between 2 and 120),
  phone          text not null check (char_length(phone) between 7 and 20),
  note           text not null default '' check (char_length(note) <= 300),
  status         text not null check (status in ('pending','confirmed','declined','cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index cab_bookings_ride_idx on public.cab_bookings (ride_id);
create index cab_bookings_user_idx on public.cab_bookings (user_id, created_at desc);
create trigger cab_bookings_updated before update on public.cab_bookings for each row execute function public.set_updated_at();

alter table public.cab_bookings enable row level security;
create policy "cab_bookings: read own / driver / admin" on public.cab_bookings for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin()
    or exists (select 1 from public.cab_rides r where r.id = ride_id and public.owns_partner(r.partner_id))
  );
-- Inserts and status changes only through the functions below.

-- Book seats atomically (row lock prevents two people taking the last seat).
create or replace function public.book_cab_seats(p_ride uuid, p_seats integer, p_name text, p_phone text, p_note text default '')
returns public.cab_bookings
language plpgsql security definer set search_path = '' as $$
declare
  ride  public.cab_rides;
  b     public.cab_bookings;
  v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in to book'; end if;
  if p_seats is null or p_seats < 1 then raise exception 'Choose at least one seat'; end if;

  select * into ride from public.cab_rides where id = p_ride for update;
  if not found then raise exception 'Ride not found'; end if;
  if ride.status <> 'open' or ride.departure_at <= now() then
    raise exception 'This ride is no longer open';
  end if;
  if ride.seats_total - ride.seats_booked < p_seats then
    raise exception 'Only % seat(s) left', ride.seats_total - ride.seats_booked;
  end if;

  insert into public.cab_bookings (ride_id, user_id, seats, passenger_name, phone, note, status)
  values (p_ride, auth.uid(), p_seats, left(p_name, 120), left(p_phone, 20), left(coalesce(p_note, ''), 300),
          case when ride.auto_confirm then 'confirmed' else 'pending' end)
  returning * into b;

  update public.cab_rides
     set seats_booked = seats_booked + p_seats,
         status = case when seats_booked + p_seats >= seats_total then 'full' else status end
   where id = p_ride;

  select owner_id into v_owner from public.partners where id = ride.partner_id;
  perform public.notify(v_owner, 'Seat booking: ' || p_seats || ' seat(s)',
    left(p_name, 60) || ' · ' || to_char(ride.departure_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'),
    '#/partner/rides');
  return b;
end $$;

-- Driver/admin accepts or declines a pending booking; traveller cancels own booking.
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
  select * into ride from public.cab_rides where id = b.ride_id for update;
  v_driver := public.owns_partner(ride.partner_id);

  if public.is_admin() then
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

  -- Seats come back when a held booking is declined or cancelled.
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
    perform public.notify(b.user_id, 'Cab booking ' || p_status, 'Ride on ' ||
      to_char(ride.departure_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'), '#/account');
  end if;
  return b;
end $$;

revoke execute on function public.book_cab_seats(uuid, integer, text, text, text) from public, anon;
revoke execute on function public.set_cab_booking_status(uuid, text) from public, anon;
grant execute on function public.book_cab_seats(uuid, integer, text, text, text) to authenticated;
grant execute on function public.set_cab_booking_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Trips: a traveller's own day-by-day plan (built from scratch or copied
-- from a curated itinerary). Items are stored as JSON for flexibility.
-- ---------------------------------------------------------------------
create table public.trips (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title             text not null check (char_length(title) between 2 and 160),
  start_date        date,
  days_count        integer not null default 3 check (days_count between 1 and 30),
  travellers        integer not null default 2 check (travellers between 1 and 50),
  budget            integer check (budget is null or budget >= 0),
  theme_slugs       text[] not null default '{}' check (cardinality(theme_slugs) <= 12),
  from_itinerary_id uuid references public.itineraries(id) on delete set null,
  days              jsonb not null default '[]'::jsonb check (jsonb_typeof(days) = 'array'),
  notes             text not null default '' check (char_length(notes) <= 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index trips_user_idx on public.trips (user_id, created_at desc);
create index trips_itinerary_idx on public.trips (from_itinerary_id);
create trigger trips_updated before update on public.trips for each row execute function public.set_updated_at();

alter table public.trips enable row level security;
create policy "trips: own read" on public.trips for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "trips: own insert" on public.trips for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "trips: own update" on public.trips for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "trips: own delete" on public.trips for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Photo storage: public bucket; each user uploads into their own folder,
-- admins can manage everything.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "media: upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
create policy "media: update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
create policy "media: delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
