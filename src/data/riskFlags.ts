import type { RiskCategory } from './types';

const SECTION_TO_CATEGORY: Record<string, RiskCategory> = {
  obstetric_history: 'Previous Obstetric History',
  current_complications: 'Current Pregnancy Complications',
  medical_conditions: 'Maternal Medical Conditions',
  pregnancy_related: 'Pregnancy-Related Factors'
};

// Reason text -> section, copied verbatim from frontend/src/utils/riskAssessment.ts's
// MANUAL_FACTOR_OPTIONS (reason, section pairs) — this file does not import that
// module (admin-web stays isolated), so the mapping is duplicated here by value.
const REASON_TO_SECTION: Record<string, string> = {
  'Previous caesarean section or uterine surgery': 'obstetric_history',
  'Previous stillbirth or neonatal death': 'obstetric_history',
  'Previous preterm birth': 'obstetric_history',
  'Previous recurrent abortions': 'obstetric_history',
  'Previous baby with congenital anomaly': 'obstetric_history',
  'Previous PPH or severe obstetric complication': 'obstetric_history',
  'Previous severe pre-eclampsia or eclampsia': 'obstetric_history',
  'Previous stillbirth or postpartum haemorrhage': 'obstetric_history', // legacy combined field
  'Hypertension, pre-eclampsia or eclampsia': 'current_complications',
  'Anaemia, especially severe anaemia': 'current_complications',
  'Antepartum haemorrhage': 'current_complications',
  'Multiple pregnancy (twins or more)': 'current_complications',
  Malpresentation: 'current_complications',
  'Placenta previa or accreta': 'current_complications',
  'Fetal growth restriction': 'current_complications',
  'Rh isoimmunisation': 'current_complications',
  'Oligohydramnios or polyhydramnios': 'current_complications',
  'Congenital fetal anomaly': 'current_complications',
  'Severe respiratory disease': 'medical_conditions',
  'Autoimmune disorder': 'medical_conditions',
  'Very low or high BMI': 'pregnancy_related',
  'Poor nutritional status': 'pregnancy_related',
  'Poor antenatal care': 'pregnancy_related',
  'Post-term pregnancy (41 weeks or more)': 'pregnancy_related',
  'Prolonged rupture of membranes': 'pregnancy_related',
  'Short stature (height under 145 cm)': 'pregnancy_related'
};

// Reasonable-default assumption (logged in the debt log): free-text and
// clinician-override reasons have no natural section, so they fall into this
// catch-all. Same fallback for any future reason string this table hasn't seen.
const CATCH_ALL: RiskCategory = 'Pregnancy-Related Factors';

function isAutoFlag(reason: string): boolean {
  return (
    reason.startsWith('Adolescent pregnancy') ||
    reason.startsWith('Advanced maternal age') ||
    reason.startsWith('Very advanced maternal age') ||
    reason.startsWith('Grand multipara') ||
    reason.startsWith('Rh-negative blood group')
  );
}

export function bucketRiskReasons(reasons: string[]): Record<RiskCategory, string[]> {
  const result: Record<RiskCategory, string[]> = {
    'Maternal Age': [],
    'Previous Obstetric History': [],
    'Current Pregnancy Complications': [],
    'Maternal Medical Conditions': [],
    'Pregnancy-Related Factors': []
  };
  for (const reason of reasons) {
    if (isAutoFlag(reason)) {
      result['Maternal Age'].push(reason);
      continue;
    }
    if (reason.startsWith('Known comorbidity:')) {
      result['Maternal Medical Conditions'].push(reason);
      continue;
    }
    const section = REASON_TO_SECTION[reason];
    const category = section ? SECTION_TO_CATEGORY[section] : undefined;
    result[category ?? CATCH_ALL].push(reason);
  }
  return result;
}
