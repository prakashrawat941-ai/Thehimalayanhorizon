-- Clean start: remove the previous site's tables, functions and storage rules
-- (chosen by the owner on 2026-11-19). User accounts in auth.users are kept.

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists
  public.audit_logs, public.contact_messages, public.team_members, public.ads,
  public.reviews, public.listing_media, public.listings, public.home_sections,
  public.site_settings, public.media, public.cab_requests, public.trip_plans,
  public.bookings, public.profiles
  cascade;

drop function if exists
  public.audit_row() , public.create_booking, public.guard_booking_update(),
  public.handle_new_user(), public.is_admin(), public.is_staff(),
  public.protect_profile_role(), public.touch_updated_at()
  cascade;

drop policy if exists media_bucket_staff_select on storage.objects;
drop policy if exists media_bucket_staff_insert on storage.objects;
drop policy if exists media_bucket_staff_update on storage.objects;
drop policy if exists media_bucket_staff_delete on storage.objects;
