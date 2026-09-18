import PageContainer from '@/components/layout/page-container';
import { ReferralForm } from '../referral-form';

export default function NewReferralPage() {
  return (
    <PageContainer
      pageTitle='New Referral'
      pageDescription='Refer a beneficiary to a higher-level facility'
    >
      <ReferralForm />
    </PageContainer>
  );
}
