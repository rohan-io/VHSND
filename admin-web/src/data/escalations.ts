import type { Escalation } from './types';
import { BENEFICIARIES } from './beneficiaries';

export const ESCALATIONS: Escalation[] = BENEFICIARIES.filter((b) => b.risk.is_critical).map(
  (b, i) => ({
    id: `ALERT-CRIT-ESC-PREG-2026-${1000 + i}`,
    beneficiaryId: b.id,
    beneficiaryName: b.name,
    village: b.village,
    gestationalAgeLabel: b.gestationalAgeLabel,
    reasons: b.risk.reasons,
    createdAt: '2026-09-15'
  })
);
