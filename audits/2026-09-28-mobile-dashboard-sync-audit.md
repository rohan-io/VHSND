# Mobile ↔ Dashboard Sync Audit — 2026-09-28

Repo: `D:\Technocracy-2\Anm-Health-Connect-Offline-Demo\Anm-tracker-main` · branch `aditi`
Scope: `frontend/` (Expo/React Native, ASHA login `worker02` / Mamata Barik) ↔ `local-api/` (Express + SQLite, port 3001) ↔ `admin-web/` (Next.js, Dilip Acharya login)

---

## 1. Verdict

**Partially connected and syncing — with one confirmed silent data-loss path and no real path from a physical APK to this server at all.** When both dev servers are running on the same laptop, mobile → dashboard sync works correctly and immediately in every case tested (new high-risk and routine registrations, an ANC visit that raises risk mid-pregnancy, referral and acknowledgement actions flow to mobile notifications and alerts) — all via a shared SQLite database on one Express server, not a real distributed sync protocol. But the mobile app's *own* built-in offline-queue feature ("Simulate Offline Field Conditions" → "Sync Now") is a dead end: the server's `/api/sync` endpoint is a stub that accepts and discards every transaction while telling the app it succeeded, so a worker who relies on it loses her record permanently with a confident "synchronized" message and no error anywhere. Separately, a real field phone cannot reach this server under any current build configuration — the only APK build profile forces a fully offline demo mode, and even the alternate build profile would bake in a useless `localhost` URL with Android cleartext-HTTP blocking on top. In short: the *shape* of two-way sync is implemented and works on a laptop; the *offline-resilience* and *physical-device-reachability* halves of "works in the field" do not exist yet.

---

## 2. How it was tested

No Android SDK, `adb`, or emulator is installed on this machine (`adb`/`emulator` not found, `ANDROID_HOME` unset) — **Method A (emulator) was unavailable for the whole audit.**

