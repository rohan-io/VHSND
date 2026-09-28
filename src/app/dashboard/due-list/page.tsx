import PageContainer from '@/components/layout/page-container';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { getSessions } from '@/features/vhsnd/api/service';
import { getBeneficiaries } from '@/features/beneficiaries/api/service';
import { DueListTable, type DueListRow } from './due-list-table';
import { UnscheduledTable, type UnscheduledRow } from './unscheduled-table';

export default async function DueListPage() {
  let rows: DueListRow[] = [];
  let unscheduledRows: UnscheduledRow[] = [];
  let apiError = false;

  try {
    const [sessions, beneficiaries] = await Promise.all([getSessions(), getBeneficiaries()]);
    const beneficiaryById = new Map(beneficiaries.map((b) => [b.id, b]));
    const scheduledIds = new Set(sessions.flatMap((s) => s.expectedBeneficiaryIds));

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

    // Mothers (mobile-registered or otherwise) not expected at any VHSND
    // session yet — e.g. just registered, not yet scheduled. Shown in a
    // clearly separate section below, never mixed into the real schedule.
    unscheduledRows = beneficiaries
      .filter((b) => !scheduledIds.has(b.id))
      .map((b) => ({
        beneficiaryId: b.id,
        beneficiaryName: b.name,
        village: b.village,
        trimester: b.trimester,
        isCritical: b.risk.is_critical
      }));
  } catch (err) {
    console.warn('Failed to load due list from local-api:', err);
    apiError = true;
  }

  return (
    <PageContainer
      pageTitle='Due List'
      pageDescription='Beneficiaries expected to attend upcoming and recent VHSND sessions'
    >
      <div className='flex flex-col gap-6'>
        {apiError && <ApiErrorAlert />}
        <DueListTable data={rows} />
        {unscheduledRows.length > 0 && (
          <div className='flex flex-col gap-2'>
            <div>
              <h2 className='text-lg font-semibold'>Not yet scheduled for VHSND</h2>
              <p className='text-muted-foreground text-sm'>
                Registered mothers not yet expected at any upcoming session.
              </p>
            </div>
            <UnscheduledTable data={unscheduledRows} />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
