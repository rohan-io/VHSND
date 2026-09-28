import type { Beneficiary, Block } from '@/data/types';
import { blockForVillage } from '@/data/villages';
import type { ApiBeneficiary, ApiHighRiskFlag, ApiPregnancy } from './types';

// Pure mapping from local-api's snake_case rows to this app's existing
// Beneficiary/RiskResult shape (data/types.ts is the UI contract). Kept
// separate from service.ts's fetching so it's testable without mocking fetch.
export function mapBeneficiary(
  row: ApiBeneficiary,
  pregnancy: ApiPregnancy | undefined,
  risk: ApiHighRiskFlag | undefined
): Beneficiary {
  return {
    id: row.id,
    name: row.name,
    husbandName: row.husband_name || '',
    age: row.age ?? 0,
    village: row.village,
    block: (row.block as Block) || blockForVillage(row.village),
    anmId: row.anm_id || '',
    anmName: row.anm_name || '',
    trimester: (pregnancy?.trimester as 1 | 2 | 3) || 1,
    gestationalAgeLabel: pregnancy?.gestational_age_label || '',
    risk: risk
      ? {
          is_critical: true,
          reasons: risk.reasons,
          auto_flags: risk.auto_flags,
          manual_flags: risk.manual_flags,
          status: risk.status as 'ACTIVE' | 'ACKNOWLEDGED'
        }
      : { is_critical: false, reasons: [], auto_flags: [], manual_flags: [] }
  };
}
