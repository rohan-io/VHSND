# Supervisor (Admin) Web Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `admin-web/`, an isolated Next.js + shadcn/ui desktop dashboard for the Supervisor/Admin (CMO) role, with six sections backed by a typed mock data layer grounded in the real mobile app's data shapes.

**Architecture:** Clone `Kiranism/next-shadcn-dashboard-starter`, strip Clerk/kanban/demo content, add a plain-TS fixture data layer under `src/data/` (three pure functions TDD'd), a single mock-persona cookie auth, a `theme.ts`-derived shadcn theme, and six route pages reusing the starter's table/card/form primitives.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind + shadcn/ui, TanStack Table, React Hook Form + Zod, vitest (new, test-only dependency).

**Spec:** `admin-web/docs/specs/2026-09-17-supervisor-web-dashboard-design.md`

## Global Constraints

- `admin-web/` is fully isolated: own `package.json`, lockfile, `node_modules`, `git init`. No imports from `frontend/` or `backend/`, no shared dependency tree.
- Do not touch `frontend/`'s or `backend/`'s own data or logic.
- Color/token source of truth: `frontend/src/constants/theme.ts` (not `design_guidelines.json` — see spec §2 for the specific resolved conflicts).
- WCAG AA contrast (4.5:1) required on every status/alert color actually shipped; verify, don't assume.
- design-taste-frontend skill applies only its universal bars (contrast, form patterns, one locked accent/radius, icon discipline, copy self-audit) — not its landing-page mechanics (spec §2).
- Real ID conventions must be preserved exactly: `BEN-2026-xxx`, `CHILD-MCH-xxxx`, `ALERT-CRIT-ESC-*`.
- The 8 real villages/2 blocks (spec §4) are fixed; do not invent villages.
- TDD (test-first) applies to exactly 3 functions: `bucketRiskReasons`, the due-date bucket math, the miss-report filter. Nowhere else in this codebase needs a test.
- Every shortcut taken gets logged in the debt section (Task 18), not silently absorbed.

---

## Task 1: Scaffold, strip, and verify boot

**Files:**
- Create: `admin-web/` (cloned starter contents)
- Modify: `admin-web/package.json` (remove Clerk deps), `admin-web/.env.example` (remove Clerk vars)
- Delete: starter's kanban feature directory, product-demo pages, Clerk provider/middleware/sign-in-up pages (exact paths depend on the cloned starter's current layout — locate via the searches in Step 3)

- [ ] **Step 1: Clone the starter without its git history**

```bash
cd "D:/Technocracy-2/Anm-Health-Connect-Offline-Demo/Anm-tracker-main"
git clone --depth 1 https://github.com/Kiranism/next-shadcn-dashboard-starter.git admin-web
rm -rf admin-web/.git
```

- [ ] **Step 2: Fresh, independent git repo for admin-web**

```bash
cd admin-web
git init
git branch -m main
```

(This repo stays uncommitted until Task 2 — commit once the spec/plan docs written in earlier steps are copied back in, see Step 6.)

- [ ] **Step 3: Locate what to strip**

```bash
grep -ril "clerk" admin-web/src admin-web/package.json
grep -ril "kanban" admin-web/src
find admin-web/src/app -maxdepth 3 -iname "*demo*" -o -iname "*product*"
```

Record every match — these are the deletion targets in Step 4. Do not delete anything not matched by one of these three searches (avoid guessing at file names).

- [ ] **Step 4: Delete Clerk, kanban, and demo-product content**

