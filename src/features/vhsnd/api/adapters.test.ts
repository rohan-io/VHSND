// Fixtures below are real responses captured via curl against a running
// local-api (see local-api/README.md), not hand-invented shapes.
import { describe, expect, it } from 'vitest';
import { mapAttendance, mapBeneficiaryAttendance, mapSession } from './adapters';
import type { ApiAttendance, ApiBeneficiaryAttendance, ApiSession } from './types';

const sessionFixture: ApiSession = {
  id: 'VHSND-2026-MGRJ-01',
  village: 'Mangarajpur',
  block: 'Jajpur Sadar',
  date: '2026-09-10',
  anm_id: 'USR-HW-001',
  anm_name: 'Smruti Malla (ANM)',
  expected_beneficiary_ids: ['BEN-2026-500', 'BEN-2026-511']
};

const attendanceFixture: ApiAttendance = {
  id: 1,
  session_id: 'VHSND-2026-MGRJ-01',
  anm_id: 'USR-HW-001',
  anm_name: 'Smruti Malla (ANM)',
  status: 'Present',
  check_in_time: '09:15'
};

const beneficiaryAttendanceFixture: ApiBeneficiaryAttendance = {
  id: 2,
  session_id: 'VHSND-2026-MGRJ-01',
  beneficiary_id: 'BEN-2026-511',
  status: 'Absent',
  reason: 'Travelled to relatives',
  follow_up_status: 'Contacted'
};

describe('mapSession', () => {
  it('renames snake_case fields to the VhsndSession shape', () => {
    expect(mapSession(sessionFixture)).toEqual({
      id: 'VHSND-2026-MGRJ-01',
      village: 'Mangarajpur',
      block: 'Jajpur Sadar',
      date: '2026-09-10',
      anmId: 'USR-HW-001',
      anmName: 'Smruti Malla (ANM)',
      expectedBeneficiaryIds: ['BEN-2026-500', 'BEN-2026-511']
    });
  });

  it('falls back to blockForVillage when block is missing', () => {
    expect(mapSession({ ...sessionFixture, block: null }).block).toBe('Jajpur Sadar');
  });
});

describe('mapAttendance', () => {
  it('renames snake_case fields to the AnmAttendanceRecord shape', () => {
    expect(mapAttendance(attendanceFixture)).toEqual({
      sessionId: 'VHSND-2026-MGRJ-01',
      anmId: 'USR-HW-001',
      anmName: 'Smruti Malla (ANM)',
      status: 'Present',
      checkInTime: '09:15'
    });
  });

  it('turns a null check_in_time into undefined', () => {
    expect(
      mapAttendance({ ...attendanceFixture, check_in_time: null }).checkInTime
    ).toBeUndefined();
  });
});

describe('mapBeneficiaryAttendance', () => {
  it('renames snake_case fields to the BeneficiaryAttendance shape', () => {
    expect(mapBeneficiaryAttendance(beneficiaryAttendanceFixture)).toEqual({
      sessionId: 'VHSND-2026-MGRJ-01',
      beneficiaryId: 'BEN-2026-511',
      status: 'Absent',
      reason: 'Travelled to relatives',
      followUpStatus: 'Contacted'
    });
  });

  it('turns null reason/follow_up_status into undefined', () => {
    const result = mapBeneficiaryAttendance({
      ...beneficiaryAttendanceFixture,
      reason: null,
      follow_up_status: null
    });
    expect(result.reason).toBeUndefined();
    expect(result.followUpStatus).toBeUndefined();
  });
});
