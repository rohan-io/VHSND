export interface ApiReferral {
  id: string;
  beneficiary_id: string;
  beneficiary_name: string;
  facility: string;
  reason: string;
  date: string;
  follow_up_status: 'Pending' | 'Referred' | 'Completed';
  notes: string | null;
}

export interface CreateReferralInput {
  beneficiary_id: string;
  beneficiary_name: string;
  facility: string;
  reason: string;
  date: string;
  notes?: string;
}
