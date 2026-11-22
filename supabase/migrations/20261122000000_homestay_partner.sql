-- Homestay Partner Dashboard + Admin Portal (owner: "DB approved", 22 Nov 2026).
-- Plan: Project doc claude/homestay-partner-plan.md. Additive: nothing removed.
-- Money is recorded only (no online payment): amounts, commission and payouts are an account.

-- ───────── Counters for homestay booking codes (THH-H-DDMMYYYY-NNNN) ─────────
insert into private.id_counters (kind) values ('homestay') on conflict do nothing;

-- ───────── 1. Properties (existing homestays table) ─────────
alter table public.homestays
  add column if not exists district        text not null default '' check (char_length(district) <= 80),
  add column if not exists state           text not null default 'Uttarakhand' check (char_length(state) <= 80),
  add column if not exists commission_rate numeric(5,2) not null default 12 check (commission_rate between 0 and 50);

-- Partners can't change their commission; admin notes and approvals stay admin-only (guard_listing).
create or replace function private.guard_homestay_extra()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() or auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then new.commission_rate := 12; else new.commission_rate := old.commission_rate; end if;
  return new;
end $$;
drop trigger if exists homestays_guard_extra on public.homestays;
create trigger homestays_guard_extra before insert or update on public.homestays
  for each row execute function private.guard_homestay_extra();

create or replace function private.owns_homestay(p_homestay uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.homestays h join public.partners p on p.id = h.partner_id
                  where h.id = p_homestay and p.owner_id = auth.uid());
$$;

-- Tell the partner when admin approves / rejects a property.
create or replace function private.on_homestay_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') and private.is_admin() then
    select owner_id into v_owner from public.partners where id = new.partner_id;
    perform private.notify(v_owner,
      case when new.status = 'approved' then 'Property approved: ' else 'Property needs changes: ' end || new.name,
      coalesce(nullif(new.admin_note, ''), case when new.status = 'approved' then 'Your homestay is now live.' else 'Please see the admin remarks.' end),
      '#/partner/properties');
  end if;
  return new;
end $$;
drop trigger if exists homestays_status_notify on public.homestays;
create trigger homestays_status_notify after update on public.homestays
  for each row execute function private.on_homestay_status();

