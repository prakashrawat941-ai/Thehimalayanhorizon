# Run the website and PWA

With Node.js 22 installed, run these commands from the repository root:

```sh
cd web
npm install
npm run dev
```

Open http://localhost:3000. For a production build, run `npm run build` followed by `npm start` from the same directory. The build generates the service worker.

Netlify uses the checked-in netlify.toml to build web/ and publish .next. Configure the production site URL and allowed authentication redirects in Supabase. Configure the browser-facing project URL and publishable key with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Keep service-role credentials out of client settings.

GitHub Actions builds the Next.js application and checks public routes and login redirects on pull requests. Database tests are in tests/db. The older static-browser regression suite targets the pre-migration snapshot. To reproduce that suite in isolation, use a Git worktree:

```sh
git worktree add --detach ../thh-static-baseline a0c8c7f920fb03a67dba7c6aa0dd80d8f6a0aa5e
```

Use the baseline checkout for its Playwright scripts, fixtures and Python static server.
