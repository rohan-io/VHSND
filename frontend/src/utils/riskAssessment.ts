/**
 * High-risk / "Critical Pregnancy" screening — single source of truth.
 *
 * Thresholds are India NHM / PMSMA high-risk pregnancy identification criteria.
 * Any ONE factor present marks the pregnancy Critical.
 *
 * Auto-derived (no checkbox needed — computed from fields the form already collects):
 *   - age < 18, >= 35, or >= 40   (age, or DOB)
 *   - grand multipara              (gravida >= 5)
 *   - Rh-negative                  (blood group ends in "-")
 * Everything else is a manual checkbox, grouped into 5 clinically-organised
 * sections on the registration form (see MANUAL_FACTOR_OPTIONS `section`):
 *   1. Maternal Age            — fully auto-derived, no manual entry (above)
 *   2. obstetric_history        — previous pregnancy/delivery complications
 *   3. current_complications    — this pregnancy's complications
 *   4. medical_conditions       — pre-existing maternal disease
 *   5. pregnancy_related        — BMI, nutrition, ANC quality, timing
 * "Teenage pregnancy" is intentionally NOT a pregnancy_related checkbox — it
 * duplicates the auto-detected age < 18 flag above (see registration screen).
 *
 * `legacy` section: `previous_stillbirth_or_pph` is the old combined field.
 * The registration form now splits it into `previous_stillbirth` (section 2)
 * and `previous_pph` (also section 2); the ANC follow-up visit form
 * (app/anc/record.tsx) still reads/writes the combined field and is out of
 * scope for this pass, so it stays recognised here for backward compat.
 * ponytail: two fields carry near-identical meaning until anc/record.tsx is
 * migrated to the split fields too — acceptable for a demo, revisit together.
 *
 * Reason strings are canonical ENGLISH and get stored in
 * PregnancyRecord.high_risk_reasons — screens translate the *labels* around
 * them, never the stored data (same rule as src/i18n/strings.ts).
 *
 * backend/server.py assess_high_risk() mirrors this logic for Postgres parity
 * but has NOT been updated for the new thresholds/fields below (out of scope
 * for this frontend-form pass; the demo APK runs entirely off this module +
 * demoDb.ts via EXPO_PUBLIC_DEMO_MODE).
 */

export const COMORBIDITY_OPTIONS = [
  { key: "diabetes", label: "diabetes" },
  { key: "cardiac", label: "cardiac disease" },
  { key: "thyroid", label: "thyroid disorder" },
  { key: "epilepsy", label: "epilepsy" },
  { key: "kidney", label: "kidney disease" },
  { key: "tb", label: "TB" },
  { key: "hiv", label: "HIV" },
] as const;

export type ComorbidityKey = (typeof COMORBIDITY_OPTIONS)[number]["key"];

/** The 4 manual-checkbox groupings shown on the registration form (section 1, Maternal Age, is auto-only). */
export const RISK_FACTOR_SECTIONS = [
  "obstetric_history",
  "current_complications",
  "medical_conditions",
  "pregnancy_related",
] as const;

export type RiskFactorSection = (typeof RISK_FACTOR_SECTIONS)[number];

