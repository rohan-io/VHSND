import PageContainer from '@/components/layout/page-container';
import FormCardSkeleton from '@/components/form-card-skeleton';

export default function Loading() {
  return (
    <PageContainer
      pageTitle='New Referral'
      pageDescription='Refer a beneficiary to a higher-level facility'
    >
      <FormCardSkeleton />
    </PageContainer>
  );
}