-- ───────── 2. Room types ─────────
create table if not exists public.homestay_rooms (
  id              uuid primary key default gen_random_uuid(),
  homestay_id     uuid not null references public.homestays(id) on delete cascade,
  room_type       text not null check (char_length(room_type) between 2 and 60),
  base_price      integer not null check (base_price between 0 and 1000000),
  weekend_price   integer check (weekend_price is null or weekend_price between 0 and 1000000),
  max_guests      integer not null default 2 check (max_guests between 1 and 20),
  total_inventory integer not null default 1 check (total_inventory between 1 and 50),
  is_active       boolean not null default true,
  sort            integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists homestay_rooms_homestay_idx on public.homestay_rooms (homestay_id);
alter table public.homestay_rooms enable row level security;
create policy "homestay_rooms: read" on public.homestay_rooms for select to anon, authenticated
  using (exists (select 1 from public.homestays h where h.id = homestay_id and h.status = 'approved') or private.owns_homestay(homestay_id) or (select private.is_admin()));
create policy "homestay_rooms: owner or admin insert" on public.homestay_rooms for insert to authenticated
  with check (private.owns_homestay(homestay_id) or (select private.is_admin()));
create policy "homestay_rooms: owner or admin update" on public.homestay_rooms for update to authenticated
  using (private.owns_homestay(homestay_id) or (select private.is_admin())) with check (private.owns_homestay(homestay_id) or (select private.is_admin()));
create policy "homestay_rooms: owner or admin delete" on public.homestay_rooms for delete to authenticated
  using (private.owns_homestay(homestay_id) or (select private.is_admin()));
create trigger homestay_rooms_updated before update on public.homestay_rooms for each row execute function private.set_updated_at();
create or replace function private.guard_room()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then new.homestay_id := old.homestay_id; end if;
  return new;
end $$;
create trigger homestay_rooms_guard before update on public.homestay_rooms for each row execute function private.guard_room();

-- Booking columns first (used by the availability functions below).
alter table public.booking_requests
  add column if not exists booking_code          text,
  add column if not exists room_id               uuid references public.homestay_rooms(id),
  add column if not exists rooms_booked          integer not null default 1 check (rooms_booked between 1 and 20),
  add column if not exists total_amount          integer check (total_amount is null or total_amount >= 0),
  add column if not exists commission_rate       numeric(5,2),
  add column if not exists platform_commission   integer check (platform_commission is null or platform_commission >= 0),
  add column if not exists partner_payout_amount integer check (partner_payout_amount is null or partner_payout_amount >= 0),
  add column if not exists payout_status         text not null default 'unpaid' check (payout_status in ('unpaid', 'processing', 'paid')),
  add column if not exists payout_id             uuid,
  add column if not exists checked_in_at         timestamptz,
  add column if not exists completed_at          timestamptz;
create unique index if not exists booking_requests_code_uidx on public.booking_requests (booking_code) where booking_code is not null;
create index if not exists booking_requests_room_idx on public.booking_requests (room_id, start_date) where room_id is not null;
create index if not exists booking_requests_partner_idx on public.booking_requests (partner_id, start_date desc);
alter table public.booking_requests drop constraint if exists booking_requests_status_check;
alter table public.booking_requests add constraint booking_requests_status_check
  check (status in ('requested', 'confirmed', 'checked_in', 'declined', 'cancelled', 'completed'));

-- ───────── 3. Rate calendar (blocks and custom prices per date) ─────────
create table if not exists public.room_rates (
  room_id       uuid not null references public.homestay_rooms(id) on delete cascade,
  date          date not null,
  custom_price  integer check (custom_price is null or custom_price between 0 and 1000000),
  blocked_units integer not null default 0 check (blocked_units between 0 and 50),
  note          text not null default '' check (char_length(note) <= 120),
  updated_at    timestamptz not null default now(),
  primary key (room_id, date)
);
alter table public.room_rates enable row level security;
create policy "room_rates: owner or admin read" on public.room_rates for select to authenticated
  using (exists (select 1 from public.homestay_rooms r where r.id = room_id and (private.owns_homestay(r.homestay_id) or private.is_admin())));
create policy "room_rates: owner or admin insert" on public.room_rates for insert to authenticated
  with check (exists (select 1 from public.homestay_rooms r where r.id = room_id and (private.owns_homestay(r.homestay_id) or private.is_admin())));
create policy "room_rates: owner or admin update" on public.room_rates for update to authenticated
  using (exists (select 1 from public.homestay_rooms r where r.id = room_id and (private.owns_homestay(r.homestay_id) or private.is_admin())))
  with check (exists (select 1 from public.homestay_rooms r where r.id = room_id and (private.owns_homestay(r.homestay_id) or private.is_admin())));
create policy "room_rates: owner or admin delete" on public.room_rates for delete to authenticated
  using (exists (select 1 from public.homestay_rooms r where r.id = room_id and (private.owns_homestay(r.homestay_id) or private.is_admin())));
create or replace function private.guard_room_rate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_inv integer;
begin
  select total_inventory into v_inv from public.homestay_rooms where id = new.room_id;
  if new.blocked_units > v_inv then new.blocked_units := v_inv; end if;
  if new.date < current_date - 1 then raise exception 'Past dates cannot be changed'; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger room_rates_guard before insert or update on public.room_rates for each row execute function private.guard_room_rate();

-- Price for one night: custom price → weekend price (Fri, Sat nights) → base price.
create or replace function private.night_price(p_room public.homestay_rooms, p_date date)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select rr.custom_price from public.room_rates rr where rr.room_id = p_room.id and rr.date = p_date),
                  case when extract(isodow from p_date) in (5, 6) and p_room.weekend_price is not null then p_room.weekend_price else p_room.base_price end);
$$;

-- Rooms of this type still free on every night of the stay.
create or replace function private.rooms_free(p_room uuid, p_start date, p_end date, p_skip uuid default null)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(min(r.total_inventory - coalesce(rr.blocked_units, 0)
         - coalesce((select sum(b.rooms_booked) from public.booking_requests b
                      where b.room_id = r.id and b.status in ('confirmed', 'checked_in') and b.id is distinct from p_skip
                        and b.start_date <= d.d and b.end_date > d.d), 0)), 0)::int
    from public.homestay_rooms r
    cross join generate_series(p_start, p_end - 1, interval '1 day') as d(d)
    left join public.room_rates rr on rr.room_id = r.id and rr.date = d.d::date
   where r.id = p_room;
