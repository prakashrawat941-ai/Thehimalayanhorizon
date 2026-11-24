-- Instant Cab Phase 2: database security and rules test.
-- Run inside a transaction that is ROLLED BACK (nothing stays): begin; \i this file; rollback;
-- Works on the local test database (tests/db/supabase-stubs.sql + migrations) and on the live one.
-- Result: one row per check with ok = true/false.

create temp table r (n serial, name text, ok boolean, info text);
create temp table ids (k text primary key, v uuid);
grant all on r, ids to anon, authenticated; grant usage, select on sequence r_n_seq to anon, authenticated;

create function pg_temp.ok(c boolean, name text, info text default '') returns void language sql as
$$ insert into pg_temp.r (name, ok, info) values (name, coalesce(c, false), coalesce(info, '')) $$;
create function pg_temp.err(q text, pat text, name text) returns void language plpgsql as $$
begin
  execute q;
  insert into pg_temp.r (name, ok, info) values (name, false, 'no error was raised');
exception when others then
  insert into pg_temp.r (name, ok, info) values (name, sqlerrm ~* pat, sqlerrm);
end $$;
create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.id(key text) returns uuid language sql stable as $$ select v from pg_temp.ids where k = key $$;
create function pg_temp.put(key text, val uuid) returns void language sql as $$ insert into pg_temp.ids values (key, val) on conflict (k) do update set v = excluded.v $$;
create function pg_temp.tomorrow(t time) returns timestamptz language sql stable as
$$ select ((now() at time zone 'Asia/Kolkata')::date + 1 + t) at time zone 'Asia/Kolkata' $$;

