# Deployment Handoff

For whoever is hosting `admin-web` and `local-api`. Written from the code as
it stands on branch `aditi`, not from intent — if something here looks wrong
against what you see running, the code is the source of truth.

## 1. Architecture

```
Android phone (APK, "hosted" build)  ---HTTPS-->  local-api (Express + SQLite)
                                                        ^
admin-web (Next.js, server-side fetch) --------HTTP----|
                                                        |
                                            one shared SQLite database
```

- **`local-api`** is the only thing that touches the database. It's a plain
  Express + `better-sqlite3` server — no ORM, no external DB service.
- **`admin-web`** never talks to the database directly. Every page that shows
  data calls `local-api` over plain `fetch()`, **server-side** (inside a
  Next.js Server Component / async function) — confirmed by inspection: no
  `/api/` calls appear in the browser's network tab for any dashboard page.
  This means `local-api` needs to be reachable from wherever `admin-web`'s
  Node process runs, not from the end user's browser.
- **The mobile app (APK)** talks to `local-api` directly over the public
  internet (or a LAN, for the `lan-dev` profile) — see §5.
- There is no message queue, no webhook, no push notifications. "Sync" means
  both apps read/write the same rows in the same SQLite file; a change is
  visible to the other app on its next fetch, not pushed.

## 2. `local-api`

### Persistent disk is required

`local-api/data.sqlite` (plus its `-wal`/`-shm` files while the server is
running — SQLite is in WAL mode, `db.js`: `db.pragma("journal_mode = WAL")`)
is the entire database, sitting on local disk next to the code. **This
cannot run on serverless or ephemeral-filesystem hosting** (e.g. a container
platform that doesn't give you a persistent volume, or anything that spins
up a fresh filesystem per request/instance) — the database would either not
persist between requests or would silently diverge across instances. Host it
somewhere with a persistent disk attached to a single long-running process
(a VM, a container platform with a mounted volume, etc.).

### Start command, port, bind address

```bash
cd local-api
npm install
npm start          # node server.js — no nodemon, no auto-reload
```

- Listens on `process.env.PORT || 3001`.
- `app.listen(PORT, ...)` is called with **no host argument**, so it binds
  `0.0.0.0` (all interfaces) — confirmed via `netstat` during the earlier
  sync audit. Put a reverse proxy / firewall in front of it in production;
  it will happily accept connections from anywhere it's network-reachable.
- Database path: `process.env.DB_FILE || path.join(__dirname, "data.sqlite")`
  (`local-api/db.js`).
- `NODE_ENV` is accepted (the test scripts set it to `"test"`) but **nothing
  in the codebase actually reads or branches on it** — setting it to
  `production` changes no server behavior today.

### Seeding — and how to disable it (there is currently no flag)

Two independent seed generators run automatically, unconditionally, at
server startup, before any request can arrive:

- `db.js`'s `seedIfEmpty()` — 8 villages, 16 beneficiaries, 2 children, 6
  VHSND sessions, referrals, high-risk flags (checks `SELECT COUNT(*) FROM
  beneficiaries`; no-ops if non-zero).
- `mobileDb.js`'s `seedIfEmpty()` — 50 pregnancies, 30 children, ANC visits,
  immunizations, alerts, notifications (checks a `seed_version` marker row;
  re-seeds if the version string in code changed, which would **wipe and
  regenerate** the mobile-side data — see the code comment above
  `SEED_VERSION` before ever bumping it against a database with real data).

**There is no environment variable to skip seeding.** Both functions run
unconditionally on import; they only skip work if the tables are already
non-empty. Practical options for a production launch:

1. Let it seed once on a brand-new `data.sqlite` (harmless — it's additive,
   not destructive), then delete the demo rows by hand before real
   beneficiaries are registered, **or**
2. Start from an empty repo checkout, immediately register real data through
   the app before anyone looks at the seeded demo records, accepting that
   the demo rows will sit alongside real ones until manually removed.

Neither is great. Worth adding a `SKIP_SEED=true` guard around both
`seedIfEmpty()` calls before a real launch — flagging this rather than
inventing a flag that doesn't exist in the code today.

### Backups

No backup script exists in this repo. Because of WAL mode, a safe backup is
**not** just copying `data.sqlite` — you need `data.sqlite`, `data.sqlite-wal`,
and `data.sqlite-shm` together, consistent at the same instant. Two ways to
do that:

- **Stop the server**, copy all three files (`-wal`/`-shm` may not exist if
  the server shut down cleanly and checkpointed — that's fine, copy whichever
  exist), then restart.
- **Live backup, no downtime**: use SQLite's own backup API — e.g.
  `sqlite3 data.sqlite ".backup backup.sqlite"` (the `sqlite3` CLI) or
  `VACUUM INTO 'backup.sqlite'` run against the live DB — either produces a
  single consistent file without stopping the server.

