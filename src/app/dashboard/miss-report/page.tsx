import PageContainer from '@/components/layout/page-container';
import { filterMissedBeneficiaries } from '@/data/missReport';
import { VHSND_SESSIONS, BENEFICIARY_ATTENDANCE } from '@/data/vhsndSessions';
import { BENEFICIARIES } from '@/data/beneficiaries';
import { MissReportTable, type MissReportRow } from './miss-report-table';

export default function MissReportPage() {
  const missed = filterMissedBeneficiaries(VHSND_SESSIONS, BENEFICIARY_ATTENDANCE, new Date());

  const rows: MissReportRow[] = missed.map((m) => ({
    beneficiaryId: m.beneficiaryId,
    beneficiaryName: BENEFICIARIES.find((b) => b.id === m.beneficiaryId)?.name ?? m.beneficiaryId,
    village: m.village,
    sessionDate: m.sessionDate,
    reason: m.reason,
    followUpStatus: m.followUpStatus
  }));

  return (
    <PageContainer
      pageTitle='Beneficiary VHSND Miss Report'
      pageDescription='Beneficiaries who missed a VHSND session and their follow-up status'
    >
      <MissReportTable data={rows} />
    </PageContainer>
  );
}
