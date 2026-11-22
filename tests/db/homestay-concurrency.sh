#!/usr/bin/env bash
# LOCAL test database only: two confirmations for the last room at the same moment → exactly one succeeds.
set -u
P="psql -h /home/postgres/pg -p 55432 -U postgres -d thh -qAt"
H='00000000-0000-4000-9100-000000000001'
$P <<SQL >/dev/null
delete from auth.users where email like 'hc-%';
insert into auth.users (id, email) values ('$H', 'hc-host@thh.invalid'), ('00000000-0000-4000-9100-000000000002', 'hc-g1@thh.invalid'), ('00000000-0000-4000-9100-000000000003', 'hc-g2@thh.invalid');
insert into public.partners (owner_id, business_name, contact_name, phone, email, categories, status, created_by) values ('$H', 'HC Stay', 'HC', '9000000999', 'hc@thh.invalid', '{homestay}', 'approved', '$H');
insert into public.homestays (partner_id, name, village, summary, description, rooms, max_guests, price_per_night, status) select id, 'HC House', 'X', 's', 'd', 1, 2, 1000, 'approved' from public.partners where owner_id = '$H';
insert into public.homestay_rooms (homestay_id, room_type, base_price, total_inventory) select id, 'Only room', 1000, 1 from public.homestays where name = 'HC House';
alter table public.booking_requests disable trigger booking_requests_prepare;
insert into public.booking_requests (kind, homestay_id, partner_id, room_id, user_id, guest_name, guest_phone, start_date, end_date, guests, status)
  select 'homestay', h.id, h.partner_id, r.id, g.id, 'Guest HC', '9876500000', current_date + 20, current_date + 21, 1, 'requested'
    from public.homestays h join public.homestay_rooms r on r.homestay_id = h.id, (values ('00000000-0000-4000-9100-000000000002'::uuid), ('00000000-0000-4000-9100-000000000003'::uuid)) g(id) where h.name = 'HC House';
alter table public.booking_requests enable trigger booking_requests_prepare;
SQL
ids=$($P -c "select id from public.booking_requests where guest_name = 'Guest HC' and homestay_id = (select id from public.homestays where name = 'HC House')")
confirm() { $P -c "begin; select set_config('request.jwt.claims', json_build_object('sub','$H','role','authenticated')::text, true); set local role authenticated;
  select status from public.set_booking_status('$1', 'confirmed'); select pg_sleep(0.6); commit;" 2>&1 | grep -E "^confirmed|ERROR" | sed 's/^psql:[^E]*//'; }
i=0; for b in $ids; do confirm "$b" > /tmp/hc$i & i=$((i+1)); done; wait
echo "Last room, 2 confirmations at once: confirmed=$(cat /tmp/hc* | grep -c '^confirmed') refused=$(cat /tmp/hc* | grep -c 'Not enough rooms')"
echo "Confirmed bookings for the room in DB: $($P -c "select count(*) from public.booking_requests where status='confirmed' and homestay_id = (select id from public.homestays where name = 'HC House')")"
rm -f /tmp/hc*
$P -c "delete from public.partners where owner_id = '$H'; delete from auth.users where email like 'hc-%';" >/dev/null
