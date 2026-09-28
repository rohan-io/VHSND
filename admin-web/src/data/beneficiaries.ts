// Deliberate scope decision (logged in the debt log): frontend/src/api/demoDb.ts
// procedurally generates 50 pregnancies via assessRisk(). Porting that generator
// would mean importing cross-package logic, which breaks admin-web's isolation
// constraint. Instead, this is a hand-authored ~16-record subset reusing real
// names/villages from demoDb.ts's PREG_NAMES and real reason strings from
// riskAssessment.ts, covering all 8 villages, all 3 trimesters, all 5
// bucketRiskReasons categories at least once, and routine (no-risk) cases.
import type { Beneficiary } from './types';
import { blockForVillage } from './villages';

const ANM = {
  sectorA: { id: 'USR-HW-001', name: 'Smruti Malla (ANM)' }, // Mangarajpur, Badatrilochanpur, Balarampur
  sectorB: { id: 'USR-HW-002', name: 'Mamata Barik (ASHA)' } // Gandhapal, Baradiha, Kantira, Nuadihi, Singadia
};
const anmFor = (village: string) =>
  ['Mangarajpur', 'Badatrilochanpur', 'Balarampur'].includes(village) ? ANM.sectorA : ANM.sectorB;

function beneficiary(
  seedIndex: number,
  name: string,
  husbandName: string,
  age: number,
  village: string,
  trimester: 1 | 2 | 3,
  gestationalAgeLabel: string,
  risk: Beneficiary['risk']
): Beneficiary {
  const anm = anmFor(village);
  return {
    id: `BEN-2026-${500 + seedIndex}`,
    name,
    husbandName,
    age,
    village,
    block: blockForVillage(village),
    anmId: anm.id,
    anmName: anm.name,
    trimester,
    gestationalAgeLabel,
    risk
  };
}

const noRisk: Beneficiary['risk'] = {
  is_critical: false,
  reasons: [],
  auto_flags: [],
  manual_flags: []
};

export const BENEFICIARIES: Beneficiary[] = [
  beneficiary(0, 'Sasmita Jena', 'Prakash Jena', 24, 'Mangarajpur', 1, '10 Weeks 2 Days', noRisk),
  beneficiary(
    1,
    'Puspanjali Sahoo',
    'Bikram Sahoo',
    22,
    'Badatrilochanpur',
    2,
    '18 Weeks 0 Days',
    noRisk
  ),
  beneficiary(2, 'Rojalin Behera', 'Sanjay Behera', 29, 'Gandhapal', 3, '34 Weeks 3 Days', {
    is_critical: true,
    reasons: ['Advanced maternal age (35 years or older, especially first pregnancy)'],
    auto_flags: ['Advanced maternal age (35 years or older, especially first pregnancy)'],
    manual_flags: []
  }),
  beneficiary(3, 'Manaswini Nayak', 'Deepak Nayak', 36, 'Baradiha', 2, '22 Weeks 1 Day', {
    is_critical: true,
    reasons: ['Advanced maternal age (35 years or older, especially first pregnancy)'],
    auto_flags: ['Advanced maternal age (35 years or older, especially first pregnancy)'],
    manual_flags: []
  }),
  beneficiary(4, 'Lipsa Mohanty', 'Rakesh Mohanty', 17, 'Kantira', 1, '8 Weeks 5 Days', {
    is_critical: true,
    reasons: ['Adolescent pregnancy (under 18 years)'],
    auto_flags: ['Adolescent pregnancy (under 18 years)'],
    manual_flags: []
  }),
  beneficiary(5, 'Sunita Pradhan', 'Gopal Pradhan', 26, 'Balarampur', 3, '36 Weeks 0 Days', noRisk),
  beneficiary(6, 'Ipsita Rout', 'Manoj Rout', 28, 'Mangarajpur', 2, '24 Weeks 2 Days', {
    is_critical: true,
    reasons: ['Previous caesarean section or uterine surgery'],
    auto_flags: [],
    manual_flags: ['Previous caesarean section or uterine surgery']
  }),
  beneficiary(7, 'Sujata Das', 'Niranjan Das', 31, 'Nuadihi', 3, '30 Weeks 6 Days', {
    is_critical: true,
    reasons: ['Hypertension, pre-eclampsia or eclampsia'],
    auto_flags: [],
    manual_flags: ['Hypertension, pre-eclampsia or eclampsia']
  }),
  beneficiary(8, 'Snigdha Parida', 'Sushil Parida', 23, 'Singadia', 1, '12 Weeks 0 Days', {
    is_critical: true,
    reasons: ['Anaemia, especially severe anaemia'],
    auto_flags: [],
    manual_flags: ['Anaemia, especially severe anaemia']
  }),
  beneficiary(9, 'Madhusmita Sahu', 'Rabindra Sahu', 27, 'Badatrilochanpur', 2, '20 Weeks 3 Days', {
    is_critical: true,
    reasons: ['Severe respiratory disease'],
    auto_flags: [],
    manual_flags: ['Severe respiratory disease']
  }),
  beneficiary(10, 'Basanti Swain', 'Chittaranjan Swain', 32, 'Gandhapal', 3, '33 Weeks 1 Day', {
    is_critical: true,
    reasons: ['Autoimmune disorder'],
    auto_flags: [],
    manual_flags: ['Autoimmune disorder']
  }),
  beneficiary(11, 'Sanjukta Barik', 'Prasanna Barik', 25, 'Mangarajpur', 1, '9 Weeks 4 Days', {
    is_critical: true,
    reasons: ['Very low or high BMI'],
    auto_flags: [],
    manual_flags: ['Very low or high BMI']
  }),
  beneficiary(12, 'Sabitri Soren', 'Mangal Soren', 21, 'Balarampur', 2, '26 Weeks 0 Days', {
    is_critical: true,
    reasons: ['Short stature (height under 145 cm)'],
    auto_flags: [],
    manual_flags: ['Short stature (height under 145 cm)']
  }),
  beneficiary(13, 'Nisha Bibi', 'Sk. Imran', 28, 'Baradiha', 3, '38 Weeks 2 Days', {
    is_critical: true,
    reasons: ['Known comorbidity: diabetes'],
    auto_flags: [],
    manual_flags: ['Known comorbidity: diabetes']
  }),
  beneficiary(14, 'Pratima Sethi', 'Bijay Sethi', 30, 'Kantira', 2, '19 Weeks 5 Days', noRisk),
  beneficiary(15, 'Nirmala Panda', 'Basudev Panda', 41, 'Badatrilochanpur', 3, '35 Weeks 0 Days', {
    is_critical: true,
    reasons: [
      'Very advanced maternal age (40 years or older)',
      'Advanced maternal age (35 years or older, especially first pregnancy)'
    ],
    auto_flags: [
      'Very advanced maternal age (40 years or older)',
      'Advanced maternal age (35 years or older, especially first pregnancy)'
    ],
    manual_flags: []
  })
];