$$;

-- Public price check for guests (approved homestays only).
create or replace function public.quote_homestay(p_room uuid, p_start date, p_end date, p_rooms integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r public.homestay_rooms; v_total integer := 0; d date;
begin
  select hr.* into r from public.homestay_rooms hr join public.homestays h on h.id = hr.homestay_id
   where hr.id = p_room and hr.is_active and (h.status = 'approved' or private.owns_homestay(h.id) or private.is_admin());
  if not found then raise exception 'Room not found'; end if;
  if p_start is null or p_end is null or p_end <= p_start then raise exception 'Check-out must be after check-in'; end if;
  if p_end - p_start > 60 then raise exception 'Stays can be up to 60 nights'; end if;
  if coalesce(p_rooms, 1) not between 1 and r.total_inventory then raise exception 'Choose 1 to % rooms', r.total_inventory; end if;
  for d in select generate_series(p_start, p_end - 1, interval '1 day')::date loop
    v_total := v_total + private.night_price(r, d);
  end loop;
  return jsonb_build_object('nights', p_end - p_start, 'rooms', coalesce(p_rooms, 1), 'total', v_total * coalesce(p_rooms, 1),
    'available', private.rooms_free(p_room, p_start, p_end) >= coalesce(p_rooms, 1));
end $$;

-- ───────── 4. Bookings (existing booking_requests) ─────────
-- New request: booking code, room checks, estimated amount (fixed again at confirmation).
create or replace function private.homestay_request_extra()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.homestay_rooms; q jsonb;
begin
  new.booking_code := 'THH-H-' || to_char(now() at time zone 'Asia/Kolkata', 'DDMMYYYY') || '-' || lpad(private.next_counter('homestay')::text, 4, '0');
  new.payout_status := 'unpaid'; new.payout_id := null; new.platform_commission := null; new.partner_payout_amount := null;
  new.checked_in_at := null; new.completed_at := null;
  if new.kind = 'homestay' and new.room_id is not null then
    select * into r from public.homestay_rooms where id = new.room_id and homestay_id = new.homestay_id and is_active;
    if not found then raise exception 'Choose a room of this homestay'; end if;
    if new.end_date is null or new.end_date <= new.start_date then raise exception 'Check-out must be after check-in'; end if;
    if coalesce(new.guests, 1) > r.max_guests * new.rooms_booked then
      raise exception 'Up to % guests in % room(s). Add another room.', r.max_guests * new.rooms_booked, new.rooms_booked;
    end if;
    q := public.quote_homestay(new.room_id, new.start_date, new.end_date, new.rooms_booked);
    if not (q ->> 'available')::boolean then raise exception 'Not enough rooms free on these dates'; end if;
    new.total_amount := (q ->> 'total')::int;
  else
    new.total_amount := null;
  end if;
  return new;
end $$;
drop trigger if exists booking_requests_quote on public.booking_requests;
create trigger booking_requests_quote before insert on public.booking_requests
  for each row execute function private.homestay_request_extra();

-- Codes, amounts and payout fields can't be edited directly; only through the functions below.
create or replace function private.guard_booking_money()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  new.booking_code := old.booking_code; new.room_id := old.room_id; new.rooms_booked := old.rooms_booked;
  new.total_amount := old.total_amount; new.commission_rate := old.commission_rate;
  new.platform_commission := old.platform_commission; new.partner_payout_amount := old.partner_payout_amount;
  new.payout_status := old.payout_status; new.payout_id := old.payout_id;
  return new;
end $$;
drop trigger if exists booking_requests_money on public.booking_requests;
create trigger booking_requests_money before update on public.booking_requests
  for each row execute function private.guard_booking_money();

-- Status changes for every kind of request. Homestay confirmations lock the room, check free rooms,
-- and fix the amount, commission and host payout from the rate calendar.
create or replace function public.set_booking_status(p_id uuid, p_status text, p_note text default '')
returns public.booking_requests language plpgsql security definer set search_path = '' as $$
declare
  r public.booking_requests; v_is_partner boolean; v_admin boolean := private.is_admin(); v_room public.homestay_rooms;
  v_rate numeric; v_total integer; q jsonb; v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select * into r from public.booking_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  v_is_partner := private.owns_partner(r.partner_id);
  if p_status not in ('confirmed', 'declined', 'checked_in', 'completed', 'cancelled') then raise exception 'Unknown status'; end if;

  if v_admin or v_is_partner then
    if not ((r.status = 'requested' and p_status in ('confirmed', 'declined'))
         or (r.status = 'confirmed' and p_status in ('checked_in', 'completed', 'cancelled'))
         or (r.status = 'checked_in' and p_status = 'completed')
         or (v_admin and r.status = 'requested' and p_status = 'cancelled')) then
      raise exception 'You cannot change this booking from % to %', r.status, p_status;
    end if;
  elsif r.user_id = auth.uid() and p_status = 'cancelled' and r.status in ('requested', 'confirmed') then
    null;
  else
    raise exception 'You cannot change this request to %', p_status;
  end if;
  if p_status in ('checked_in', 'completed') and r.start_date > v_today then
    raise exception 'Guests can be checked in from the check-in date (%)', to_char(r.start_date, 'DD Mon YYYY');
  end if;

  if p_status = 'confirmed' and r.kind = 'homestay' and r.room_id is not null then
    select * into v_room from public.homestay_rooms where id = r.room_id for update;  -- one confirmation at a time per room type
    if private.rooms_free(r.room_id, r.start_date, r.end_date, r.id) < r.rooms_booked then
      raise exception 'Not enough rooms free on these dates. Block or decline instead.';
    end if;
    q := public.quote_homestay(r.room_id, r.start_date, r.end_date, r.rooms_booked);
    v_total := (q ->> 'total')::int;
    select commission_rate into v_rate from public.homestays where id = r.homestay_id;
    update public.booking_requests
       set total_amount = v_total, commission_rate = v_rate,
           platform_commission = round(v_total * v_rate / 100), partner_payout_amount = v_total - round(v_total * v_rate / 100)
     where id = p_id;
  end if;

  update public.booking_requests
     set status = p_status,
         partner_note = case when v_is_partner or v_admin then left(coalesce(p_note, ''), 1000) else partner_note end,
         decided_at = case when p_status in ('confirmed', 'declined') then now() else decided_at end,
         checked_in_at = case when p_status = 'checked_in' then now() else checked_in_at end,
         completed_at = case when p_status = 'completed' then now() else completed_at end
   where id = p_id
   returning * into r;

  if auth.uid() is distinct from r.user_id then
    perform private.notify(r.user_id, 'Booking ' || replace(p_status, '_', ' ') || coalesce(' · ' || r.booking_code, ''),
      coalesce(nullif(p_note, ''), 'Your booking was updated.'), '#/account/bookings');
  else
    perform private.notify((select owner_id from public.partners where id = r.partner_id), 'Booking cancelled by guest' || coalesce(' · ' || r.booking_code, ''),
      r.guest_name || ' · ' || to_char(r.start_date, 'DD Mon YYYY'), '#/partner/bookings');
  end if;
  return r;
end $$;

-- ───────── 5. KYC and bank details (private) ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-docs', 'partner-docs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy "partner-docs: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'partner-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "partner-docs: owner or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'partner-docs' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));
create policy "partner-docs: owner or admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'partner-docs' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));

