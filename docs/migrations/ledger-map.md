# Migration ledger map (28 November 2026)

Three different timestamp sets exist for the same migrations: repository filenames, the staging ledger (`gboxcnxgdkcewstkxogt`) and the production ledger (`kjuboknsxlsotzoibdnv`). **Nothing was replayed, renamed in a database, repaired or deleted.** This map is the reconciliation record; release tooling must match by **name and verified content**, never by timestamp.

| Migration name | Repository file version | Staging ledger | Production ledger |
|---|---|---|---|
| `base` | — | — | 20261101000000 |
| `cms` | — | — | 20261105000000 |
| `booking_security` | — | — | 20261105000001 |
| `cms_defaults` | — | — | 20261105000100 |
| `remove_old_site` | 20261119000000 | — | 20261119085509 |
| `core_schema` | 20261119000001 | 20261124083317 | 20261119085707 |
| `private_helpers` | 20261119000002 | 20261124083342 | 20261119085855 |
| `starter_content` | 20261119000003 | 20261124083345 | 20261119090309 |
| `fix_seat_counter` | 20261119000004 | 20261124083347 | 20261119090555 |
| `split_admin_policies` | 20261119000005 | 20261124104921 | 20261119090651 |
| `home_cta_hindi` | 20261119000006 | 20261124110230 | 20261119092357 |
| `cab_step1` | 20261120000000 | 20261124110317 | 20261119162209 |
| `cab_places` | 20261120000001 | 20261124110319 | 20261119162309 |
| `cab_old_functions_guard` | 20261120000002 | 20261124110321 | 20261119163634 |
| `trip_planner` | 20261120000003 | 20261124110410 | 20261120104025 |
| `cab_phase2` | 20261121000000 | 20261124110446 | 20261121044843 |
| `homestay_partner` | 20261122000000 | 20261124110515 | 20261122055905 |
| `contact_messages` | 20261122100000 | 20261124110530 | 20261122071832 |
| `vehicle_master_catalogue` | 20261124112450 | 20261124114841 | 20261124120011 |
| `cab_vehicle_images` | 20261124133917 | 20261124134045 | 20261124134618 |
| `cab_monitor_sos` | 20261124203500 | 20261124151019 | 20261124153034 |
| `cab_discovery_driver_ratings` | 20261124135330 | 20261124135826 | 20261125071445 |
| `cab_booking_retries` | 20261124142000 | 20261124142240 | 20261125071449 |
| `management` | 20261124185212 | 20261124185212 | — |
| `leadership_invitations` | 20261125032017 | 20261125032017 | — |
| `leadership_handoff` | 20261125033652 | 20261125033652 | — |
| `dashboard_integration` | 20261127030300 | 20261127030300 | — |
| `dashboard_privacy` | 20261127030721 | 20261127030721 | — |
| `dashboard_validation` | 20261127031107 | 20261127031107 | — |
| `dashboard_audit` | 20261127031223 | 20261127031223 | — |
| `cab_public_followups` | 20261127041210 | 20261127041210 | — |
| `retain_independent_admin_access` | 20261127043916 | 20261127043916 | — |
| `management_review_fixes` | 20261127160000 | 20261127160000 | — |
| `leadership_employee_login` | 20261127172011 | 20261127172011 | — |
| `partner_booking_privacy_room_caps` | 20261128022625 | 20261128022625 | — |
| `home_extras_sections` | 20261127060000 | 20261128025223 | — |
| `step02_security_hardening` | 20261128035123 | 20261128035123 | — |
| `step02_org_core` | 20261128035510 | 20261128035510 | — |
| `step02_approval_engine` | 20261128035831 | 20261128035831 | — |
| `step02_approval_actions_fix` | 20261128040110 | 20261128040110 | — |
| `step02_function_access_review` | 20261128040252 | 20261128040252 | — |
| `step02_permissions_and_claims` | 20261128040520 | 20261128040520 | — |

## Findings

- `leadership_employee_login` existed only in the staging ledger. Its exact source was recovered from `supabase_migrations.schema_migrations.statements` into `supabase/migrations/20261127172011_leadership_employee_login.sql` (md5 `ef43a49f801d87d7a32b6be84de663cf`, identical to the ledger).
- Step 02 migrations use the staging ledger version as the filename. Files 035123, 035510, 040110, 040252 are byte-identical to the ledger; 035831 and 040520 are identical after removing comments and whitespace (md5 of code verified on both sides).
- `base`, `cms`, `booking_security`, `cms_defaults`, `remove_old_site` exist only in production (pre-Next.js site history). Not needed on staging.
- Production is missing 19 migrations that staging has, including all management, leadership, dashboard, partner-privacy, home-extras and Step 02 work. A production release needs a reviewed plan, a fresh backup and Founder approval.
- Older repository filenames (e.g. `20261119*`, `20261120*`) do not match either ledger timestamp for the same name; content equivalence for those was checked by Codex in Step 01 and is not re-asserted here.
