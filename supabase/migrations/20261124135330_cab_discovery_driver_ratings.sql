-- Public discovery cards need aggregate review data for the rides already visible to the caller.
create function public.cab_discovery_driver_ratings(p_ride_ids uuid[])
returns table (driver_id uuid, avg_rating numeric, reviews integer, completed_rides integer)
language sql stable security definer set search_path = '' as $$
  with visible_drivers as (
    select distinct r.driver_id
    from public.cab_rides r
    join public.driver_profiles d on d.user_id = r.driver_id and d.status = 'active'
    where r.id = any(p_ride_ids[1:200])
      and (not r.is_test or r.driver_id = (select auth.uid())
        or private.owns_partner(r.partner_id) or (select private.is_admin()))
  )
  select d.driver_id, reviews.avg_rating, reviews.count, trips.count
  from visible_drivers d
  cross join lateral (
    select round(avg(f.stars), 2) as avg_rating, count(*)::integer as count
    from public.cab_feedback f join public.cab_rides r on r.id = f.ride_id and not r.is_test
    where f.to_user = d.driver_id and f.from_role = 'passenger'
  ) reviews
  cross join lateral (
    select count(*)::integer as count
    from public.cab_rides r
    where r.driver_id = d.driver_id and r.status = 'completed' and not r.is_test
      and exists (select 1 from public.cab_bookings b where b.ride_id = r.id and b.status = 'completed')
  ) trips;
$$;

revoke all on function public.cab_discovery_driver_ratings(uuid[]) from public;
grant execute on function public.cab_discovery_driver_ratings(uuid[]) to anon, authenticated;
