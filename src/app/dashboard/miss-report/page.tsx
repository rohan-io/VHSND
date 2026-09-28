import PageContainer from '@/components/layout/page-container';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { filterMissedBeneficiaries } from '@/data/missReport';
// BENEFICIARY_ATTENDANCE (per-beneficiary session attendance + follow-up
// status) has no local-api equivalent — local-api only tracks ANM-level
// check-in (/api/attendance). Phase 3 is scoped to not modify the server, so
// this one piece stays on the fixture; sessions and beneficiaries are live.
import { BENEFICIARY_ATTENDANCE } from '@/data/vhsndSessions';
import { getSessions } from '@/features/vhsnd/api/service';
import { getBeneficiaries } from '@/features/beneficiaries/api/service';
import { MissReportTable, type MissReportRow } from './miss-report-table';

export default async function MissReportPage() {
  let rows: MissReportRow[] = [];
  let apiError = false;

  try {
    const [sessions, beneficiaries] = await Promise.all([getSessions(), getBeneficiaries()]);
    const missed = filterMissedBeneficiaries(sessions, BENEFICIARY_ATTENDANCE, new Date());
    const beneficiaryById = new Map(beneficiaries.map((b) => [b.id, b]));

    rows = missed.map((m) => ({
      beneficiaryId: m.beneficiaryId,
      beneficiaryName: beneficiaryById.get(m.beneficiaryId)?.name ?? m.beneficiaryId,
      village: m.village,
      sessionDate: m.sessionDate,
      reason: m.reason,
      followUpStatus: m.followUpStatus
    }));
  } catch (err) {
    console.warn('Failed to load miss report from local-api:', err);
    apiError = true;
  }

  return (
    <PageContainer
      pageTitle='Beneficiary VHSND Miss Report'
      pageDescription='Beneficiaries who missed a VHSND session and their follow-up status'
    >
      <div className='flex flex-col gap-4'>
        {apiError && <ApiErrorAlert />}
        <MissReportTable data={rows} />
      </div>
    </PageContainer>
  );
}
