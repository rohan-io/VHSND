// Raw local-api response shapes (snake_case, per local-api/README.md).
export interface ApiBeneficiary {
  id: string;
  name: string;
  husband_name: string | null;
  age: number | null;
  village: string;
  block: string | null;
  anm_id: string | null;
  anm_name: string | null;
}

export interface ApiPregnancy {
  id: string;
  beneficiary_id: string;
  trimester: number;
  gestational_age_label: string;
  is_high_risk: boolean;
  high_risk_reasons: string[];
}

export interface ApiHighRiskFlag {
  beneficiary_id: string;
  reasons: string[];
  auto_flags: string[];
  manual_flags: string[];
  status: string;
}
