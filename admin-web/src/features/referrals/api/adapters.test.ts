// Fixture below is a real response captured via curl against a running
// local-api (see local-api/README.md), not a hand-invented shape.
import { describe, expect, it } from 'vitest';
import { mapReferral } from './adapters';
import type { ApiReferral } from './types';

const referralFixture: ApiReferral = {
  id: 'REF-2026-002',
  beneficiary_id: 'BEN-2026-507',
  beneficiary_name: 'Sujata Das',
  facility: 'CHC Sukinda',
  reason: 'Hypertension, pre-eclampsia or eclampsia — BP monitoring',
  date: '2026-09-16',
  follow_up_status: 'Pending',
  notes: null
};

describe('mapReferral', () => {
  it('renames snake_case fields to the Referral shape', () => {
    expect(mapReferral(referralFixture)).toEqual({
      id: 'REF-2026-002',
      beneficiaryId: 'BEN-2026-507',
      beneficiaryName: 'Sujata Das',
      facility: 'CHC Sukinda',
      reason: 'Hypertension, pre-eclampsia or eclampsia — BP monitoring',
      date: '2026-09-16',
      followUpStatus: 'Pending',
      notes: undefined
    });
  });

  it('keeps notes when present', () => {
    expect(mapReferral({ ...referralFixture, notes: 'Transport arranged' }).notes).toBe(
      'Transport arranged'
    );
  });
});