This is exactly the mechanism this session's own audits used (see
`audits/tmp/` for an example of the three-file copy approach) — reuse it,
automate it on a schedule, and store copies off the same disk as the
original.

## 3. `admin-web`

```bash
cd admin-web
npm install
NEXT_PUBLIC_API_URL=https://your-local-api-host.example.com npm run build
npm start          # next start, listens on PORT (default 3000), HOSTNAME (default 0.0.0.0 in the Docker image)
```

**`NEXT_PUBLIC_API_URL` must be set at `next build` time, not just at
`next start`/deploy time.** Next.js inlines every `NEXT_PUBLIC_*` variable
into the compiled output via webpack at build time; setting it only as a
runtime environment variable on the running container will not change
anything already baked into the build. If you rebuild the image without
this set, it silently falls back to `http://localhost:3001`
(`src/lib/api-config.ts`) — wrong for any real deployment.

A `Dockerfile` already exists (`admin-web/Dockerfile`, multi-stage,
`BUILD_STANDALONE=true`, runs as non-root, `EXPOSE 3000`). Note it still
declares build `ARG`s for Clerk (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, sign-in/
sign-up URLs) — these are **leftover from the original starter template**
and unused by anything in `src/` today (this app uses the mock-persona login
in §6, not Clerk); you can safely leave them unset.

## 4. Every environment variable

| App | Variable | Purpose | Example | When it's read |
|---|---|---|---|---|
| `local-api` | `PORT` | listen port | `3001` | runtime, process start |
| `local-api` | `DB_FILE` | SQLite file path override | `/data/data.sqlite` | runtime, process start |
| `local-api` | `NODE_ENV` | accepted, unused | `production` | — (no effect) |
| `admin-web` | `NEXT_PUBLIC_API_URL` | `local-api` base URL | `https://api.example.com` | **build time** (webpack-inlined) |
| `admin-web` | `NEXT_PUBLIC_APP_URL` | optional — sets `metadataBase` for social/SEO previews | `https://dashboard.example.com` | build time |
| `admin-web` | `NEXT_PUBLIC_SENTRY_DSN` | optional Sentry error reporting | (a Sentry DSN URL) | build time |
| `admin-web` | `NEXT_PUBLIC_SENTRY_DISABLED` | set to disable Sentry entirely | `true` | build time |
| `admin-web` | `PORT` | `next start` listen port | `3000` | runtime |
| `admin-web` | `HOSTNAME` | `next start` bind address (Docker image sets `0.0.0.0`) | `0.0.0.0` | runtime |
| `admin-web` | `BUILD_STANDALONE` | switches `next build` to standalone output (Docker only) | `true` | build time |
| `frontend` (Expo) | `EXPO_PUBLIC_API_MODE` | `local` \| `offline` \| `mongodb` | `local` | build time (inlined by Expo/Metro, same mechanism as Next.js) |
| `frontend` (Expo) | `EXPO_PUBLIC_API_BASE_URL` | `local-api` base URL, no trailing slash, no `/api` suffix | `https://api.example.com` | build time |
| `frontend` (Expo) | `EXPO_PUBLIC_BACKEND_URL` | legacy alias, lower priority than `API_BASE_URL` | — | build time |
| `frontend` (Expo) | `EXPO_PUBLIC_DEMO_MODE` | legacy flag; `true` forces fully offline mode regardless of `API_MODE` | `true` (set by the `preview` EAS profile) | build time |
| `frontend` (Expo) | `EXPO_PUBLIC_ALLOW_CLEARTEXT` | allows plain `http://` on Android — **only** the `lan-dev` EAS profile should set this | `true` | build time (read by `app.config.js`, not app runtime code) |

## 5. Building the APK against the hosted server

