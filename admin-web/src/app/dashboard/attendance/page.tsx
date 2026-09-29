import PageContainer from '@/components/layout/page-container';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { getSessions, getAnmAttendance } from '@/features/vhsnd/api/service';
import { AttendanceTable, type AttendanceRow } from './attendance-table';

export default async function AttendancePage() {
  let rows: AttendanceRow[] = [];
  let apiError = false;

  try {
    const [sessions, attendance] = await Promise.all([getSessions(), getAnmAttendance()]);
    rows = sessions
      .map((session) => {
        const record = attendance.find((a) => a.sessionId === session.id);
        return {
          sessionId: session.id,
          date: session.date,
          village: session.village,
          anmName: session.anmName,
          status: record?.status ?? 'Not Recorded',
          checkInTime: record?.checkInTime
        };
      })
      .toSorted((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.warn('Failed to load attendance from local-api:', err);
    apiError = true;
  }

  return (
    <PageContainer
      pageTitle='ANM Attendance'
      pageDescription='ANM check-in status for each VHSND session'
    >
      <div className='flex flex-col gap-4'>
        {apiError && <ApiErrorAlert />}
        <AttendanceTable data={rows} />
      </div>
    </PageContainer>
  );
}
