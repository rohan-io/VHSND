import { PregnancyRecord } from "@/src/types";
import { parseISODate, todayISO } from "@/src/utils/date";

type StatusShape = Pick<PregnancyRecord, "status" | "edd" | "gestational_weeks" | "trimester">;

/**
 * A record can arrive marked "delivered" while its EDD is still months out and
 * gestational age is mid-pregnancy (upstream data problem seen in seed data).
 * Don't render a clinically impossible "Delivered" badge — only trust the flag
 * when the pregnancy is actually at or past term.
 */
export function isTrulyDelivered(p: StatusShape): boolean {
  if (p.status !== "delivered") return false;
  const edd = parseISODate(p.edd || "");
  if (edd && p.edd > todayISO() && (p.gestational_weeks ?? 0) < 37) return false;
  return true;
}

export function pregnancyStatusLabel(p: StatusShape): string {
  return isTrulyDelivered(p) ? "Delivered" : `Trimester ${p.trimester}`;
}

if (typeof require !== "undefined" && require.main === module) {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("FAIL: " + m); };
  assert(isTrulyDelivered({ status: "delivered", edd: "2020-01-01", gestational_weeks: 41, trimester: 3 }), "past-term delivered");
  assert(!isTrulyDelivered({ status: "delivered", edd: "2099-01-01", gestational_weeks: 17, trimester: 2 }), "future EDD + mid-pregnancy is not delivered");
  assert(!isTrulyDelivered({ status: "active", edd: "2020-01-01", gestational_weeks: 41, trimester: 3 }), "active is not delivered");
  assert(pregnancyStatusLabel({ status: "delivered", edd: "2099-01-01", gestational_weeks: 17, trimester: 2 }) === "Trimester 2", "mislabeled falls back to trimester");
  console.log("pregnancy.ts self-check passed");
}
