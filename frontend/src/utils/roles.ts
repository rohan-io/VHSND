import type { UserProfile } from "@/src/types";

/**
 * Admin role policy: Monitor, Escalate, Notify — never a direct write on
 * operational data (that stays with the Health Worker role). Every write
 * action point (Acknowledge, Record ANC Visit, Mark Administered, Mark done)
 * checks this — not just whether its button is rendered — so direct
 * navigation to a write screen can't bypass it. See app/anc/record.tsx for
 * the full-screen version (useBlockAdminWrite).
 */
export const isAdmin = (user: UserProfile | null | undefined): boolean =>
  user?.role === "Administrator";

// --- self-check ---------------------------------------------------------------
if (typeof require !== "undefined" && require.main === module) {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL: " + m);
  };
  assert(isAdmin({ role: "Administrator" } as UserProfile) === true, "administrator is admin");
  assert(isAdmin({ role: "Health Worker" } as UserProfile) === false, "health worker is not admin");
  assert(isAdmin(null) === false, "null user is not admin");
  assert(isAdmin(undefined) === false, "undefined user is not admin");
  console.log("roles.ts self-check passed");
}
