// Net-new: nothing in the mobile app models VHSND sessions/attendance yet.
// Dates are relative to a fixed reference "today" of 2026-09-17 (this
// project's authoring date) so the mix of past/future sessions is
// deterministic for screenshots — the bucket logic itself (dueReport.ts,
// missReport.ts) still works correctly against the real current date.
import type { VhsndSession, AnmAttendanceRecord, BeneficiaryAttendance } from './types';

export const VHSND_SESSIONS: VhsndSession[] = [
  {
    id: 'VHSND-2026-MGRJ-01',
    village: 'Mangarajpur',
    block: 'Jajpur Sadar',
    date: '2026-09-10',
    anmId: 'USR-HW-001',
    anmName: 'Smruti Malla (ANM)',
    expectedBeneficiaryIds: ['BEN-2026-500', 'BEN-2026-511']
  },
  {
    id: 'VHSND-2026-BDTP-01',
    village: 'Badatrilochanpur',
    block: 'Jajpur Sadar',
    date: '2026-09-12',
    anmId: 'USR-HW-001',
    anmName: 'Smruti Malla (ANM)',
    expectedBeneficiaryIds: ['BEN-2026-501', 'BEN-2026-509', 'BEN-2026-515']
  },
  {
    id: 'VHSND-2026-GNDP-01',
    village: 'Gandhapal',
    block: 'Sukinda',
    date: '2026-09-15',
    anmId: 'USR-HW-002',
    anmName: 'Mamata Barik (ASHA)',
    expectedBeneficiaryIds: ['BEN-2026-502', 'BEN-2026-510']
  },
  {
    id: 'VHSND-2026-MGRJ-02',
    village: 'Mangarajpur',
    block: 'Jajpur Sadar',
    date: '2026-09-24',
    anmId: 'USR-HW-001',
    anmName: 'Smruti Malla (ANM)',
    expectedBeneficiaryIds: ['BEN-2026-500', 'BEN-2026-506']
  },
  {
    id: 'VHSND-2026-BLRM-01',
    village: 'Balarampur',
    block: 'Jajpur Sadar',
    date: '2026-09-30',
    anmId: 'USR-HW-001',
    anmName: 'Smruti Malla (ANM)',
    expectedBeneficiaryIds: ['BEN-2026-505', 'BEN-2026-512']
  },
  {
    id: 'VHSND-2026-SGDA-01',
    village: 'Singadia',
    block: 'Sukinda',
    date: '2026-10-03',
    anmId: 'USR-HW-002',
    anmName: 'Mamata Barik (ASHA)',
    expectedBeneficiaryIds: ['BEN-2026-508']
  }
];

export const ANM_ATTENDANCE: AnmAttendanceRecord[] = [
  {
    sessionId: 'VHSND-2026-MGRJ-01',
    anmId: 'USR-HW-001',
    anmName: 'Smruti Malla (ANM)',
    status: 'Present',
    checkInTime: '09:15'
  },
  {
    sessionId: 'VHSND-2026-BDTP-01',
    anmId: 'USR-HW-001',
    anmName: 'Smruti Malla (ANM)',
    status: 'Present',
    checkInTime: '09:40'
  },
  {
    sessionId: 'VHSND-2026-GNDP-01',
    anmId: 'USR-HW-002',
    anmName: 'Mamata Barik (ASHA)',
    status: 'Absent'
  }
];

export const BENEFICIARY_ATTENDANCE: BeneficiaryAttendance[] = [
  { sessionId: 'VHSND-2026-MGRJ-01', beneficiaryId: 'BEN-2026-500', status: 'Present' },
  {
    sessionId: 'VHSND-2026-MGRJ-01',
    beneficiaryId: 'BEN-2026-511',
    status: 'Absent',
    reason: 'Travelled to relatives',
    followUpStatus: 'Contacted'
  },
  { sessionId: 'VHSND-2026-BDTP-01', beneficiaryId: 'BEN-2026-501', status: 'Present' },
  { sessionId: 'VHSND-2026-BDTP-01', beneficiaryId: 'BEN-2026-509', status: 'Present' }
  // BEN-2026-515 at VHSND-2026-BDTP-01 has no record: an unrecorded past-session miss.
];
