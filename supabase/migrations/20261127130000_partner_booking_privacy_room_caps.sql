begin;

-- Keep contact details out of partner-readable rows until a booking is confirmed.
alter table public.booking_requests alter column guest_phone drop not null;

create table private.booking_guest_contacts (
  booking_id uuid primary key references public.booking_requests(id) on delete cascade deferrable initially deferred,
  guest_phone text not null check (char_length(guest_phone) between 7 and 20)
);
alter table private.booking_guest_contacts enable row level security;
revoke all on private.booking_guest_contacts from public, anon, authenticated;

insert into private.booking_guest_contacts (booking_id, guest_phone)
select id, guest_phone from public.booking_requests;

create function private.mask_booking_guest_phone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into private.booking_guest_contacts (booking_id, guest_phone)
      values (new.id, new.guest_phone);
  elsif new.guest_phone is not null and new.guest_phone is distinct from old.guest_phone then
    update private.booking_guest_contacts
      set guest_phone = new.guest_phone where booking_id = new.id;
  end if;

  if new.status in ('confirmed', 'checked_in', 'completed') then
    select guest_phone into new.guest_phone
      from private.booking_guest_contacts where booking_id = new.id;
  else
    new.guest_phone := null;
  end if;
  return new;
end
$$;
revoke all on function private.mask_booking_guest_phone() from public, anon, authenticated;

-- Run after the existing prepare and quote triggers, which establish the request status.
create trigger booking_requests_zz_mask_phone
before insert or update of status, guest_phone on public.booking_requests
for each row execute function private.mask_booking_guest_phone();

update public.booking_requests set guest_phone = null
where status not in ('confirmed', 'checked_in', 'completed');

-- Guests retain access to their own contacts. Admins can support any booking.
create function public.booking_guest_phones(p_ids uuid[])
returns table(booking_id uuid, guest_phone text)
language sql stable security definer set search_path = '' as $$
  select c.booking_id, c.guest_phone
  from private.booking_guest_contacts c
  join public.booking_requests b on b.id = c.booking_id
  where b.id = any(p_ids)
    and (b.user_id = (select auth.uid()) or (select private.is_admin()))
$$;
revoke all on function public.booking_guest_phones(uuid[]) from public, anon;
grant execute on function public.booking_guest_phones(uuid[]) to authenticated;

create or replace function private.guard_room_rate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_inventory integer;
  v_booked integer;
begin
  if new.date < current_date - 1 then raise exception 'Past dates cannot be changed'; end if;

  -- The booking confirmation RPC takes the same room row lock before checking availability.
  select r.total_inventory into v_inventory
  from public.homestay_rooms r
  where r.id = new.room_id
  for update;

  select coalesce(sum(b.rooms_booked), 0)::int into v_booked
  from public.booking_requests b
  where b.room_id = new.room_id
    and b.status in ('confirmed', 'checked_in')
    and b.start_date <= new.date and b.end_date > new.date;

  new.blocked_units := least(new.blocked_units, greatest(v_inventory - v_booked, 0));
  new.updated_at := now();
  return new;
end
$$;

-- Repair existing future rate rows that closed units already committed to guests.
with available_to_close as (
  select rr.room_id, rr.date, greatest(r.total_inventory - coalesce((
    select sum(b.rooms_booked) from public.booking_requests b
    where b.room_id = rr.room_id and b.status in ('confirmed', 'checked_in')
      and b.start_date <= rr.date and b.end_date > rr.date
  ), 0), 0) as cap
  from public.room_rates rr
  join public.homestay_rooms r on r.id = rr.room_id
  where rr.date >= current_date
)
update public.room_rates rr
set blocked_units = a.cap
from available_to_close a
where rr.room_id = a.room_id and rr.date = a.date and rr.blocked_units > a.cap;

commit;
