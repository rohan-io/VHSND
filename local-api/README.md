# local-api

A local Node.js/Express + SQLite (better-sqlite3) API server so the mobile app
(Expo) and the admin-web dashboard can share one live dataset instead of each
running against its own mock/fixture data. Registering a beneficiary from
either app immediately shows up for the other, because both talk to this
server instead of their own bundled demo DB.

## Start it

```bash
npm install        # first time only
npm run dev         # nodemon, auto-reloads on file changes
# or
npm start           # plain node
```

Server listens on `http://localhost:3001` (override with `PORT` in `.env`).
Data lives in `local-api/data.sqlite`, created and seeded automatically on
first run:
- Admin-web-shaped tables (`villages`, `beneficiaries`, `pregnancies`\*,
  `children`\*, `vhsnd_sessions`, `anm_attendance`, `referrals`,
  `high_risk_flags`) — 8 villages, 16 beneficiaries, 2 children, 6 VHSND
  sessions, seed attendance/referrals/high-risk records.
- A `mobile_records` collection store (same generic `(collection, id, data)`
  shape as `frontend/src/api/demoDb.ts`) — 50 pregnancies, 30 children, ANC
  visits, immunizations, alerts, notifications — ported byte-for-byte from
  that file's seed generator so the mobile app sees identical data whether
  it's offline or talking to this server.

\* `pregnancies` and `children` as *tables* are admin-web-shaped and currently
unused by any route (see Endpoints below — `/api/pregnancies` and
`/api/children` are served from the `mobile_records` store instead). They're
kept seeded for when admin-web is wired in Phase 3.

Delete `data.sqlite` to reset everything to the seed state.

Run `npm test` for a smoke test that spins the server up against a scratch DB
and exercises every route group.

## Connecting from the apps

- **Admin dashboard (Next.js dev server, browser)**: `http://localhost:3001`
- **Expo web / iOS simulator**: `http://localhost:3001`
- **Expo on a physical phone / Android emulator**: the emulator's `10.0.2.2`
  alias, or your machine's LAN IP (e.g. `http://192.168.1.x:3001`) — `localhost`
  on the phone refers to the phone itself, not your dev machine. CORS is wide
  open (`cors()` default), so any origin can call it.

## Endpoints

All JSON, prefixed with `/api`. Two groups, from two different phases —
see the data section above for why they don't share a schema yet.

### Admin-web-shaped (Phase 1, `server.js`)

| Method | Path | Notes |
|---|---|---|
| GET | `/villages` | all 8 villages |
| GET | `/beneficiaries` | optional `?village=` filter |
| GET | `/beneficiaries/:id` | 404 if missing |
| POST | `/beneficiaries` | requires `name`, `village` |
| PATCH | `/beneficiaries/:id` | partial update |
| GET | `/sessions` | VHSND sessions |
| POST | `/sessions` | requires `village`, `date` |
| GET | `/sessions/:id/attendees` | expected beneficiary IDs + records |
| GET | `/attendance` | optional `?session_id=` filter |
| POST | `/attendance` | ANM check-in; requires `session_id` (must exist), `anm_id` |
| PATCH | `/attendance/:id` | status / check-in time |
| GET | `/referrals` | |
| POST | `/referrals` | requires `beneficiary_id` (must exist), `facility`, `reason`, `date` |
| PATCH | `/referrals/:id` | follow-up status / notes |
| GET | `/high-risk` | beneficiary + flags joined |
| GET | `/high-risk/:id` | keyed by beneficiary ID |
| PATCH | `/high-risk/:id` | flags / status |

### Mobile-app-shaped (Phase 2, `mobileRoutes.js`) — mirrors `demoDb.ts` 1:1

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{username, password}` → `{access_token, user}`. Demo creds: `admin`/`Admin@123`, `worker0[1-5]`/`Worker@123`, or `beneficiary-demo`/any 6-digit code |
| POST | `/auth/logout` | |
| POST | `/sync` | `{transactions:[...]}` → `{sync_time, total_processed}` |
| GET | `/dashboard` | summary counts, today's alerts, recent/critical pregnancies |
| GET | `/pregnancies` | `?search=&trimester=&village=&high_risk=&status_filter=` → `{total, items}` |
| GET | `/pregnancies/:id` | → `{pregnancy, visits, immunizations, children}` |
| POST | `/pregnancies` | full record (name, vitals, LMP, risk factors...); risk auto-scored |
| POST | `/pregnancies/:id/visits` | record an ANC visit; re-scores risk |
| POST | `/pregnancies/:id/immunizations/:immId/complete` | |
| POST | `/pregnancies/:id/pmsma/attend` | |
| GET | `/children` | `?search=&village=&gender=` → `{total, items}` |
| POST | `/children` | |
| GET | `/children/:id` | → `{child, immunizations, mother}` |
| POST | `/children/:id/immunizations/:immId/complete` | |
| POST | `/children/:id/immunizations/:immId/reschedule` | |
| GET | `/health-workers/:id/supervised-team` | ANM's supervised ASHAs + their stats |
| GET | `/alerts` | `?status_filter=&priority=&category=` → `{total, items}` |
| POST | `/alerts/:id/acknowledge` | |
| POST | `/alerts/recalculate` | stub, matches demoDb.ts |
| GET | `/notifications` | → `{unread_count, items}` |
| POST | `/notifications/:id/read` | |
| GET | `/admin/kpis` | |
| GET | `/audit-logs` | always `[]`, matches demoDb.ts |

Unknown routes return `404 {"error": ...}`; malformed JSON bodies return
`400`; unexpected errors return `500`. Every request is logged to stdout as
`METHOD /path` with a timestamp.

## Mobile app wiring (Phase 2)

`frontend/src/api/client.ts` picks its data source via `EXPO_PUBLIC_API_MODE`
(`local` | `offline` | `mongodb`, default `local`) and `EXPO_PUBLIC_API_BASE_URL`
(default `http://localhost:3001`) — see `frontend/.env.example`. In `local`
mode, if this server is unreachable, each request transparently falls back to
the bundled offline dataset (`frontend/src/api/demoDb.ts`) instead of failing,
with a console warning. No mobile UI or screen code changed — only the data
layer.
