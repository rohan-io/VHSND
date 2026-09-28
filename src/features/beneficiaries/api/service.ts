import { apiGet, apiPatch } from '@/lib/api-config';
import type { Beneficiary, Block } from '@/data/types';
import { blockForVillage } from '@/data/villages';
import type { ApiBeneficiary, ApiHighRiskFlag, ApiPregnancy } from './types';

// Joins three local-api resources into the shape every existing table/card
// component already expects (data/types.ts's Beneficiary). Phase 2 repointed
// /api/pregnancies at the mobile app's full 50-record dataset, so this only
// looks up the entries whose beneficiary_id matches one of the 16 admin-web
// beneficiaries — see local-api/README.md's "two schemas" note.
export async function getBeneficiaries(): Promise<Beneficiary[]> {
  const [beneficiaries, pregnancies, highRisk] = await Promise.all([
    apiGet<ApiBeneficiary[]>('/beneficiaries'),
    apiGet<{ items: ApiPregnancy[] }>('/pregnancies').then((r) => r.items),
    apiGet<ApiHighRiskFlag[]>('/high-risk')
  ]);

  const pregnancyByBeneficiary = new Map(pregnancies.map((p) => [p.beneficiary_id, p]));
  const riskByBeneficiary = new Map(highRisk.map((h) => [h.beneficiary_id, h]));

  return beneficiaries.map((b): Beneficiary => {
    const pregnancy = pregnancyByBeneficiary.get(b.id);
    const risk = riskByBeneficiary.get(b.id);
    return {
      id: b.id,
      name: b.name,
      husbandName: b.husband_name || '',
      age: b.age ?? 0,
      village: b.village,
      block: (b.block as Block) || blockForVillage(b.village),
      anmId: b.anm_id || '',
      anmName: b.anm_name || '',
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
  });
}

export const acknowledgeHighRisk = (beneficiaryId: string) =>
  apiPatch(`/high-risk/${beneficiaryId}`, { status: 'ACKNOWLEDGED' });
