# The Himalayan Horizon — Next.js rebuild

Built from `claude/THH-Project-Requirements.md` (PRD). Uses the **same Supabase database** as the current app.

| Part | Status |
|---|---|
| 1. Design system, layout, auth (email + Google), roles, PWA, Hindi/English | ✅ this branch |
| 2. Public website + CMS content | ✅ this branch |
| 3–8. Customer portal, Trip Planner, Partner/Homestay, Admin, Instant Cab, testing | ⏳ open in current app via "Open in current app" |

- Stack: Next.js (App Router, TypeScript), `@supabase/ssr`, plain CSS with the approved design tokens (`app/globals.css`).
- Language: cookie `thh_lang` (default Hindi), switch in header/footer; saved to profile when signed in.
- Login: `/login` (email/password, Google), `/auth/callback`, `/auth/reset`. Returns to the page you came from (`?next=`).
- Roles: `lib/auth.ts` → customer / partner (has partner record) / driver (has driver profile) / admin (`profiles.role = 'admin'`, set only by the owner).
- PWA: `app/manifest.ts`, `scripts/sw.template.js` → `public/sw.js` (unique version per deploy), update check on open, on return to screen and every 30 minutes; version in footer.
- CMS: home sections, themes, locations, itineraries from their tables; text pages from `site_settings.pages`; FAQ from `site_settings.faqs`; contact from `site_settings.contact`.
- Contact form needs migration `supabase/migrations/20261122100000_contact_messages.sql` (not applied yet).

Local: `npm install && npm run dev` inside `web/`.