-- People (fake, removed by the rollback)
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'test-admin@thh.invalid'),
  ('00000000-0000-4000-8000-0000000000d1', 'test-driver@thh.invalid'),
  ('00000000-0000-4000-8000-0000000000d2', 'test-unverified@thh.invalid'),
  ('00000000-0000-4000-8000-000000000001', 'test-p1@thh.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'test-p2@thh.invalid'),
  ('00000000-0000-4000-8000-000000000003', 'test-p3@thh.invalid'),
  ('00000000-0000-4000-8000-0000000000ee', 'test-stranger@thh.invalid');
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000000a1';
update public.profiles set full_name = 'Test Passenger One', emergency_contact_name = 'Sister', emergency_contact_phone = '9000000009'
 where id = '00000000-0000-4000-8000-000000000001';
insert into public.driver_profiles (user_id, full_name, phone, is_verified) values
  ('00000000-0000-4000-8000-0000000000d1', 'Ramesh Test Driver', '9000000001', true),
  ('00000000-0000-4000-8000-0000000000d2', 'Unverified Driver', '9000000002', false);
select pg_temp.put('ertiga', (select vv.id from public.vehicle_variants vv join public.vehicle_models mo on mo.id = vv.model_id
                            where mo.name = 'Ertiga' and vv.variant = 'Standard' and vv.model_year is null));

-- ── Driver side ──
select pg_temp.login('00000000-0000-4000-8000-0000000000d1');
select pg_temp.err($q$ insert into public.vehicles (owner_id, vehicle_type, model, registration_no, seats, variant_id)
  values ('00000000-0000-4000-8000-0000000000d1', 'ertiga', 'x', 'UK07AB1234', 7, pg_temp.id('ertiga')) $q$,
  'only 6 passenger seats', '01 vehicle: more seats than the catalog allows is refused');
insert into public.vehicles (owner_id, vehicle_type, model, registration_no, seats, variant_id)
values ('00000000-0000-4000-8000-0000000000d1', 'ertiga', 'x', 'uk 07 ab 1234', 6, pg_temp.id('ertiga'));
select pg_temp.put('veh', (select id from public.vehicles where owner_id = '00000000-0000-4000-8000-0000000000d1' order by created_at desc limit 1));
select pg_temp.ok((select model = 'Maruti Suzuki Ertiga' from public.vehicles where id = pg_temp.id('veh')), '02 vehicle: name taken from the catalog');

select pg_temp.err($q$ insert into public.cab_rides (driver_id, vehicle_id, pickup_point, drop_point, departure_at, vehicle_model, vehicle_type, seats_total, price_per_seat, from_geo, to_geo)
  values ('00000000-0000-4000-8000-0000000000d1', pg_temp.id('veh'), 'Delhi', 'Deghat', pg_temp.tomorrow('06:00'), 'Ertiga', 'ertiga', 7, 900,
          '{"name":"Delhi","lat":28.61,"lng":77.21}', '{"name":"Deghat","lat":29.87,"lng":79.21}') $q$,
  'only 6 passenger seats', '03 publish: more seats than the vehicle is refused');

-- Ride 1: Delhi → Moradabad → Ramnagar → Deghat, 6 seats, driver accepts requests.
with x as (insert into public.cab_rides (driver_id, vehicle_id, pickup_point, drop_point, departure_at, vehicle_model, vehicle_type, seats_total, price_per_seat,
                              auto_confirm, from_geo, to_geo, route_line, distance_km, duration_min)
values ('00000000-0000-4000-8000-0000000000d1', pg_temp.id('veh'), 'Delhi', 'Deghat', pg_temp.tomorrow('06:00'), 'Ertiga', 'ertiga', 6, 900, false,
        '{"name":"Delhi","lat":28.61,"lng":77.21}', '{"name":"Deghat","lat":29.87,"lng":79.21}',
        '[[28.61,77.21],[28.67,77.45],[28.84,78.77],[29.39,79.13],[29.87,79.21]]', 345.2, 480) returning id)
select pg_temp.put('r1', (select id from x));
select pg_temp.ok((select ride_ref ~ '^UK07-[0-9]{4}-[0-9]{4}-THH-[0-9]{4,}$' from public.cab_rides where id = pg_temp.id('r1')), '04 ride ID format UK07-DDMM-YYYY-THH-NNNN',
                  (select ride_ref from public.cab_rides where id = pg_temp.id('r1')));
update public.cab_rides set ride_ref = 'HACK', notes = 'Ride notes' where id = pg_temp.id('r1');
select pg_temp.ok((select ride_ref <> 'HACK' from public.cab_rides where id = pg_temp.id('r1')), '05 ride ID cannot be changed');
select pg_temp.err($q$ update public.cab_rides set status = 'completed' where id = pg_temp.id('r1') $q$, 'Start ride', '06 driver cannot mark a ride completed directly');

-- Ride 2: 4 seats, Instant Book (the brief's seat example).
with x as (insert into public.cab_rides (driver_id, vehicle_id, pickup_point, drop_point, departure_at, vehicle_model, vehicle_type, seats_total, price_per_seat,
                              auto_confirm, from_geo, to_geo)
values ('00000000-0000-4000-8000-0000000000d1', pg_temp.id('veh'), 'Haldwani', 'Almora', pg_temp.tomorrow('09:00'), 'Ertiga', 'ertiga', 4, 400, true,
        '{"name":"Haldwani","lat":29.22,"lng":79.51}', '{"name":"Almora","lat":29.6,"lng":79.66}') returning id)
select pg_temp.put('r2', (select id from x));
reset role;

select pg_temp.login('00000000-0000-4000-8000-0000000000d2');
insert into public.vehicles (owner_id, vehicle_type, model, registration_no, seats) values ('00000000-0000-4000-8000-0000000000d2', 'swift', 'Swift', 'UK04X1', 4);
select pg_temp.err($q$ insert into public.cab_rides (driver_id, vehicle_id, pickup_point, drop_point, departure_at, vehicle_model, vehicle_type, seats_total, price_per_seat, from_geo, to_geo)
  values ('00000000-0000-4000-8000-0000000000d2', (select id from public.vehicles where owner_id = '00000000-0000-4000-8000-0000000000d2' limit 1), 'A', 'B', pg_temp.tomorrow('07:00'),
          'Swift', 'swift', 3, 500, '{"name":"A","lat":29.1,"lng":79.5}', '{"name":"B","lat":29.5,"lng":79.6}') $q$,
  'waiting for verification', '07 unverified driver cannot publish rides');
reset role;

-- ── Booking: seats, IDs, holds ──
select pg_temp.login('00000000-0000-4000-8000-000000000001');
select pg_temp.put('b1', (select (public.request_cab_ride(pg_temp.id('r1'), '{1,2}', 'Test Passenger One', '9876543210')).id));
reset role;
select pg_temp.ok((select booking_ref ~ '^THH-[0-9]{8}-[0-9]{4,}$' and booking_code = booking_ref from public.cab_bookings where id = pg_temp.id('b1')),
                  '08 booking ID format THH-DDMMYYYY-NNNN', (select booking_ref from public.cab_bookings where id = pg_temp.id('b1')));
select pg_temp.ok((select substr(booking_ref, 5, 8) = to_char(now() at time zone 'Asia/Kolkata', 'DDMMYYYY') from public.cab_bookings where id = pg_temp.id('b1')), '09 booking ID carries today''s date');
select pg_temp.ok((select status = 'pending' and hold_expires_at between now() + interval '14 minutes' and now() + interval '16 minutes'
                     from public.cab_bookings where id = pg_temp.id('b1')), '10 request holds seats for 15 minutes');

select pg_temp.login('00000000-0000-4000-8000-000000000001');
select (public.request_cab_ride(pg_temp.id('r2'), '{1,2}', 'Test Passenger One', '9876543210')).id;
reset role;
select pg_temp.login('00000000-0000-4000-8000-000000000002');
select pg_temp.put('b2', (select (public.request_cab_ride(pg_temp.id('r1'), '{3}', 'Test Passenger Two', '9876543211')).id));
select (public.request_cab_ride(pg_temp.id('r2'), '{3}', 'Test Passenger Two', '9876543211')).id;
reset role;
select pg_temp.ok((select seats_total - seats_booked = 1 from public.cab_rides where id = pg_temp.id('r2')), '11 4 seats − 2 − 1 = 1 seat left');
select pg_temp.login('00000000-0000-4000-8000-000000000003');
select pg_temp.err($q$ select public.request_cab_ride(pg_temp.id('r2'), '{4,1}', 'Test Passenger Three', '9876543212') $q$,
  'just been taken', '12 asking for 2 seats when 1 is left is refused');
reset role;
select pg_temp.ok((select seats_booked = 3 from public.cab_rides where id = pg_temp.id('r2')), '13 refused booking did not change the seat count');
select pg_temp.ok((select count(distinct booking_ref) = count(*) from public.cab_bookings), '14 every booking ID is unique');

-- Hold runs out: the job releases the seat.
alter table public.cab_bookings disable trigger cab_bookings_ref;
update public.cab_bookings set hold_expires_at = now() - interval '1 minute' where id = pg_temp.id('b2');
alter table public.cab_bookings enable trigger cab_bookings_ref;
select pg_temp.ok(private.expire_cab_holds() >= 1, '15 expiry job runs');
select pg_temp.ok((select status = 'expired' from public.cab_bookings where id = pg_temp.id('b2'))
              and (select seats_booked = 2 from public.cab_rides where id = pg_temp.id('r1'))
              and not exists (select 1 from public.cab_seat_holds where booking_id = pg_temp.id('b2') and released_at is null),
                  '16 expired request released its seat');
select pg_temp.login('00000000-0000-4000-8000-0000000000d1');
select pg_temp.err($q$ select public.respond_cab_request(pg_temp.id('b2'), true) $q$, 'already been answered', '17 expired request cannot be accepted');
reset role;
-- Accepting after 15 minutes but before the job ran is also refused.
select pg_temp.login('00000000-0000-4000-8000-000000000003');
select pg_temp.put('b3', (select (public.request_cab_ride(pg_temp.id('r1'), '{4}', 'Test Passenger Three', '9876543212')).id));
reset role;
alter table public.cab_bookings disable trigger cab_bookings_ref;
update public.cab_bookings set hold_expires_at = now() - interval '1 second' where id = pg_temp.id('b3');
alter table public.cab_bookings enable trigger cab_bookings_ref;
select pg_temp.login('00000000-0000-4000-8000-0000000000d1');
select pg_temp.err($q$ select public.respond_cab_request(pg_temp.id('b3'), true) $q$, 'expired', '18 request past 15 minutes cannot be accepted');
select (public.respond_cab_request(pg_temp.id('b1'), true)).status;
reset role;
select pg_temp.ok((select status = 'confirmed' from public.cab_bookings where id = pg_temp.id('b1')), '19 driver accepts a request in time');

-- ── Privacy ──
select pg_temp.login('00000000-0000-4000-8000-0000000000ee');
select pg_temp.ok((select count(*) = 0 from public.cab_bookings), '20 stranger sees no bookings');
select pg_temp.ok((select count(*) = 0 from public.driver_profiles), '21 stranger sees no driver phone numbers');
select pg_temp.ok((select count(*) = 0 from public.vehicles), '22 stranger sees no registration numbers');
update public.cab_bookings set status = 'cancelled' where id = pg_temp.id('b1');
reset role;
select pg_temp.ok((select status = 'confirmed' from public.cab_bookings where id = pg_temp.id('b1')), '23 stranger cannot change a booking');
select pg_temp.login('00000000-0000-4000-8000-000000000001');
update public.cab_bookings set status = 'completed', seats = 1 where id = pg_temp.id('b1');
reset role;
select pg_temp.ok((select status = 'confirmed' and seats = 2 from public.cab_bookings where id = pg_temp.id('b1')), '24 passenger cannot edit a booking directly');

-- ── Route matching (50 km corridor) ──
set local role anon;
select pg_temp.ok(exists (select 1 from public.match_cab_rides(28.65, 77.19, 29.87, 79.21, ((now() at time zone 'Asia/Kolkata')::date + 1), 2) m where m.ride_id = pg_temp.id('r1')),
                  '25 Delhi (Karol Bagh) → Deghat finds the ride');
select pg_temp.ok(exists (select 1 from public.match_cab_rides(28.84, 78.77, 29.39, 79.13, ((now() at time zone 'Asia/Kolkata')::date + 1), 1) m where m.ride_id = pg_temp.id('r1')),
                  '26 Moradabad → Ramnagar (on the way) finds the ride');
select pg_temp.ok(not exists (select 1 from public.match_cab_rides(29.87, 79.21, 28.65, 77.19, ((now() at time zone 'Asia/Kolkata')::date + 1), 1) m where m.ride_id = pg_temp.id('r1')),
                  '27 opposite direction (Deghat → Delhi) is not matched');
select pg_temp.ok(not exists (select 1 from public.match_cab_rides(27.18, 78.01, 29.87, 79.21, ((now() at time zone 'Asia/Kolkata')::date + 1), 1) m where m.ride_id = pg_temp.id('r1')),
                  '28 Agra (far from the route) is not matched');
select pg_temp.ok(not exists (select 1 from public.match_cab_rides(28.65, 77.19, 30.32, 78.03, ((now() at time zone 'Asia/Kolkata')::date + 1), 1) m where m.ride_id = pg_temp.id('r1')),
                  '29 destination off the route (Dehradun) is not matched');
select pg_temp.ok(not exists (select 1 from public.match_cab_rides(28.65, 77.19, 29.87, 79.21, ((now() at time zone 'Asia/Kolkata')::date + 2), 1) m where m.ride_id = pg_temp.id('r1')),
                  '30 another date is not matched');
select pg_temp.ok(not exists (select 1 from public.match_cab_rides(28.65, 77.19, 29.87, 79.21, ((now() at time zone 'Asia/Kolkata')::date + 1), 5) m where m.ride_id = pg_temp.id('r1')),
                  '31 more seats than left is not matched');
select pg_temp.err($q$ select public.raise_sos(pg_temp.id('r1')) $q$, 'permission denied', '32 visitors (not signed in) cannot send SOS');
reset role;

-- ── Ride day: start, live sharing, SOS, complete ──
select pg_temp.login('00000000-0000-4000-8000-0000000000d1');
select pg_temp.err($q$ select public.start_cab_ride(pg_temp.id('r1')) $q$, '3 hours', '33 ride cannot start a day early');
reset role;
update public.cab_rides set departure_at = now() + interval '1 hour' where id = pg_temp.id('r1');

select pg_temp.login('00000000-0000-4000-8000-000000000001');
select pg_temp.put('tok', null);
create temp table share (j jsonb); grant all on share to authenticated, anon;
insert into share select public.start_live_share(pg_temp.id('b1'));
reset role;
select pg_temp.ok((select char_length(j ->> 'token') = 48 from share), '34 passenger gets a secure 48-character share link');
select pg_temp.login('00000000-0000-4000-8000-0000000000d1');
select pg_temp.ok(public.post_live_position(pg_temp.id('r1'), 28.70, 77.50, 15), '35 driver location is saved near departure time');
select (public.start_cab_ride(pg_temp.id('r1'))).status;
reset role;
select pg_temp.ok((select status = 'started' from public.cab_rides where id = pg_temp.id('r1'))
              and (select status = 'expired' from public.cab_bookings where id = pg_temp.id('b3')), '36 start ride; unanswered requests close');
set local role anon;
select pg_temp.ok((select (public.get_live_share(j ->> 'token')) ->> 'active' = 'true' from share), '37 trusted contact can open the live link');
select pg_temp.ok((select (public.get_live_share(j ->> 'token'))::text !~* '98765|9000000|UK07AB1234|AB1234' from share), '38 live link shows no phone or registration number');
select pg_temp.ok((select (public.get_live_share(j ->> 'token')) -> 'position' ->> 'from' = 'driver' from share), '39 live link shows the car position');
select pg_temp.ok((public.get_live_share(repeat('a', 48))) ->> 'active' = 'false', '40 a guessed link shows nothing');
reset role;
select pg_temp.login('00000000-0000-4000-8000-0000000000ee');
select pg_temp.err($q$ select public.post_live_position(pg_temp.id('r1'), 28.7, 77.5) $q$, 'Only people on this ride', '41 stranger cannot post a location');
select pg_temp.ok((select count(*) = 0 from public.cab_live_positions), '42 stranger cannot read ride locations');
select pg_temp.err($q$ select public.raise_sos(pg_temp.id('r1'), 28.7, 77.5) $q$, 'Only people on this ride', '43 stranger cannot send SOS for a ride');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000001');
select pg_temp.err($q$ select public.cancel_cab_booking(pg_temp.id('b1')) $q$, 'already (started|left)', '44 booking cannot be cancelled once the ride started');
create temp table sos (j jsonb); grant all on sos to authenticated;
insert into sos select public.raise_sos(pg_temp.id('r1'), 28.71, 77.52, 20, 'Test SOS');
reset role;
select pg_temp.ok((select (j ->> 'delivered')::boolean and (j ->> 'alerted')::int >= 1 from sos), '45 SOS reaches THH admins (delivered = true only when sent)');
select pg_temp.ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-8000-0000000000a1' and title like 'SOS:%'), '46 admin got the SOS alert');
select pg_temp.ok((select emergency_phone = '9000000009' and booking_id = pg_temp.id('b1') and lat = 28.71 from public.sos_incidents where id = (select (j ->> 'id')::uuid from sos)),
                  '47 SOS stores booking, location and emergency contact');
select pg_temp.login('00000000-0000-4000-8000-000000000001');
select pg_temp.ok((public.raise_sos(pg_temp.id('r1'), 28.72, 77.53)) ->> 'repeat' = 'true', '48 pressing SOS again does not create duplicates');
select pg_temp.err($q$ select public.admin_update_sos((select (j ->> 'id')::uuid from pg_temp.sos), 'resolved') $q$, 'Admins only', '49 passenger cannot close an SOS as admin');
reset role;
select pg_temp.login('00000000-0000-4000-8000-0000000000a1');
select pg_temp.err($q$ select public.admin_update_sos((select (j ->> 'id')::uuid from pg_temp.sos), 'resolved') $q$,
  'status has changed', 'Monitor: open incident must be acknowledged before resolution');
select (public.admin_update_sos((select (j ->> 'id')::uuid from sos), 'acknowledged', 'Called the passenger')).status;
reset role;
select pg_temp.ok((select status = 'acknowledged' and handled_by = '00000000-0000-4000-8000-0000000000a1' from public.sos_incidents where id = (select (j ->> 'id')::uuid from sos)),
                  '50 admin acknowledges SOS');
select pg_temp.ok(exists (select 1 from public.audit_log where table_name = 'sos_incidents' and actor = '00000000-0000-4000-8000-0000000000a1'), '51 admin action is in the audit log');

select pg_temp.login('00000000-0000-4000-8000-000000000001');
select pg_temp.err($q$ select public.submit_cab_feedback(pg_temp.id('b1'), 5) $q$, 'after the ride is completed', '52 no feedback before the ride is completed');
reset role;
select pg_temp.login('00000000-0000-4000-8000-0000000000d1');
select (public.complete_cab_ride(pg_temp.id('r1'))).status;
reset role;
select pg_temp.ok((select status = 'completed' from public.cab_bookings where id = pg_temp.id('b1')), '53 complete ride completes confirmed bookings');
set local role anon;
select pg_temp.ok((select (public.get_live_share(j ->> 'token')) ->> 'active' = 'false' from share), '54 live link stops when the ride is complete');
reset role;

-- ── Feedback and reliability ──
select pg_temp.login('00000000-0000-4000-8000-000000000001');
select pg_temp.ok((select count(*) = 1 from public.my_pending_feedback()), '55 passenger sees the ride waiting for feedback');
select (public.submit_cab_feedback(pg_temp.id('b1'), 5, '{"behaviour":5,"safety":5,"punctuality":4,"cleanliness":5,"overall":5,"hack":99}', 'Very safe driving')).stars;
select pg_temp.ok((select ratings ? 'hack' = false and (ratings ->> 'punctuality')::int = 4 from public.cab_feedback where booking_id = pg_temp.id('b1') and from_role = 'passenger'),
                  '56 feedback saved; unknown fields dropped');
select pg_temp.err($q$ select public.submit_cab_feedback(pg_temp.id('b1'), 1) $q$, 'already given feedback', '57 only one feedback per person per ride');
select pg_temp.ok((select count(*) = 0 from public.my_pending_feedback()), '58 nothing pending after feedback');
reset role;
select pg_temp.login('00000000-0000-4000-8000-000000000002');
select pg_temp.err($q$ select public.submit_cab_feedback(pg_temp.id('b2'), 5) $q$, 'after the ride is completed', '59 expired / cancelled bookings cannot be reviewed');
reset role;
select pg_temp.login('00000000-0000-4000-8000-0000000000d1');
select (public.submit_cab_feedback(pg_temp.id('b1'), 4, '{"behaviour":4,"communication":5}', 'On time')).from_role;
reset role;
select pg_temp.ok((select count(*) = 2 from public.cab_feedback where booking_id = pg_temp.id('b1')), '60 driver also rates the passenger');
set local role anon;
create temp table rel (j jsonb); grant all on rel to anon;
insert into rel select public.driver_reliability('00000000-0000-4000-8000-0000000000d1');
reset role;
select pg_temp.ok((select (j ->> 'completed_rides')::int = 1 and (j ->> 'passengers_served')::int = 2 and (j ->> 'reviews')::int = 1 and (j ->> 'avg_rating')::numeric = 5 from rel),
                  '61 reliability uses real rides and reviews', (select j::text from rel));
select pg_temp.ok((select j ->> 'level' = 'new' and j -> 'score' = 'null'::jsonb from rel), '62 new driver shows "not enough history", not a score');

-- ── Driver documents ──
select pg_temp.login('00000000-0000-4000-8000-0000000000d1');
insert into public.driver_documents (user_id, doc_type, doc_number, file_path, status)
values ('00000000-0000-4000-8000-0000000000d1', 'driving_licence', 'UK0720230001', '00000000-0000-4000-8000-0000000000d1/licence.jpg', 'approved');
select pg_temp.ok((select status = 'pending' from public.driver_documents where user_id = '00000000-0000-4000-8000-0000000000d1'), '63 driver cannot approve own document');
select pg_temp.err($q$ insert into public.driver_documents (user_id, doc_type, file_path) values ('00000000-0000-4000-8000-0000000000d1', 'vehicle_rc', 'someone-else/rc.jpg') $q$,
  'own folder', '64 document must be in the driver''s own folder');
reset role;
select pg_temp.login('00000000-0000-4000-8000-0000000000ee');
select pg_temp.ok((select count(*) = 0 from public.driver_documents), '65 stranger cannot see documents');
reset role;
select pg_temp.login('00000000-0000-4000-8000-0000000000a1');
update public.driver_documents set status = 'approved' where user_id = '00000000-0000-4000-8000-0000000000d1';
reset role;
select pg_temp.ok((select status = 'approved' and reviewed_by = '00000000-0000-4000-8000-0000000000a1' from public.driver_documents where user_id = '00000000-0000-4000-8000-0000000000d1'),
                  '66 admin approves a document (reviewer recorded)');

-- ── Admin Cab Monitor ──
select pg_temp.login('00000000-0000-4000-8000-0000000000ee');
select pg_temp.ok(not exists (select 1 from public.sos_incidents where id = (select (j ->> 'id')::uuid from sos)), 'Monitor: unrelated user cannot see the incident');
reset role;
select pg_temp.login('00000000-0000-4000-8000-0000000000a1');
select pg_temp.err($q$ select public.admin_update_sos((select (j ->> 'id')::uuid from pg_temp.sos), 'acknowledged') $q$,
  'status has changed', 'Monitor: repeat acknowledgement is rejected');
select pg_temp.ok((public.admin_update_sos((select (j ->> 'id')::uuid from sos), 'resolved', 'Passenger confirmed safe')).status = 'resolved',
  'Monitor: admin resolves an acknowledged incident');
select pg_temp.err($q$ select public.admin_update_sos((select (j ->> 'id')::uuid from pg_temp.sos), 'resolved') $q$,
  'status has changed', 'Monitor: repeat resolution is rejected');
reset role;
select pg_temp.ok((select count(*) = 2 from public.notifications
  where user_id = '00000000-0000-4000-8000-000000000001'
    and title in ('THH support has seen your SOS', 'Your SOS has been closed by THH support')
    and link = '/cab/bookings'), 'Monitor: exactly one notification per transition');
select pg_temp.ok(exists (select 1 from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sos_incidents'), 'Monitor: SOS incidents are published to Realtime');

-- ── Catalog and settings ──
select pg_temp.login('00000000-0000-4000-8000-0000000000d1');
select pg_temp.err($q$ insert into public.vehicle_makes (name) values ('Fake Motors') $q$, 'row-level security', '67 drivers cannot edit the vehicle catalog');
reset role;
select pg_temp.ok((select count(*) >= 12 from public.vehicle_makes) and (select bool_and(not is_verified) from public.vehicle_variants), '68 starter catalog added, all marked unverified');
select pg_temp.ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cab_rides'), '69 live seat updates switched on');
select pg_temp.ok(exists (select 1 from cron.job where jobname = 'thh-cab-housekeeping' and schedule = '* * * * *'), '70 expiry job scheduled every minute');

select n, name, ok, info from r order by n;
