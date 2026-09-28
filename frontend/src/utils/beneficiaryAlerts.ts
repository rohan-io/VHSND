/**
 * Beneficiary Alerts tab — derives friendly reminders from the same data the
 * Beneficiary Home screen already shows (VHSND sessions, latest visit's next
 * ANC date, EDD). No new data: PMSMA is just the fixed 9th-of-the-month camp
 * (see src/utils/pmsma.ts).
 */

import { shiftISO } from "@/src/utils/date";

// Same mock VHSND sessions (and same date offsets) as mockVhsndSessions() in
// app/(beneficiary)/index.tsx — keep the two in step so Home and Alerts agree.
export function mockVhsndSessions() {
  return [
    { id: "vhsnd-next", date: shiftISO(9), upcoming: true },
    { id: "vhsnd-prev-1", date: shiftISO(-21), upcoming: false },
    { id: "vhsnd-prev-2", date: shiftISO(-51), upcoming: false },
  ];
}

export type AlertUrgency = "overdue" | "upcoming" | "milestone";
export type BeneficiaryAlert = {
  id: string;
  kind: "vhsnd" | "anc" | "pmsma" | "edd";
  urgency: AlertUrgency;
  date: string; // YYYY-MM-DD
  days: number; // days from today (negative = past)
};

const DAY = 86_400_000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function daysUntil(iso: string, today: Date = new Date()): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - midnight(today).getTime()) / DAY);
}

/** Next PMSMA camp: the 9th of this month if not yet past, else next month's. */
export function nextPmsmaDate(today: Date = new Date()): string {
  const d = today.getDate() <= 9
    ? new Date(today.getFullYear(), today.getMonth(), 9)
    : new Date(today.getFullYear(), today.getMonth() + 1, 9);
  return toISO(d);
}

export function buildBeneficiaryAlerts(
  input: {
    vhsndSessions: { id: string; date: string; upcoming: boolean }[];
    nextVisitDate?: string | null;
    edd?: string | null;
    delivered: boolean;
  },
  today: Date = new Date(),
): BeneficiaryAlert[] {
  const out: BeneficiaryAlert[] = [];
  for (const s of input.vhsndSessions) {
    const days = daysUntil(s.date, today);
    if (s.upcoming && days >= 0) out.push({ id: s.id, kind: "vhsnd", urgency: "upcoming", date: s.date, days });
  }
  if (!input.delivered) {
    if (input.nextVisitDate) {
      const days = daysUntil(input.nextVisitDate, today);
      out.push({ id: "anc", kind: "anc", urgency: days < 0 ? "overdue" : "upcoming", date: input.nextVisitDate, days });
    }
    const pmsma = nextPmsmaDate(today);
    out.push({ id: "pmsma", kind: "pmsma", urgency: "upcoming", date: pmsma, days: daysUntil(pmsma, today) });
    if (input.edd) {
      out.push({ id: "edd", kind: "edd", urgency: "milestone", date: input.edd, days: daysUntil(input.edd, today) });
    }
  }
  // Overdue first, then soonest first.
  return out.sort((a, b) => Number(b.urgency === "overdue") - Number(a.urgency === "overdue") || a.date.localeCompare(b.date));
}

// --- self-check: npx tsx src/utils/beneficiaryAlerts.ts ------------------------
if (typeof require !== "undefined" && require.main === module) {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("FAIL: " + m); };
  const today = new Date(2026, 8, 28); // 2026-09-28

  assert(nextPmsmaDate(today) === "2026-10-09", "past the 9th -> next month");
  assert(nextPmsmaDate(new Date(2026, 8, 9)) === "2026-09-09", "on the 9th -> today");
  assert(nextPmsmaDate(new Date(2026, 11, 20)) === "2027-01-09", "December rolls into next year");
  assert(daysUntil("2026-10-05", today) === 7, "days until");
  assert(daysUntil("2026-09-20", today) === -8, "days since");

  const sessions = [
    { id: "a", date: "2026-10-07", upcoming: true },
    { id: "b", date: "2026-09-07", upcoming: false },
  ];
  const all = buildBeneficiaryAlerts({ vhsndSessions: sessions, nextVisitDate: "2026-09-20", edd: "2027-01-15", delivered: false }, today);
  assert(all[0].kind === "anc" && all[0].urgency === "overdue", "overdue ANC sorts first");
  assert(all.map((a) => a.kind).join() === "anc,vhsnd,pmsma,edd", "rest sorted by date: " + all.map((a) => a.kind).join());
  assert(!all.some((a) => a.id === "b"), "past VHSND session is not a reminder");

  const upcomingAnc = buildBeneficiaryAlerts({ vhsndSessions: [], nextVisitDate: "2026-10-12", delivered: false }, today);
  assert(upcomingAnc.find((a) => a.kind === "anc")!.urgency === "upcoming", "future ANC is upcoming");

  const delivered = buildBeneficiaryAlerts({ vhsndSessions: [], nextVisitDate: "2026-09-20", edd: "2026-09-01", delivered: true }, today);
  assert(delivered.length === 0, "delivered: no pregnancy reminders -> all caught up");
  console.log("beneficiaryAlerts.ts self-check passed");
}
