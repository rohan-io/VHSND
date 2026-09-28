import { apiGet, apiPost } from '@/lib/api-config';
import type { Referral } from '@/data/types';
import type { ApiReferral, CreateReferralInput } from './types';

const fromApi = (r: ApiReferral): Referral => ({
  id: r.id,
  beneficiaryId: r.beneficiary_id,
  beneficiaryName: r.beneficiary_name,
  facility: r.facility,
  reason: r.reason,
  date: r.date,
  followUpStatus: r.follow_up_status,
  notes: r.notes || undefined
});

export async function getReferrals(): Promise<Referral[]> {
  const rows = await apiGet<ApiReferral[]>('/referrals');
  return rows.map(fromApi);
}

export async function createReferral(input: CreateReferralInput): Promise<Referral> {
  const created = await apiPost<ApiReferral>('/referrals', input);
  return fromApi(created);
}
