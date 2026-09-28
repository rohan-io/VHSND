import PageContainer from '@/components/layout/page-container';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { getBeneficiaries } from '@/features/beneficiaries/api/service';
import type { Beneficiary } from '@/data/types';
import { ReferralForm } from '../referral-form';

export default async function NewReferralPage() {
  let beneficiaries: Beneficiary[] = [];
  let apiError = false;

  try {
    beneficiaries = await getBeneficiaries();
  } catch (err) {
    console.warn('Failed to load beneficiaries from local-api:', err);
    apiError = true;
  }

  return (
    <PageContainer
      pageTitle='New Referral'
      pageDescription='Refer a beneficiary to a higher-level facility'
    >
      <div className='flex flex-col gap-4'>
        {apiError && <ApiErrorAlert />}
        <ReferralForm beneficiaries={beneficiaries} />
      </div>
    </PageContainer>
  );
}
