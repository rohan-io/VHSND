// Ported from frontend/src/utils/riskAssessment.ts (pure logic, no RN deps) so
// local-api's pregnancy routes score risk identically to the mobile app's
// offline demo mode. Keep in sync with that file if thresholds change.
const COMORBIDITY_OPTIONS = [
  { key: "diabetes", label: "diabetes" },
  { key: "cardiac", label: "cardiac disease" },
  { key: "thyroid", label: "thyroid disorder" },
  { key: "epilepsy", label: "epilepsy" },
  { key: "kidney", label: "kidney disease" },
  { key: "tb", label: "TB" },
  { key: "hiv", label: "HIV" },
];

const MANUAL_FACTOR_OPTIONS = [
  { key: "previous_c_section", reason: "Previous caesarean section or uterine surgery" },
  { key: "previous_stillbirth", reason: "Previous stillbirth or neonatal death" },
  { key: "previous_preterm", reason: "Previous preterm birth" },
  { key: "previous_recurrent_abortion", reason: "Previous recurrent abortions" },
  { key: "previous_congenital_anomaly", reason: "Previous baby with congenital anomaly" },
  { key: "previous_pph", reason: "Previous PPH or severe obstetric complication" },
  { key: "previous_severe_preeclampsia", reason: "Previous severe pre-eclampsia or eclampsia" },
  { key: "hypertension", reason: "Hypertension, pre-eclampsia or eclampsia" },
  { key: "severe_anaemia", reason: "Anaemia, especially severe anaemia" },
  { key: "aph", reason: "Antepartum haemorrhage" },
  { key: "multiple_gestation", reason: "Multiple pregnancy (twins or more)" },
  { key: "malpresentation", reason: "Malpresentation" },
  { key: "placenta_previa", reason: "Placenta previa or accreta" },
  { key: "fgr", reason: "Fetal growth restriction" },
  { key: "rh_isoimmunisation", reason: "Rh isoimmunisation" },
  { key: "amniotic_fluid_abnormal", reason: "Oligohydramnios or polyhydramnios" },
  { key: "congenital_fetal_anomaly", reason: "Congenital fetal anomaly" },
  { key: "respiratory_disease", reason: "Severe respiratory disease" },
  { key: "autoimmune_disorder", reason: "Autoimmune disorder" },
  { key: "bmi_abnormal", reason: "Very low or high BMI" },
  { key: "poor_nutrition", reason: "Poor nutritional status" },
  { key: "poor_antenatal_care", reason: "Poor antenatal care" },
  { key: "post_term", reason: "Post-term pregnancy (41 weeks or more)" },
  { key: "prolonged_rom", reason: "Prolonged rupture of membranes" },
  { key: "short_stature", reason: "Short stature (height under 145 cm)" },
  { key: "previous_stillbirth_or_pph", reason: "Previous stillbirth or postpartum haemorrhage" },
];

const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && !Number.isNaN(n) ? n : null;
};

function ageFrom(inputs) {
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

function assessRisk(inputs) {
  const auto_flags = [];
  const manual_flags = [];

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

module.exports = { assessRisk };