create table if not exists public.partner_kyc (
  partner_id          uuid primary key references public.partners(id) on delete cascade,
  id_type             text not null default 'aadhaar' check (id_type in ('aadhaar', 'pan', 'gst', 'passport', 'voter_id')),
  id_number           text not null default '' check (char_length(id_number) <= 30),
  id_file             text not null default '' check (char_length(id_file) <= 300),
  gst_number          text not null default '' check (char_length(gst_number) <= 20),
  bank_account_name   text not null default '' check (char_length(bank_account_name) <= 120),
  bank_account_number text not null default '' check (char_length(bank_account_number) <= 30),
  bank_ifsc           text not null default '' check (bank_ifsc = '' or bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  upi_id              text not null default '' check (upi_id = '' or upi_id ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.]{1,40}$'),
  status              text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  admin_remark        text not null default '' check (char_length(admin_remark) <= 500),
  reviewed_by         uuid references public.profiles(id),
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.partner_kyc enable row level security;
create policy "partner_kyc: owner or admin read" on public.partner_kyc for select to authenticated using (private.owns_partner(partner_id) or (select private.is_admin()));
create policy "partner_kyc: owner insert" on public.partner_kyc for insert to authenticated with check (private.owns_partner(partner_id) or (select private.is_admin()));
create policy "partner_kyc: owner or admin update" on public.partner_kyc for update to authenticated
  using (private.owns_partner(partner_id) or (select private.is_admin())) with check (private.owns_partner(partner_id) or (select private.is_admin()));
create trigger partner_kyc_updated before update on public.partner_kyc for each row execute function private.set_updated_at();
create or replace function private.guard_partner_kyc()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  new.bank_ifsc := upper(trim(new.bank_ifsc));
  new.id_number := upper(regexp_replace(new.id_number, '\s', '', 'g'));
  new.bank_account_number := regexp_replace(new.bank_account_number, '\s', '', 'g');
  if private.is_admin() then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
      select owner_id into v_owner from public.partners where id = new.partner_id;
      perform private.notify(v_owner, case when new.status = 'verified' then 'KYC verified' else 'KYC needs changes' end,
        coalesce(nullif(new.admin_remark, ''), case when new.status = 'verified' then 'You can now request payouts.' else 'Please check your documents.' end), '#/partner/kyc');
    end if;
    return new;
  end if;
  if auth.uid() is null then return new; end if;
  if new.id_file <> '' and split_part(new.id_file, '/', 1) <> auth.uid()::text then raise exception 'Upload the file to your own folder'; end if;
  if tg_op = 'UPDATE' then new.partner_id := old.partner_id; end if;
  new.status := 'pending'; new.admin_remark := ''; new.reviewed_by := null; new.reviewed_at := null;
  return new;
end $$;
create trigger partner_kyc_guard before insert or update on public.partner_kyc for each row execute function private.guard_partner_kyc();

-- ───────── 6. Payout requests ─────────
create table if not exists public.payout_requests (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references public.partners(id) on delete cascade,
  amount          integer not null check (amount > 0),
  bookings_count  integer not null default 0,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  transaction_ref text not null default '' check (char_length(transaction_ref) <= 80),
  admin_note      text not null default '' check (char_length(admin_note) <= 500),
  requested_at    timestamptz not null default now(),
  processed_at    timestamptz,
  processed_by    uuid references public.profiles(id)
);
create index if not exists payout_requests_partner_idx on public.payout_requests (partner_id, requested_at desc);
create index if not exists payout_requests_pending_idx on public.payout_requests (requested_at) where status = 'pending';
alter table public.payout_requests enable row level security;
create policy "payout_requests: owner or admin read" on public.payout_requests for select to authenticated
  using (private.owns_partner(partner_id) or (select private.is_admin()));
alter table public.booking_requests add constraint booking_requests_payout_fk foreign key (payout_id) references public.payout_requests(id) on delete set null;

-- The amount is never typed: it is the host share of all completed, unpaid stays.
create or replace function public.request_payout(p_partner uuid)
returns public.payout_requests language plpgsql security definer set search_path = '' as $$
declare v_amount integer; v_n integer; p public.payout_requests; a record;
begin
  if not private.owns_partner(p_partner) then raise exception 'Partner not found'; end if;
  perform 1 from public.partners where id = p_partner for update;
  if not exists (select 1 from public.partner_kyc k where k.partner_id = p_partner and k.status = 'verified'
                   and (k.upi_id <> '' or (k.bank_account_number <> '' and k.bank_ifsc <> ''))) then
    raise exception 'Complete KYC and bank / UPI details first. Payouts open after verification.';
  end if;
  if exists (select 1 from public.payout_requests where partner_id = p_partner and status = 'pending') then
    raise exception 'You already have a payout request waiting';
  end if;
  select coalesce(sum(partner_payout_amount), 0), count(*) into v_amount, v_n from public.booking_requests
   where partner_id = p_partner and status = 'completed' and payout_status = 'unpaid' and partner_payout_amount is not null;
  if v_amount <= 0 then raise exception 'Nothing to pay out yet. Completed stays appear here.'; end if;
  insert into public.payout_requests (partner_id, amount, bookings_count) values (p_partner, v_amount, v_n) returning * into p;
  update public.booking_requests set payout_status = 'processing', payout_id = p.id
   where partner_id = p_partner and status = 'completed' and payout_status = 'unpaid' and partner_payout_amount is not null;
  for a in select id from public.profiles where role = 'admin' loop
    perform private.notify(a.id, 'Payout request', (select business_name from public.partners where id = p_partner) || ' · ₹' || v_amount, '#/admin/payouts');
  end loop;
  return p;
end $$;

create or replace function public.admin_process_payout(p_id uuid, p_approve boolean, p_ref text default '', p_note text default '')
returns public.payout_requests language plpgsql security definer set search_path = '' as $$
declare p public.payout_requests;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if p_approve and char_length(trim(coalesce(p_ref, ''))) < 3 then raise exception 'Enter the transaction reference (UTR / UPI ref)'; end if;
  update public.payout_requests
     set status = case when p_approve then 'approved' else 'rejected' end, transaction_ref = left(trim(coalesce(p_ref, '')), 80),
         admin_note = left(coalesce(p_note, ''), 500), processed_at = now(), processed_by = auth.uid()
   where id = p_id and status = 'pending' returning * into p;
  if not found then raise exception 'Payout not found or already processed'; end if;
  update public.booking_requests set payout_status = case when p_approve then 'paid' else 'unpaid' end,
         payout_id = case when p_approve then payout_id else null end
   where payout_id = p_id;
  perform private.notify((select owner_id from public.partners where id = p.partner_id),
    case when p_approve then 'Payout paid: ₹' || p.amount else 'Payout request rejected' end,
    case when p_approve then 'Reference ' || p.transaction_ref else coalesce(nullif(p_note, ''), 'Please contact THH support.') end, '#/partner/earnings');
  return p;
end $$;

-- ───────── 7. Support tickets ─────────
create table if not exists public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null references public.profiles(id) on delete cascade,
  partner_id      uuid references public.partners(id) on delete set null,
  booking_id      uuid references public.booking_requests(id) on delete set null,
  subject         text not null check (char_length(subject) between 3 and 140),
  category        text not null default 'other' check (category in ('booking', 'payout', 'kyc', 'listing', 'technical', 'other')),
  status          text not null default 'open' check (status in ('open', 'answered', 'closed')),
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists support_tickets_open_idx on public.support_tickets (status, last_message_at desc);
create table if not exists public.ticket_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  is_admin   boolean not null default false,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
create policy "support_tickets: own or admin" on public.support_tickets for select to authenticated using (created_by = (select auth.uid()) or (select private.is_admin()));
create policy "ticket_messages: own or admin" on public.ticket_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.created_by = (select auth.uid()) or private.is_admin())));

