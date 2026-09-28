import PageContainer from '@/components/layout/page-container';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { getSessions } from '@/features/vhsnd/api/service';
import { dueBucket } from '@/data/dueReport';
import { DueReportTable, type DueReportRow } from './due-report-table';

export default async function DueReportPage() {
  const today = new Date();
  let rows: DueReportRow[] = [];
  let apiError = false;

  try {
    const sessions = await getSessions();
    rows = sessions
      .map((session) => ({
        sessionId: session.id,
        village: session.village,
        date: session.date,
        anmName: session.anmName,
        expectedCount: session.expectedBeneficiaryIds.length,
        status: dueBucket(session.date, today)
      }))
      .toSorted((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.warn('Failed to load due report from local-api:', err);
    apiError = true;
  }

  return (
    <PageContainer
      pageTitle='Due Report'
      pageDescription='Due report of VHSND sessions across villages'
    >
      <div className='flex flex-col gap-4'>
        {apiError && <ApiErrorAlert />}
        <DueReportTable data={rows} />
      </div>
    </PageContainer>
  );
}
