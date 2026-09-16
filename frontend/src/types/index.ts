export type UserRole = "Administrator" | "Health Worker" | "Beneficiary";

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  mobile?: string;
  phc_center?: string;
  sector?: string;
  assigned_villages?: string[];
  // Set only for role "Health Worker" — distinguishes the clinical ANM from
  // the community-outreach ASHA (both share role "Health Worker"; this is the
  // finer-grained field the ANM supervisory view keys off).
  worker_type?: "ANM" | "ASHA";
  // Set only for role "Beneficiary" — the PregnancyRecord.id this account's
  // home screen is scoped to. DEMO-ONLY: a real deployment needs server-side
  // per-user data isolation, not a client-held record id (see demoDb.ts header).
  beneficiary_pregnancy_id?: string;
}

export interface PregnancyRecord {
  id: string;
  beneficiary_id: string;
  rcn_id?: string;
  full_name: string;
  husband_name?: string;
  age: number;
  dob?: string;
  mobile_number: string;
  address: string;
  village: string;
  block?: string;
  district?: string;
  registration_date?: string;
  lmp: string;
  edd: string;
  gestational_weeks: number;
  gestational_days: number;
  gestational_age_label: string;
  days_to_edd?: number;
  trimester: 1 | 2 | 3;
  gravida: number;
  para: number;
  blood_group?: string;
  // Legacy numeric vitals — no longer collected on the form (replaced by the
  // Health Slip photo); kept optional for historical/seed records.
  height_cm?: number;
  weight?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  hemoglobin?: number;
  fundal_height?: string;
  fetal_heart_rate?: number;
  is_high_risk: boolean;
  high_risk_reasons?: string[];
  // "Critical Pregnancy" screening (NHM/PMSMA). is_high_risk is the stored
  // determination; these manual factors are read off the paper RCN Card
  // (field name kept as health_slip_uri — the underlying data contract —
  // even though the UI now calls it "RCN Card").
  health_slip_uri?: string;
  // PMSMA (free ANC checkup camp, 9th of every month) — see src/utils/pmsma.ts.
  last_pmsma_check_date?: string;
  short_stature?: boolean;
  hypertension?: boolean;
  severe_anaemia?: boolean;
  bmi_abnormal?: boolean;
  previous_c_section?: boolean;
  previous_stillbirth_or_pph?: boolean; // legacy combined field, still used by the ANC follow-up form
  previous_stillbirth?: boolean;
  previous_preterm?: boolean;
  previous_recurrent_abortion?: boolean;
  previous_congenital_anomaly?: boolean;
  previous_pph?: boolean;
  previous_severe_preeclampsia?: boolean;
  aph?: boolean;
  malpresentation?: boolean;
  placenta_previa?: boolean;
  fgr?: boolean;
  rh_isoimmunisation?: boolean;
  amniotic_fluid_abnormal?: boolean;
  congenital_fetal_anomaly?: boolean;
  respiratory_disease?: boolean;
  autoimmune_disorder?: boolean;
  poor_nutrition?: boolean;
  poor_antenatal_care?: boolean;
  post_term?: boolean;
  prolonged_rom?: boolean;
  other_abnormality_text?: string;
  comorbidities?: string[];
  multiple_gestation?: boolean;
  critical_override?: boolean;
  previous_pregnancy_history?: string;
  existing_conditions?: string;
  allergies?: string;
  risk_factors?: string;
  assigned_worker_id?: string;
  assigned_worker_name?: string;
  // Joined in by demoDb.ts's /pregnancies/:id handler for the Beneficiary
  // screen's "your health worker" card — not present on list responses.
  assigned_worker_mobile?: string;
  health_centre?: string;
  status: "active" | "high_risk" | "delivered" | "archived";
  delivery_details?: {
    date: string;
    outcome: string;
    birth_weight: number;
    place: string;
    child_id?: string;
  };
  created_at: string;
  updated_at?: string;
  sync_status?: string;
}

