-- Keep helper and trigger functions out of the public API (Supabase advisor 0028/0029).
create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.is_admin() set schema private;
alter function public.owns_partner(uuid) set schema private;
alter function public.partner_can(uuid, text) set schema private;
alter function public.handle_new_user() set schema private;
alter function public.guard_profile() set schema private;
alter function public.guard_partner() set schema private;
alter function public.on_partner_approved() set schema private;
alter function public.guard_listing() set schema private;
alter function public.prepare_booking_request() set schema private;
alter function public.guard_cab_ride() set schema private;
alter function public.notify(uuid, text, text, text) set schema private;
alter function public.set_updated_at() set schema private;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function private.handle_new_user()
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

create or replace function private.guard_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not private.is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end $$;

create or replace function private.owns_partner(p_partner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.partners where id = p_partner and owner_id = auth.uid());
$$;

create or replace function private.partner_can(p_partner uuid, p_category text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.partners
    where id = p_partner and owner_id = auth.uid()
      and status = 'approved' and p_category = any (categories)
  );
$$;

create or replace function private.guard_partner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() or auth.uid() is null then
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

create or replace function private.on_partner_approved()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' and new.owner_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    update public.profiles set role = 'partner' where id = new.owner_id and role = 'traveler';
  end if;
  return new;
end $$;

create or replace function private.guard_listing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() or auth.uid() is null then
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

create or replace function private.notify(p_user uuid, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, title, body, link)
  select p_user, left(p_title, 160), left(coalesce(p_body, ''), 600), left(coalesce(p_link, ''), 300)
  where p_user is not null;
$$;

create or replace function private.prepare_booking_request()
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
  if not private.is_admin() and new.start_date < current_date then
    raise exception 'Dates must be today or later';
  end if;

  new.partner_id   := v_partner;
  new.status       := 'requested';
  new.partner_note := '';
  new.decided_at   := null;
  if not private.is_admin() then
    new.user_id := auth.uid();
  end if;

  select owner_id into v_owner from public.partners where id = v_partner;
  perform private.notify(v_owner, 'New booking request',
    new.guest_name || ' · ' || v_name || ' · ' || to_char(new.start_date, 'DD Mon YYYY'),
    '#/partner/requests');
  return new;
end $$;

create or replace function public.set_booking_status(p_id uuid, p_status text, p_note text default '')
returns public.booking_requests
language plpgsql security definer set search_path = '' as $$
declare
  r public.booking_requests;
  v_is_partner boolean;
begin
  select * into r from public.booking_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;

  v_is_partner := private.owns_partner(r.partner_id);

  if private.is_admin() then
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
         partner_note = case when v_is_partner or private.is_admin() then left(coalesce(p_note, ''), 1000) else partner_note end,
         decided_at = now()
   where id = p_id
   returning * into r;

  if auth.uid() is distinct from r.user_id then
    perform private.notify(r.user_id, 'Booking ' || p_status, coalesce(nullif(p_note, ''), 'Your request was updated.'), '#/account');
  end if;
  return r;
end $$;

create or replace function private.guard_cab_ride()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.is_admin() then
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
  perform private.notify(v_owner, 'Seat booking: ' || p_seats || ' seat(s)',
    left(p_name, 60) || ' · ' || to_char(ride.departure_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'),
    '#/partner/rides');
  return b;
end $$;

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
    perform private.notify(b.user_id, 'Cab booking ' || p_status, 'Ride on ' ||
      to_char(ride.departure_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'), '#/account');
  end if;
  return b;
end $$;

revoke execute on function private.notify(uuid, text, text, text) from public, anon, authenticated;

-- Public 'hosted by' card for approved partners (name + village only; no phone/email).
drop view if exists public.partner_public;
create or replace function public.partner_cards(p_ids uuid[])
returns table (id uuid, business_name text, village text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.business_name, p.village from public.partners p
  where p.id = any (p_ids) and p.status = 'approved';
$$;
grant execute on function public.partner_cards(uuid[]) to anon, authenticated;