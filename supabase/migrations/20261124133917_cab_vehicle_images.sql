-- A reviewed photo may be tied to a specific registered vehicle. Vehicle rows retain their own RLS.
alter table public.vehicle_images
  add column vehicle_id uuid references public.vehicles(id) on delete cascade,
  add constraint vehicle_images_actual_photo_check check (
    vehicle_id is null or (not is_generic and nullif(btrim(licence), '') is not null)
  );

create index vehicle_images_vehicle_idx on public.vehicle_images(vehicle_id) where vehicle_id is not null;

-- Expose only the catalogue variant ID for each already-visible ride.
-- The SECURITY DEFINER is needed to read vehicles protected by owner-only RLS.
create function public.cab_ride_vehicle_variants(p_ride_ids uuid[])
returns table (ride_id uuid, variant_id uuid)
language sql stable security definer set search_path = '' as $$
  select r.id, v.variant_id
  from public.cab_rides r
  join public.vehicles v on v.id = r.vehicle_id
  where r.id = any(p_ride_ids[1:200])
    and v.variant_id is not null
    and (not r.is_test or r.driver_id = (select auth.uid())
      or private.owns_partner(r.partner_id) or (select private.is_admin()));
$$;

revoke all on function public.cab_ride_vehicle_variants(uuid[]) from public;
grant execute on function public.cab_ride_vehicle_variants(uuid[]) to anon, authenticated;
