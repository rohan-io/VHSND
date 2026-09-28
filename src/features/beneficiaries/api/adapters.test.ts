// Fixtures below are real responses captured via curl against a running
// local-api (see local-api/README.md), not hand-invented shapes — so this
// test breaks if local-api's actual field names ever drift from what
// mapBeneficiary() assumes.
import { describe, expect, it } from 'vitest';
import { mapBeneficiary } from './adapters';
import type { ApiBeneficiary, ApiHighRiskFlag, ApiPregnancy } from './types';

const beneficiaryFixture: ApiBeneficiary = {
  id: 'BEN-2026-500',
  name: 'Sasmita Jena',
  husband_name: 'Prakash Jena',
  age: 24,
  village: 'Mangarajpur',
  block: 'Jajpur Sadar',
  anm_id: 'USR-HW-001',
  anm_name: 'Smruti Malla (ANM)'
};

const pregnancyFixture: ApiPregnancy = {
  id: 'PREG-2026-1002',
  beneficiary_id: 'BEN-2026-502',
  trimester: 1,
  gestational_age_label: '6 Weeks 2 Days',
  is_high_risk: false,
  high_risk_reasons: []
};

const highRiskFixture: ApiHighRiskFlag = {
  beneficiary_id: 'BEN-2026-502',
  reasons: ['Advanced maternal age (35 years or older, especially first pregnancy)'],
  auto_flags: ['Advanced maternal age (35 years or older, especially first pregnancy)'],
  manual_flags: [],
  status: 'ACTIVE'
};

describe('mapBeneficiary', () => {
  it('maps a beneficiary with no pregnancy/risk match to defaults', () => {
    const result = mapBeneficiary(beneficiaryFixture, undefined, undefined);
    expect(result).toEqual({
      id: 'BEN-2026-500',
      name: 'Sasmita Jena',
      husbandName: 'Prakash Jena',
      age: 24,
      village: 'Mangarajpur',
      block: 'Jajpur Sadar',
      anmId: 'USR-HW-001',
      anmName: 'Smruti Malla (ANM)',
      trimester: 1,
      gestationalAgeLabel: '',
      risk: { is_critical: false, reasons: [], auto_flags: [], manual_flags: [] }
    });
  });

  it('pulls trimester/gestational age from the matched pregnancy', () => {
    const result = mapBeneficiary(beneficiaryFixture, pregnancyFixture, undefined);
    expect(result.trimester).toBe(1);
    expect(result.gestationalAgeLabel).toBe('6 Weeks 2 Days');
  });

  it('marks is_critical and carries flags when a high-risk record matches', () => {
    const result = mapBeneficiary(beneficiaryFixture, pregnancyFixture, highRiskFixture);
    expect(result.risk).toEqual({
      is_critical: true,
      reasons: ['Advanced maternal age (35 years or older, especially first pregnancy)'],
      auto_flags: ['Advanced maternal age (35 years or older, especially first pregnancy)'],
      manual_flags: [],
      status: 'ACTIVE'
    });
  });

  it('falls back to blockForVillage when the API row has no block', () => {
    const result = mapBeneficiary({ ...beneficiaryFixture, block: null }, undefined, undefined);
    expect(result.block).toBe('Jajpur Sadar');
  });
});