create or replace function public.open_ticket(p_subject text, p_category text, p_body text, p_partner uuid default null, p_booking uuid default null)
returns public.support_tickets language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; a record;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if p_partner is not null and not private.owns_partner(p_partner) then raise exception 'Partner not found'; end if;
  if p_booking is not null and not exists (select 1 from public.booking_requests b where b.id = p_booking and (b.user_id = auth.uid() or private.owns_partner(b.partner_id))) then
    raise exception 'Booking not found';
  end if;
  if char_length(trim(coalesce(p_body, ''))) < 3 then raise exception 'Please describe the problem'; end if;
  insert into public.support_tickets (created_by, partner_id, booking_id, subject, category)
  values (auth.uid(), p_partner, p_booking, left(trim(p_subject), 140), coalesce(p_category, 'other')) returning * into t;
  insert into public.ticket_messages (ticket_id, author_id, is_admin, body) values (t.id, auth.uid(), false, left(trim(p_body), 2000));
  for a in select id from public.profiles where role = 'admin' loop
    perform private.notify(a.id, 'Support ticket: ' || t.subject, left(trim(p_body), 160), '#/admin/tickets');
  end loop;
  return t;
end $$;

create or replace function public.post_ticket_message(p_ticket uuid, p_body text, p_close boolean default false)
returns public.ticket_messages language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; m public.ticket_messages; v_admin boolean := private.is_admin();
begin
  select * into t from public.support_tickets where id = p_ticket for update;
  if not found or (t.created_by is distinct from auth.uid() and not v_admin) then raise exception 'Ticket not found'; end if;
  if t.status = 'closed' and not v_admin then raise exception 'This ticket is closed. Open a new one if you still need help.'; end if;
  if char_length(trim(coalesce(p_body, ''))) < 1 then raise exception 'Write a message'; end if;
  insert into public.ticket_messages (ticket_id, author_id, is_admin, body) values (p_ticket, auth.uid(), v_admin, left(trim(p_body), 2000)) returning * into m;
  update public.support_tickets set last_message_at = now(),
         status = case when p_close then 'closed' when v_admin then 'answered' else 'open' end where id = p_ticket;
  if v_admin then
    perform private.notify(t.created_by, 'Reply from THH support', left(trim(p_body), 160), '#/partner/support');
  end if;
  return m;
