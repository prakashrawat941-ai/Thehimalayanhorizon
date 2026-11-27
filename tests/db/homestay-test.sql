-- Homestay partner + admin: database rules and money test. Run inside a transaction that is ROLLED BACK.
-- Output: one row per check (ok true/false).
create temp table r (n serial, name text, ok boolean, info text);
create temp table ids (k text primary key, v uuid);
create temp table js (k text primary key, j jsonb);
grant all on r, ids, js to anon, authenticated; grant usage, select on sequence r_n_seq to anon, authenticated;
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
create function pg_temp.j(key text) returns jsonb language sql stable as $$ select j from pg_temp.js where k = key $$;
create function pg_temp.putj(key text, val jsonb) returns void language sql as $$ insert into pg_temp.js values (key, val) on conflict (k) do update set j = excluded.j $$;
-- A Monday 2–3 weeks ahead, so Mon→Thu are weekday nights.
create function pg_temp.mon() returns date language sql stable as $$ select (current_date + 14 + ((8 - extract(isodow from current_date)::int) % 7))::date $$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'test-admin@thh.invalid'),
  ('00000000-0000-4000-8000-0000000000b1', 'test-host@thh.invalid'),
  ('00000000-0000-4000-8000-0000000000b2', 'test-host2@thh.invalid'),
  ('00000000-0000-4000-8000-000000000001', 'test-guest1@thh.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'test-guest2@thh.invalid'),
  ('00000000-0000-4000-8000-0000000000ee', 'test-stranger@thh.invalid');
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000000a1';
insert into public.partners (owner_id, business_name, contact_name, phone, email, categories, status, created_by) values
  ('00000000-0000-4000-8000-0000000000b1', 'Test Pine Homestay', 'Host One', '9000000101', 'h1@thh.invalid', '{homestay}', 'approved', '00000000-0000-4000-8000-0000000000b1'),
  ('00000000-0000-4000-8000-0000000000b2', 'Other Host', 'Host Two', '9000000102', 'h2@thh.invalid', '{homestay}', 'approved', '00000000-0000-4000-8000-0000000000b2');
select pg_temp.put('p1', (select id from public.partners where owner_id = '00000000-0000-4000-8000-0000000000b1'));
select pg_temp.put('p2', (select id from public.partners where owner_id = '00000000-0000-4000-8000-0000000000b2'));

-- ── Property ──
select pg_temp.login('00000000-0000-4000-8000-0000000000b1');
with x as (insert into public.homestays (partner_id, name, village, district, summary, description, rooms, max_guests, price_per_night, status, commission_rate)
  values (pg_temp.id('p1'), 'Test Pine House', 'Deghat', 'Almora', 'Quiet pine house', 'A test homestay', 2, 6, 2000, 'approved', 5) returning id)
select pg_temp.put('h1', (select id from x));
reset role;
select pg_temp.ok((select status = 'pending' and commission_rate = 12 from public.homestays where id = pg_temp.id('h1')), '01 new property goes to review; host cannot set own commission');
select pg_temp.login('00000000-0000-4000-8000-0000000000b1');
update public.homestays set status = 'approved', commission_rate = 1, admin_note = 'self' where id = pg_temp.id('h1');
reset role;
select pg_temp.ok((select status = 'pending' and commission_rate = 12 and admin_note = '' from public.homestays where id = pg_temp.id('h1')), '02 host cannot approve own property or change commission');
select pg_temp.login('00000000-0000-4000-8000-0000000000a1');
update public.homestays set status = 'approved', commission_rate = 15, admin_note = 'Looks great' where id = pg_temp.id('h1');
reset role;
select pg_temp.ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-8000-0000000000b1' and title like 'Property approved%'), '03 admin approves; host is notified');

-- ── Rooms and rate calendar ──
select pg_temp.login('00000000-0000-4000-8000-0000000000b1');
with x as (insert into public.homestay_rooms (homestay_id, room_type, base_price, weekend_price, max_guests, total_inventory)
  values (pg_temp.id('h1'), 'Deluxe valley view', 2000, 2600, 3, 2) returning id) select pg_temp.put('room', (select id from x));
insert into public.room_rates (room_id, date, custom_price) values (pg_temp.id('room'), pg_temp.mon() + 1, 3000);
insert into public.room_rates (room_id, date, blocked_units) values (pg_temp.id('room'), pg_temp.mon() + 2, 9);
reset role;
select pg_temp.ok((select blocked_units = 2 from public.room_rates where room_id = pg_temp.id('room') and date = pg_temp.mon() + 2), '04 blocking more rooms than exist is capped');
select pg_temp.login('00000000-0000-4000-8000-0000000000b2');
select pg_temp.err($q$ insert into public.homestay_rooms (homestay_id, room_type, base_price) values (pg_temp.id('h1'), 'Hack room', 1) $q$, 'row-level security', '05 another host cannot add rooms to this property');
select pg_temp.ok((select count(*) = 0 from public.room_rates), '06 another host cannot see this rate calendar');
reset role;

set local role anon;
select pg_temp.putj('q1', public.quote_homestay(pg_temp.id('room'), pg_temp.mon(), pg_temp.mon() + 2, 1));
select pg_temp.putj('qw', public.quote_homestay(pg_temp.id('room'), pg_temp.mon() + 4, pg_temp.mon() + 6, 1));
reset role;
select pg_temp.ok((pg_temp.j('q1') ->> 'total')::int = 5000 and (pg_temp.j('q1') ->> 'nights')::int = 2, '07 price: base Mon (2000) + custom Tue (3000) = 5000', pg_temp.j('q1')::text);
select pg_temp.ok((pg_temp.j('qw') ->> 'total')::int = 5200, '08 weekend price for Fri and Sat nights (2600 + 2600)', pg_temp.j('qw')::text);

-- ── Booking requests ──
select pg_temp.login('00000000-0000-4000-8000-000000000001');
with x as (insert into public.booking_requests (kind, homestay_id, room_id, rooms_booked, guest_name, guest_phone, start_date, end_date, guests)
  values ('homestay', pg_temp.id('h1'), pg_temp.id('room'), 1, 'Guest One', '9876500001', pg_temp.mon(), pg_temp.mon() + 2, 2) returning id) select pg_temp.put('b1', (select id from x));
select pg_temp.err($q$ insert into public.booking_requests (kind, homestay_id, room_id, rooms_booked, guest_name, guest_phone, start_date, end_date, guests)
  values ('homestay', pg_temp.id('h1'), pg_temp.id('room'), 1, 'Guest One', '9876500001', pg_temp.mon(), pg_temp.mon() + 1, 5) $q$, 'Up to 3 guests', '09 too many guests for the room is refused');
select pg_temp.err($q$ insert into public.booking_requests (kind, homestay_id, room_id, rooms_booked, guest_name, guest_phone, start_date, end_date, guests)
  values ('homestay', pg_temp.id('h1'), pg_temp.id('room'), 1, 'Guest One', '9876500001', pg_temp.mon() + 2, pg_temp.mon() + 3, 2) $q$, 'Not enough rooms', '10 fully blocked date cannot be requested');
select pg_temp.ok((select guest_phone is null from public.booking_requests where id=pg_temp.id('b1'))
  and exists (select 1 from public.booking_guest_phones(array[pg_temp.id('b1')]) where guest_phone='9876500001'),
  'PP1 guest can retrieve their private contact while request row is masked');
reset role;
select pg_temp.ok((select booking_code ~ '^THH-H-[0-9]{8}-[0-9]{4,}$' and status = 'requested' and total_amount = 5000 and platform_commission is null from public.booking_requests where id = pg_temp.id('b1')),
                  '11 request gets a THH-H code and a price estimate', (select booking_code from public.booking_requests where id = pg_temp.id('b1')));

select pg_temp.login('00000000-0000-4000-8000-0000000000b1');
select pg_temp.ok((select guest_phone is null from public.booking_requests where id=pg_temp.id('b1'))
  and not exists (select 1 from public.booking_guest_phones(array[pg_temp.id('b1')])),
  'PP1 partner cannot read a requested guest phone via the table or the contact RPC');
select pg_temp.ok((public.set_booking_status(pg_temp.id('b1'), 'confirmed', 'See you')).guest_phone='9876500001',
  'PP1 phone appears in the confirmed RPC result');
insert into public.room_rates(room_id, date, blocked_units) values (pg_temp.id('room'), pg_temp.mon(), 2)
on conflict(room_id, date) do update set blocked_units=excluded.blocked_units;
select pg_temp.ok((select blocked_units=1 from public.room_rates where room_id=pg_temp.id('room') and date=pg_temp.mon()),
  'PP2 a confirmed booking leaves only the unbooked room closable');
delete from public.room_rates where room_id=pg_temp.id('room') and date=pg_temp.mon();
reset role;
select pg_temp.ok((select status = 'confirmed' and total_amount = 5000 and commission_rate = 15 and platform_commission = 750 and partner_payout_amount = 4250 from public.booking_requests where id = pg_temp.id('b1')),
                  '12 confirm fixes amount 5000, commission 15% = 750, host payout 4250');
select pg_temp.login('00000000-0000-4000-8000-0000000000b1');
update public.booking_requests set total_amount = 99999, partner_payout_amount = 99999, payout_status = 'paid' where id = pg_temp.id('b1');
reset role;
select pg_temp.ok((select total_amount = 5000 and payout_status = 'unpaid' from public.booking_requests where id = pg_temp.id('b1')), '13 host cannot edit amounts or payout status');
select pg_temp.login('00000000-0000-4000-8000-0000000000b1');
select pg_temp.err($q$ select public.set_booking_status(pg_temp.id('b1'), 'checked_in') $q$, 'from the check-in date', '14 guest cannot be checked in before the check-in date');
reset role;

-- Two rooms on Monday: one booked, one left. Two guests each ask for that last room; only one confirmation succeeds.
select pg_temp.login('00000000-0000-4000-8000-000000000002');
with x as (insert into public.booking_requests (kind, homestay_id, room_id, rooms_booked, guest_name, guest_phone, start_date, end_date, guests)
  values ('homestay', pg_temp.id('h1'), pg_temp.id('room'), 1, 'Guest Two', '9876500002', pg_temp.mon(), pg_temp.mon() + 1, 2) returning id) select pg_temp.put('b2', (select id from x));
reset role;
select pg_temp.login('00000000-0000-4000-8000-0000000000ee');
with x as (insert into public.booking_requests (kind, homestay_id, room_id, rooms_booked, guest_name, guest_phone, start_date, end_date, guests)
  values ('homestay', pg_temp.id('h1'), pg_temp.id('room'), 1, 'Guest Three', '9876500003', pg_temp.mon(), pg_temp.mon() + 1, 1) returning id) select pg_temp.put('b3', (select id from x));
reset role;
select pg_temp.login('00000000-0000-4000-8000-0000000000b1');
select (public.set_booking_status(pg_temp.id('b2'), 'confirmed')).status;
select pg_temp.err($q$ select public.set_booking_status(pg_temp.id('b3'), 'confirmed') $q$, 'Not enough rooms free', '15 last room cannot be confirmed twice (no overbooking)');
reset role;

-- A stay today: check in, complete.
alter table public.booking_requests disable trigger booking_requests_quote;
alter table public.booking_requests disable trigger booking_requests_prepare;
with x as (insert into public.booking_requests (kind, homestay_id, partner_id, room_id, rooms_booked, user_id, guest_name, guest_phone, start_date, end_date, guests, status, booking_code, total_amount)
  values ('homestay', pg_temp.id('h1'), pg_temp.id('p1'), pg_temp.id('room'), 1, '00000000-0000-4000-8000-000000000001', 'Guest Today', '9876500004',
          (now() at time zone 'Asia/Kolkata')::date, (now() at time zone 'Asia/Kolkata')::date + 1, 2, 'requested', 'THH-H-TEST-0001', 2000) returning id) select pg_temp.put('bt', (select id from x));
alter table public.booking_requests enable trigger booking_requests_quote;
alter table public.booking_requests enable trigger booking_requests_prepare;
select pg_temp.login('00000000-0000-4000-8000-0000000000b1');
select (public.set_booking_status(pg_temp.id('bt'), 'confirmed')).status;
select (public.set_booking_status(pg_temp.id('bt'), 'checked_in')).status;
select (public.set_booking_status(pg_temp.id('bt'), 'completed')).status;
reset role;
select pg_temp.ok((select status = 'completed' and checked_in_at is not null and completed_at is not null and partner_payout_amount > 0 from public.booking_requests where id = pg_temp.id('bt')),
                  '16 confirm → check-in → complete today', (select total_amount || '/' || partner_payout_amount from public.booking_requests where id = pg_temp.id('bt')));

-- ── KYC and payouts ──
select pg_temp.login('00000000-0000-4000-8000-0000000000b1');
select pg_temp.err($q$ select public.request_payout(pg_temp.id('p1')) $q$, 'Complete KYC', '17 payout needs verified KYC and bank details');
select pg_temp.err($q$ insert into public.partner_kyc (partner_id, id_type, id_number, bank_ifsc) values (pg_temp.id('p1'), 'pan', 'ABCDE1234F', 'BAD') $q$, 'check constraint', '18 wrong IFSC format is refused');
insert into public.partner_kyc (partner_id, id_type, id_number, id_file, bank_account_name, bank_account_number, bank_ifsc, status)
values (pg_temp.id('p1'), 'pan', 'abcde 1234f', '00000000-0000-4000-8000-0000000000b1/pan.jpg', 'Host One', '1234 5678 9012', 'sbin0001234', 'verified');
reset role;
select pg_temp.ok((select status = 'pending' and bank_ifsc = 'SBIN0001234' and id_number = 'ABCDE1234F' from public.partner_kyc where partner_id = pg_temp.id('p1')), '19 host cannot self-verify KYC; details cleaned');
select pg_temp.login('00000000-0000-4000-8000-0000000000b2');
select pg_temp.ok((select count(*) = 0 from public.partner_kyc), '20 another host cannot see KYC or bank details');
select pg_temp.err($q$ insert into public.partner_kyc (partner_id, id_file) values (pg_temp.id('p1'), 'x/y.jpg') $q$, 'row-level security|own folder', '21 another host cannot write this KYC');
reset role;
select pg_temp.login('00000000-0000-4000-8000-0000000000a1');
update public.partner_kyc set status = 'verified', admin_remark = 'OK' where partner_id = pg_temp.id('p1');
reset role;
select pg_temp.ok((select reviewed_by = '00000000-0000-4000-8000-0000000000a1' from public.partner_kyc where partner_id = pg_temp.id('p1'))
              and exists (select 1 from public.notifications where user_id = '00000000-0000-4000-8000-0000000000b1' and title = 'KYC verified'), '22 admin verifies KYC; host notified');

select pg_temp.login('00000000-0000-4000-8000-0000000000b1');
select pg_temp.put('po', (select (public.request_payout(pg_temp.id('p1'))).id));
select pg_temp.err($q$ select public.request_payout(pg_temp.id('p1')) $q$, 'already have a payout', '23 only one payout request at a time');
select pg_temp.err($q$ select public.admin_process_payout(pg_temp.id('po'), true, 'UTR123') $q$, 'Admins only', '24 host cannot approve own payout');
reset role;
select pg_temp.ok((select amount = (select partner_payout_amount from public.booking_requests where id = pg_temp.id('bt')) and bookings_count = 1 from public.payout_requests where id = pg_temp.id('po'))
              and (select payout_status = 'processing' from public.booking_requests where id = pg_temp.id('bt'))
              and (select payout_status = 'unpaid' from public.booking_requests where id = pg_temp.id('b1')), '25 payout = host share of completed stays only (confirmed future stay not included)');
select pg_temp.login('00000000-0000-4000-8000-0000000000a1');
select pg_temp.err($q$ select public.admin_process_payout(pg_temp.id('po'), true, '') $q$, 'transaction reference', '26 approving needs a transaction reference');
select (public.admin_process_payout(pg_temp.id('po'), true, 'UTR2026112201')).status;
reset role;
select pg_temp.ok((select payout_status = 'paid' from public.booking_requests where id = pg_temp.id('bt'))
              and exists (select 1 from public.notifications where user_id = '00000000-0000-4000-8000-0000000000b1' and title like 'Payout paid%'), '27 approved payout marks stays paid; host notified');
select pg_temp.login('00000000-0000-4000-8000-0000000000ee');
select pg_temp.ok((select count(*) = 0 from public.payout_requests), '28 stranger sees no payouts');
select pg_temp.ok((select count(*) = 0 from public.booking_requests where partner_id = pg_temp.id('p1') and user_id <> '00000000-0000-4000-8000-0000000000ee'), '29 stranger sees only own requests');
select pg_temp.err($q$ select public.admin_homestay_stats() $q$, 'Admins only', '30 only admin sees platform numbers');
reset role;

-- ── Support ──
select pg_temp.login('00000000-0000-4000-8000-0000000000b1');
select pg_temp.put('t1', (select (public.open_ticket('Payout question', 'payout', 'When will I get my money?', pg_temp.id('p1'))).id));
reset role;
select pg_temp.login('00000000-0000-4000-8000-0000000000ee');
select pg_temp.err($q$ select public.post_ticket_message(pg_temp.id('t1'), 'hi') $q$, 'Ticket not found', '31 stranger cannot post in a ticket');
select pg_temp.ok((select count(*) = 0 from public.ticket_messages), '32 stranger cannot read tickets');
reset role;
select pg_temp.login('00000000-0000-4000-8000-0000000000a1');
select (public.post_ticket_message(pg_temp.id('t1'), 'Paid today, reference UTR2026112201.')).is_admin;
select pg_temp.putj('stats', public.admin_homestay_stats());
reset role;
select pg_temp.ok((select status = 'answered' from public.support_tickets where id = pg_temp.id('t1'))
              and exists (select 1 from public.notifications where user_id = '00000000-0000-4000-8000-0000000000b1' and title = 'Reply from THH support'), '33 admin reply marks ticket answered; host notified');
select pg_temp.ok((pg_temp.j('stats') ->> 'gmv')::int = 5000 + (select total_amount from public.booking_requests where id = pg_temp.id('bt')) + (select total_amount from public.booking_requests where id = pg_temp.id('b2'))
              and (pg_temp.j('stats') ->> 'pending_payouts')::int = 0, '34 admin GMV counts confirmed / completed stays', pg_temp.j('stats')::text);
select pg_temp.ok(exists (select 1 from public.audit_log where table_name = 'payout_requests' and actor = '00000000-0000-4000-8000-0000000000a1')
              and exists (select 1 from public.audit_log where table_name = 'homestays' and actor = '00000000-0000-4000-8000-0000000000a1'), '35 admin approvals and payouts are in the audit log');
select pg_temp.login('00000000-0000-4000-8000-0000000000ee'::uuid);
select pg_temp.ok((public.set_booking_status(pg_temp.id('b3'), 'cancelled')).guest_phone is null,
  'PP1 guest cancellation does not return a phone in the booking row');
reset role;
select pg_temp.ok((select count(*) = 8 from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('homestays', 'booking_requests', 'payout_requests', 'partner_kyc', 'support_tickets', 'ticket_messages', 'partners', 'homestay_rooms')),
                  '36 live updates switched on for all queues');

select n, name, ok, info from r order by n;
