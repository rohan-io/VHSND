import PageContainer from '@/components/layout/page-container';
import { VHSND_SESSIONS } from '@/data/vhsndSessions';
import { dueBucket } from '@/data/dueReport';
import { DueReportTable, type DueReportRow } from './due-report-table';

export default function DueReportPage() {
  const today = new Date();
  const rows: DueReportRow[] = VHSND_SESSIONS.map((session) => ({
    sessionId: session.id,
    village: session.village,
    date: session.date,
    anmName: session.anmName,
    expectedCount: session.expectedBeneficiaryIds.length,
    status: dueBucket(session.date, today)
  })).toSorted((a, b) => a.date.localeCompare(b.date));

  return (
    <PageContainer
      pageTitle='Due Report'
      pageDescription='Due report of VHSND sessions across villages'
    >
      <DueReportTable data={rows} />
    </PageContainer>
  );
}
