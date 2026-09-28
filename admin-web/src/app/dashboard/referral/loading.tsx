import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';

export default function Loading() {
  return (
    <PageContainer
      pageTitle='Referrals'
      pageDescription='Referral of beneficiaries to higher-level facilities'
    >
      <DataTableSkeleton columnCount={5} rowCount={6} />
    </PageContainer>
  );
}