/** Manual checkbox factors — boolean keys on RiskInputs, grouped by section for the UI. */
export const MANUAL_FACTOR_OPTIONS = [
  // -- Previous Obstetric History --
  { key: "previous_c_section", section: "obstetric_history", reason: "Previous caesarean section or uterine surgery" },
  { key: "previous_stillbirth", section: "obstetric_history", reason: "Previous stillbirth or neonatal death" },
  { key: "previous_preterm", section: "obstetric_history", reason: "Previous preterm birth" },
  { key: "previous_recurrent_abortion", section: "obstetric_history", reason: "Previous recurrent abortions" },
  { key: "previous_congenital_anomaly", section: "obstetric_history", reason: "Previous baby with congenital anomaly" },
  { key: "previous_pph", section: "obstetric_history", reason: "Previous PPH or severe obstetric complication" },
  { key: "previous_severe_preeclampsia", section: "obstetric_history", reason: "Previous severe pre-eclampsia or eclampsia" },

  // -- Current Pregnancy Complications (diabetes lives in COMORBIDITY_OPTIONS, not here) --
  { key: "hypertension", section: "current_complications", reason: "Hypertension, pre-eclampsia or eclampsia" },
  { key: "severe_anaemia", section: "current_complications", reason: "Anaemia, especially severe anaemia" },
  { key: "aph", section: "current_complications", reason: "Antepartum haemorrhage" },
  { key: "multiple_gestation", section: "current_complications", reason: "Multiple pregnancy (twins or more)" },
  { key: "malpresentation", section: "current_complications", reason: "Malpresentation" },
  { key: "placenta_previa", section: "current_complications", reason: "Placenta previa or accreta" },
  { key: "fgr", section: "current_complications", reason: "Fetal growth restriction" },
  { key: "rh_isoimmunisation", section: "current_complications", reason: "Rh isoimmunisation" },
  { key: "amniotic_fluid_abnormal", section: "current_complications", reason: "Oligohydramnios or polyhydramnios" },
  { key: "congenital_fetal_anomaly", section: "current_complications", reason: "Congenital fetal anomaly" },

  // -- Maternal Medical Conditions (cardiac/thyroid/epilepsy/kidney/tb/hiv live in COMORBIDITY_OPTIONS) --
  { key: "respiratory_disease", section: "medical_conditions", reason: "Severe respiratory disease" },
  { key: "autoimmune_disorder", section: "medical_conditions", reason: "Autoimmune disorder" },

  // -- Pregnancy-Related Factors --
  { key: "bmi_abnormal", section: "pregnancy_related", reason: "Very low or high BMI" },
  { key: "poor_nutrition", section: "pregnancy_related", reason: "Poor nutritional status" },
  { key: "poor_antenatal_care", section: "pregnancy_related", reason: "Poor antenatal care" },
  { key: "post_term", section: "pregnancy_related", reason: "Post-term pregnancy (41 weeks or more)" },
  { key: "prolonged_rom", section: "pregnancy_related", reason: "Prolonged rupture of membranes" },
  { key: "short_stature", section: "pregnancy_related", reason: "Short stature (height under 145 cm)" },

  // -- legacy (ANC follow-up form only, see file header) --
  { key: "previous_stillbirth_or_pph", section: "legacy", reason: "Previous stillbirth or postpartum haemorrhage" },
] as const;

export type ManualFactorKey = (typeof MANUAL_FACTOR_OPTIONS)[number]["key"];

export interface RiskInputs {
  age?: number | null;
  dob?: string | null; // ISO date; used only when age is missing
  gravida?: number | null;
  blood_group?: string | null;
  // manual checkbox factors (see MANUAL_FACTOR_OPTIONS for the full/grouped list)
  short_stature?: boolean | null;
  hypertension?: boolean | null;
  severe_anaemia?: boolean | null;
  bmi_abnormal?: boolean | null;
  previous_c_section?: boolean | null;
  previous_stillbirth_or_pph?: boolean | null; // legacy combined field (ANC form)
  previous_stillbirth?: boolean | null;
  previous_pph?: boolean | null;
  previous_preterm?: boolean | null;
  previous_recurrent_abortion?: boolean | null;
  previous_congenital_anomaly?: boolean | null;
  previous_severe_preeclampsia?: boolean | null;
  aph?: boolean | null;
  multiple_gestation?: boolean | null;
  malpresentation?: boolean | null;
  placenta_previa?: boolean | null;
  fgr?: boolean | null;
  rh_isoimmunisation?: boolean | null;
  amniotic_fluid_abnormal?: boolean | null;
  congenital_fetal_anomaly?: boolean | null;
  respiratory_disease?: boolean | null;
  autoimmune_disorder?: boolean | null;
  poor_nutrition?: boolean | null;
  poor_antenatal_care?: boolean | null;
  post_term?: boolean | null;
  prolonged_rom?: boolean | null;
  other_abnormality_text?: string | null;
  comorbidities?: string[] | null;
  critical_override?: boolean | null; // clinician escape hatch
}

export interface RiskResult {
  is_critical: boolean;
  reasons: string[];
  auto_flags: string[];
  manual_flags: string[];
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof n === "number" && !Number.isNaN(n) ? n : null;
};

function ageFrom(inputs: RiskInputs): number | null {
  const a = num(inputs.age);
  if (a != null && a > 0) return a;
  if (inputs.dob) {
    const d = new Date(inputs.dob);
    if (!Number.isNaN(d.getTime())) {
      return Math.floor((Date.now() - d.getTime()) / (365.25 * 86_400_000));
    }
  }
  return null;
}

