import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';

export default function Loading() {
  return (
    <PageContainer
      pageTitle='ANM Attendance'
      pageDescription='ANM check-in status for each VHSND session'
    >
      <DataTableSkeleton columnCount={5} rowCount={6} />
    </PageContainer>
  );
}
