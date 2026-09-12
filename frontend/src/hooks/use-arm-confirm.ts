import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Two-tap confirmation for irreversible actions, no modal. First tap arms the
 * button (caller shows "Tap again to confirm"); second tap within the window
 * runs the action. Auto-disarms so a stray first tap costs nothing.
 *
 * ponytail: one armed id at a time — fine for one confirm-tap per screen. If a
 * screen ever needs several armed at once, hold a Set instead.
 */
export function useArmConfirm(timeoutMs = 3500) {
  const [armedId, setArmedId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setArmedId(null);
  }, []);

  /** Returns true if the action should run now (already armed for this id). */
  const confirm = useCallback(
    (id: string) => {
      if (armedId === id) {
        disarm();
        return true;
      }
      if (timer.current) clearTimeout(timer.current);
      setArmedId(id);
      timer.current = setTimeout(() => setArmedId(null), timeoutMs);
      return false;
    },
    [armedId, disarm, timeoutMs]
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { armedId, confirm, disarm };
}