export function assessRisk(inputs: RiskInputs): RiskResult {
  const auto_flags: string[] = [];
  const manual_flags: string[] = [];

  // --- auto-derived (Maternal Age section is 100% auto — thresholds can overlap) ---
  const age = ageFrom(inputs);
  if (age != null) {
    if (age < 18) auto_flags.push("Adolescent pregnancy (under 18 years)");
    if (age >= 35) auto_flags.push("Advanced maternal age (35 years or older, especially first pregnancy)");
    if (age >= 40) auto_flags.push("Very advanced maternal age (40 years or older)");
  }

  const gravida = num(inputs.gravida);
  if (gravida != null && gravida >= 5) auto_flags.push("Grand multipara (5 or more pregnancies)");

  const bg = (inputs.blood_group || "").trim();
  if (bg.endsWith("-")) auto_flags.push(`Rh-negative blood group (${bg})`);

  // --- manual (grouped checkbox sections) ---
  for (const f of MANUAL_FACTOR_OPTIONS) {
    if (inputs[f.key]) manual_flags.push(f.reason);
  }

  const otherText = (inputs.other_abnormality_text || "").trim();
  if (otherText) manual_flags.push(`Other: ${otherText}`);

  const picked = new Set(inputs.comorbidities || []);
  for (const c of COMORBIDITY_OPTIONS) {
    if (picked.has(c.key)) manual_flags.push(`Known comorbidity: ${c.label}`);
  }

  if (inputs.critical_override) manual_flags.push("Flagged by clinician");

  const reasons = [...auto_flags, ...manual_flags];
  return { is_critical: reasons.length > 0, reasons, auto_flags, manual_flags };
}

// --- self-check ---------------------------------------------------------------
if (typeof require !== "undefined" && require.main === module) {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL: " + m);
  };

  assert(!assessRisk({ age: 25, gravida: 2, blood_group: "O+" }).is_critical, "healthy case is not critical");

  assert(assessRisk({ age: 17 }).is_critical, "age 17 critical");
  assert(assessRisk({ age: 35 }).is_critical, "age 35 critical (>=35 threshold)");
  assert(assessRisk({ age: 40 }).is_critical, "age 40 critical");
  assert(!assessRisk({ age: 34 }).is_critical, "age 34 not critical");
  assert(!assessRisk({ age: 18 }).is_critical, "age 18 not critical");
  assert(assessRisk({ dob: "2010-01-01" }).is_critical, "dob -> age < 18 critical");
  assert(assessRisk({ age: 42 }).auto_flags.length === 2, "age 42 trips both the >=35 and >=40 flags");

  assert(assessRisk({ gravida: 5 }).is_critical, "gravida 5 grand multipara critical");
  assert(!assessRisk({ gravida: 4 }).is_critical, "gravida 4 not critical");

  assert(assessRisk({ blood_group: "O-" }).is_critical, "Rh-negative critical");
  assert(!assessRisk({ blood_group: "O+" }).is_critical, "Rh-positive not critical");

  assert(assessRisk({ short_stature: true }).is_critical, "short stature critical");
  assert(assessRisk({ hypertension: true }).is_critical, "hypertension critical");
  assert(assessRisk({ severe_anaemia: true }).is_critical, "severe anaemia critical");
  assert(assessRisk({ bmi_abnormal: true }).is_critical, "abnormal BMI critical");
  assert(assessRisk({ previous_c_section: true }).is_critical, "previous c-section critical");
  assert(assessRisk({ previous_stillbirth_or_pph: true }).is_critical, "legacy combined field still critical (ANC form)");
  assert(assessRisk({ previous_stillbirth: true }).is_critical, "split previous_stillbirth critical");
  assert(assessRisk({ previous_pph: true }).is_critical, "split previous_pph critical");
  assert(assessRisk({ previous_preterm: true }).is_critical, "previous preterm birth critical");
  assert(assessRisk({ multiple_gestation: true }).is_critical, "multiple gestation critical");
  assert(assessRisk({ malpresentation: true }).is_critical, "malpresentation critical");
  assert(assessRisk({ rh_isoimmunisation: true }).is_critical, "Rh isoimmunisation critical");
  assert(assessRisk({ respiratory_disease: true }).is_critical, "respiratory disease critical");
  assert(assessRisk({ autoimmune_disorder: true }).is_critical, "autoimmune disorder critical");
  assert(assessRisk({ post_term: true }).is_critical, "post-term pregnancy critical");
  assert(assessRisk({ other_abnormality_text: "Unusual cord insertion" }).is_critical, "free-text other abnormality critical");
  assert(!assessRisk({ other_abnormality_text: "   " }).is_critical, "blank other-text is not a flag");
  assert(assessRisk({ comorbidities: ["hiv"] }).is_critical, "HIV comorbidity critical");
  assert(assessRisk({ comorbidities: ["diabetes"] }).is_critical, "diabetes comorbidity critical");
  assert(assessRisk({ critical_override: true }).is_critical, "clinician override critical");

  const multi = assessRisk({ age: 16, blood_group: "AB-", previous_c_section: true, comorbidities: ["diabetes"] });
  assert(multi.reasons.length === 4, "collects all reasons");
  assert(multi.auto_flags.length === 2 && multi.manual_flags.length === 2, "splits auto vs manual");

  console.log("riskAssessment.ts self-check passed");
}