end $$;

-- ───────── 8. Admin numbers ─────────
create or replace function public.admin_homestay_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'gmv', (select coalesce(sum(total_amount), 0) from public.booking_requests where kind = 'homestay' and status in ('confirmed', 'checked_in', 'completed')),
    'commission', (select coalesce(sum(platform_commission), 0) from public.booking_requests where kind = 'homestay' and status in ('confirmed', 'checked_in', 'completed')),
    'paid_out', (select coalesce(sum(amount), 0) from public.payout_requests where status = 'approved'),
    'active_partners', (select count(*) from public.partners where status = 'approved'),
    'live_homestays', (select count(*) from public.homestays where status = 'approved'),
    'pending_properties', (select count(*) from public.homestays where status = 'pending'),
    'pending_kyc', (select count(*) from public.partner_kyc where status = 'pending'),
    'pending_partners', (select count(*) from public.partners where status = 'pending'),
    'pending_payouts', (select count(*) from public.payout_requests where status = 'pending'),
    'open_tickets', (select count(*) from public.support_tickets where status = 'open'),
    'by_month', (select coalesce(jsonb_agg(x order by x.m), '[]'::jsonb) from (
       select to_char(date_trunc('month', start_date), 'YYYY-MM') m, sum(total_amount) gmv, sum(platform_commission) commission
         from public.booking_requests where kind = 'homestay' and status in ('confirmed', 'checked_in', 'completed') and start_date >= (current_date - interval '11 months')
        group by 1) x));
