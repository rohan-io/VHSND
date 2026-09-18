import PageContainer from '@/components/layout/page-container';
import { VHSND_SESSIONS, ANM_ATTENDANCE } from '@/data/vhsndSessions';
import { AttendanceTable, type AttendanceRow } from './attendance-table';

export default function AttendancePage() {
  const rows: AttendanceRow[] = VHSND_SESSIONS.map((session) => {
    const record = ANM_ATTENDANCE.find((a) => a.sessionId === session.id);
    return {
      sessionId: session.id,
      date: session.date,
      village: session.village,
      anmName: session.anmName,
      status: record?.status ?? 'Not Recorded',
      checkInTime: record?.checkInTime
    };
  }).toSorted((a, b) => a.date.localeCompare(b.date));

  return (
    <PageContainer
      pageTitle='ANM Attendance'
      pageDescription='ANM check-in status for each VHSND session'
    >
      <AttendanceTable data={rows} />
    </PageContainer>
  );
}
