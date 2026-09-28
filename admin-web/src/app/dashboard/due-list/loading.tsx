import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';

export default function Loading() {
  return (
    <PageContainer
      pageTitle='Due List'
      pageDescription='Beneficiaries expected to attend upcoming and recent VHSND sessions'
    >
      <DataTableSkeleton columnCount={5} rowCount={8} />
    </PageContainer>
  );
}