export interface ANCVisit {
  id: string;
  pregnancy_id: string;
  beneficiary_id: string;
  mother_name: string;
  visit_number: number;
  visit_date: string;
  gestational_weeks_at_visit: number;
  // Legacy numeric vitals — not captured on the redesigned ANC form; optional
  // so historical/seed visits still render.
  weight?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  hemoglobin?: number;
  fundal_height?: string;
  fetal_heart_rate?: number;
  symptoms?: string;
  examination_notes?: string;
  investigation_details?: string;
  risk_status: "Normal" | "High Risk";
  advice?: string;
  next_visit_date?: string;
  health_worker_id?: string;
  health_worker_name?: string;
  status: "Completed" | "Upcoming" | "Overdue";
  created_at: string;
}

export interface MaternalImmunization {
  id: string;
  pregnancy_id: string;
  beneficiary_id: string;
  mother_name: string;
  vaccine_name: string;
  dose?: string;
  description?: string;
  recommended_date: string;
  due_date: string;
  administration_date?: string | null;
  batch_number?: string;
  status: "Upcoming" | "Due" | "Completed" | "Overdue";
  remarks?: string;
  health_worker_name?: string;
}

export interface ChildRecord {
  id: string;
  child_id: string;
  mother_id: string;
  mother_name: string;
  mother_mobile?: string;
  child_name: string;
  gender: "Male" | "Female";
  dob: string;
  age_days: number;
  age_label: string;
  birth_weight: number;
  place_of_birth: string;
  address?: string;
  village: string;
  block?: string;
  district?: string;
  health_worker_id?: string;
  health_worker_name?: string;
  vaccine_stats?: {
    total: number;
    completed: number;
    overdue: number;
    due: number;
    progress_percent: number;
  };
  created_at: string;
}

export interface ChildImmunization {
  id: string;
  child_id: string;
  child_name: string;
  vaccine_code: string;
  vaccine_name: string;
  target_age_label: string;
  recommended_due_date: string;
  administered_date?: string | null;
  route?: string;
  status: "Upcoming" | "Due" | "Completed" | "Overdue";
  batch_no?: string;
  adverse_event_reported?: boolean;
  remarks?: string;
  administered_by?: string;
}

export interface AlertItem {
  id: string;
  alert_type: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  message: string;
  beneficiary_name: string;
  beneficiary_id: string;
  related_entity_type: "pregnancy" | "child";
  related_entity_id: string;
  due_date: string;
  assigned_worker_id?: string;
  assigned_worker_name?: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  created_at: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  beneficiary_name?: string;
  created_at: string;
  is_read: boolean;
  target_user_id?: string;
}

export interface DashboardSummary {
  total_pregnancies: number;
  trimester_1: number;
  trimester_2: number;
  trimester_3: number;
  high_risk_pregnancies: number;
  delivered_pregnancies: number;
  anc_due: number;
  anc_overdue: number;
  maternal_vaccine_due: number;
  maternal_vaccine_overdue: number;
  maternal_vaccine_completed: number;
  total_children: number;
  child_vaccines_due: number;
  child_vaccines_overdue: number;
  child_vaccines_completed: number;
}

export interface OfflineSyncItem {
  client_txn_id: string;
  entity_type: "pregnancy" | "anc_visit" | "maternal_imm" | "child" | "child_imm";
  payload: any;
  worker_id?: string;
  timestamp: string;
  display_title: string;
  display_subtitle: string;
}

// An ASHA's stats as seen on her supervising ANM's dashboard (read-only —
// see app/(tabs)/index.tsx's supervisory section).
export interface SupervisedAshaSummary {
  worker_id: string;
  name: string;
  mobile?: string;
  sector?: string;
  assigned_villages?: string[];
  registered_pregnancies: number;
  anc_visits_conducted: number;
  children_covered: number;
}

export interface SupervisedTeamResponse {
  supervisor: { id: string; name: string; phc_center?: string };
  ashas: SupervisedAshaSummary[];
  critical_escalations: AlertItem[];
}
