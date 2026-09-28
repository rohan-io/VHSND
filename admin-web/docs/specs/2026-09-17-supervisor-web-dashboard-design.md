# Supervisor (Admin) Web Dashboard — Design Spec

Status: approved by user 2026-09-17. Implementation plan to follow via `writing-plans`.

## 1. Purpose & scope

A new, fully isolated Next.js web app at `admin-web/` for the Supervisor/Admin
role in the VHSND pilot demo. Desktop dashboard, not a mobile screen. Does not
integrate with `backend/` (FastAPI+Mongo) or replace the existing mobile
`frontend/app/(admin)/` tab — both are noted as intentionally separate surfaces
for now (README + code comment).

Six sections, one shell, one shared mock data layer:
1. Beneficiary list to attend VHSND (due-list)
2. ANM attendance per session
3. Beneficiary VHSND miss report
4. Due report of VHSND (upcoming checkups across villages)
5. High-risk pregnancy update & reporting (filterable by 5 risk categories)
6. Referral of beneficiary (form)

## 2. Resolved conflicts (do not re-litigate)

- **Palette:** `frontend/src/constants/theme.ts` is source of truth, not
  `design_guidelines.json`. Conflicts found: brand hue (`#B23F2E`/`#1B7A4A` vs
  `#0D9488`/`#14B8A6`), `info` hex (`#0D9488` vs `#0EA5E9`), and `onWarning`
  (`#7A3E00` vs `#FFFFFF` — the JSON value fails WCAG AA on an amber fill;
  `theme.ts` is correct). Surfaces, status base colors, spacing, and radius
  scales already agree between the two files, so most of the port is
  uncontested — only brand/info/onWarning needed the explicit call.
- **design-taste-frontend skill scope:** its own §13 excludes dashboards/data
  tables. Apply only its universal bars: WCAG AA contrast (4.5:1), form
  patterns (label above input, error below, no placeholder-as-label), one
  locked accent + one locked radius scale, icon-library discipline (Phosphor
  family, not lucide, per its §3.C — align with whatever the starter already
  ships to avoid a second icon dependency), copy self-audit. Skip its
  landing-page mechanics (hero rules, eyebrow caps, marquee/bento/GSAP scroll
  patterns, the 1-10 dial system) — not applicable to a multi-route dashboard
  shell. Pair with the general `frontend-design` skill for actual dashboard
  layout/hierarchy taste.
- **Step 0 / origin state:** `origin` is `rohan-io/VHSND.git`; `master` is
  exactly `origin/main`'s tip. No `admin-web`-shaped folder exists anywhere in
  that history. Clean to build on.

## 3. Scaffold & isolation

- Shallow-clone `Kiranism/next-shadcn-dashboard-starter` into `admin-web/`,
  discard the upstream `.git`, run a fresh `git init` for `admin-web/` alone.
- Own `package.json`, lockfile, `node_modules`, `tsconfig.json` — zero shared
  dependency tree with `frontend/` or `backend/`.
- Strip: kanban board feature, product-demo pages, Clerk auth wiring (provider,
  middleware, sign-in/up pages, env vars).
- Keep and reuse as-is: sidebar nav shell, TanStack Table setup, card
  primitives, chart components, React Hook Form + Zod form patterns, shadcn/ui
  component library.
- If the clone creates any tooling/dependency conflict with the sibling
  folders, keep `admin-web/` isolated and flag back rather than merging
  anything — do not edit root-level config to accommodate it.

## 4. Data layer (`admin-web/src/data/`)

Plain typed TS fixture modules + pure functions. No fake API/fetch
indirection.

- `villages.ts` — the real 8: Mangarajpur, Badatrilochanpur, Balarampur
  (Jajpur Sadar block / Sector A) and Gandhapal, Baradiha, Kantira, Nuadihi,
  Singadia (Sukinda block), sourced from `frontend/src/api/demoDb.ts`'s
  `SECTOR_A`/`blockForVillage`.
- `beneficiaries.ts` — typed records using real ID conventions from
  `demoDb.ts`: `BEN-2026-{500+i}` (maternal), `CHILD-MCH-{7000+j}` (child).
  Reuse real seeded names/villages/ages from `PREG_NAMES`/`CHILD_NAMES` rather
  than inventing new ones, so cross-referencing the mobile app's demo data
  stays plausible.
- `riskFlags.ts` — reuses the real `RiskResult` shape
  (`auto_flags`/`manual_flags`/`reasons`) from `riskAssessment.ts`. Exports
  `bucketRiskReasons()` (TDD, see §6).
- `escalations.ts` — reuses real `ALERT-CRIT-ESC-*` id convention from
  `demoDb.ts`.
- `vhsndSessions.ts` — **net-new** (nothing in the mobile app models VHSND
  sessions/attendance/miss-reports yet). Originate fresh but keep consistent
  with real villages, real ANM names (Smruti Malla, Mamata Barik, Sujata
  Parida, Kabita Sahoo, Namita Sethi from `DEMO_USERS`), and the `ALERT-*`/
  `BEN-*` id conventions above. Exports due-date math (TDD) and miss-report
  filter logic (TDD).
- `referrals.ts` — net-new, form-backing types only (facility, reason, date,
  follow-up status/notes); no seeded referral records required beyond enough
  to populate the list view.

## 5. Auth & theming

- Single mock persona login: "Continue as Dilip Acharya (Chief Medical
  Officer)" — the real seeded admin (`DEMO_USERS[0]` in `demoDb.ts`, id
  `USR-ADMIN-001`). One button, no form fields.
- Session: a cookie flag set by a server action/route handler on click;
  `middleware.ts` gates all dashboard routes on its presence and redirects to
  `/login` otherwise. No JWT, no backend call.
