import { apiGet, apiPatch } from '@/lib/api-config';
import type { Beneficiary } from '@/data/types';
import { mapBeneficiary } from './adapters';
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

  return beneficiaries.map((b) =>
    mapBeneficiary(b, pregnancyByBeneficiary.get(b.id), riskByBeneficiary.get(b.id))
  );
}

export const acknowledgeHighRisk = (beneficiaryId: string) =>
  apiPatch(`/high-risk/${beneficiaryId}`, { status: 'ACKNOWLEDGED' });
