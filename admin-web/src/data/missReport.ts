import type { VhsndSession, BeneficiaryAttendance } from './types';

export interface MissedBeneficiary {
  beneficiaryId: string;
  sessionId: string;
  village: string;
  sessionDate: string;
  reason?: string;
  followUpStatus: 'Pending' | 'Contacted' | 'Rescheduled';
}

export function filterMissedBeneficiaries(
  sessions: VhsndSession[],
  attendance: BeneficiaryAttendance[],
  today: Date
): MissedBeneficiary[] {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const byKey = new Map(attendance.map((a) => [`${a.sessionId}::${a.beneficiaryId}`, a]));
  const missed: MissedBeneficiary[] = [];

  for (const session of sessions) {
    const sessionDate = new Date(`${session.date}T00:00:00`);
    if (sessionDate.getTime() >= base.getTime()) continue; // only past sessions can be "missed"

    for (const beneficiaryId of session.expectedBeneficiaryIds) {
      const record = byKey.get(`${session.id}::${beneficiaryId}`);
      if (record?.status === 'Present') continue;
      missed.push({
        beneficiaryId,
        sessionId: session.id,
        village: session.village,
        sessionDate: session.date,
        reason: record?.reason,
        followUpStatus: record?.followUpStatus ?? 'Pending'
      });
    }
  }
  return missed;
}