Remove every file/directory found in Step 3. For `package.json`, remove any `@clerk/*` dependency lines. For any route that imported a deleted Clerk provider (commonly `app/layout.tsx` or a route group's `layout.tsx`), remove the import and the `<ClerkProvider>`/auth-guard wrapper — replace with a plain passthrough layout for now; Task 8 adds the real mock auth.

- [ ] **Step 5: Install and boot-check**

```bash
cd admin-web
npm install
npm run dev &
sleep 6
curl -sf http://localhost:3000 > /dev/null && echo "BOOT OK" || echo "BOOT FAILED"
kill %1
```

If `BOOT FAILED`: read the dev server's stderr output, fix the broken import from Step 4 (most likely a dangling Clerk/kanban import), and rerun this step. Do not proceed to Task 2 until `BOOT OK`.

- [ ] **Step 6: Bring the spec/plan docs into the new repo and commit the scaffold**

```bash
cd admin-web
git add -A
git commit -m "Scaffold: next-shadcn-dashboard-starter, stripped of Clerk/kanban/demo pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Core types and fixture data (villages, beneficiaries, children, escalations)

**Files:**
- Create: `admin-web/src/data/types.ts`
- Create: `admin-web/src/data/villages.ts`
- Create: `admin-web/src/data/beneficiaries.ts`
- Create: `admin-web/src/data/escalations.ts`

**Interfaces:**
- Produces: `Block`, `Village`, `RiskResult`, `RiskCategory`, `Beneficiary`, `ChildBeneficiary`, `Escalation` types; `VILLAGES: Village[]`; `BENEFICIARIES: Beneficiary[]`; `CHILDREN: ChildBeneficiary[]`; `ESCALATIONS: Escalation[]` — every later task's fixtures and route pages import from here.

- [ ] **Step 1: Write the shared types**

```typescript
// admin-web/src/data/types.ts
export type Block = "Jajpur Sadar" | "Sukinda";

export interface Village {
  name: string;
  block: Block;
}

export interface RiskResult {
  is_critical: boolean;
  reasons: string[];
  auto_flags: string[];
  manual_flags: string[];
}

export type RiskCategory =
  | "Maternal Age"
  | "Previous Obstetric History"
  | "Current Pregnancy Complications"
  | "Maternal Medical Conditions"
  | "Pregnancy-Related Factors";

export interface Beneficiary {
  id: string; // BEN-2026-xxx
  name: string;
  husbandName: string;
  age: number;
  village: string;
  block: Block;
  anmId: string;
  anmName: string;
  trimester: 1 | 2 | 3;
  gestationalAgeLabel: string;
  risk: RiskResult;
}

export interface ChildBeneficiary {
  id: string; // CHILD-MCH-xxxx
  name: string;
  motherName: string;
  motherId: string; // BEN-2026-xxx
  village: string;
  block: Block;
  ageLabel: string;
}

export interface Escalation {
  id: string; // ALERT-CRIT-ESC-<pregnancyId>
  beneficiaryId: string;
  beneficiaryName: string;
  village: string;
  gestationalAgeLabel: string;
  reasons: string[];
  createdAt: string; // ISO date
}
```

- [ ] **Step 2: Villages fixture**

```typescript
// admin-web/src/data/villages.ts
import type { Village } from "./types";

export const VILLAGES: Village[] = [
  { name: "Mangarajpur", block: "Jajpur Sadar" },
  { name: "Badatrilochanpur", block: "Jajpur Sadar" },
  { name: "Balarampur", block: "Jajpur Sadar" },
  { name: "Gandhapal", block: "Sukinda" },
  { name: "Baradiha", block: "Sukinda" },
  { name: "Kantira", block: "Sukinda" },
  { name: "Nuadihi", block: "Sukinda" },
  { name: "Singadia", block: "Sukinda" },
];

export function blockForVillage(village: string): Block {
  return VILLAGES.find((v) => v.name === village)?.block ?? "Sukinda";
}

type Block = Village["block"];
```

- [ ] **Step 3: Beneficiaries fixture — curated subset, not the full 50-record generator**

A deliberate scope decision (log in Task 18's debt section): `frontend/src/api/demoDb.ts` procedurally generates 50 pregnancies via `assessRisk()`. Porting that generator would mean importing cross-package logic, which breaks the isolation constraint. Instead, hand-author ~16 records reusing real names/villages from `demoDb.ts`'s `PREG_NAMES` and real reason strings from `riskAssessment.ts`, covering: all 8 villages, all 3 trimesters, all 5 `bucketRiskReasons` categories at least once, and at least 2 beneficiaries with zero risk factors (routine cases).

```typescript
// admin-web/src/data/beneficiaries.ts
import type { Beneficiary } from "./types";
import { blockForVillage } from "./villages";

const ANM = {
  sectorA: { id: "USR-HW-001", name: "Smruti Malla (ANM)" }, // Mangarajpur, Badatrilochanpur, Balarampur
  sectorB: { id: "USR-HW-002", name: "Mamata Barik (ASHA)" }, // Gandhapal, Baradiha, Kantira, Nuadihi, Singadia
};
const anmFor = (village: string) =>
  ["Mangarajpur", "Badatrilochanpur", "Balarampur"].includes(village) ? ANM.sectorA : ANM.sectorB;

function beneficiary(
  seedIndex: number,
  name: string,
  husbandName: string,
  age: number,
  village: string,
  trimester: 1 | 2 | 3,
  gestationalAgeLabel: string,
  risk: Beneficiary["risk"]
): Beneficiary {
  const anm = anmFor(village);
  return {
    id: `BEN-2026-${500 + seedIndex}`,
    name,
    husbandName,
    age,
    village,
    block: blockForVillage(village),
    anmId: anm.id,
    anmName: anm.name,
    trimester,
    gestationalAgeLabel,
    risk,
  };
}

const noRisk: Beneficiary["risk"] = { is_critical: false, reasons: [], auto_flags: [], manual_flags: [] };

export const BENEFICIARIES: Beneficiary[] = [
  beneficiary(0, "Sasmita Jena", "Prakash Jena", 24, "Mangarajpur", 1, "10 Weeks 2 Days", noRisk),
  beneficiary(1, "Puspanjali Sahoo", "Bikram Sahoo", 22, "Badatrilochanpur", 2, "18 Weeks 0 Days", noRisk),
  beneficiary(2, "Rojalin Behera", "Sanjay Behera", 29, "Gandhapal", 3, "34 Weeks 3 Days", {
    is_critical: true,
    reasons: ["Advanced maternal age (35 years or older, especially first pregnancy)"],
    auto_flags: ["Advanced maternal age (35 years or older, especially first pregnancy)"],
    manual_flags: [],
  }),
  beneficiary(3, "Manaswini Nayak", "Deepak Nayak", 36, "Baradiha", 2, "22 Weeks 1 Day", {
    is_critical: true,
    reasons: ["Advanced maternal age (35 years or older, especially first pregnancy)"],
    auto_flags: ["Advanced maternal age (35 years or older, especially first pregnancy)"],
    manual_flags: [],
  }),
  beneficiary(4, "Lipsa Mohanty", "Rakesh Mohanty", 17, "Kantira", 1, "8 Weeks 5 Days", {
    is_critical: true,
    reasons: ["Adolescent pregnancy (under 18 years)"],
    auto_flags: ["Adolescent pregnancy (under 18 years)"],
    manual_flags: [],
  }),
  beneficiary(5, "Sunita Pradhan", "Gopal Pradhan", 26, "Balarampur", 3, "36 Weeks 0 Days", noRisk),
  beneficiary(6, "Ipsita Rout", "Manoj Rout", 28, "Mangarajpur", 2, "24 Weeks 2 Days", {
    is_critical: true,
    reasons: ["Previous caesarean section or uterine surgery"],
    auto_flags: [],
    manual_flags: ["Previous caesarean section or uterine surgery"],
  }),
  beneficiary(7, "Sujata Das", "Niranjan Das", 31, "Nuadihi", 3, "30 Weeks 6 Days", {
    is_critical: true,
    reasons: ["Hypertension, pre-eclampsia or eclampsia"],
    auto_flags: [],
    manual_flags: ["Hypertension, pre-eclampsia or eclampsia"],
  }),
  beneficiary(8, "Snigdha Parida", "Sushil Parida", 23, "Singadia", 1, "12 Weeks 0 Days", {
    is_critical: true,
    reasons: ["Anaemia, especially severe anaemia"],
    auto_flags: [],
    manual_flags: ["Anaemia, especially severe anaemia"],
  }),
  beneficiary(9, "Madhusmita Sahu", "Rabindra Sahu", 27, "Badatrilochanpur", 2, "20 Weeks 3 Days", {
    is_critical: true,
    reasons: ["Severe respiratory disease"],
    auto_flags: [],
    manual_flags: ["Severe respiratory disease"],
  }),
  beneficiary(10, "Basanti Swain", "Chittaranjan Swain", 32, "Gandhapal", 3, "33 Weeks 1 Day", {
    is_critical: true,
    reasons: ["Autoimmune disorder"],
    auto_flags: [],
    manual_flags: ["Autoimmune disorder"],
  }),
  beneficiary(11, "Sanjukta Barik", "Prasanna Barik", 25, "Mangarajpur", 1, "9 Weeks 4 Days", {
    is_critical: true,
    reasons: ["Very low or high BMI"],
    auto_flags: [],
    manual_flags: ["Very low or high BMI"],
  }),
  beneficiary(12, "Sabitri Soren", "Mangal Soren", 21, "Balarampur", 2, "26 Weeks 0 Days", {
    is_critical: true,
    reasons: ["Short stature (height under 145 cm)"],
    auto_flags: [],
    manual_flags: ["Short stature (height under 145 cm)"],
  }),
  beneficiary(13, "Nisha Bibi", "Sk. Imran", 28, "Baradiha", 3, "38 Weeks 2 Days", {
    is_critical: true,
    reasons: ["Known comorbidity: diabetes"],
    auto_flags: [],
    manual_flags: ["Known comorbidity: diabetes"],
  }),
  beneficiary(14, "Pratima Sethi", "Bijay Sethi", 30, "Kantira", 2, "19 Weeks 5 Days", noRisk),
  beneficiary(15, "Nirmala Panda", "Basudev Panda", 41, "Badatrilochanpur", 3, "35 Weeks 0 Days", {
    is_critical: true,
    reasons: [
      "Very advanced maternal age (40 years or older)",
      "Advanced maternal age (35 years or older, especially first pregnancy)",
    ],
    auto_flags: [
      "Very advanced maternal age (40 years or older)",
      "Advanced maternal age (35 years or older, especially first pregnancy)",
    ],
    manual_flags: [],
  }),
];
```

- [ ] **Step 4: Children fixture (short — used by beneficiary detail cross-references only, not a standalone section)**

```typescript
// admin-web/src/data/children.ts
import type { ChildBeneficiary } from "./types";
import { blockForVillage } from "./villages";

export const CHILDREN: ChildBeneficiary[] = [
  { id: "CHILD-MCH-7000", name: "Aryan Jena", motherName: "Sasmita Jena", motherId: "BEN-2026-500", village: "Mangarajpur", block: blockForVillage("Mangarajpur"), ageLabel: "45 Days" },
  { id: "CHILD-MCH-7001", name: "Anwesha Sahoo", motherName: "Puspanjali Sahoo", motherId: "BEN-2026-501", village: "Badatrilochanpur", block: blockForVillage("Badatrilochanpur"), ageLabel: "3 Months 0 Days" },
];
```

- [ ] **Step 5: Escalations fixture — derived from the high-risk beneficiaries, using the real `ALERT-CRIT-ESC-*` id convention**

```typescript
// admin-web/src/data/escalations.ts
import type { Escalation } from "./types";
import { BENEFICIARIES } from "./beneficiaries";

export const ESCALATIONS: Escalation[] = BENEFICIARIES.filter((b) => b.risk.is_critical).map((b, i) => ({
  id: `ALERT-CRIT-ESC-PREG-2026-${1000 + i}`,
  beneficiaryId: b.id,
  beneficiaryName: b.name,
  village: b.village,
  gestationalAgeLabel: b.gestationalAgeLabel,
  reasons: b.risk.reasons,
  createdAt: "2026-09-15",
}));
```

- [ ] **Step 6: Typecheck and commit**

```bash
cd admin-web
npx tsc --noEmit
git add src/data/types.ts src/data/villages.ts src/data/beneficiaries.ts src/data/children.ts src/data/escalations.ts
git commit -m "Add core fixture data: villages, beneficiaries, children, escalations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `bucketRiskReasons` (TDD)

**Files:**
- Create: `admin-web/src/data/riskFlags.ts`
- Test: `admin-web/src/data/riskFlags.test.ts`
- Modify: `admin-web/package.json` (add `vitest` devDependency + `test` script)

**Interfaces:**
- Consumes: `RiskCategory` from `./types` (Task 2).
- Produces: `bucketRiskReasons(reasons: string[]): Record<RiskCategory, string[]>` — used by the `/high-risk` route (Task 14).

- [ ] **Step 1: Add vitest**

```bash
cd admin-web
npm install -D vitest
```

Add to `admin-web/package.json` `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test**

```typescript
// admin-web/src/data/riskFlags.test.ts
import { describe, it, expect } from "vitest";
import { bucketRiskReasons } from "./riskFlags";

describe("bucketRiskReasons", () => {
  it("returns all 5 category keys present even when empty", () => {
    const result = bucketRiskReasons([]);
    expect(Object.keys(result)).toEqual([
      "Maternal Age",
      "Previous Obstetric History",
      "Current Pregnancy Complications",
      "Maternal Medical Conditions",
      "Pregnancy-Related Factors",
    ]);
    expect(result["Maternal Age"]).toEqual([]);
  });

  it("buckets age auto-flag under Maternal Age", () => {
    const result = bucketRiskReasons(["Adolescent pregnancy (under 18 years)"]);
    expect(result["Maternal Age"]).toEqual(["Adolescent pregnancy (under 18 years)"]);
  });

  it("buckets grand multipara under Maternal Age (per riskAssessment.ts's own section-1 convention)", () => {
    const result = bucketRiskReasons(["Grand multipara (5 or more pregnancies)"]);
    expect(result["Maternal Age"]).toEqual(["Grand multipara (5 or more pregnancies)"]);
  });

  it("buckets Rh-negative under Maternal Age", () => {
    const result = bucketRiskReasons(["Rh-negative blood group (O-)"]);
    expect(result["Maternal Age"]).toEqual(["Rh-negative blood group (O-)"]);
  });

  it("buckets obstetric history reasons", () => {
    const result = bucketRiskReasons(["Previous caesarean section or uterine surgery"]);
    expect(result["Previous Obstetric History"]).toEqual(["Previous caesarean section or uterine surgery"]);
  });

  it("buckets current pregnancy complications", () => {
    const result = bucketRiskReasons(["Hypertension, pre-eclampsia or eclampsia"]);
    expect(result["Current Pregnancy Complications"]).toEqual(["Hypertension, pre-eclampsia or eclampsia"]);
  });

  it("buckets medical conditions", () => {
    const result = bucketRiskReasons(["Severe respiratory disease"]);
    expect(result["Maternal Medical Conditions"]).toEqual(["Severe respiratory disease"]);
  });

  it("buckets pregnancy-related factors", () => {
    const result = bucketRiskReasons(["Very low or high BMI"]);
    expect(result["Pregnancy-Related Factors"]).toEqual(["Very low or high BMI"]);
  });

  it("buckets comorbidities under Maternal Medical Conditions", () => {
    const result = bucketRiskReasons(["Known comorbidity: HIV"]);
    expect(result["Maternal Medical Conditions"]).toEqual(["Known comorbidity: HIV"]);
  });

  it("catch-all buckets free-text and clinician override under Pregnancy-Related Factors", () => {
    const result = bucketRiskReasons(["Other: Unusual cord insertion", "Flagged by clinician"]);
    expect(result["Pregnancy-Related Factors"]).toEqual(["Other: Unusual cord insertion", "Flagged by clinician"]);
  });

  it("never throws on an unmapped string, falls back to the catch-all", () => {
    expect(() => bucketRiskReasons(["Some future reason not yet mapped"])).not.toThrow();
    const result = bucketRiskReasons(["Some future reason not yet mapped"]);
    expect(result["Pregnancy-Related Factors"]).toContain("Some future reason not yet mapped");
  });

  it("handles multiple reasons across categories, one per bucket", () => {
    const result = bucketRiskReasons([
      "Advanced maternal age (35 years or older, especially first pregnancy)",
      "Previous caesarean section or uterine surgery",
      "Hypertension, pre-eclampsia or eclampsia",
      "Severe respiratory disease",
      "Very low or high BMI",
    ]);
    expect(result["Maternal Age"]).toHaveLength(1);
    expect(result["Previous Obstetric History"]).toHaveLength(1);
    expect(result["Current Pregnancy Complications"]).toHaveLength(1);
    expect(result["Maternal Medical Conditions"]).toHaveLength(1);
    expect(result["Pregnancy-Related Factors"]).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/data/riskFlags.test.ts`
Expected: FAIL — `riskFlags.ts` does not exist yet.

- [ ] **Step 4: Write the implementation**

```typescript
// admin-web/src/data/riskFlags.ts
import type { RiskCategory } from "./types";

const SECTION_TO_CATEGORY: Record<string, RiskCategory> = {
  obstetric_history: "Previous Obstetric History",
  current_complications: "Current Pregnancy Complications",
  medical_conditions: "Maternal Medical Conditions",
  pregnancy_related: "Pregnancy-Related Factors",
};

// Reason text -> section, copied verbatim from frontend/src/utils/riskAssessment.ts's
// MANUAL_FACTOR_OPTIONS (reason, section pairs) — this file does not import that
// module (admin-web stays isolated), so the mapping is duplicated here by value.
const REASON_TO_SECTION: Record<string, string> = {
  "Previous caesarean section or uterine surgery": "obstetric_history",
  "Previous stillbirth or neonatal death": "obstetric_history",
  "Previous preterm birth": "obstetric_history",
  "Previous recurrent abortions": "obstetric_history",
  "Previous baby with congenital anomaly": "obstetric_history",
  "Previous PPH or severe obstetric complication": "obstetric_history",
  "Previous severe pre-eclampsia or eclampsia": "obstetric_history",
  "Previous stillbirth or postpartum haemorrhage": "obstetric_history", // legacy combined field
  "Hypertension, pre-eclampsia or eclampsia": "current_complications",
  "Anaemia, especially severe anaemia": "current_complications",
  "Antepartum haemorrhage": "current_complications",
  "Multiple pregnancy (twins or more)": "current_complications",
  "Malpresentation": "current_complications",
  "Placenta previa or accreta": "current_complications",
  "Fetal growth restriction": "current_complications",
  "Rh isoimmunisation": "current_complications",
  "Oligohydramnios or polyhydramnios": "current_complications",
  "Congenital fetal anomaly": "current_complications",
  "Severe respiratory disease": "medical_conditions",
  "Autoimmune disorder": "medical_conditions",
  "Very low or high BMI": "pregnancy_related",
  "Poor nutritional status": "pregnancy_related",
  "Poor antenatal care": "pregnancy_related",
  "Post-term pregnancy (41 weeks or more)": "pregnancy_related",
  "Prolonged rupture of membranes": "pregnancy_related",
  "Short stature (height under 145 cm)": "pregnancy_related",
};

// Reasonable-default assumption (flagged in spec §6.1 / debt log): free-text and
// clinician-override reasons have no natural section, so they fall into this
// catch-all. Same fallback for any future reason string this table hasn't seen.
const CATCH_ALL: RiskCategory = "Pregnancy-Related Factors";

function isAutoFlag(reason: string): boolean {
  return (
    reason.startsWith("Adolescent pregnancy") ||
    reason.startsWith("Advanced maternal age") ||
    reason.startsWith("Very advanced maternal age") ||
    reason.startsWith("Grand multipara") ||
    reason.startsWith("Rh-negative blood group")
  );
}

export function bucketRiskReasons(reasons: string[]): Record<RiskCategory, string[]> {
  const result: Record<RiskCategory, string[]> = {
    "Maternal Age": [],
    "Previous Obstetric History": [],
    "Current Pregnancy Complications": [],
    "Maternal Medical Conditions": [],
    "Pregnancy-Related Factors": [],
  };
  for (const reason of reasons) {
    if (isAutoFlag(reason)) {
      result["Maternal Age"].push(reason);
      continue;
    }
    if (reason.startsWith("Known comorbidity:")) {
      result["Maternal Medical Conditions"].push(reason);
      continue;
    }
    const section = REASON_TO_SECTION[reason];
    const category = section ? SECTION_TO_CATEGORY[section] : undefined;
    result[category ?? CATCH_ALL].push(reason);
  }
  return result;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/riskFlags.test.ts`
Expected: PASS, all 12 cases.

- [ ] **Step 6: Commit**

```bash
cd admin-web
git add package.json package-lock.json src/data/riskFlags.ts src/data/riskFlags.test.ts
git commit -m "Add bucketRiskReasons with TDD coverage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Due Report due-date math (TDD)

**Files:**
- Create: `admin-web/src/data/dueReport.ts`
- Test: `admin-web/src/data/dueReport.test.ts`

**Interfaces:**
- Produces: `type DueBucket = "Overdue" | "Due Today" | "Due This Week" | "Upcoming"`; `daysUntil(dateISO: string, today: Date): number`; `dueBucket(dateISO: string, today: Date): DueBucket` — used by the `/due-report` route (Task 13) and `/miss-report`'s past-session check (Task 5/12).

- [ ] **Step 1: Write the failing test**

```typescript
// admin-web/src/data/dueReport.test.ts
import { describe, it, expect } from "vitest";
import { daysUntil, dueBucket } from "./dueReport";

const TODAY = new Date(2026, 8, 17); // 2026-09-17

describe("daysUntil", () => {
  it("returns 0 for today", () => {
    expect(daysUntil("2026-09-17", TODAY)).toBe(0);
  });
  it("returns a positive count for future dates", () => {
    expect(daysUntil("2026-09-20", TODAY)).toBe(3);
  });
  it("returns a negative count for past dates", () => {
    expect(daysUntil("2026-09-10", TODAY)).toBe(-7);
  });
});

describe("dueBucket", () => {
  it("buckets past dates as Overdue", () => {
    expect(dueBucket("2026-09-10", TODAY)).toBe("Overdue");
  });
  it("buckets today as Due Today", () => {
    expect(dueBucket("2026-09-17", TODAY)).toBe("Due Today");
  });
  it("buckets within the next 7 days as Due This Week", () => {
    expect(dueBucket("2026-09-24", TODAY)).toBe("Due This Week");
  });
  it("buckets day 8+ as Upcoming", () => {
    expect(dueBucket("2026-09-25", TODAY)).toBe("Upcoming");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/dueReport.test.ts`
Expected: FAIL — `dueReport.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// admin-web/src/data/dueReport.ts
export type DueBucket = "Overdue" | "Due Today" | "Due This Week" | "Upcoming";

export function daysUntil(dateISO: string, today: Date): number {
  const target = new Date(`${dateISO}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

export function dueBucket(dateISO: string, today: Date): DueBucket {
  const d = daysUntil(dateISO, today);
  if (d < 0) return "Overdue";
  if (d === 0) return "Due Today";
  if (d <= 7) return "Due This Week";
  return "Upcoming";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/dueReport.test.ts`
Expected: PASS, all 7 cases.

- [ ] **Step 5: Commit**

```bash
cd admin-web
git add src/data/dueReport.ts src/data/dueReport.test.ts
git commit -m "Add due-date bucket math with TDD coverage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: VHSND sessions, ANM attendance, beneficiary attendance fixtures + miss-report filter (TDD)

**Files:**
- Modify: `admin-web/src/data/types.ts` (add session/attendance types)
- Create: `admin-web/src/data/vhsndSessions.ts`
- Create: `admin-web/src/data/missReport.ts`
- Test: `admin-web/src/data/missReport.test.ts`

**Interfaces:**
- Consumes: `Block` from `./types` (Task 2).
- Produces: `VhsndSession`, `AnmAttendanceRecord`, `BeneficiaryAttendance` types; `VHSND_SESSIONS`, `ANM_ATTENDANCE`, `BENEFICIARY_ATTENDANCE` fixtures; `filterMissedBeneficiaries(sessions, attendance, today): MissedBeneficiary[]` — used by `/due-list` (Task 10), `/attendance` (Task 11), `/miss-report` (Task 12).

Note: ANM attendance (did the health worker show up) and beneficiary attendance (did the individual mother/child show up) are two distinct concepts per spec §7 sections 2 and 3 — do not collapse them into one type.

- [ ] **Step 1: Add the session/attendance types**

```typescript
// admin-web/src/data/types.ts — append to the file created in Task 2
export interface VhsndSession {
  id: string; // VHSND-2026-<village-code>-<seq>
  village: string;
  block: Block;
  date: string; // ISO date, YYYY-MM-DD
  anmId: string;
  anmName: string;
  expectedBeneficiaryIds: string[];
}

export type AttendanceStatus = "Present" | "Absent" | "Not Recorded";

export interface AnmAttendanceRecord {
  sessionId: string;
  anmId: string;
  anmName: string;
  status: AttendanceStatus;
  checkInTime?: string; // "HH:MM"
}

export interface BeneficiaryAttendance {
  sessionId: string;
  beneficiaryId: string;
  status: AttendanceStatus;
  reason?: string;
  followUpStatus?: "Pending" | "Contacted" | "Rescheduled";
}
```

- [ ] **Step 2: Sessions + attendance fixtures**

Dates are relative to a fixed reference "today" of 2026-09-17 (matches this plan's authoring date) so the mix of past/future sessions is deterministic for screenshots; route pages (Tasks 10-13) call `new Date()` at render time, so real "today" still works correctly once relative math is applied — only the fixture *dates* are hardcoded, not the bucket logic.

```typescript
// admin-web/src/data/vhsndSessions.ts
import type { VhsndSession, AnmAttendanceRecord, BeneficiaryAttendance } from "./types";

export const VHSND_SESSIONS: VhsndSession[] = [
  { id: "VHSND-2026-MGRJ-01", village: "Mangarajpur", block: "Jajpur Sadar", date: "2026-09-10", anmId: "USR-HW-001", anmName: "Smruti Malla (ANM)", expectedBeneficiaryIds: ["BEN-2026-500", "BEN-2026-511"] },
  { id: "VHSND-2026-BDTP-01", village: "Badatrilochanpur", block: "Jajpur Sadar", date: "2026-09-12", anmId: "USR-HW-001", anmName: "Smruti Malla (ANM)", expectedBeneficiaryIds: ["BEN-2026-501", "BEN-2026-509", "BEN-2026-515"] },
  { id: "VHSND-2026-GNDP-01", village: "Gandhapal", block: "Sukinda", date: "2026-09-15", anmId: "USR-HW-002", anmName: "Mamata Barik (ASHA)", expectedBeneficiaryIds: ["BEN-2026-502", "BEN-2026-510"] },
  { id: "VHSND-2026-MGRJ-02", village: "Mangarajpur", block: "Jajpur Sadar", date: "2026-09-24", anmId: "USR-HW-001", anmName: "Smruti Malla (ANM)", expectedBeneficiaryIds: ["BEN-2026-500", "BEN-2026-506"] },
  { id: "VHSND-2026-BLRM-01", village: "Balarampur", block: "Jajpur Sadar", date: "2026-09-30", anmId: "USR-HW-001", anmName: "Smruti Malla (ANM)", expectedBeneficiaryIds: ["BEN-2026-505", "BEN-2026-512"] },
  { id: "VHSND-2026-SGDA-01", village: "Singadia", block: "Sukinda", date: "2026-10-03", anmId: "USR-HW-002", anmName: "Mamata Barik (ASHA)", expectedBeneficiaryIds: ["BEN-2026-508"] },
];

export const ANM_ATTENDANCE: AnmAttendanceRecord[] = [
  { sessionId: "VHSND-2026-MGRJ-01", anmId: "USR-HW-001", anmName: "Smruti Malla (ANM)", status: "Present", checkInTime: "09:15" },
  { sessionId: "VHSND-2026-BDTP-01", anmId: "USR-HW-001", anmName: "Smruti Malla (ANM)", status: "Present", checkInTime: "09:40" },
  { sessionId: "VHSND-2026-GNDP-01", anmId: "USR-HW-002", anmName: "Mamata Barik (ASHA)", status: "Absent" },
];

export const BENEFICIARY_ATTENDANCE: BeneficiaryAttendance[] = [
  { sessionId: "VHSND-2026-MGRJ-01", beneficiaryId: "BEN-2026-500", status: "Present" },
  { sessionId: "VHSND-2026-MGRJ-01", beneficiaryId: "BEN-2026-511", status: "Absent", reason: "Travelled to relatives", followUpStatus: "Contacted" },
  { sessionId: "VHSND-2026-BDTP-01", beneficiaryId: "BEN-2026-501", status: "Present" },
  { sessionId: "VHSND-2026-BDTP-01", beneficiaryId: "BEN-2026-509", status: "Present" },
  // BEN-2026-515 at VHSND-2026-BDTP-01 has no record: an unrecorded past-session miss.
];
```

- [ ] **Step 3: Write the failing test for the miss-report filter**

```typescript
// admin-web/src/data/missReport.test.ts
import { describe, it, expect } from "vitest";
import { filterMissedBeneficiaries } from "./missReport";
import type { VhsndSession, BeneficiaryAttendance } from "./types";

const TODAY = new Date(2026, 8, 17); // 2026-09-17

const sessions: VhsndSession[] = [
  { id: "VHSND-2026-MGRJ-01", village: "Mangarajpur", block: "Jajpur Sadar", date: "2026-09-10", anmId: "USR-HW-001", anmName: "Smruti Malla (ANM)", expectedBeneficiaryIds: ["BEN-2026-500", "BEN-2026-501"] },
  { id: "VHSND-2026-MGRJ-02", village: "Mangarajpur", block: "Jajpur Sadar", date: "2026-09-24", anmId: "USR-HW-001", anmName: "Smruti Malla (ANM)", expectedBeneficiaryIds: ["BEN-2026-500"] },
];

describe("filterMissedBeneficiaries", () => {
  it("excludes beneficiaries explicitly marked Present at a past session", () => {
    const attendance: BeneficiaryAttendance[] = [
      { sessionId: "VHSND-2026-MGRJ-01", beneficiaryId: "BEN-2026-500", status: "Present" },
    ];
    const result = filterMissedBeneficiaries(sessions, attendance, TODAY);
    expect(result.map((r) => r.beneficiaryId)).toEqual(["BEN-2026-501"]);
  });

  it("includes beneficiaries explicitly marked Absent, carrying the reason through", () => {
    const attendance: BeneficiaryAttendance[] = [
      { sessionId: "VHSND-2026-MGRJ-01", beneficiaryId: "BEN-2026-500", status: "Absent", reason: "Travelled to relatives" },
      { sessionId: "VHSND-2026-MGRJ-01", beneficiaryId: "BEN-2026-501", status: "Present" },
    ];
    const result = filterMissedBeneficiaries(sessions, attendance, TODAY);
    expect(result).toEqual([
      { beneficiaryId: "BEN-2026-500", sessionId: "VHSND-2026-MGRJ-01", village: "Mangarajpur", sessionDate: "2026-09-10", reason: "Travelled to relatives", followUpStatus: "Pending" },
    ]);
  });

  it("treats a missing attendance record for a past session as missed", () => {
    const result = filterMissedBeneficiaries(sessions, [], TODAY);
    expect(result.map((r) => r.beneficiaryId).sort()).toEqual(["BEN-2026-500", "BEN-2026-501"]);
  });

  it("ignores future sessions entirely", () => {
    const result = filterMissedBeneficiaries(sessions, [], TODAY);
    expect(result.some((r) => r.sessionId === "VHSND-2026-MGRJ-02")).toBe(false);
  });

  it("carries through a recorded followUpStatus instead of defaulting to Pending", () => {
    const attendance: BeneficiaryAttendance[] = [
      { sessionId: "VHSND-2026-MGRJ-01", beneficiaryId: "BEN-2026-500", status: "Absent", followUpStatus: "Contacted" },
    ];
    const result = filterMissedBeneficiaries(sessions, attendance, TODAY);
    expect(result.find((r) => r.beneficiaryId === "BEN-2026-500")?.followUpStatus).toBe("Contacted");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/data/missReport.test.ts`
Expected: FAIL — `missReport.ts` does not exist yet.

- [ ] **Step 5: Write the implementation**

```typescript
// admin-web/src/data/missReport.ts
import type { VhsndSession, BeneficiaryAttendance } from "./types";

export interface MissedBeneficiary {
  beneficiaryId: string;
  sessionId: string;
  village: string;
  sessionDate: string;
  reason?: string;
  followUpStatus: "Pending" | "Contacted" | "Rescheduled";
}

export function filterMissedBeneficiaries(
  sessions: VhsndSession[],
  attendance: BeneficiaryAttendance[],
  today: Date
): MissedBeneficiary[] {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const byKey = new Map(attendance.map((a) => [`${a.sessionId}::${a.beneficiaryId}`, a]));
  const missed: MissedBeneficiary[] = [];

  for (const session of sessions) {
    const sessionDate = new Date(`${session.date}T00:00:00`);
    if (sessionDate.getTime() >= base.getTime()) continue; // only past sessions can be "missed"

    for (const beneficiaryId of session.expectedBeneficiaryIds) {
      const record = byKey.get(`${session.id}::${beneficiaryId}`);
      if (record?.status === "Present") continue;
      missed.push({
        beneficiaryId,
        sessionId: session.id,
        village: session.village,
        sessionDate: session.date,
        reason: record?.reason,
        followUpStatus: record?.followUpStatus ?? "Pending",
      });
    }
  }
  return missed;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/data/missReport.test.ts`
Expected: PASS, all 5 cases.

- [ ] **Step 7: Typecheck and commit**

```bash
cd admin-web
npx tsc --noEmit
git add src/data/types.ts src/data/vhsndSessions.ts src/data/missReport.ts src/data/missReport.test.ts
git commit -m "Add VHSND session/attendance fixtures and miss-report filter with TDD coverage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Referral types and fixtures

**Files:**
- Modify: `admin-web/src/data/types.ts` (add `Referral`, `ReferralFacility`)
- Create: `admin-web/src/data/referrals.ts`

**Interfaces:**
- Produces: `Referral` type; `REFERRAL_FACILITIES: string[]`; `REFERRALS: Referral[]` — used by `/referral` (Task 15).

- [ ] **Step 1: Add the referral type**

```typescript
// admin-web/src/data/types.ts — append
export interface Referral {
  id: string; // REF-2026-xxx
  beneficiaryId: string;
  beneficiaryName: string;
  facility: string;
  reason: string;
  date: string; // ISO date
  followUpStatus: "Pending" | "Referred" | "Completed";
  notes?: string;
}
```

- [ ] **Step 2: Fixture data**

Facility list is a reasonable-default assumption (flagged per spec §7 Notes) grounded in the real facility names already present in `demoDb.ts` (`DHH Jajpur`, `CHC Jajpur Sadar`, `CHC Sukinda`) plus one higher-tier referral destination for genuinely critical escalations.

```typescript
// admin-web/src/data/referrals.ts
import type { Referral } from "./types";

export const REFERRAL_FACILITIES = [
  "CHC Jajpur Sadar",
  "CHC Sukinda",
  "DHH Jajpur",
  "SCB Medical College, Cuttack",
] as const;

export const REFERRALS: Referral[] = [
  {
    id: "REF-2026-001",
    beneficiaryId: "BEN-2026-502",
    beneficiaryName: "Rojalin Behera",
    facility: "DHH Jajpur",
    reason: "Advanced maternal age — third trimester, needs specialist monitoring",
    date: "2026-09-14",
    followUpStatus: "Referred",
    notes: "Family informed; transport arranged via ASHA.",
  },
  {
    id: "REF-2026-002",
    beneficiaryId: "BEN-2026-507",
    beneficiaryName: "Sujata Das",
    facility: "CHC Sukinda",
    reason: "Hypertension, pre-eclampsia or eclampsia — BP monitoring",
    date: "2026-09-16",
    followUpStatus: "Pending",
  },
];
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd admin-web
npx tsc --noEmit
git add src/data/types.ts src/data/referrals.ts
git commit -m "Add referral types and fixture data

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Theme port (theme.ts → shadcn CSS variables, light + dark)

**Files:**
- Modify: `admin-web/src/app/globals.css` (or wherever the starter's Tailwind base/theme CSS variables live — locate via Step 1)
- Modify: `admin-web/tailwind.config.ts` (if the starter defines custom color names there rather than purely via CSS vars)

- [ ] **Step 1: Locate the starter's existing theme variables**

```bash
cd admin-web
grep -rl "\-\-primary" src/app src/styles 2>/dev/null
```

This is the file to edit — shadcn starters put `:root { --primary: ...; }` and a `.dark { ... }` block here.

- [ ] **Step 2: Convert `theme.ts` tokens to the CSS-variable set shadcn expects**

Source values (verbatim from `frontend/src/constants/theme.ts`, confirmed as source of truth per spec §2):

| shadcn var | Light (`theme.ts` light) | Dark (`theme.ts` dark) |
|---|---|---|
| `--background` | `#F8FAFC` (surface) | `#0F0F0F` (surface) |
| `--foreground` | `#0F172A` (textPrimary) | `#F5F5F5` (textPrimary) |
| `--card` | `#FFFFFF` (surfaceSecondary) | `#1A1A1A` (surfaceSecondary) |
| `--card-foreground` | `#0F172A` | `#F5F5F5` |
| `--primary` | `#B23F2E` (orange[600]) | `#E8917B` (orangeDark[600]) |
| `--primary-foreground` | `#FFFFFF` (onBrand) | `#1A1A1A` (onBrand) |
| `--secondary` | `#1B7A4A` (green[600]) | `#4FB587` (greenDark[600]) |
| `--secondary-foreground` | `#FFFFFF` | `#121212` |
| `--muted` | `#F1F5F9` (surfaceTertiary) | `#262626` (surfaceTertiary) |
| `--muted-foreground` | `#64748B` (textMuted) | `#8C8C8C` (textMuted) |
| `--destructive` | `#EF4444` (error) | `#F98A8A` (error) |
| `--destructive-foreground` | `#FFFFFF` | `#121212` |
| `--border` | `#E2E8F0` | `#333333` |
| `--input` | `#E2E8F0` (border) | `#333333` (border) |
| `--ring` | `#B23F2E` (brand) | `#E8917B` (brand) |
| `--radius` | `0.75rem` (12px, `radius.md`) | same |
| custom `--success` | `#10B981` | `#3FD98C` |
| custom `--success-foreground` | `#FFFFFF` | `#121212` |
| custom `--warning` | `#F59E0B` | `#F2B84A` |
| custom `--warning-foreground` | `#7A3E00` (NOT `#FFFFFF` — spec §2 flags the JSON's white-on-amber as an AA failure) | `#1A1A1A` |
| custom `--info` | `#0D9488` | `#2DD4BF` |
| custom `--info-foreground` | `#FFFFFF` | `#121212` |

Convert each hex to an HSL triplet in the `H S% L%` form shadcn's CSS vars expect (e.g. `#B23F2E` → `9 60% 41%`) — write a short throwaway Node script rather than converting by hand:

```bash
node -e '
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch (max) {
      case r: h = (g-b)/d + (g<b?6:0); break;
      case g: h = (b-r)/d + 2; break;
      default: h = (r-g)/d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h*360)} ${Math.round(s*100)}% ${Math.round(l*100)}%`;
}
const tokens = {
  "background-light": "#F8FAFC", "background-dark": "#0F0F0F",
  "foreground-light": "#0F172A", "foreground-dark": "#F5F5F5",
  "card-light": "#FFFFFF", "card-dark": "#1A1A1A",
  "primary-light": "#B23F2E", "primary-dark": "#E8917B",
  "secondary-light": "#1B7A4A", "secondary-dark": "#4FB587",
  "muted-light": "#F1F5F9", "muted-dark": "#262626",
  "muted-foreground-light": "#64748B", "muted-foreground-dark": "#8C8C8C",
  "destructive-light": "#EF4444", "destructive-dark": "#F98A8A",
  "border-light": "#E2E8F0", "border-dark": "#333333",
  "success-light": "#10B981", "success-dark": "#3FD98C",
  "warning-light": "#F59E0B", "warning-dark": "#F2B84A",
  "warning-foreground-light": "#7A3E00", "warning-foreground-dark": "#1A1A1A",
  "info-light": "#0D9488", "info-dark": "#2DD4BF",
};
for (const [k,v] of Object.entries(tokens)) console.log(k, "->", hexToHsl(v));
'
```

Use the printed HSL values to fill in the table above, then write them into the `:root` and `.dark` blocks in the file found in Step 1, following that file's existing formatting exactly (same variable names it already declares for `--background`, `--primary`, etc.; add `--success`, `--warning`, `--info` and their `-foreground` pairs as new custom properties in the same block, plus matching entries in `tailwind.config.ts`'s `theme.extend.colors` if the starter wires CSS vars through Tailwind color names there).

- [ ] **Step 3: Visual sanity check**

```bash
npm run dev &
sleep 6
curl -sf http://localhost:3000 > /dev/null && echo "BOOT OK" || echo "BOOT FAILED"
kill %1
```

(Full visual/contrast verification happens in Task 17 via Playwright, once there are pages to screenshot.)

- [ ] **Step 4: Commit**

```bash
cd admin-web
git add -A
git commit -m "Port theme.ts tokens into shadcn CSS variables (light + dark)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Mock auth — single persona, cookie session, middleware gate

**Files:**
- Create: `admin-web/src/app/login/page.tsx`
- Create: `admin-web/src/app/login/actions.ts`
- Create: `admin-web/src/middleware.ts`
- Modify: the dashboard's root layout (wherever Clerk's `<ClerkProvider>` was removed in Task 1 Step 4) to read the session cookie for a display name / logout control

**Interfaces:**
- Produces: a `admin_session` cookie set to `"USR-ADMIN-001"` on login; `logout()` server action clearing it. Route pages (Tasks 10-15) do not need to check auth themselves — middleware handles the gate.

- [ ] **Step 1: Login page with the single persona button**

```tsx
// admin-web/src/app/login/page.tsx
import { continueAsAdmin } from "./actions";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 text-card-foreground shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">VHSND Supervisor Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Pilot demo — not connected to live government infrastructure.
          </p>
        </div>
        <form action={continueAsAdmin}>
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Continue as Dilip Acharya (Chief Medical Officer)
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Server action to set the session cookie**

```typescript
// admin-web/src/app/login/actions.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function continueAsAdmin() {
  const store = await cookies();
  store.set("admin_session", "USR-ADMIN-001", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/due-list");
}

export async function logout() {
  const store = await cookies();
  store.delete("admin_session");
  redirect("/login");
}
```

- [ ] **Step 3: Middleware gate**

```typescript
// admin-web/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }
  const session = request.cookies.get("admin_session");
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 4: Wire the persona name + logout into the shell layout**

In the root dashboard layout file (the one that previously held `<ClerkProvider>`/Clerk's `<UserButton>`, removed in Task 1), replace any leftover Clerk user-display component with:

```tsx
import { cookies } from "next/headers";
import { logout } from "@/app/login/actions";

// inside the layout component, server-side:
const session = (await cookies()).get("admin_session");
const displayName = session ? "Dilip Acharya (Chief Medical Officer)" : null;

// in the JSX where the user menu previously rendered:
{displayName && (
  <form action={logout} className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground">{displayName}</span>
    <button type="submit" className="text-sm font-medium text-destructive hover:underline">
      Sign out
    </button>
  </form>
)}
```

Adjust the JSX insertion point to match wherever the starter's header/sidebar actually renders its user control — locate it via `grep -rl "UserButton\|SignedIn" src` before editing (should already be empty after Task 1's Clerk strip; if a leftover reference exists, this is where it gets replaced).

- [ ] **Step 5: Manual verification**

```bash
npm run dev &
sleep 6
curl -sfL http://localhost:3000/due-list -o /tmp/redirect_check.html
grep -q "Continue as Dilip Acharya" /tmp/redirect_check.html && echo "REDIRECT OK" || echo "REDIRECT FAILED"
kill %1
```

- [ ] **Step 6: Commit**

```bash
cd admin-web
git add -A
git commit -m "Add mock persona login, cookie session, and route middleware gate

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Nav shell — register the 6 routes, remove stale nav items

**Files:**
- Modify: the starter's sidebar nav config (locate via Step 1 — commonly `src/constants/data.ts` or `src/components/layout/*nav*`)

- [ ] **Step 1: Locate the nav config**

```bash
cd admin-web
grep -rl "kanban\|Kanban" src/constants src/components 2>/dev/null
```

The file(s) matched define the sidebar's nav item list — this is what Step 2 edits.

- [ ] **Step 2: Replace the nav item list**

Remove entries pointing at deleted kanban/product-demo routes (Task 1). Replace with exactly these 6, following the exact shape (icon field, href field, label field) the matched config already uses for its existing items — do not invent a new nav-item shape:

- Beneficiary Due List → `/due-list`
- ANM Attendance → `/attendance`
- Miss Report → `/miss-report`
- Due Report → `/due-report`
- High-Risk Pregnancies → `/high-risk`
- Referrals → `/referral`

- [ ] **Step 3: Verify the sidebar renders all 6 with no dead links**

```bash
npm run dev &
sleep 6
for route in due-list attendance miss-report due-report high-risk referral; do
  curl -s -o /dev/null -w "%{http_code} /$route\n" "http://localhost:3000/$route" -b "admin_session=USR-ADMIN-001"
done
kill %1
```

Every route returns 404 at this point (pages don't exist until Tasks 10-15) — that's expected here; this step only confirms the middleware/cookie combination reaches routing, not a 500. A 500 means the nav config edit broke something; fix before proceeding.

- [ ] **Step 4: Commit**

```bash
cd admin-web
git add -A
git commit -m "Wire sidebar nav to the 6 dashboard sections

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Phase 2 — six route sections (parallelizable; each task below is independent once Tasks 1-9 are committed)

Each task in this phase only reads from `src/data/*` (Tasks 2-6) and reuses starter primitives (`DataTable`, `Card`, `Badge`, `Dialog`/`Sheet`, shadcn `Form`) — none of them modify another Phase 2 task's files, so they can run as parallel subagents.

## Task 10: `/due-list` — Beneficiary list to attend VHSND

**Files:**
- Create: `admin-web/src/app/due-list/page.tsx`
- Create: `admin-web/src/app/due-list/columns.tsx`

**Interfaces:**
- Consumes: `VHSND_SESSIONS` (Task 5), `BENEFICIARIES` (Task 2).

- [ ] **Step 1: Column definitions**

```tsx
// admin-web/src/app/due-list/columns.tsx
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export interface DueListRow {
  sessionId: string;
  village: string;
  date: string;
  beneficiaryName: string;
  beneficiaryId: string;
  trimester: number;
  isHighRisk: boolean;
}

export const columns: ColumnDef<DueListRow>[] = [
  { accessorKey: "village", header: "Village" },
  { accessorKey: "date", header: "Session Date" },
  { accessorKey: "beneficiaryName", header: "Beneficiary" },
  { accessorKey: "beneficiaryId", header: "ID" },
  {
    accessorKey: "trimester",
    header: "Trimester",
    cell: ({ row }) => `T${row.original.trimester}`,
  },
  {
    id: "risk",
    header: "Risk",
    cell: ({ row }) =>
      row.original.isHighRisk ? (
        <Badge variant="destructive">High Risk</Badge>
      ) : (
        <Badge variant="secondary">Routine</Badge>
      ),
  },
];
```

- [ ] **Step 2: Page — join sessions to beneficiaries**

```tsx
// admin-web/src/app/due-list/page.tsx
import { VHSND_SESSIONS } from "@/data/vhsndSessions";
import { BENEFICIARIES } from "@/data/beneficiaries";
import { DataTable } from "@/components/ui/table/data-table"; // starter's existing table wrapper — adjust import path if the starter names it differently
import { columns, type DueListRow } from "./columns";

export default function DueListPage() {
  const beneficiaryById = new Map(BENEFICIARIES.map((b) => [b.id, b]));
  const rows: DueListRow[] = VHSND_SESSIONS.flatMap((session) =>
    session.expectedBeneficiaryIds.map((id) => {
      const b = beneficiaryById.get(id);
      return {
        sessionId: session.id,
        village: session.village,
        date: session.date,
        beneficiaryName: b?.name ?? id,
        beneficiaryId: id,
        trimester: b?.trimester ?? 0,
        isHighRisk: b?.risk.is_critical ?? false,
      };
    })
  );

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Beneficiaries Due for VHSND</h1>
        <p className="text-sm text-muted-foreground">Upcoming and recent sessions across all villages.</p>
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  );
}
```

Before finalizing, check `src/components/ui/table/` (or wherever Task 1's clone put it) for the starter's actual `DataTable` export name/props signature and adjust the import + usage to match exactly — do not invent a different table component.

- [ ] **Step 3: Typecheck and commit**

```bash
cd admin-web
npx tsc --noEmit
git add src/app/due-list
git commit -m "Add /due-list route: beneficiaries expected at upcoming VHSND sessions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: `/attendance` — ANM attendance per session

**Files:**
- Create: `admin-web/src/app/attendance/page.tsx`
- Create: `admin-web/src/app/attendance/columns.tsx`

**Interfaces:**
- Consumes: `VHSND_SESSIONS`, `ANM_ATTENDANCE` (Task 5).

- [ ] **Step 1: Column definitions**

```tsx
// admin-web/src/app/attendance/columns.tsx
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export interface AttendanceRow {
  sessionId: string;
  date: string;
  village: string;
  anmName: string;
  status: "Present" | "Absent" | "Not Recorded";
  checkInTime?: string;
}

export const columns: ColumnDef<AttendanceRow>[] = [
  { accessorKey: "date", header: "Date" },
  { accessorKey: "village", header: "Village" },
  { accessorKey: "anmName", header: "ANM" },
  {
    accessorKey: "status",
    header: "Attendance",
    cell: ({ row }) => {
      const s = row.original.status;
      const variant = s === "Present" ? "secondary" : s === "Absent" ? "destructive" : "outline";
      return <Badge variant={variant}>{s}</Badge>;
    },
  },
  { accessorKey: "checkInTime", header: "Check-in Time", cell: ({ row }) => row.original.checkInTime ?? "—" },
];
```

- [ ] **Step 2: Page — join sessions to ANM attendance, defaulting to "Not Recorded"**

```tsx
// admin-web/src/app/attendance/page.tsx
import { VHSND_SESSIONS, ANM_ATTENDANCE } from "@/data/vhsndSessions";
import { DataTable } from "@/components/ui/table/data-table";
import { columns, type AttendanceRow } from "./columns";

export default function AttendancePage() {
  const attendanceBySession = new Map(ANM_ATTENDANCE.map((a) => [a.sessionId, a]));
  const rows: AttendanceRow[] = VHSND_SESSIONS.map((session) => {
    const record = attendanceBySession.get(session.id);
    return {
      sessionId: session.id,
      date: session.date,
      village: session.village,
      anmName: session.anmName,
      status: record?.status ?? "Not Recorded",
      checkInTime: record?.checkInTime,
    };
  });

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ANM Attendance</h1>
        <p className="text-sm text-muted-foreground">Whether the assigned ANM attended each VHSND session.</p>
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd admin-web
npx tsc --noEmit
git add src/app/attendance
git commit -m "Add /attendance route: per-session ANM attendance record

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: `/miss-report` — Beneficiary VHSND miss report

**Files:**
- Create: `admin-web/src/app/miss-report/page.tsx`
- Create: `admin-web/src/app/miss-report/columns.tsx`

**Interfaces:**
- Consumes: `filterMissedBeneficiaries` (Task 5), `VHSND_SESSIONS`, `BENEFICIARY_ATTENDANCE` (Task 5), `BENEFICIARIES` (Task 2).

- [ ] **Step 1: Column definitions**

```tsx
// admin-web/src/app/miss-report/columns.tsx
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export interface MissReportRow {
  beneficiaryName: string;
  beneficiaryId: string;
  village: string;
  sessionDate: string;
  reason: string;
  followUpStatus: "Pending" | "Contacted" | "Rescheduled";
}

export const columns: ColumnDef<MissReportRow>[] = [
  { accessorKey: "beneficiaryName", header: "Beneficiary" },
  { accessorKey: "village", header: "Village" },
  { accessorKey: "sessionDate", header: "Missed Session" },
  { accessorKey: "reason", header: "Reason" },
  {
    accessorKey: "followUpStatus",
    header: "Follow-up",
    cell: ({ row }) => {
      const s = row.original.followUpStatus;
      const variant = s === "Pending" ? "destructive" : s === "Contacted" ? "outline" : "secondary";
      return <Badge variant={variant}>{s}</Badge>;
    },
  },
];
```

- [ ] **Step 2: Page**

```tsx
// admin-web/src/app/miss-report/page.tsx
import { filterMissedBeneficiaries } from "@/data/missReport";
import { VHSND_SESSIONS, BENEFICIARY_ATTENDANCE } from "@/data/vhsndSessions";
import { BENEFICIARIES } from "@/data/beneficiaries";
import { DataTable } from "@/components/ui/table/data-table";
import { columns, type MissReportRow } from "./columns";

export default function MissReportPage() {
  const missed = filterMissedBeneficiaries(VHSND_SESSIONS, BENEFICIARY_ATTENDANCE, new Date());
  const beneficiaryById = new Map(BENEFICIARIES.map((b) => [b.id, b]));

  const rows: MissReportRow[] = missed.map((m) => ({
    beneficiaryName: beneficiaryById.get(m.beneficiaryId)?.name ?? m.beneficiaryId,
    beneficiaryId: m.beneficiaryId,
    village: m.village,
    sessionDate: m.sessionDate,
    reason: m.reason ?? "Not captured",
    followUpStatus: m.followUpStatus,
  }));

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">VHSND Miss Report</h1>
        <p className="text-sm text-muted-foreground">Beneficiaries due but absent at a past session.</p>
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd admin-web
npx tsc --noEmit
git add src/app/miss-report
git commit -m "Add /miss-report route: beneficiaries due but absent

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: `/due-report` — Due report of VHSND

**Files:**
- Create: `admin-web/src/app/due-report/page.tsx`
- Create: `admin-web/src/app/due-report/columns.tsx`

**Interfaces:**
- Consumes: `dueBucket` (Task 4), `VHSND_SESSIONS` (Task 5).

- [ ] **Step 1: Column definitions**

```tsx
// admin-web/src/app/due-report/columns.tsx
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { DueBucket } from "@/data/dueReport";

export interface DueReportRow {
  village: string;
  date: string;
  anmName: string;
  bucket: DueBucket;
  expectedCount: number;
}

const BUCKET_VARIANT: Record<DueBucket, "destructive" | "outline" | "secondary"> = {
  Overdue: "destructive",
  "Due Today": "destructive",
  "Due This Week": "outline",
  Upcoming: "secondary",
};

export const columns: ColumnDef<DueReportRow>[] = [
  { accessorKey: "village", header: "Village" },
  { accessorKey: "date", header: "Session Date" },
  { accessorKey: "anmName", header: "ANM" },
  { accessorKey: "expectedCount", header: "Expected" },
  {
    accessorKey: "bucket",
    header: "Status",
    cell: ({ row }) => <Badge variant={BUCKET_VARIANT[row.original.bucket]}>{row.original.bucket}</Badge>,
  },
];
```

- [ ] **Step 2: Page**

```tsx
// admin-web/src/app/due-report/page.tsx
import { dueBucket } from "@/data/dueReport";
import { VHSND_SESSIONS } from "@/data/vhsndSessions";
import { DataTable } from "@/components/ui/table/data-table";
import { columns, type DueReportRow } from "./columns";

export default function DueReportPage() {
  const today = new Date();
  const rows: DueReportRow[] = VHSND_SESSIONS.map((session) => ({
    village: session.village,
    date: session.date,
    anmName: session.anmName,
    bucket: dueBucket(session.date, today),
    expectedCount: session.expectedBeneficiaryIds.length,
  }));

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Due Report</h1>
        <p className="text-sm text-muted-foreground">Upcoming VHSND checkups across all villages.</p>
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd admin-web
npx tsc --noEmit
git add src/app/due-report
git commit -m "Add /due-report route: upcoming VHSND checkups by village

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: `/high-risk` — High-risk pregnancy update & reporting

**Files:**
- Create: `admin-web/src/app/high-risk/page.tsx`
- Create: `admin-web/src/app/high-risk/risk-category-filter.tsx`

**Interfaces:**
- Consumes: `bucketRiskReasons` (Task 3), `BENEFICIARIES` (Task 2), `RiskCategory` (Task 2).

- [ ] **Step 1: Client-side category filter control**

```tsx
// admin-web/src/app/high-risk/risk-category-filter.tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { RiskCategory } from "@/data/types";

const CATEGORIES: RiskCategory[] = [
  "Maternal Age",
  "Previous Obstetric History",
  "Current Pregnancy Complications",
  "Maternal Medical Conditions",
  "Pregnancy-Related Factors",
];

export function RiskCategoryFilter({ onChange }: { onChange: (category: RiskCategory | "All") => void }) {
  const [active, setActive] = useState<RiskCategory | "All">("All");

  function select(category: RiskCategory | "All") {
    setActive(category);
    onChange(category);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(["All", ...CATEGORIES] as const).map((category) => (
        <button key={category} type="button" onClick={() => select(category)}>
          <Badge variant={active === category ? "default" : "outline"}>{category}</Badge>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Page — critical escalation cards get the structurally-distinct treatment from spec §5 (full styling pass happens in Task 16; this step establishes the structural difference, not just color)**

```tsx
// admin-web/src/app/high-risk/page.tsx
"use client";

import { useMemo, useState } from "react";
import { BENEFICIARIES } from "@/data/beneficiaries";
import { bucketRiskReasons } from "@/data/riskFlags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskCategoryFilter } from "./risk-category-filter";
import type { RiskCategory } from "@/data/types";

export default function HighRiskPage() {
  const [category, setCategory] = useState<RiskCategory | "All">("All");

  const highRisk = useMemo(() => BENEFICIARIES.filter((b) => b.risk.is_critical), []);

  const filtered = useMemo(() => {
    if (category === "All") return highRisk;
    return highRisk.filter((b) => bucketRiskReasons(b.risk.reasons)[category].length > 0);
  }, [highRisk, category]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">High-Risk Pregnancy Reporting</h1>
        <p className="text-sm text-muted-foreground">{highRisk.length} beneficiaries currently flagged.</p>
      </div>
      <RiskCategoryFilter onChange={setCategory} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((b) => (
          // Structural escalation treatment: left accent border + icon-bearing
          // header, not a routine card with a swapped background color.
          <Card key={b.id} className="border-l-4 border-l-destructive">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>{b.name}</span>
                <Badge variant="destructive">Critical</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                {b.village} · {b.gestationalAgeLabel}
              </p>
              <ul className="list-inside list-disc space-y-1">
                {b.risk.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd admin-web
npx tsc --noEmit
git add src/app/high-risk
git commit -m "Add /high-risk route: filterable high-risk pregnancy dashboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 15: `/referral` — Referral list + new-referral form

**Files:**
- Create: `admin-web/src/app/referral/page.tsx`
- Create: `admin-web/src/app/referral/columns.tsx`
- Create: `admin-web/src/app/referral/new/page.tsx`
- Create: `admin-web/src/app/referral/referral-form.tsx`

**Interfaces:**
- Consumes: `REFERRALS`, `REFERRAL_FACILITIES`, `Referral` (Task 6), `BENEFICIARIES` (Task 2), the starter's existing RHF+Zod form pattern (locate via Step 1).

- [ ] **Step 1: Locate the starter's existing RHF+Zod form pattern to match its conventions**

```bash
cd admin-web
grep -rl "zodResolver" src/app src/components 2>/dev/null | head -3
```

Read one matched file before writing Step 3 — match its import style for `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` from the starter's `components/ui/form`.

- [ ] **Step 2: List page + columns**

```tsx
// admin-web/src/app/referral/columns.tsx
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { Referral } from "@/data/types";

const STATUS_VARIANT: Record<Referral["followUpStatus"], "destructive" | "outline" | "secondary"> = {
  Pending: "destructive",
  Referred: "outline",
  Completed: "secondary",
};

export const columns: ColumnDef<Referral>[] = [
  { accessorKey: "beneficiaryName", header: "Beneficiary" },
  { accessorKey: "facility", header: "Facility" },
  { accessorKey: "reason", header: "Reason" },
  { accessorKey: "date", header: "Date" },
  {
    accessorKey: "followUpStatus",
    header: "Status",
    cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.followUpStatus]}>{row.original.followUpStatus}</Badge>,
  },
];
```

```tsx
// admin-web/src/app/referral/page.tsx
import Link from "next/link";
import { REFERRALS } from "@/data/referrals";
import { DataTable } from "@/components/ui/table/data-table";
import { Button } from "@/components/ui/button";
import { columns } from "./columns";

export default function ReferralListPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Referrals</h1>
          <p className="text-sm text-muted-foreground">Beneficiaries referred to a higher facility.</p>
        </div>
        <Button asChild>
          <Link href="/referral/new">New Referral</Link>
        </Button>
      </div>
      <DataTable columns={columns} data={REFERRALS} />
    </div>
  );
}
```

- [ ] **Step 3: Form — reuse the starter's RHF + Zod pattern found in Step 1**

```tsx
// admin-web/src/app/referral/referral-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BENEFICIARIES } from "@/data/beneficiaries";
import { REFERRAL_FACILITIES } from "@/data/referrals";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const referralSchema = z.object({
  beneficiaryId: z.string().min(1, "Select a beneficiary"),
  facility: z.string().min(1, "Select a facility"),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type ReferralFormValues = z.infer<typeof referralSchema>;

export function ReferralForm() {
  const form = useForm<ReferralFormValues>({
    resolver: zodResolver(referralSchema),
    defaultValues: { beneficiaryId: "", facility: "", reason: "", date: "", notes: "" },
  });

  function onSubmit(values: ReferralFormValues) {
    // Demo-only: no backend. Log to console so the form's full round-trip is
    // visible during manual verification; flagged as debt (no persistence).
    console.log("Referral submitted (demo, not persisted):", values);
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg space-y-6">
        <FormField
          control={form.control}
          name="beneficiaryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Beneficiary</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a beneficiary" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BENEFICIARIES.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} — {b.village}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="facility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Facility</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a facility" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {REFERRAL_FACILITIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason</FormLabel>
              <FormControl>
                <Textarea placeholder="Clinical reason for referral" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Follow-up notes" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Mark Referred</Button>
      </form>
    </Form>
  );
}
```

```tsx
// admin-web/src/app/referral/new/page.tsx
import { ReferralForm } from "../referral-form";

export default function NewReferralPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Referral</h1>
        <p className="text-sm text-muted-foreground">Refer a beneficiary to a facility for follow-up.</p>
      </div>
      <ReferralForm />
    </div>
  );
}
```

Before finalizing, check `src/components/ui/` for exactly which of `select`, `textarea`, `input`, `form` the starter already ships (it should, per the prompt's "React Hook Form + Zod forms" starter feature) — if any is missing, install only that shadcn primitive via `npx shadcn@latest add <component>` rather than hand-rolling it.

- [ ] **Step 4: Typecheck and commit**

```bash
cd admin-web
npx tsc --noEmit
git add src/app/referral
git commit -m "Add /referral route: referral list and new-referral form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 16: Escalation card hierarchy polish + mobile-Admin relationship note

**Files:**
- Modify: `admin-web/src/app/high-risk/page.tsx` (verify/extend the structural treatment from Task 14)
- Create: `admin-web/README.md`

- [ ] **Step 1: Verify escalation card hierarchy against spec §5**

Re-read `admin-web/src/app/high-risk/page.tsx`. Confirm the Critical card treatment is structural, not just recolored: left accent border (already added in Task 14), plus check that `Card` spacing/elevation reads as more prominent than routine list rows elsewhere in the app (e.g. `/due-list` table rows). If it doesn't yet read as visually heavier, add a subtle `shadow-sm` and slightly larger `CardTitle` text to the Critical cards specifically — do not apply the same treatment to non-critical cards elsewhere.

- [ ] **Step 2: WCAG AA contrast check on every shipped status color**

```bash
node -e '
function luminance(hex) {
  const [r,g,b] = [hex.slice(1,3),hex.slice(3,5),hex.slice(5,7)].map(h => {
    const c = parseInt(h,16)/255;
    return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
  });
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
function contrast(hex1, hex2) {
  const l1 = luminance(hex1), l2 = luminance(hex2);
  const [lighter, darker] = l1 > l2 ? [l1,l2] : [l2,l1];
  return (lighter + 0.05) / (darker + 0.05);
}
const pairs = {
  "destructive on white (light)": ["#EF4444", "#FFFFFF"],
  "destructive-fg text on destructive (light)": ["#FFFFFF", "#EF4444"],
  "warning-fg on warning (light)": ["#7A3E00", "#F59E0B"],
  "success-fg on success (light)": ["#FFFFFF", "#10B981"],
};
for (const [label, [fg, bg]] of Object.entries(pairs)) {
  const r = contrast(fg, bg);
  console.log(label, r.toFixed(2), r >= 4.5 ? "PASS" : "FAIL");
}
'
```

If any pair reports FAIL, do not ship it — darken/lighten the foreground token in `globals.css` (Task 7) until it passes 4.5:1, and note the change in the debt log (Task 18) as a deviation from the literal `theme.ts` value, with the reason.

- [ ] **Step 3: README with the mobile-Admin relationship note**

```markdown
// admin-web/README.md
# VHSND Supervisor Web Dashboard (Pilot Demo)

Desktop dashboard for the Supervisor/Admin (CMO) role. Pilot/demo only — not
connected to live government infrastructure, not integrated with `backend/`
(FastAPI+Mongo) or the mobile app's own Admin dashboard tab.

## Relationship to the mobile app's Admin tab

`frontend/app/(admin)/` already has an Admin dashboard tab on the mobile app
(see `admin-dashboard.png` at the repo root) with its own KPI summary. This
web dashboard is **intentionally a separate surface** for now — it adds six
capabilities (due-list, ANM attendance, miss-report, due-report, high-risk
filtering, referrals) the mobile Admin tab does not have, and does not read
from or write to the mobile app's data. This was a deliberate scope decision,
not an oversight — see the design spec at `docs/specs/` for the reasoning.

## Running locally

\`\`\`bash
npm install
npm run dev
npm test        # vitest — covers bucketRiskReasons, due-date math, miss-report filter
\`\`\`

## Auth

Single mock persona ("Continue as Dilip Acharya, Chief Medical Officer"),
cookie-based session, no backend, no real credentials.

## Data

All data in `src/data/` is a static, hand-authored fixture layer — grounded in
the real IDs/villages/risk-flag shapes from the mobile app's
`frontend/src/api/demoDb.ts` and `frontend/src/utils/riskAssessment.ts`, but
not imported from them (this app stays fully isolated — see
`docs/specs/2026-09-17-supervisor-web-dashboard-design.md`).

## Known debt

See `docs/specs/2026-09-17-supervisor-web-dashboard-design.md` §10 and this
README's own accumulated notes for anything flagged during the build.
```

- [ ] **Step 4: Commit**

```bash
cd admin-web
git add -A
git commit -m "Polish escalation card hierarchy, verify WCAG AA contrast, add README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 17: Playwright verification — light + dark, all 6 sections + login

**Files:** none (verification only; screenshots saved under `admin-web/.playwright-verification/`, gitignored)

- [ ] **Step 1: Confirm Playwright MCP connectivity**

Attempt a navigate call. If it errors, report explicitly that live browser verification isn't available and fall back to `npm run dev` + reading each page's rendered HTML/console output instead — do not silently skip this task.

- [ ] **Step 2: Start the dev server**

```bash
cd admin-web
npm run dev &
sleep 6
```

- [ ] **Step 3: Screenshot each route in light mode, then dark mode**

For each of `/login`, `/due-list`, `/attendance`, `/miss-report`, `/due-report`, `/high-risk`, `/referral`, `/referral/new`:
1. Navigate to `http://localhost:3000<route>` (set the `admin_session` cookie first for gated routes, or navigate through `/login`'s button once per session).
2. Screenshot light mode → `admin-web/.playwright-verification/<route>-light.png`.
3. Toggle dark mode (via the starter's existing theme toggle control) and screenshot → `admin-web/.playwright-verification/<route>-dark.png`.

Visually check each screenshot for: table data actually populated (not empty), Critical cards on `/high-risk` reading as structurally distinct, no obvious contrast failures beyond what Task 16 Step 2 already checked programmatically, no layout overflow at desktop width.

- [ ] **Step 4: Stop the dev server**

```bash
kill %1
```

- [ ] **Step 5: Record results**

Note in the final report (not committed to the repo) which screenshots passed visual review and which needed a follow-up fix — if any fix was needed, apply it, re-screenshot only that route, and note the fix in Task 18's debt log if it reflects a deferred rather than fully-resolved issue.

---

## Task 18: Final debt log entry

**Files:**
- Modify: `admin-web/README.md` (append accumulated debt under "Known debt")

- [ ] **Step 1: Compile every flagged item from Tasks 1-17 into the README's "Known debt" section**

At minimum, include: the curated 16-beneficiary subset instead of the full 50-record generator (Task 2), the `bucketRiskReasons` catch-all assumption for free-text/clinician-override reasons (Task 3), the reasonable-default referral facility list and ANM-attendance field shape (Tasks 5-6), the referral form's console-log-only submission with no persistence (Task 15), and any contrast-driven token deviation from literal `theme.ts` values (Task 16 Step 2), each with one line of reasoning.

- [ ] **Step 2: Commit**

```bash
cd admin-web
git add README.md
git commit -m "Log accumulated build debt

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 19: Verification-before-completion gate

**Files:** none

- [ ] **Step 1: Full test suite**

```bash
cd admin-web
npx vitest run
```

Expected: all tests pass (riskFlags, dueReport, missReport — Tasks 3-5).

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: build succeeds with no route errors.

- [ ] **Step 4: Lint (if the starter ships one)**

```bash
npm run lint
```

Expected: zero errors (warnings acceptable if the starter's own default config produces any pre-existing ones unrelated to this work).

- [ ] **Step 5: Confirm every command's actual output before declaring the build done**

Do not report success from memory of what "should" happen — paste/quote the actual pass/fail output of Steps 1-4 in the final report to the user, per superpowers:verification-before-completion.

---

## Self-Review Notes (writing-plans skill, completed at authoring time)

- **Spec coverage:** §3 scaffold → Task 1. §4 data layer → Tasks 2, 5, 6. §6 TDD functions → Tasks 3, 4, 5. §5 auth/theming → Tasks 7, 8, 16. §7 six routes → Tasks 10-15. §8 sequencing → Phase boundaries as drawn. §9 verification → Task 17. §10 debt → Task 18 (continuously fed from every earlier task). Nav shell (implied by §7 "separate nav routes under one dashboard shell") → Task 9. No spec section without a task.
- **Placeholder scan:** no "TBD"/"handle edge cases" strings; every code step has real code; UI tasks state exact component/prop names to locate rather than hand-waving "use appropriate components."
- **Type consistency:** `AnmAttendanceRecord` vs `BeneficiaryAttendance` kept distinct throughout (Task 5 → Tasks 11/12), not collapsed into one ambiguous `AttendanceRecord` as an earlier draft of this plan mistakenly did. `RiskCategory` string literals match exactly between `types.ts` (Task 2), `riskFlags.ts` (Task 3), and the filter UI (Task 14). `DueBucket` literals match between `dueReport.ts` (Task 4) and `due-report/columns.tsx` (Task 13).
