#!/usr/bin/env bash
# Simultaneous bookings on the LOCAL test database (never the live one):
#  A) 2 people grab the last seat at the same moment → exactly one succeeds.
#  B) 20 people book at the same moment → 20 different booking IDs, seats never above capacity.
set -u
P="psql -h /home/postgres/pg -p 55432 -U postgres -d thh -qAt"
U() { printf '00000000-0000-4000-9000-%012d' "$1"; }

$P <<SQL >/dev/null
delete from auth.users where email like 'conc-%';
insert into auth.users (id, email) select ('00000000-0000-4000-9000-' || lpad(g::text, 12, '0'))::uuid, 'conc-' || g || '@thh.invalid' from generate_series(1, 30) g;
insert into public.driver_profiles (user_id, full_name, phone, is_verified) values ('$(U 30)', 'Conc Driver', '9000000030', true);
insert into public.vehicles (owner_id, vehicle_type, model, registration_no, seats) values ('$(U 30)', 'other', 'Traveller', 'UK01TT0001', 12);
SQL
VEH=$($P -c "select id from public.vehicles where owner_id = '$(U 30)'")
ride() { $P -c "insert into public.cab_rides (driver_id, vehicle_id, pickup_point, drop_point, departure_at, vehicle_model, vehicle_type, seats_total, price_per_seat, auto_confirm, from_geo, to_geo)
  values ('$(U 30)', '$VEH', 'A', 'B', now() + interval '2 days', 'Traveller', 'other', $1, 300, true, '{\"lat\":29.1,\"lng\":79.5}', '{\"lat\":29.6,\"lng\":79.7}') returning id" | head -1; }
book() { # user ride seat
  $P -c "begin; select set_config('request.jwt.claims', json_build_object('sub','$1','role','authenticated')::text, true); set local role authenticated;
         select booking_ref from public.request_cab_ride('$2', '{$3}', 'Conc User', '9876500000'); select pg_sleep(0.5); commit;" 2>&1 | grep -E "THH-|ERROR" | sed 's/^psql:[^E]*//'; }

R1=$(ride 1)
book "$(U 1)" "$R1" 1 > /tmp/ca1 & book "$(U 2)" "$R1" 1 > /tmp/ca2 & wait
OK=$(cat /tmp/ca1 /tmp/ca2 | grep -c '^THH-'); ERR=$(cat /tmp/ca1 /tmp/ca2 | grep -c 'ERROR')
echo "A) last seat, 2 at once: success=$OK refused=$ERR  ($(cat /tmp/ca1 /tmp/ca2 | tr '\n' ' '))"
echo "   seats booked on ride: $($P -c "select seats_booked || '/' || seats_total from public.cab_rides where id = '$R1'")"

R2=$(ride 12)
for i in $(seq 1 20); do s=$(( (i - 1) % 12 + 1 )); book "$(U $i)" "$R2" "$s" > /tmp/cb$i & done; wait
OKB=$(cat /tmp/cb* | grep -c '^THH-'); UNIQ=$(cat /tmp/cb* | grep '^THH-' | sort -u | wc -l)
echo "B) 20 at once on 12 seats: success=$OKB unique_ids=$UNIQ refused=$(cat /tmp/cb* | grep -c ERROR)"
echo "   seats booked on ride: $($P -c "select seats_booked || '/' || seats_total from public.cab_rides where id = '$R2'")"
echo "   active seat holds: $($P -c "select count(*) from public.cab_seat_holds where ride_id = '$R2' and released_at is null")"
echo "   all booking IDs in DB unique: $($P -c "select count(*) = count(distinct booking_ref) from public.cab_bookings")"
rm -f /tmp/ca1 /tmp/ca2 /tmp/cb*
$P -c "delete from public.cab_rides where driver_id = '$(U 30)'; delete from auth.users where email like 'conc-%';" >/dev/null