end $$;

-- ───────── 9. Real-time queues and audit ─────────
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['homestays', 'booking_requests', 'payout_requests', 'partner_kyc', 'support_tickets', 'ticket_messages', 'partners', 'homestay_rooms'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
  foreach t in array array['homestays', 'homestay_rooms', 'partner_kyc', 'payout_requests', 'support_tickets', 'booking_requests'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
end $$;

-- ───────── Permissions ─────────
revoke execute on function private.night_price(public.homestay_rooms, date), private.rooms_free(uuid, date, date, uuid),
  private.homestay_request_extra(), private.guard_homestay_extra(), private.on_homestay_status(), private.guard_room_rate(), private.guard_partner_kyc()
  from public, anon, authenticated;
revoke execute on function private.owns_homestay(uuid) from public, anon;
grant execute on function private.owns_homestay(uuid) to anon, authenticated;  -- used inside row policies (answers only about the caller)
revoke execute on function public.quote_homestay(uuid, date, date, integer), public.request_payout(uuid), public.admin_process_payout(uuid, boolean, text, text),
  public.open_ticket(text, text, text, uuid, uuid), public.post_ticket_message(uuid, text, boolean), public.admin_homestay_stats() from public, anon;
grant execute on function public.quote_homestay(uuid, date, date, integer) to anon, authenticated;
grant execute on function public.request_payout(uuid), public.admin_process_payout(uuid, boolean, text, text),
  public.open_ticket(text, text, text, uuid, uuid), public.post_ticket_message(uuid, text, boolean), public.admin_homestay_stats() to authenticated;
