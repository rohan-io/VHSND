# VHSND Supervisor Web Dashboard (Pilot Demo)

Desktop dashboard for the Supervisor/Admin (Chief Medical Officer) role in the
VHSND (Village Health, Sanitation & Nutrition Day) maternal & child health
pilot demo. Built on [next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter),
stripped of its Clerk auth, kanban board, and product/user demo pages.

**This is a pilot/demo, not live government infrastructure.** No real backend,
no real authentication, no persisted writes.

## Relationship to the mobile app's Admin tab

`frontend/app/(admin)/` (the sibling mobile app in this repo) already has an
Admin dashboard tab with its own KPI summary (see `admin-dashboard.png` at the
repo root). This web dashboard is **intentionally a separate surface** for
now — it adds six capabilities the mobile Admin tab does not have (due-list,
ANM attendance, miss-report, due-report, high-risk filtering, referrals), and
does not read from, write to, or integrate with either the mobile app or
`backend/` (FastAPI + Mongo). This was a deliberate scope decision, not an
oversight — see `docs/specs/2026-09-17-supervisor-web-dashboard-design.md`.

## Running locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run test     # vitest — bucketRiskReasons, due-date math, miss-report filter
npm run typecheck
npm run build
```

## Auth

Single mock persona — "Continue as Dilip Acharya (Chief Medical Officer)",
the real seeded admin from the mobile app's `demoDb.ts`. Sets an
`admin_session` cookie checked by `src/app/dashboard/layout.tsx`; no real
credentials, no backend call.

## Data

Everything under `src/data/` is a static, hand-authored TypeScript fixture
layer — no fetch/API/React-Query indirection, by design (this is a small,
fully client-resident demo dataset, not a paginated live backend). Grounded in
the real IDs, villages, ANM names, and risk-flag shape from the mobile app's
`frontend/src/api/demoDb.ts` and `frontend/src/utils/riskAssessment.ts`, but
**not imported from them** — admin-web stays fully isolated with its own
`package.json`/lockfile/`node_modules`/git history, per the build spec.

## Theme

Ported from `frontend/src/constants/theme.ts` (the mobile app's actual
shipped palette — brick-red `#B23F2E` / deep green `#1B7A4A`, deliberately
distinct from any political party palette), not the stale `design_guidelines.json`
at the repo root, which predates the app's rename and still has the old teal
palette. Registered as a new named theme (`vhsnd`, set as default) in this
starter's existing multi-theme system — see `src/styles/themes/vhsnd.css`.

## Known debt / deliberate scope decisions

- **`src/data/beneficiaries.ts`** is a hand-authored ~16-record subset, not a
  port of `demoDb.ts`'s full 50-record procedural generator — porting that
  generator would mean importing cross-package logic, breaking isolation.
  Covers all 8 villages, all 3 trimesters, all 5 risk categories, and routine
  (no-risk) cases.
- **`bucketRiskReasons()`'s catch-all bucket** (`src/data/riskFlags.ts`): free-text
  ("Other: …") and clinician-override ("Flagged by clinician") reasons have no
  natural risk-category section in the source data, so they fall under
  Pregnancy-Related Factors as a reasonable-default assumption — flagged for
  confirmation, not a documented mapping.
- **Referral facility list** (`src/data/referrals.ts`) and **ANM/beneficiary
  attendance field shapes** (`src/data/types.ts`) are reasonable-default
  assumptions grounded in real facility names from `demoDb.ts`, not sourced
  from any existing schema.
- **Referral form has no persistence** — submit shows a `toast.success('Referred')`
  and resets; there is no backend to write to in this demo.
- **Data layer bypasses this starter's own React Query + API-layer convention**
  (`api/types.ts` → `api/service.ts` → `api/queries.ts`, used by the starter's
  now-removed product/user demo features) — a deliberate ruling: the build
  spec explicitly calls for "arrays + a few pure functions, no fake API/
  indirection layer," which is disproportionate ceremony for small static
  fixture arrays with no real backend. New route pages import `src/data/*`
  directly in Server Components instead.
- **Tables use plain `useReactTable` + `getCoreRowModel`/`getSortedRowModel`**,
  not this starter's `useDataTable` hook (`src/hooks/use-data-table.ts`) —
  that hook drives server-paginated, URL-search-param-synced tables (`nuqs`),
  which is disproportionate for ~16-row static arrays with no server round-trip.
- **`--success`/`--warning`/`--info` theme tokens deviate from a literal
  `theme.ts` port on purpose**: mapping them as solid saturated fills with
  white text reproduced the exact class of WCAG AA failure the build spec
  called out (verified contrast as low as 2.54:1). Fixed by following
  `theme.ts`'s own actual usage pattern — a light tint background with its
  paired `*Text` color — and by using `errorText` (`#991B1B`) rather than the
  solid `error` (`#EF4444`) as the destructive button/badge fill. All pairs
  now verified ≥ 4.5:1.
- **`scripts/cleanup-templates/`** (this starter's own reference material for
  a Clerk-strip flow) is excluded from `tsc`'s scope via `tsconfig.json` — it
  referenced a hook (`use-nav`) removed during the manual Clerk strip and was
  never going to be run in this fork anyway.