The `hosted` EAS build profile (`frontend/eas.json`) is already wired for
this: `EXPO_PUBLIC_DEMO_MODE=false`, `EXPO_PUBLIC_API_MODE=local`, cleartext
stays blocked (it's HTTPS-only), and `EXPO_PUBLIC_API_BASE_URL` comes from an
EAS-managed environment variable rather than anything committed to the repo:

```bash
cd frontend

# One-time: store the real hosted https:// URL as an EAS secret
eas env:create --scope project --environment production \
  --name EXPO_PUBLIC_API_BASE_URL --value https://your-local-api-host.example.com \
  --visibility plaintext

eas build --profile hosted --platform android
```

Full details, including the `lan-dev` profile for testing against a laptop
instead: `frontend/docs/eas-build-profiles.md`.

**Do not submit the `production` profile to the Play Store** until real
authentication exists (§6) — that profile builds against the real API, but
the login is still the same mock-persona flow.

## 6. Security gaps — stated plainly

None of this is hidden behind a flag; all of it is true of the code as it
stands today.

- **The admin dashboard login has no credential check at all.** "Continue as
  Dilip Acharya" (`admin-web/src/app/login/actions.ts`) sets a session cookie
  (`admin_session=USR-ADMIN-001`) with a single click — no password, no
  verification of who's clicking it. The dashboard layout does check for the
  cookie's *presence* (`src/app/dashboard/layout.tsx`), but anyone who can
  reach the login page can set it themselves.
- **`local-api` has no authentication whatsoever.** No API key, no bearer
  token, no session check on any route — confirmed by inspection (`grep` for
  `Authorization`/`Bearer`/JWT across `server.js` and `mobileRoutes.js`
  returns nothing). Anyone who can reach the port can read and write every
  beneficiary, pregnancy, and health record, full stop.
- **CORS is wide open**: `app.use(cors())` with no options allows any origin.
  Fine for a LAN pilot; not fine once this is reachable from the internet.
- **No rate limiting anywhere** — no `express-rate-limit` or equivalent in
  `package.json`'s dependencies. A single client can hammer any endpoint.
- **Do not load real beneficiary data — personal health data — into this
  system until real authentication exists on both `local-api` and
  `admin-web`.** This is personal/sensitive health information; under
  India's DPDP Act (Digital Personal Data Protection Act, 2023) processing
  it without the access controls above would be a compliance problem, not
  just a security one. Treat everything currently in the seed/demo data as
  the ceiling of what this system is safe to hold until that work is done.

## 7. Remaining known limitations (from the sync audit)

From `audits/2026-09-28-mobile-dashboard-sync-audit.md` and its re-test
section — fixed where noted, still open otherwise:

- **Fixed**: `POST /api/sync` now really applies queued offline records
  (Finding 1); writes made while the phone can't reach `local-api` now queue
  instead of silently vanishing into bundled demo data, and the app's
  online/offline badge reflects real reachability (Findings 3 & 4); the
  dashboard's high-risk count now matches the admin-web board (Finding 5).
- **Config fixed, not build-verified**: the `hosted`/`lan-dev`/`production`
  EAS profiles exist and are correctly scoped (Finding 2) — but no APK has
  actually been built and run on a physical device against a real hosted
  server as part of this work. Do that as part of your first real deploy;
  §8 below is exactly that check.
- **Not automated (by direction)**: the `lan-dev` profile's LAN-IP path needs
  a Windows Firewall inbound rule for `node.exe` on the **Private** network
  profile on whatever machine runs `local-api` for that kind of testing —
  this only matters for `lan-dev`, not for a real hosted deployment (Finding
  7). Not relevant to production hosting at all, only to local dev testing.
- **Known gap, not a bug**: a mobile ANC visit can't be recorded for a
  mother until she has synced to the server — the app has no UI to select a
  not-yet-synced, locally-queued mother for a follow-up visit. The
  server-side logic to support that (mapping a temp offline id to the real
  server id within one sync batch) is implemented and tested; only the
  mobile UI path to trigger it is missing.
- **Known gap**: `admin-web` has no view of registered children at all,
  despite mobile child registration working end-to-end (Finding 6) — flagged
  as possibly-intentional scope, worth confirming with product before
  treating it as a bug.
- **Not tested**: this document's own claims about a real APK reaching a
  real hosted server haven't been exercised end-to-end (no build was
  triggered as part of this work, by direction) — §8 is written assuming
  you're the first to actually do that.

## 8. Post-deploy checklist

Run through this after the first real deploy of `local-api` + `admin-web`,
and again after building the `hosted` APK.

1. **Health check**: `curl https://your-local-api-host.example.com/api/health`
   → `{"status":"ok"}`.
2. **Dashboard login**: open `admin-web`, "Continue as Dilip Acharya", confirm
   the Due List / High-Risk / Referral pages load real (not error, not
   empty-by-accident) data.
3. **Mobile → dashboard sync**: on the built `hosted` APK, register a test
   pregnancy (name it something identifiable, e.g. `DEPLOY-TEST-...`) — on
   `admin-web`, confirm she appears on the Due List within a few seconds of
   a page refresh.
4. **Dashboard → mobile sync**: create a referral for her in `admin-web` —
   on the phone, open Notifications and confirm it arrives with the right
   facility and reason.
5. **Acknowledgement flows back**: mark her reviewed on the High-Risk board
   in `admin-web` — on the phone, confirm her alert flips to acknowledged
   and she leaves the escalations list.
6. **Offline round-trip**: on the phone, turn on airplane mode, register
   another test mother (confirm the app shows her as queued, not a plain
   success), turn airplane mode off, confirm the app auto-syncs (or tap Sync
   Now), then confirm on `admin-web` that she appears — **exactly once**,
   not zero times (the old bug) and not duplicated.
7. **Clean up** every `DEPLOY-TEST-...` record you created before handing
   this off as "verified" — same reasoning as the audit's own cleanup step:
   don't leave test data mixed into what might become real records.
