/**
 * PMSMA (Pradhan Mantri Surakshit Matritva Abhiyan) — a free specialist ANC
 * checkup camp held on the 9th of every month.
 *
 * Scope: every ACTIVE pregnancy, not just high-risk ones — that matches the
 * real national scheme (PMSMA guarantees the free 9th-of-the-month checkup to
 * every pregnant woman, with high-risk cases getting extra follow-up on top,
 * not instead of it). If that reading is wrong for this deployment, narrow
 * the `isActivePregnancy` filter below to `is_high_risk` — flagging it here
 * rather than guessing silently.
 *
 * Status for the CURRENT month only (this resets every month — a woman
 * checked last month is not "still on track" this month):
 *   - "pmsma"  (on track) — the 9th hasn't happened yet this month, OR she
 *              has a check recorded within this month.
 *   - "epmsma" (missed)   — past the 9th AND no check recorded this month.
 */

import type { PregnancyRecord } from "@/src/types";

export type PmsmaStatusValue = "pmsma" | "epmsma";

export function pmsmaStatus(
  lastCheckDateISO: string | null | undefined,
  today: Date = new Date(),
): PmsmaStatusValue {
  if (today.getDate() <= 9) return "pmsma"; // this month's camp hasn't happened yet
  if (!lastCheckDateISO) return "epmsma";
  const last = new Date(lastCheckDateISO);
  if (Number.isNaN(last.getTime())) return "epmsma";
  const sameMonth = last.getFullYear() === today.getFullYear() && last.getMonth() === today.getMonth();
  return sameMonth ? "pmsma" : "epmsma";
}

/** "Active" here matches the rest of the app's dashboard/admin counts. */
export const isActivePregnancy = (p: Pick<PregnancyRecord, "status">): boolean =>
  p.status === "active" || p.status === "high_risk";

// --- self-check ---------------------------------------------------------------
if (typeof require !== "undefined" && require.main === module) {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL: " + m);
  };

  const before9th = new Date(2026, 8, 5); // Sep 5, 2026
  const after9th = new Date(2026, 8, 15); // Sep 15, 2026
  const onThe9th = new Date(2026, 8, 9); // Sep 9, 2026 itself — not yet "past"

  assert(pmsmaStatus(null, before9th) === "pmsma", "before the 9th: always on track, even unchecked");
  assert(pmsmaStatus(null, onThe9th) === "pmsma", "on the 9th itself: not yet 'past' the 9th");
  assert(pmsmaStatus(null, after9th) === "epmsma", "past the 9th, never checked: missed");
  assert(pmsmaStatus("2026-09-10", after9th) === "pmsma", "past the 9th, checked this month: on track");
  assert(pmsmaStatus("2026-08-20", after9th) === "epmsma", "past the 9th, last check was last month: missed");
  assert(pmsmaStatus("2026-09-01", after9th) === "pmsma", "checked earlier this month still counts");
  assert(pmsmaStatus("not-a-date", after9th) === "epmsma", "garbage date treated as unchecked");

  assert(isActivePregnancy({ status: "active" } as any), "active counts");
  assert(isActivePregnancy({ status: "high_risk" } as any), "high_risk counts as active");
  assert(!isActivePregnancy({ status: "delivered" } as any), "delivered does not count");
  assert(!isActivePregnancy({ status: "archived" } as any), "archived does not count");

  console.log("pmsma.ts self-check passed");
}
