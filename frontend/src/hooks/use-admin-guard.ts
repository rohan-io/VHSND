import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { isAdmin } from "@/src/utils/roles";

/**
 * Blocks a write-only screen (e.g. app/anc/record.tsx) from ever rendering for
 * the Admin role — including direct navigation to its route, not just a hidden
 * button on the screen that links here. Redirects to the Admin dashboard with
 * an explanatory toast.
 *
 * Usage: `if (useBlockAdminWrite("...")) return null;` at the top of the
 * screen component, before any data loading.
 */
export function useBlockAdminWrite(message: string): boolean {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const blocked = isAdmin(user);

  useEffect(() => {
    if (blocked) {
      showToast(message, "info");
      router.replace("/(admin)");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  return blocked;
}
