// Raw local-api response shapes (snake_case, per local-api/README.md).
export interface ApiPregnancy {
  id: string;
  beneficiary_id: string;
  full_name: string;
  husband_name: string;
  age: number;
  village: string;
  trimester: number;
  gestational_age_label: string;
  is_high_risk: boolean;
  high_risk_reasons: string[];
  assigned_worker_id: string;
  assigned_worker_name: string;
  status: string;
}

export interface ApiHighRiskFlag {
  beneficiary_id: string;
  reasons: string[];
  auto_flags: string[];
  manual_flags: string[];
  status: string;
}
