import PageContainer from '@/components/layout/page-container';
import { VHSND_SESSIONS } from '@/data/vhsndSessions';
import { BENEFICIARIES } from '@/data/beneficiaries';
import { DueListTable, type DueListRow } from './due-list-table';

export default function DueListPage() {
  const rows: DueListRow[] = VHSND_SESSIONS.flatMap((session) =>
    session.expectedBeneficiaryIds.flatMap((beneficiaryId) => {
      const beneficiary = BENEFICIARIES.find((b) => b.id === beneficiaryId);
      if (!beneficiary) return [];
      return [
        {
          sessionId: session.id,
          village: session.village,
          date: session.date,
          beneficiaryId: beneficiary.id,
          beneficiaryName: beneficiary.name,
          trimester: beneficiary.trimester,
          isCritical: beneficiary.risk.is_critical
        }
      ];
    })
  ).toSorted((a, b) => a.date.localeCompare(b.date));

  return (
    <PageContainer
      pageTitle='Due List'
      pageDescription='Beneficiaries expected to attend upcoming and recent VHSND sessions'
    >
      <DueListTable data={rows} />
    </PageContainer>
  );
}
