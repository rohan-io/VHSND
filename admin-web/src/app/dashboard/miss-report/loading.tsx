import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';

export default function Loading() {
  return (
    <PageContainer
      pageTitle='Beneficiary VHSND Miss Report'
      pageDescription='Beneficiaries who missed a VHSND session and their follow-up status'
    >
      <DataTableSkeleton columnCount={4} rowCount={6} />
    </PageContainer>
  );
}
