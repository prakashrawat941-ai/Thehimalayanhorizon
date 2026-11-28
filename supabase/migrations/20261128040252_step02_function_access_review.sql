-- Step 02 · 05 · Elevated-function access review (Phase 2 security priority).
-- Review of all SECURITY DEFINER functions in public: see docs/step-02-phase2-report.md §Security.
-- 13 anonymously callable: 11 power public pages and return no personal data; get_live_share is the
-- token-protected live-ride link for trusted contacts (tests/db/cab-phase2-test.sql 37–40, 54).
-- cab_ride_seat_status is not used by any public page: anonymous access is removed (signed-in access kept).
revoke execute on function public.cab_ride_seat_status(uuid) from public, anon;
grant execute on function public.cab_ride_seat_status(uuid) to authenticated;
