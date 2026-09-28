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
first run (8 villages, 16 beneficiaries/pregnancies, 2 children, 6 VHSND
sessions, seed attendance/referrals/high-risk records). Delete `data.sqlite`
to reset to the seed state.

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

All JSON, prefixed with `/api`.

| Method | Path | Notes |
|---|---|---|
| GET | `/villages` | all 8 villages |
| GET | `/beneficiaries` | optional `?village=` filter |
| GET | `/beneficiaries/:id` | 404 if missing |
| POST | `/beneficiaries` | requires `name`, `village` |
| PATCH | `/beneficiaries/:id` | partial update |
| GET | `/pregnancies` | optional `?status=` filter |
| GET | `/pregnancies/:id` | |
| POST | `/pregnancies` | requires `beneficiary_id` (must exist), `trimester` |
| PATCH | `/pregnancies/:id` | trimester, risk flags, status |
| GET | `/children` | |
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

Unknown routes return `404 {"error": ...}`; malformed JSON bodies return
`400`; unexpected errors return `500`. Every request is logged to stdout as
`METHOD /path` with a timestamp.
