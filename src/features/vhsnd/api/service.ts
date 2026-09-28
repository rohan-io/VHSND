import { apiGet } from '@/lib/api-config';
import type { AnmAttendanceRecord, Block, VhsndSession } from '@/data/types';
import { blockForVillage } from '@/data/villages';
import type { ApiAttendance, ApiSession } from './types';

export async function getSessions(): Promise<VhsndSession[]> {
  const sessions = await apiGet<ApiSession[]>('/sessions');
  return sessions.map((s) => ({
    id: s.id,
    village: s.village,
    block: (s.block as Block) || blockForVillage(s.village),
    date: s.date,
    anmId: s.anm_id || '',
    anmName: s.anm_name || '',
    expectedBeneficiaryIds: s.expected_beneficiary_ids
  }));
}

export async function getAnmAttendance(): Promise<AnmAttendanceRecord[]> {
  const rows = await apiGet<ApiAttendance[]>('/attendance');
  return rows.map((a) => ({
    sessionId: a.session_id,
    anmId: a.anm_id || '',
    anmName: a.anm_name || '',
    status: a.status,
    checkInTime: a.check_in_time || undefined
  }));
}
