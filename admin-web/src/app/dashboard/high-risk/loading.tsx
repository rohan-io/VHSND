import PageContainer from '@/components/layout/page-container';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageContainer
      pageTitle='High-Risk Pregnancy Reporting'
      pageDescription='Escalations for beneficiaries flagged critical, filterable by risk category.'
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-wrap gap-2'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='h-6 w-24 rounded-full' />
          ))}
        </div>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='h-40 w-full rounded-lg' />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
