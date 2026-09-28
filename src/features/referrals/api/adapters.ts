import type { Referral } from '@/data/types';
import type { ApiReferral } from './types';

export function mapReferral(row: ApiReferral): Referral {
  return {
    id: row.id,
    beneficiaryId: row.beneficiary_id,
    beneficiaryName: row.beneficiary_name,
    facility: row.facility,
    reason: row.reason,
    date: row.date,
    followUpStatus: row.follow_up_status,
    notes: row.notes || undefined
  };
}