- Theme tokens ported 1:1 from `theme.ts` (per §2) into shadcn's CSS-variable
  convention (`--primary`, `--secondary`, `--destructive`, `--border`,
  `--radius`, etc.) in `globals.css`, light + dark, using the same semantic
  approach the mobile app uses (screens read semantic names, never branch on
  scheme). Full status/surface/spacing/radius scale ported, not just the two
  brand colors.
- Card treatment varies by information hierarchy: a Critical Escalation card
  (section 5/6 territory) reads as structurally more urgent than a routine
  due-list item — distinct border weight, icon, and placement, not just a red
  background swap. Mirrors how the existing mobile `AdminDashboardScreen`
  already gives its escalation panel a different structural treatment than
  its snapshot chips (see `frontend/app/(admin)/index.tsx`).
- Every status/alert color gets a WCAG AA contrast check (4.5:1) before
  shipping — explicitly do not inherit the mobile app's `#EF4444`/`#FFFFFF`
  combination if it fails, and do not introduce a new failing pair.
- Button/status copy stays active-voice and consistent through a flow (e.g.
  "Mark Referred" action → "Referred" status label, not "Referral Marked").

## 6. TDD scope (test-first, these three functions only)

1. **`bucketRiskReasons(reasons: string[]): Record<RiskCategory, string[]>`**
   — maps each real reason string from `riskAssessment.ts` into one of 5 UI
   groups: Maternal Age, Previous Obstetric History, Current Pregnancy
   Complications, Maternal Medical Conditions, Pregnancy-Related Factors.
   Mapping source of truth: `MANUAL_FACTOR_OPTIONS[].section` →
   `obstetric_history`→Previous Obstetric History,
   `current_complications`→Current Pregnancy Complications,
   `medical_conditions`→Maternal Medical Conditions,
   `pregnancy_related`→Pregnancy-Related Factors. All of `auto_flags` (age
   thresholds, grand multipara, Rh-negative) map to **Maternal Age** as a
   block — this follows `riskAssessment.ts`'s own file-header documentation,
   which describes section 1 "Maternal Age" as the auto-derived section as a
   whole, not just the literal age checks. `COMORBIDITY_OPTIONS` reasons
   ("Known comorbidity: X") map to Maternal Medical Conditions (pre-existing
   disease). Free-text "Other: …" and "Flagged by clinician" have no natural
   section — **reasonable-default assumption**: bucket them under
   Pregnancy-Related Factors as a catch-all, flagged for confirmation. Must
   never throw on an unmapped string; falls back to the same catch-all.
   Every bucket key always present in the result, even if empty.
2. **Due Report due-date math** — pure function(s) computing, from a VHSND
   session date (or ANC/PMSMA due date), a bucket relative to a supplied
   "today" (never `Date.now()` read inside the pure function — inject it, for
   determinism): Overdue / Due Today / Due This Week / Upcoming.
3. **Miss Report filter logic** — pure function taking VHSND sessions,
   attendance/beneficiary-presence records, and the due-list, returning
   beneficiaries who were expected at a now-past session and have no
   "present" attendance record.

Test runner: the starter ships none, so add `vitest` as one new devDependency
(justified — TDD was explicitly required for these three). No test framework
elsewhere in `admin-web/`; trivial glue code stays untested per YAGNI.

## 7. Six nav routes

Separate routes under one dashboard shell, each reusing starter table/card/
form primitives — no new primitives hand-rolled where the starter already has
one that fits:

1. `/due-list` — village, session date, expected beneficiaries (table).
2. `/attendance` — per-session ANM attendance record (table + status).
3. `/miss-report` — due-but-absent beneficiaries, reason (if captured),
   follow-up status (table, built on `bucketRiskReasons`-adjacent filter
   logic from §6.3).
4. `/due-report` — upcoming checkups across villages: next session, PMSMA,
   ANC visit (table, built on §6.2 due-date math).
5. `/high-risk` — list/dashboard view filterable by the 5 `bucketRiskReasons`
   categories, current status.
6. `/referral/new` (+ a referral list view) — facility, reason, date,
   follow-up status/notes; RHF + Zod form component from the starter;
   actionable from a beneficiary's record.

## 8. Build sequencing

One shared Next.js app — no git worktrees per section (that fragments one
`package.json`/`node_modules` for what's really "add routes to one repo").

- **Phase 1 (sequential):** scaffold, strip, data layer (§4, including the 3
  TDD'd functions), theme port (§5), auth (§5), nav shell. Everything else
  depends on this being in place first.
- **Phase 2 (parallel subagents, one per route):** the 6 sections in §7. Each
  only touches its own route's files and reads the shared data layer/types/
  theme — no shared mutable state between them, safe to parallelize.
- **Phase 3 (sequential):** polish pass, self-review/audit, Playwright
  screenshots (light + dark) per section, README + debt log, verification-
  before-completion gate.

## 9. Verification

- Confirm Playwright MCP is connected before using it (it was already
  reconnected/available as of this session); if it genuinely can't connect,
  fall back to running the dev server and describing rendered state
  explicitly rather than silently skipping the check.
- Screenshot each of the 6 sections × light/dark for contrast and layout
  verification.
- Run a review/audit pass and the verification-before-completion gate across
  the whole `admin-web/` folder before reporting done.

## 10. Flagged debt (tracked, not blocking)

- `backend/server.py` and `frontend/app/(admin)/` are out of scope — no
  integration attempted with either.
- ANM attendance and referral facility field lists are reasonable-default
  assumptions, not sourced from any existing schema — confirm/adjust once
  scaffolded.
- `bucketRiskReasons()`'s catch-all bucket for free-text/clinician-override
  reasons (§6.1) is a judgment call, not a documented mapping — flagged.
- Any other shortcut taken for build speed gets logged here at completion
  time, not silently absorbed.