- **Method B — `npx expo start --web` + Playwright** was the primary method for every mobile-side test (M1–M5, D1–D3, F1 mobile checks). It runs the *same* `src/api/client.ts` / `mch.ts` / `AuthContext.tsx` code the APK would run, over the same HTTP endpoints, so the request/response contract and application logic (fallback behaviour, offline queue, alert cascades) are exercised faithfully. **What it can't prove:** native networking behaviour, Android's cleartext-HTTP blocking, whether a *built APK* on a *physical device* can reach the laptop at all, or how the on-device `expo-sqlite` offline store behaves (the web build falls back to an **in-memory** store when `expo-sqlite` isn't available — this made the F1 "silent fallback" finding look *more* ephemeral than it would be on a real phone, where that data would at least persist on-device; see Finding 3/4).
- **Method C — curl** was used to independently confirm the API contract (`POST /api/auth/login`, `GET /api/dashboard`, `GET /api/pregnancies`, `GET /api/alerts`) and, critically, to verify server-side ground truth after each Playwright-driven action (e.g. confirming a record actually landed in — or was absent from — `local-api`'s SQLite via direct queries, independent of what the UI claimed). Method C was **not** used to fully replay each mobile write (registration/ANC visit/referral) as a duplicate raw HTTP request end-to-end — verification queries (GET) covered that role instead. This is the one respect in which Part 3's method coverage is partial; it doesn't affect the findings, since server-side truth was checked directly by SQL/API query rather than by trusting the UI.
- Static configuration review (Part 1) was done by reading source directly (no test needed to *establish* facts like build profiles or CORS config, though F1 then *confirmed* the predicted runtime behaviour live).

---

## 3. Configuration (Part 1)

| Setting | Value | OK / Risk |
|---|---|---|
| `local-api` listen | `app.listen(PORT)` — no host arg → binds `0.0.0.0` (confirmed via `netstat`: `0.0.0.0:3001` and `[::]:3001`) | **OK** — reachable from LAN, not just localhost |
| `local-api` CORS | `app.use(cors())`, no options → all origins allowed | OK for a local dev/pilot tool; **would be a risk if ever exposed beyond the LAN** |
| `local-api` DB | `better-sqlite3`, `local-api/data.sqlite` (or `DB_FILE` env override) | OK |
| `local-api` seeding | `seedIfEmpty()` in `db.js`, runs once at startup if tables are empty; mobile-side seed lives in `mobileDb.js` (50 pregnancies / 30 children, ported from `demoDb.ts`) | OK |
| `local-api` port/env | `.env`: `PORT=3001`, `NODE_ENV=development` | OK |
| `frontend/.env` | `EXPO_PUBLIC_API_MODE=local`, `EXPO_PUBLIC_API_BASE_URL=http://localhost:3001` | **Risk** — `localhost` is only correct for the web/emulator dev method used here; a physical phone needs the LAN IP, and nothing in the app surfaces this |
| `client.ts` mode selection | `local` (real API, silent per-request fallback to bundled `demoDb` if unreachable) / `offline` (demo-only) / `mongodb` (future) | See Findings 1, 3, 4 |
| `client.ts` unreachable-server behaviour | Network-level failure in `local` mode → **silently** calls `demoRequest()` instead, logs only a `console.warn`; no thrown error, no UI change | **Critical/High risk** — see Findings 1, 3 |
| `app.json` (Android) | No `usesCleartextTraffic`, no `expo-build-properties` plugin | **Risk** — Android 9+ blocks cleartext `http://` by default; nothing here overrides that |
| `eas.json` "preview" (the APK build) | `buildType: apk`, `env.EXPO_PUBLIC_DEMO_MODE: "true"` | **Critical risk** — the only APK profile forces offline-only demo mode; see Finding 2 |
| `eas.json` "production" | `buildType: app-bundle`, no API URL override | **Risk** — would ship with the `.env`-time `localhost` URL baked in, and still no cleartext allowance |
| `admin-web/.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:3001` | OK for local dev |
| `admin-web` fetch caching | `api-config.ts`: `cache: 'no-store'` on every request, 10s timeout | OK — no stale-cache risk |
| `admin-web` fetch location | Server Components (`getBeneficiaries()`, etc. called in `async function Page()`) — confirmed no `/api/` calls appear in the browser's network tab for the High-Risk page | OK, by design |
| Laptop LAN IP | `192.168.0.103` (Wi-Fi) | — |
| Network profile | **Public** (`Get-NetConnectionProfile` → `NetworkCategory: Public`) | Risk in general, but see next row |
| Firewall rule | An inbound **Allow** rule for `C:\program files\nodejs\node.exe` already exists on the **Public** profile (pre-existing, not created by this audit) | OK today, but fragile — a clean machine/profile would silently block phone→laptop traffic with no error surfaced anywhere |
| `local-api` reachability | `curl http://localhost:3001` → 200; `curl http://192.168.0.103:3001` → 200 | OK on this laptop right now |
| Android emulator (`10.0.2.2`) | Not applicable — no SDK/emulator installed | N/A |

---

## 4. Sync results

| Test | Action | Direction | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|---|
| M1 | Register AUDIT-Mother-High (age 42) | Mobile→Dashboard | Due List "not scheduled" + High-Risk critical | Both, immediately | **Pass** | `M1-register-form-filled.png`, `M1-M2-due-list.png`, `M1-high-risk-card.png` |
| M2 | Register AUDIT-Mother-Routine (normal) | Mobile→Dashboard | Due List shows her; High-Risk does not | Both correct | **Pass** | `M2-register-form-filled.png`, `M1-M2-due-list.png` |
| M3 | ANC visit on AUDIT-Mother-Routine, tick Hypertension | Mobile→Dashboard | She becomes High-Risk | Appeared on High-Risk board immediately | **Pass** | `M3-anc-visit-form.png`, `M3-high-risk-after-anc.png` |
| M4 | Register AUDIT-Child-1 | Mobile→Dashboard | Visible somewhere in dashboard | Registered fine (201, immunisation schedule generated) but admin-web has **no children view at all** (no nav item, no route) | **Gap** (not a failure — likely intentional scope, but worth flagging; Finding 6) | `M4-child-register-form.png` |
| M5 | `/api/dashboard` totals before/after M1+M2 | Mobile counts | Totals rise by exactly 2 | `total_pregnancies` 45→47, `high_risk_pregnancies` 28→29 (M1 is high-risk, M2 isn't — exactly right) | **Pass** | curl output in session transcript |
| D1 | Referral for AUDIT-Mother-High → DHH Jajpur | Dashboard→Mobile | Notification for worker02 w/ facility+reason | Appeared immediately, full text correct | **Pass** | `D1-referral-form-filled.png`, `D1-mobile-notification.png` |
| D2 | "Mark Reviewed" AUDIT-Mother-High | Dashboard→Mobile | Her mobile alerts → ACKNOWLEDGED, leaves escalations | Both alerts (`ALERT-CRIT-ESC-…`, `ALERT-HR-…`) flipped to ACKNOWLEDGED; she disappeared from `/alerts` | **Pass** | `D2-mark-reviewed.png`, `D2-mobile-alerts-after-ack.png` (note: first click missed and hit AUDIT-Mother-Routine's card instead due to a DOM-selector bug in *my own test script*, not the app — corrected immediately, both mothers' acknowledgements verified independently by SQL query) |
| D3 | Referral for seeded mother BEN-2026-503 (Manaswini Nayak, already worker02's) | Dashboard→Mobile | Reaches her assigned worker's notifications | Appeared immediately for worker02 | **Pass** | `D3-referral-form-filled.png`, `D3-mobile-notification.png` |
| C1 | Timing of visibility across all tests above | — | Immediate / cache-expiry / restart-only | **Immediate on next navigation/fetch** in every case — `admin-web` uses `cache: 'no-store'`, mobile re-fetches per screen. Note this is "fresh fetch on navigate", not a push/live update — nothing auto-refreshes an already-open screen. | **Pass** (with the push-vs-fetch caveat noted) | — |
| C2 | High-risk count consistency: `/api/dashboard` vs admin-web High-Risk board vs raw data | — | Explain any difference | Three different numbers, all internally consistent once traced: `/api/high-risk` (relational `high_risk_flags` table only) = 12; `/api/dashboard`'s `high_risk_pregnancies` (mobile `is_high_risk` flag on *active* pregnancies only) = 28 of 45; admin-web's High-Risk board (documented "union rule" — mobile-flagged **OR** relationally-flagged) = 33. Verified exactly: 45 active pregnancies, 28 mobile-flagged, 12 relational flags (all pointing at active pregnancies), union = 33 — matches the board's card count precisely. The union rule is intentional and commented in `adapters.ts`, but **no screen tells a supervisor these numbers are computed differently** — see Finding 5. | **Gap** (by-design but unexplained in UI) | — |
| C3 | Same mother → same `beneficiary_id`/pregnancy id on both sides | — | IDs match | Confirmed throughout — `BEN-LOCAL-…`/`PREG-LOCAL-…` ids assigned by `local-api` are used identically in mobile UI, admin-web UI, and raw API responses (single shared SQLite backend, not two synced stores) | **Pass** | — |
| F1a | `admin-web` behaviour with `local-api` stopped | — | Friendly error, not 404/crash | Clean inline error: "Could not reach the local API server… Make sure local-api is running…", 0 rows, no crash | **Pass** | `F1-admin-web-server-down.png` |
| F1b | Mobile "Online" badge accuracy with `local-api` stopped (toggle untouched) | — | Reflects real connectivity, or at least warns | Badge stayed **"Online"** the entire outage — it only reflects the manual "Simulate Offline" toggle, never real reachability. Only a `console.warn` (invisible to a real user) recorded the fallback. | **Fail** | `F1-mobile-badge-still-online.png` |
| F1c | Register a pregnancy while `local-api` is down (toggle OFF — the real "server unreachable" case) | — | Documented, safe behaviour | Silently succeeded via the bundled offline demo dataset, showed a plain **"Pregnancy registered successfully"** toast (not an offline warning), and was **not** queued for later sync. On the web method it didn't even survive a page reload (in-memory fallback store); see Finding 3/4 for what this means on a real device. | **Fail** | `F1-offline-fallback-toast.png` |
| F1d | Use the app's own offline-queue ("Simulate Offline" ON → register → toggle back ON-line → "Sync Now") | — | Record reaches `local-api` | Queued correctly on-device, "Sync Now" called `POST /api/sync` → `200 OK`, UI showed **"Offline queue is empty. All records synchronized"** — but the record **never appeared in `local-api`'s pregnancies** at all. `POST /api/sync` is a stub that only echoes back a fabricated count and writes nothing. | **Fail (Critical)** | `F1-sync-stub-data-loss.png`; `local-api/mobileRoutes.js` lines 26–29 |
| F2 | Restart `local-api`, confirm both sides recover without a manual reload hack | — | Auto-recovery | Both recovered on the very next normal navigation (`admin-web` due-list showed correct 12/36 rows again; mobile `/api/dashboard` returned 200 with real data) — no server restart of the frontends, no cache-clear, no special action needed | **Pass** | — |

---

## 5. Findings (by severity)

### CRITICAL

**1. The mobile app's own offline-sync queue silently discards every record it "syncs."**
`local-api/mobileRoutes.js` (`POST /api/sync`, lines 26–29) does nothing but echo back `{ sync_time, total_processed: transactions.length }` — it never reads `req.body.transactions` for real, never writes to the database. The mobile app (`OfflineSyncContext.tsx`) trusts that response, clears its local queue, and shows **"Successfully synchronized 1 records with central database!"**. Verified live: queued `AUDIT-Mother-Queued` via the "Simulate Offline" toggle, tapped Sync Now, got a `200 OK` and "queue is empty — all records synchronized," then confirmed by direct query that `local-api` never received her. **Impact:** this is the app's one explicitly-documented, user-facing "safe way to work offline" — an ASHA/ANM who uses it in the field (or a supervisor who's told to trust it) loses the record permanently and is told the opposite. There is no error, no retry, no trace. **Fix:** implement the `/api/sync` route for real — iterate `transactions`, dispatch each by `entity_type` to the existing create/update handlers (`createPregnancy`, ANC visit, etc.), and return per-item success/failure so the client can keep failed items queued instead of discarding them.

**2. No APK build variant can currently reach a real `local-api` server from a physical phone.**
Two independent, stacking problems: (a) `eas.json`'s `preview` profile — the *only* profile that produces an installable APK (`buildType: apk`) — hardcodes `EXPO_PUBLIC_DEMO_MODE: "true"`, which forces the app into pure offline-demo mode; it never attempts a network call regardless of URL or Wi-Fi. (b) The `production` profile (app-bundle, for Play Store) sets no API URL, so it would ship whatever `EXPO_PUBLIC_API_BASE_URL` was in `.env` at build time — `http://localhost:3001`, meaningless on a phone — and `app.json` has no `expo-build-properties` plugin or `usesCleartextTraffic` override, so even a corrected `http://<LAN-IP>` would be blocked outright by Android 9+'s default cleartext-HTTP restriction. **Impact:** every "does the app talk to the dashboard on a real phone" question currently has the same answer — no, by construction, not "it depends on the network." **Fix:** add an `expo-build-properties` plugin block enabling `usesCleartextTraffic` (or move to HTTPS via a dev tunnel/reverse proxy), and add a build profile that sets a real `EXPO_PUBLIC_API_BASE_URL` (the LAN IP, passed via `--env-file` or EAS secrets) without forcing demo mode.

### HIGH

**3. Any `local-api` outage — not just the manual "offline" toggle — silently and invisibly switches the app to disconnected bundled demo data, with the "Online" badge still showing green.**
`client.ts`'s `apiRequest()` catches *all* network-level failures in `local` mode and transparently serves `demoRequest()` instead (bundled/offline dataset), logging only a `console.warn("Cannot reach API server. Running in offline mode.")` — invisible to any real user. Verified live: with `local-api` stopped and the offline toggle untouched, the Header still read **"Online"** throughout, and a new registration returned a plain success toast. The Header's badge only reflects the manually-set `isSimulatedOffline` flag from `OfflineSyncContext`, never actual reachability. **Impact:** a field worker has no way to know her data just diverged onto an isolated store that (per Finding 4) never reaches the supervisor. This is worse than an explicit error, because everything *looks* fine. **Fix:** make the badge/online-state reflect real reachability (e.g. a lightweight periodic health check against `local-api`, or flip state on the first fallback in `apiRequest`), and route silent-fallback writes into the *same* offline queue used by the manual toggle rather than a disconnected demo store.

**4. Data written during that silent fallback has no path back to `local-api`, ever — and on the web test method didn't even survive a page reload.**
Registrations made during a real outage (Finding 3) bypass `OfflineSyncContext.addToOfflineQueue` entirely (that only fires on the manual toggle, or in one narrow catch-block case that a resolved `demoRequest()` promise never reaches) and land in the bundled offline dataset instead. Verified: `AUDIT-Mother-Offline-Fallback`, registered while the server was down, was gone from the mobile UI after a fresh page load and never appeared in `local-api`. **Caveat from the test method:** on the web build used here, the offline fallback store is explicitly documented as **in-memory only** when `expo-sqlite` isn't available (`demoDb.ts` header comment) — a real device would use on-device SQLite and the record would at least *persist locally* rather than vanish on reload, but it would still never reach the dashboard, since nothing queues it. **Fix:** same as Finding 3 — unify the silent-fallback and manual-offline write paths through one real queue, backed by Finding 1's fixed `/sync` endpoint.

### MEDIUM

**5. Three different, silently-disagreeing "how many mothers are high-risk" numbers exist across the product, with the reason never surfaced in any UI.** `/api/high-risk` (relational-flags table only) = 12; `/api/dashboard`'s `high_risk_pregnancies` summary (mobile `is_high_risk` on active pregnancies) = 28 of 45; admin-web's High-Risk board (deliberate "union rule": mobile-flagged **or** relationally-flagged, documented in `adapters.ts`) = 33. The math checks out exactly once traced, so this isn't a bug in the union logic — but a supervisor glancing between a KPI tile showing 28 and a board showing 33 has no way to know both are "correct." **Fix:** either compute `/api/dashboard`'s summary using the same union rule the board already uses, or label the discrepancy in the UI (e.g. a tooltip: "includes N flagged for follow-up beyond auto-detected risk").

**6. Admin-web has no view of registered children at all.** M4 confirmed child registration works end-to-end on mobile (`POST /api/children` → 201, immunisation schedule generated), but there is no nav item, route, or page anywhere in `admin-web` that surfaces children — `grep` of the nav config and dashboard routes found nothing. This may be deliberate scope (the dashboard is pregnancy/VHSND-session-focused today), but as delivered, a supervisor has zero visibility into child registrations happening in the field. **Fix:** either add a children view, or explicitly document this as out of scope so it isn't mistaken for a bug later.

### LOW

**7. LAN reachability today depends on a pre-existing, easy-to-lose firewall exception.** The Wi-Fi network profile is **Public**, which blocks most inbound connections by default; reachability from another device only works because an inbound Allow rule for `node.exe` already exists (from an earlier "Allow access" prompt, not created by this audit). On a fresh machine, a fresh network, or after that rule is ever revoked, phone→laptop traffic would silently fail with no error message pointing at the firewall as the cause. **Fix:** document this dependency in the README/setup steps for anyone reproducing the "physical phone on the same Wi-Fi" scenario.

---

## 6. Repeat these tests by hand on a physical phone

1. **Find the laptop's LAN IP**: on the laptop, run `ipconfig`, note the Wi-Fi adapter's IPv4 (was `192.168.0.103` during this audit — re-check, it may differ).
2. **Start `local-api`**: `cd local-api && npm run dev` — confirm it prints `Server running on http://localhost:3001`.
3. **On the phone, browser test first** (fastest way to rule out network issues before building an APK): open `http://<laptop-LAN-IP>:3001/api/dashboard` in the phone's browser, over the same Wi-Fi. You should see raw JSON. If this fails, stop here — it's a network/firewall problem, not an app problem (check the phone and laptop are on the *same* Wi-Fi network, not one on mobile data; check Windows Firewall allows `node.exe` on whatever network profile is active).
4. **Run a real dev client on the phone**: on the laptop, `cd frontend && npx expo start --dev-client`, scan the QR code with Expo Go (or a custom dev client) on the phone — **not** the shipped "preview" APK, which per Finding 2 is offline-only by design. Before scanning, confirm `frontend/.env` (or an env var passed on the command line) has `EXPO_PUBLIC_API_BASE_URL=http://<laptop-LAN-IP>:3001`, not `localhost`.
5. **Log in as worker02** (ASHA / Mamata Barik, `Worker@123`) and register a test pregnancy named something starting `AUDIT-` so it's easy to find and delete afterward.
6. **On the laptop, open `admin-web`** (`cd admin-web && npm run dev`, browse `http://localhost:3000`, "Continue as Dilip Acharya") and confirm the new mother appears on Due List / High-Risk within a few seconds of a page refresh.
7. **Repeat in the other direction**: create a referral for her in admin-web, then pull-to-refresh or reopen Notifications on the phone and confirm it arrives.
8. **Test the offline path knowingly-broken today (Finding 1)**: turn on the phone's airplane mode, register another `AUDIT-` mother, turn airplane mode off, open the app's Sync Center, and tap Sync Now. Confirm (via `admin-web` or a curl to `/api/pregnancies` from the laptop) that she does **not** actually appear server-side, even though the app will claim she's synced — this is the known critical bug, not a setup mistake.
9. **Clean up**: delete every `AUDIT-`-named test record you created (or ask for another audit pass to do it), and restore `local-api/data.sqlite` from a backup taken beforehand if you want the demo dataset pristine again.

---

## 7. Cleanup confirmation

- Both dev servers (and the `expo start --web` instance used for Method B) were stopped gracefully via `Stop-Process` on their specific PIDs — no `taskkill /F`, no unrelated process touched.
- `local-api/data.sqlite` (+ `-wal`/`-shm`) restored from the pre-audit copy in `audits/tmp/`; `/api/dashboard` re-verified to match the pre-audit baseline **exactly** (`total_pregnancies: 45`, `high_risk_pregnancies: 28`, `total_children: 30`).
- Direct SQLite/mobileDb queries confirm **zero** `AUDIT-`-prefixed rows remain in `pregnancies`, `children`, `notifications`, `alerts`, or `high_risk_flags`.
- `git status --short` shows only `audits/` as new, plus pre-existing unrelated untracked items from before this audit began (`.agents/`, `.playwright-verification/`, `install.cmd`, `skills-lock.json`) — `git diff --stat` against all tracked files is empty. `frontend/.env` was never edited and is confirmed byte-identical to its pre-audit copy.
