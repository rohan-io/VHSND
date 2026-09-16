// Facility list is a reasonable-default assumption (logged in the debt log),
// grounded in the real facility names already present in demoDb.ts
// (DHH Jajpur, CHC Jajpur Sadar, CHC Sukinda) plus one higher-tier referral
// destination for genuinely critical escalations.
import type { Referral } from './types';

export const REFERRAL_FACILITIES = [
  'CHC Jajpur Sadar',
  'CHC Sukinda',
  'DHH Jajpur',
  'SCB Medical College, Cuttack'
] as const;

export const REFERRALS: Referral[] = [
  {
    id: 'REF-2026-001',
    beneficiaryId: 'BEN-2026-502',
    beneficiaryName: 'Rojalin Behera',
    facility: 'DHH Jajpur',
    reason: 'Advanced maternal age — third trimester, needs specialist monitoring',
    date: '2026-09-14',
    followUpStatus: 'Referred',
    notes: 'Family informed; transport arranged via ASHA.'
  },
  {
    id: 'REF-2026-002',
    beneficiaryId: 'BEN-2026-507',
    beneficiaryName: 'Sujata Das',
    facility: 'CHC Sukinda',
    reason: 'Hypertension, pre-eclampsia or eclampsia — BP monitoring',
    date: '2026-09-16',
    followUpStatus: 'Pending'
  }
];
