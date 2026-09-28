import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';

export default function Loading() {
  return (
    <PageContainer
      pageTitle='Due Report'
      pageDescription='Due report of VHSND sessions across villages'
    >
      <DataTableSkeleton columnCount={5} rowCount={6} />
    </PageContainer>
  );
}
