// Fixtures below are real responses captured via curl against a running
// local-api (see local-api/README.md), not hand-invented shapes. The
// mismatch fixtures reproduce two real seeded records where the relational
// high_risk_flags table and the mobile pregnancy record disagree.
import { describe, expect, it } from 'vitest';
import { mapBeneficiary } from './adapters';
import type { ApiHighRiskFlag, ApiPregnancy } from './types';

const routinePregnancy: ApiPregnancy = {
  id: 'PREG-2026-1000',
  beneficiary_id: 'BEN-2026-500',
  full_name: 'Sasmita Jena',
  husband_name: 'Prakash Jena',
  age: 24,
  village: 'Mangarajpur',
  trimester: 1,
  gestational_age_label: '10 Weeks 2 Days',
  is_high_risk: false,
  high_risk_reasons: [],
  assigned_worker_id: 'USR-HW-001',
  assigned_worker_name: 'Smruti Malla (ANM)',
  status: 'active'
};

const highRiskPregnancy: ApiPregnancy = {
  id: 'PREG-2026-1002',
  beneficiary_id: 'BEN-2026-502',
  full_name: 'Rojalin Behera',
  husband_name: 'Sanjay Behera',
  age: 29,
  village: 'Gandhapal',
  trimester: 1,
  gestational_age_label: '6 Weeks 2 Days',
  is_high_risk: false,
  high_risk_reasons: [],
  assigned_worker_id: 'USR-HW-002',
  assigned_worker_name: 'Mamata Barik (ASHA)',
  status: 'active'
};

const relationalHighRisk: ApiHighRiskFlag = {
  beneficiary_id: 'BEN-2026-502',
  reasons: ['Advanced maternal age (35 years or older, especially first pregnancy)'],
  auto_flags: ['Advanced maternal age (35 years or older, especially first pregnancy)'],
  manual_flags: [],
  status: 'ACTIVE'
};

// A real mobile registration (POST /api/pregnancies), captured after
// submitting exactly what frontend/app/pregnancy/register.tsx sends —
// beneficiary_id is fabricated locally (BEN-LOCAL-*) since she has no
// relational counterpart at all.
const mobileRegisteredPregnancy: ApiPregnancy = {
  id: 'PREG-LOCAL-1790591058798',
  beneficiary_id: 'BEN-LOCAL-1790591058798',
  full_name: 'Playwright Test Mother',
  husband_name: 'Test Husband',
  age: 42,
  village: 'Mangarajpur',
  trimester: 2,
  gestational_age_label: '17 Weeks 0 Days',
  is_high_risk: true,
  high_risk_reasons: [
    'Advanced maternal age (35 years or older, especially first pregnancy)',
    'Very advanced maternal age (40 years or older)'
  ],
  assigned_worker_id: 'USR-HW-001',
  assigned_worker_name: 'Smruti Malla (ANM)',
  status: 'high_risk'
};

describe('mapBeneficiary', () => {
  it('maps a fresh mobile registration (BEN-LOCAL-* id, no relational row) straight from the pregnancy record', () => {
    const result = mapBeneficiary(mobileRegisteredPregnancy, undefined);
    expect(result.id).toBe('BEN-LOCAL-1790591058798');
    expect(result.name).toBe('Playwright Test Mother');
    expect(result.risk).toEqual({
      is_critical: true,
      reasons: [
        'Advanced maternal age (35 years or older, especially first pregnancy)',
        'Very advanced maternal age (40 years or older)'
      ],
      auto_flags: [
        'Advanced maternal age (35 years or older, especially first pregnancy)',
        'Very advanced maternal age (40 years or older)'
      ],
      manual_flags: [],
      status: undefined
    });
  });

  it('is routine when neither source flags risk', () => {
    const result = mapBeneficiary(routinePregnancy, undefined);
    expect(result.risk).toEqual({
      is_critical: false,
      reasons: [],
      auto_flags: [],
      manual_flags: []
    });
  });

  // BEN-2026-500 (Sasmita Jena): the real seeded mismatch — the relational
  // table calls her routine (no high_risk_flags row at all), but her own
  // mobile pregnancy record (BP 145/95, Hb 6.5) is clinically high-risk.
  // Union rule: she must show as high-risk, sourced entirely from the
  // mobile side, with an "open" (undefined) review status since there's no
  // relational row to hold an acknowledgement.
  it('relational routine + mobile high-risk -> high-risk (union, real BEN-2026-500 mismatch)', () => {
    const mobileHighRisk: ApiPregnancy = {
      ...routinePregnancy,
      is_high_risk: true,
      high_risk_reasons: ['Hypertension, pre-eclampsia or eclampsia']
    };
    const result = mapBeneficiary(mobileHighRisk, undefined);
    expect(result.risk.is_critical).toBe(true);
    expect(result.risk.reasons).toEqual(['Hypertension, pre-eclampsia or eclampsia']);
    expect(result.risk.status).toBeUndefined();
  });

  it('relational high-risk + mobile routine -> stays high-risk from the relational row alone', () => {
    const result = mapBeneficiary(highRiskPregnancy, relationalHighRisk);
    expect(result.risk).toEqual({
      is_critical: true,
      reasons: ['Advanced maternal age (35 years or older, especially first pregnancy)'],
      auto_flags: ['Advanced maternal age (35 years or older, especially first pregnancy)'],
      manual_flags: [],
      status: 'ACTIVE'
    });
  });

  it('de-duplicates reasons when both sources flag the same one', () => {
    const bothCritical: ApiPregnancy = {
      ...highRiskPregnancy,
      is_high_risk: true,
      high_risk_reasons: [
        'Advanced maternal age (35 years or older, especially first pregnancy)',
        'Short stature (height under 145 cm)'
      ]
    };
    const result = mapBeneficiary(bothCritical, relationalHighRisk);
    expect(result.risk.reasons).toEqual([
      'Advanced maternal age (35 years or older, especially first pregnancy)',
      'Short stature (height under 145 cm)'
    ]);
  });

  it('review status comes only from the relational row, never the mobile side', () => {
    const acknowledged: ApiHighRiskFlag = { ...relationalHighRisk, status: 'ACKNOWLEDGED' };
    expect(mapBeneficiary(highRiskPregnancy, acknowledged).risk.status).toBe('ACKNOWLEDGED');
  });

  it('maps name/village/worker fields straight from the pregnancy record', () => {
    const result = mapBeneficiary(routinePregnancy, undefined);
    expect(result.name).toBe('Sasmita Jena');
    expect(result.husbandName).toBe('Prakash Jena');
    expect(result.village).toBe('Mangarajpur');
    expect(result.anmId).toBe('USR-HW-001');
    expect(result.anmName).toBe('Smruti Malla (ANM)');
    expect(result.block).toBe('Jajpur Sadar');
  });
});
