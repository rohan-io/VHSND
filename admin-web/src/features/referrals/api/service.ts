import { apiGet, apiPost } from '@/lib/api-config';
import type { Referral } from '@/data/types';
import { mapReferral } from './adapters';
import type { ApiReferral, CreateReferralInput } from './types';

export async function getReferrals(): Promise<Referral[]> {
  const rows = await apiGet<ApiReferral[]>('/referrals');
  return rows.map(mapReferral);
}

export async function createReferral(input: CreateReferralInput): Promise<Referral> {
  const created = await apiPost<ApiReferral>('/referrals', input);
  return mapReferral(created);
}
