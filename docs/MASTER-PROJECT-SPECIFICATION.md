# The Himalayan Horizon — Master Project Specification
Version 1.0 | 28 November 2026 | Consolidated requirements baseline; not a release certificate.

## 1. Governance and sources
Owner: Founder. Claude owns frontend/design; Codex owns backend integration, permissions, booking correctness and verification. Read [AI-HANDOFF.md](AI-HANDOFF.md), [SETUP.md](SETUP.md), [repository README](../README.md), [application notes](../web/README.md) before implementation. The handoff contains detailed approved previews, routes, RPC contracts and test evidence. New visual direction: [Premium Immersive UI](https://github.com/prakashrawat941-ai/Thehimalayanhorizon/blob/design/premium-immersive-ui/docs/PREMIUM-IMMERSIVE-UI.md). Preserve approved screens; the earlier rejected all-in-one preview is not a baseline. Resolve conflicting requirements with Founder before changing behavior. This consolidation uses the main-branch README and AI-HANDOFF plus owner requirements from conversation; other branches, live databases and private previews have not been independently audited. Handoff has contradictory PR #19 merge wording; verify actual PR state.

## 2. Business
Uttarakhand-first village travel, hidden destinations, homestays, workations, shared cabs and trip planning; expand geographically after operational readiness. Commission model; rates, taxes, settlement and cancellation rules require explicit approved policies. Brand: The Himalayan Horizon. No fabricated inventory, reviews or prices.

## 3. Design system
Preserve public Forest Green/Gold and approved Himalayan photography; management Navy/Blue/Teal. New proposed public/PWA visual direction: soft gradients, selective glassmorphism, Bento cards, immersive photography, floating navigation, realistic vehicle assets. Central tokens, Lucide icons, responsive layouts, EN/HI, light/dark themes for dashboards, accessible focus, contrast, loading/error/empty/success states. No wholesale redesign of approved dashboards. New screens need visual approval.

## 4. Motion
Lightweight cinematic hero, scroll transitions, micro-interactions, cab mountain loading concept. Respect reduced motion, avoid blocking input, optimize WebP and lazy loading; no motion inferred from static reference. Approve new animation preview before rollout.

## 5. Homepage and PWA
Existing routes /, /destinations, /villages, /homestays, /workspaces, /village-tours, /about, /our-story, /our-office. CMS-driven hero, themes, listings, itineraries, trust, season, map, sample plan and rides. WhatsApp only with configured verified number. Map fallback list; office coordinates require schema decision. Manifest, standalone install, icons, offline fallback, public static cache only; never cache private/authenticated pages. Mobile tabs Home, Plan, Cabs, Villages, Account as proposed navigation baseline; reconcile existing routes. Homepage CMS migration 20261127060000_home_extras_sections.sql reported not applied to production; staging first. Confirm photo rights.

## 6. AI Trip Planner
/plan: Plan & route → Day plan → Cost → Report. Map-first, start/stops, GPS accuracy, route alternatives, travellers (solo/couple/family/friends/group), vehicle/fuel/mileage, dates, budget, day itinerary, nearby stays and sightseeing. Save/share report. Existing OSRM, OSM/Leaflet, Open-Meteo, Nominatim and Overpass integrations per handoff; Google Maps/Places and NHAI data are requested alternatives, not confirmed deployed. Fuel adapter requires dated district coverage and credentials; toll rates sourced by class/date; unknown prices remain unknown. No fake totals; show estimates and sources. T1–T5 in handoff; T5 deferred. Verify live provider, route POIs and staging.

## 7. Instant Cab
Search pickup/drop/date/seats, authenticate, choose ride, model-specific seat layout, select seats, review, book, server-confirmed receipt, booking/ride IDs, driver reliability and contact only after confirmation, WhatsApp chat. Owner target: instant auto-accept; handoff currently supports pending and confirmed, so reconcile server workflow before changing. Atomic seat allocation, idempotency, expiry, concurrency, retry and live availability; no passenger phone disclosure. Driver seat nonselectable. Existing RPCs request_cab_ride_idempotent, cab_ride_taken_seats, cab_booking_contact, cab_driver_cards, driver_reliability. Verify held vs booked, rules, batched availability, ID format (THH-DDMMYYYY-NNNN; ride format to confirm against server), real signed-in tests. See C0–C4. Driver publish: verified vehicle, model/capacity, route, date, fare, seat inventory, ride management, SOS and feedback.

## 8. Homestays, villages, workations and guides
Discover listings, gallery, rooms, amenities, house rules, dates, availability, quote, request, host confirmation, voucher, cancellation and review. Existing quote_homestay and booking_requests; server rechecks capacity and availability. Village tours/workspaces retain existing flows until approved upgrades. Guide onboarding and assignments are proposed scope. No automatic confirmation for host-request stays unless separately approved. SB1–SB3 staging tests.

## 9. Customer account
/account and bookings, voucher, notifications, profile, cab bookings, saved places, trips, reviews. Profile photo, emergency contact, history, cancellation and status timeline. Own records only; AC1 signed-in verification, AC2 optional host-note notification.

## 10. Partner portal
/partner: onboarding, KYC, property wizard, rooms, photos, calendar, rates, bookings, earnings, payouts. Draft → review → approval/publication; edits requiring review must not silently change live content. Server-derived commission and payout. Guest phone restricted by policy, not merely UI; PP1–PP3 privacy, inventory and signed-in verification. Driver/guide role-specific portals subject to verified permissions.

## 11. Founder Command Center
/founder, /access, /approvals, /audit. Financial overview, leadership access, invitations, MFA, work approvals, critical/expense decisions, audit trail, company KPIs and escalation. Founder-only membership actions; prevent self-demotion and admin-row edits. Temporary employee-ID/password onboarding is proposed: short expiry, hashed credentials, restricted claim-only session, verified email, permanent auth, revoke/regenerate, audit; never store plaintext. Verify existing role implementation before extension.

## 12. CEO Operations Center
/ceo, /tasks, /reviews, /requests. Daily check-ins, rides, holds, SOS, support SLA, office/employee operations, tasks, review queues and escalation to Founder. Server-enforced scoped decisions, notes and evidence.

## 13. Co-Founder Technology & Growth
/co-founder, /locations, /onboarding, /releases. CMS, growth, partner readiness, release monitoring, location matching and autofill with field provenance, duplicate detection, draft/review/publish. Matching contract in handoff D3; no fabricated details. External data requires source and validation.

## 14. Admin Control Center
/admin, /admin/bookings, CMS, users, partner verification, listings, booking monitoring, support, site settings, content moderation and audit. Live data only; pagination/filtering; role checks on every action. Preserve approved dashboard layouts. CMS conflict D6 must be reconciled.

## 15. Employee Workspace
Independent internal shell, assigned tasks, attendance/office scope, evidence, due dates, comments, submission/review, notifications and escalation. No unrestricted finance, access management or CMS privileges. Proposed until current implementation verified. All five management portals exclude public header/footer, promotions and customer navigation.

## 16. Automation and workflows
Customer request → authorized operational queue → assigned employee/admin → CEO review where needed → Founder approval for reserved decisions. Partner edits → validation → review → publication. Automate deterministic routing, reminders, SLA alerts, duplicate detection and reports; AI assists matching/content drafting with human review for sensitive decisions. Idempotent jobs, retries, audit, failure queue, manual override; no autonomous payments, privilege changes or unapproved publication. Define exact approval matrix before enabling.

## 17. Architecture and security
Next.js App Router in web/, reusable components in web/components, assets web/public, Supabase PostgreSQL/Auth, migrations supabase/migrations, DB tests tests/db. Keep one canonical architecture. Staging gboxcnxgdkcewstkxogt; production kjuboknsxlsotzoibdnv (owner-provided IDs; verify environment). RLS and least privilege, server-only secrets, input validation, MFA aal2 for management, management_members/work/events and audited RPCs. Handoff D1–D6 describes temporary requireAdmin owner view and pending integration as of 27 Nov; newer branch status unverified. Never treat frontend guard as authorization. Separate staging/prod; no production test records. OAuth callback and credential checks; never commit secrets. Backup and rollback migrations.

## 18. APIs and data contracts
Reuse existing RPCs and loaders documented in handoff. Server actions return {ok:true} or {ok:false,message}; show success only after durable write. Validate permissions, schema, inputs and state transitions on server. External providers: route/maps, geocoding, weather, fuel, toll, WhatsApp, payments (provider and policy not finalized). Timeout, rate limits, caching, provenance and explicit unavailable states. Payments/refunds require approved provider, verified webhooks, idempotent ledger and reconciliation before release.

## 19. GitHub and deployment
Repository prakashrawat941-ai/Thehimalayanhorizon. Main protected baseline; feature branches, focused PRs, review, CI and staging before merge. Verify current open PRs, duplicate changes and branch ancestry; do not blindly merge PR #18/#28 or superseded work. Existing handoff references Vercel previews and Netlify testing; final hosting/domain decision must be confirmed against actual deployment (owner previously requested ghumopahad.com). No production migrations or deployments without authorization. Maintain AI-HANDOFF and changelog.

## 20. Verification and roadmap
Phase A: audit branches, migrations, environments, security and current UI; reconcile handoff contradictions. Phase B: complete management guards, onboarding, work queues, location/CMS and employee workflows. Phase C: booking correctness, partner/customer flows, live integrations. Phase D: approved premium UI/motion and PWA improvements. Phase E: consolidated staging preview, regression, accessibility, security, performance and release approval. Run build, lint, unit (Vitest where configured), Playwright, axe, DB/RLS and concurrency tests; mobile 360px and desktop 1280px plus real devices. Test each authorized button/form/action, unauthorized access, failure/retry, EN/HI, dark mode, offline behavior and real signed-in staging workflows. Record commit, environment, commands, results and unresolved defects. No task marked verified based solely on mock harness or merged PR. Handoff reports merges #14/#15/#17/#22/#23/#24/#25/#26 and conflicting #19 wording; verify against GitHub. Preserve detailed pending IDs C0–C4, P1–P5, D1–D6, T1–T5, H1–H4, PP1–PP3, SB1–SB3, AC1–AC2. This document is a requirements index and does not replace detailed approved contracts or prove implementation.

## Change control
Update this file and linked handoff when approved scope changes. Record decision, owner, date, affected routes/contracts and acceptance evidence. Routine implementation may proceed within authorized scope; no unapproved redesign, production changes or destructive cleanup.
