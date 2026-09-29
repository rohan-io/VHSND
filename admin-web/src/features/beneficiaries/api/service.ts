import { apiGet, apiPatch } from '@/lib/api-config';
import type { Beneficiary } from '@/data/types';
import { mapBeneficiary } from './adapters';
import type { ApiHighRiskFlag, ApiPregnancy } from './types';

// The mobile store (/api/pregnancies) is the single source of truth for
// mothers — it includes every mobile registration, not just the 16
// hand-seeded admin-web beneficiaries. Every field the UI needs (name,
// village, trimester, assigned worker...) already lives on the pregnancy
// record, so /api/beneficiaries (the older, fixed 16-row relational table)
// isn't fetched here at all anymore. /api/high-risk is still consulted for
// review status and as one half of the union risk merge — see adapters.ts.
export async function getBeneficiaries(): Promise<Beneficiary[]> {
  const [pregnancies, highRisk] = await Promise.all([
    apiGet<{ items: ApiPregnancy[] }>('/pregnancies').then((r) => r.items),
    apiGet<ApiHighRiskFlag[]>('/high-risk')
  ]);

  const riskByBeneficiary = new Map(highRisk.map((h) => [h.beneficiary_id, h]));

  return pregnancies
    .filter((p) => p.status !== 'delivered')
    .map((p) => mapBeneficiary(p, riskByBeneficiary.get(p.beneficiary_id)));
}

export const acknowledgeHighRisk = (beneficiaryId: string) =>
  apiPatch(`/high-risk/${beneficiaryId}`, { status: 'ACKNOWLEDGED' });
