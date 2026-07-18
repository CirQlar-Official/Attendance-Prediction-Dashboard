# CAST — Church Attendance Statistical Tracker

CAST is a single-page web app for tracking weekly church attendance, visualizing
trends, and forecasting next week's attendance with an in-browser Random Forest
model. Groups join with a code; admins manage membership and can edit or delete
records.

## Stack

- **React 18** + **react-router 7**, built with **Vite 6** and **Tailwind CSS v4**
- **Supabase** (Postgres, Auth, Realtime) for all persistence — there is no
  separate backend server
- **Open-Meteo** for weather enrichment (no API key required)
- A from-scratch Random Forest regressor (`src/app/utils/randomForest.ts`),
  trained off the main thread in a Web Worker

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's values
npm run dev
```

### Environment variables

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API (the `anon`/`publishable` key — safe to expose client-side, **provided Row-Level Security policies are correctly configured** on every table) |

This app has no server component, so the anon key is the only credential it
ever holds. Authorization (who can read/write which rows) is enforced entirely
by Supabase RLS policies, not by anything in this codebase — verify those
policies directly in your Supabase project before treating any deployment as
production-ready.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run test` | Run the Vitest suite once |
| `npm run typecheck` | Run `tsc --noEmit` |

There is no lint script configured yet.

## Deployment

This is a static SPA — `npm run build` produces a `dist/` folder deployable to
any static host (Vercel, Netlify, Supabase Hosting, etc.). Because routing is
client-side (react-router), **your host needs a rewrite rule that serves
`index.html` for any path** (e.g. Vercel's default SPA fallback, or Netlify's
`_redirects: /* /index.html 200`) — without it, deep links like `/forecast`
will 404 on a hard refresh.

## Project layout

```
src/
  app/
    components/    # Auth, GroupSelector, RootLayout, BottomNav, shared UI
    context/        # DarkModeContext
    hooks/          # useAttendanceData - the central data + ML hook
    pages/          # Dashboard, AddData, Forecast, History, Members
    utils/          # randomForest.ts (pure, unit-tested Random Forest)
    workers/        # randomForest.worker.ts + client wrapper
  lib/
    supabase.ts     # all Supabase reads/writes/auth
    weather.ts      # Open-Meteo integration
```

## Database schema

This repo does not currently version the Supabase schema or RLS policies.
The tables the app expects, inferred from `src/lib/supabase.ts` and
`src/app/hooks/useAttendanceData.ts`:

- `groups` (`id`, `name`, `join_code`, `created_by`, `created_at`)
- `group_members` (`user_id`, `group_id`, `joined_at`) — one row per user
  (a user belongs to at most one group at a time)
- `attendance_entries` — one row per week per group, including the raw
  attendance count, the lag/rolling/delta features the model trains on,
  seasonality flags, weather, and `created_by`/`averaged_from` for
  same-date multi-submitter averaging
- `user_profiles` (`user_id`, `full_name`)
- `admins` (`user_id`) — presence in this table grants global admin rights
  (create groups, edit/delete any record, manage membership)

If you're setting this up fresh, you'll need to create these tables and
author RLS policies restricting each to the caller's own group/rows before
this is safe to use with real data.
