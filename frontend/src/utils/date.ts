// Date helpers for the register / ANC forms. Field workers type these on a
// phone keypad, so the native input never gets a free calendar picker — mask
// and validate hard instead.

/** Progressive YYYY-MM-DD mask from raw keystrokes ("20260115" -> "2026-01-15"). */
export function maskDateInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean);
  return parts.join("-");
}

/** Strict parse. Rejects fake calendar days like 2026-02-30. Returns null if invalid. */
export function parseISODate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, day] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, day);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== day) return null;
  return dt;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Today shifted by `days` (negative = past), as YYYY-MM-DD. */
export function shiftISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns null when valid, otherwise a human sentence naming the problem.
 * ISO date strings compare correctly with `<` / `>`, so range checks are plain string compares.
 */
export function validateDate(
  s: string,
  opts: { min?: string; max?: string; label?: string } = {}
): string | null {
  const label = opts.label || "Date";
  const v = s.trim();
  if (!v) return `${label} is required.`;
  if (!parseISODate(v)) return `${label} must be a real date in YYYY-MM-DD format.`;
  if (opts.min && v < opts.min) return `${label} can't be earlier than ${opts.min}.`;
  if (opts.max && v > opts.max) return `${label} can't be later than ${opts.max}.`;
  return null;
}

// demo(): run `npx tsx src/utils/date.ts` style check
if (typeof require !== "undefined" && require.main === module) {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("FAIL: " + m); };
  assert(maskDateInput("20260115") === "2026-01-15", "mask full");
  assert(maskDateInput("2026") === "2026", "mask partial year");
  assert(maskDateInput("202601") === "2026-01", "mask year-month");
  assert(parseISODate("2026-02-30") === null, "reject fake day");
  assert(parseISODate("2026-13-01") === null, "reject fake month");
  assert(parseISODate("2026-01-15") instanceof Date, "accept real date");
  assert(validateDate("2026-01-15", { min: "2026-01-01", max: "2026-12-31" }) === null, "in range");
  assert(!!validateDate("2025-12-31", { min: "2026-01-01" }), "below min flagged");
  assert(!!validateDate("2027-01-01", { max: "2026-12-31" }), "above max flagged");
  assert(!!validateDate("not-a-date"), "garbage flagged");
  console.log("date.ts self-check passed");
}
