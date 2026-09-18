import { describe, it, expect } from 'vitest';
import { filterMissedBeneficiaries } from './missReport';
import type { VhsndSession, BeneficiaryAttendance } from './types';

const TODAY = new Date(2026, 8, 17); // 2026-09-17

const sessions: VhsndSession[] = [
  {
    id: 'VHSND-2026-MGRJ-01',
    village: 'Mangarajpur',
    block: 'Jajpur Sadar',
    date: '2026-09-10',
    anmId: 'USR-HW-001',
    anmName: 'Smruti Malla (ANM)',
    expectedBeneficiaryIds: ['BEN-2026-500', 'BEN-2026-501']
  },
  {
    id: 'VHSND-2026-MGRJ-02',
    village: 'Mangarajpur',
    block: 'Jajpur Sadar',
    date: '2026-09-24',
    anmId: 'USR-HW-001',
    anmName: 'Smruti Malla (ANM)',
    expectedBeneficiaryIds: ['BEN-2026-500']
  }
];

describe('filterMissedBeneficiaries', () => {
  it('excludes beneficiaries explicitly marked Present at a past session', () => {
    const attendance: BeneficiaryAttendance[] = [
      { sessionId: 'VHSND-2026-MGRJ-01', beneficiaryId: 'BEN-2026-500', status: 'Present' }
    ];
    const result = filterMissedBeneficiaries(sessions, attendance, TODAY);
    expect(result.map((r) => r.beneficiaryId)).toEqual(['BEN-2026-501']);
  });

  it('includes beneficiaries explicitly marked Absent, carrying the reason through', () => {
    const attendance: BeneficiaryAttendance[] = [
      {
        sessionId: 'VHSND-2026-MGRJ-01',
        beneficiaryId: 'BEN-2026-500',
        status: 'Absent',
        reason: 'Travelled to relatives'
      },
      { sessionId: 'VHSND-2026-MGRJ-01', beneficiaryId: 'BEN-2026-501', status: 'Present' }
    ];
    const result = filterMissedBeneficiaries(sessions, attendance, TODAY);
    expect(result).toEqual([
      {
        beneficiaryId: 'BEN-2026-500',
        sessionId: 'VHSND-2026-MGRJ-01',
        village: 'Mangarajpur',
        sessionDate: '2026-09-10',
        reason: 'Travelled to relatives',
        followUpStatus: 'Pending'
      }
    ]);
  });

  it('treats a missing attendance record for a past session as missed', () => {
    const result = filterMissedBeneficiaries(sessions, [], TODAY);
    expect(result.map((r) => r.beneficiaryId).toSorted()).toEqual(['BEN-2026-500', 'BEN-2026-501']);
  });

  it('ignores future sessions entirely', () => {
    const result = filterMissedBeneficiaries(sessions, [], TODAY);
    expect(result.some((r) => r.sessionId === 'VHSND-2026-MGRJ-02')).toBe(false);
  });

  it('carries through a recorded followUpStatus instead of defaulting to Pending', () => {
    const attendance: BeneficiaryAttendance[] = [
      {
        sessionId: 'VHSND-2026-MGRJ-01',
        beneficiaryId: 'BEN-2026-500',
        status: 'Absent',
        followUpStatus: 'Contacted'
      }
    ];
    const result = filterMissedBeneficiaries(sessions, attendance, TODAY);
    expect(result.find((r) => r.beneficiaryId === 'BEN-2026-500')?.followUpStatus).toBe(
      'Contacted'
    );
  });
});
