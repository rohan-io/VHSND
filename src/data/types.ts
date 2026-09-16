export type Block = 'Jajpur Sadar' | 'Sukinda';

export interface Village {
  name: string;
  block: Block;
}

export interface RiskResult {
  is_critical: boolean;
  reasons: string[];
  auto_flags: string[];
  manual_flags: string[];
}

export type RiskCategory =
  | 'Maternal Age'
  | 'Previous Obstetric History'
  | 'Current Pregnancy Complications'
  | 'Maternal Medical Conditions'
  | 'Pregnancy-Related Factors';

export interface Beneficiary {
  id: string; // BEN-2026-xxx
  name: string;
  husbandName: string;
  age: number;
  village: string;
  block: Block;
  anmId: string;
  anmName: string;
  trimester: 1 | 2 | 3;
  gestationalAgeLabel: string;
  risk: RiskResult;
}

export interface ChildBeneficiary {
  id: string; // CHILD-MCH-xxxx
  name: string;
  motherName: string;
  motherId: string; // BEN-2026-xxx
  village: string;
  block: Block;
  ageLabel: string;
}

export interface Escalation {
  id: string; // ALERT-CRIT-ESC-<pregnancyId>
  beneficiaryId: string;
  beneficiaryName: string;
  village: string;
  gestationalAgeLabel: string;
  reasons: string[];
  createdAt: string; // ISO date
}

export interface VhsndSession {
  id: string; // VHSND-2026-<village-code>-<seq>
  village: string;
  block: Block;
  date: string; // ISO date, YYYY-MM-DD
  anmId: string;
  anmName: string;
  expectedBeneficiaryIds: string[];
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Not Recorded';

export interface AnmAttendanceRecord {
  sessionId: string;
  anmId: string;
  anmName: string;
  status: AttendanceStatus;
  checkInTime?: string; // "HH:MM"
}

export interface BeneficiaryAttendance {
  sessionId: string;
  beneficiaryId: string;
  status: AttendanceStatus;
  reason?: string;
  followUpStatus?: 'Pending' | 'Contacted' | 'Rescheduled';
}

export interface Referral {
  id: string; // REF-2026-xxx
  beneficiaryId: string;
  beneficiaryName: string;
  facility: string;
  reason: string;
  date: string; // ISO date
  followUpStatus: 'Pending' | 'Referred' | 'Completed';
  notes?: string;
}
