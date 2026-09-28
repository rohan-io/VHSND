import type { AnmAttendanceRecord, BeneficiaryAttendance, Block, VhsndSession } from '@/data/types';
import { blockForVillage } from '@/data/villages';
import type { ApiAttendance, ApiBeneficiaryAttendance, ApiSession } from './types';

export function mapSession(row: ApiSession): VhsndSession {
  return {
    id: row.id,
    village: row.village,
    block: (row.block as Block) || blockForVillage(row.village),
    date: row.date,
    anmId: row.anm_id || '',
    anmName: row.anm_name || '',
    expectedBeneficiaryIds: row.expected_beneficiary_ids
  };
}

export function mapAttendance(row: ApiAttendance): AnmAttendanceRecord {
  return {
    sessionId: row.session_id,
    anmId: row.anm_id || '',
    anmName: row.anm_name || '',
    status: row.status,
    checkInTime: row.check_in_time || undefined
  };
}

export function mapBeneficiaryAttendance(row: ApiBeneficiaryAttendance): BeneficiaryAttendance {
  return {
    sessionId: row.session_id,
    beneficiaryId: row.beneficiary_id,
    status: row.status,
    reason: row.reason || undefined,
    followUpStatus: row.follow_up_status || undefined
  };
}
