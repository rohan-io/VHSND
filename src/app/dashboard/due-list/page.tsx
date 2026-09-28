import PageContainer from '@/components/layout/page-container';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { getSessions } from '@/features/vhsnd/api/service';
import { getBeneficiaries } from '@/features/beneficiaries/api/service';
import { DueListTable, type DueListRow } from './due-list-table';

export default async function DueListPage() {
  let rows: DueListRow[] = [];
  let apiError = false;

  try {
    const [sessions, beneficiaries] = await Promise.all([getSessions(), getBeneficiaries()]);
    const beneficiaryById = new Map(beneficiaries.map((b) => [b.id, b]));

    rows = sessions
      .flatMap((session) =>
        session.expectedBeneficiaryIds.flatMap((beneficiaryId) => {
          const beneficiary = beneficiaryById.get(beneficiaryId);
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
      )
      .toSorted((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.warn('Failed to load due list from local-api:', err);
    apiError = true;
  }

  return (
    <PageContainer
      pageTitle='Due List'
      pageDescription='Beneficiaries expected to attend upcoming and recent VHSND sessions'
    >
      <div className='flex flex-col gap-4'>
        {apiError && <ApiErrorAlert />}
        <DueListTable data={rows} />
      </div>
    </PageContainer>
  );
}
