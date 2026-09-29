// Ported from frontend/src/utils/pmsma.ts — see that file for the PMSMA rules.
function pmsmaStatus(lastCheckDateISO, today = new Date()) {
  if (today.getDate() <= 9) return "pmsma";
  if (!lastCheckDateISO) return "epmsma";
  const last = new Date(lastCheckDateISO);
  if (Number.isNaN(last.getTime())) return "epmsma";
  const sameMonth = last.getFullYear() === today.getFullYear() && last.getMonth() === today.getMonth();
  return sameMonth ? "pmsma" : "epmsma";
}

const isActivePregnancy = (p) => p.status === "active" || p.status === "high_risk";

module.exports = { pmsmaStatus, isActivePregnancy };
