import type { Beneficiary, Block } from '@/data/types';
import { blockForVillage } from '@/data/villages';
import type { ApiHighRiskFlag, ApiPregnancy } from './types';

const uniq = (values: string[]) => Array.from(new Set(values));

// Pure mapping from a local-api pregnancy record (the mobile store — the
// single source of truth for mothers, per Gap 1) plus an optional relational
// high_risk_flags row into this app's existing Beneficiary/RiskResult shape.
//
// Union merge rule: the two seed generators disagree on risk for 7 of the
// original 16 beneficiary_ids (independently authored, same names/villages).
// A supervisor view must never show a clinically high-risk mother as
// routine, so a mother is critical if EITHER source says so, and her reasons
// are the de-duplicated union of both. Review status (open/acknowledged)
// only ever comes from the relational row — the mobile side has no
// acknowledgement concept — so a mother with no relational row is always
// "open" (status left undefined, which the UI already treats as not
// acknowledged).
export function mapBeneficiary(
  pregnancy: ApiPregnancy,
  relationalRisk: ApiHighRiskFlag | undefined
): Beneficiary {
  const isCritical = !!relationalRisk || pregnancy.is_high_risk;
  const reasons = uniq([...(relationalRisk?.reasons ?? []), ...pregnancy.high_risk_reasons]);
  const autoFlags = uniq([...(relationalRisk?.auto_flags ?? []), ...pregnancy.high_risk_reasons]);
  const manualFlags = relationalRisk?.manual_flags ?? [];

  return {
    id: pregnancy.beneficiary_id,
    name: pregnancy.full_name,
    husbandName: pregnancy.husband_name || '',
    age: pregnancy.age ?? 0,
    village: pregnancy.village,
    block: blockForVillage(pregnancy.village) as Block,
    anmId: pregnancy.assigned_worker_id || '',
    anmName: pregnancy.assigned_worker_name || '',
    trimester: (pregnancy.trimester as 1 | 2 | 3) || 1,
    gestationalAgeLabel: pregnancy.gestational_age_label || '',
    risk: isCritical
      ? {
          is_critical: true,
          reasons,
          auto_flags: autoFlags,
          manual_flags: manualFlags,
          status: relationalRisk?.status as 'ACTIVE' | 'ACKNOWLEDGED' | undefined
        }
      : { is_critical: false, reasons: [], auto_flags: [], manual_flags: [] }
  };
}
