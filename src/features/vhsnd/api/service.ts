import { apiGet } from '@/lib/api-config';
import type { AnmAttendanceRecord, BeneficiaryAttendance, VhsndSession } from '@/data/types';
import { mapAttendance, mapBeneficiaryAttendance, mapSession } from './adapters';
import type { ApiAttendance, ApiBeneficiaryAttendance, ApiSession } from './types';

export async function getSessions(): Promise<VhsndSession[]> {
  const sessions = await apiGet<ApiSession[]>('/sessions');
  return sessions.map(mapSession);
}

export async function getAnmAttendance(): Promise<AnmAttendanceRecord[]> {
  const rows = await apiGet<ApiAttendance[]>('/attendance');
  return rows.map(mapAttendance);
}

// Per-beneficiary VHSND attendance (did she personally show up) — distinct
// from getAnmAttendance() above (did the ANM show up to run the session).
export async function getBeneficiaryAttendance(): Promise<BeneficiaryAttendance[]> {
  const rows = await apiGet<ApiBeneficiaryAttendance[]>('/beneficiary-attendance');
  return rows.map(mapBeneficiaryAttendance);
}
