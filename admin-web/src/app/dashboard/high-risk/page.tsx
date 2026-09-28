import PageContainer from '@/components/layout/page-container';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { getBeneficiaries } from '@/features/beneficiaries/api/service';
import type { Beneficiary } from '@/data/types';
import { HighRiskBoard } from './high-risk-board';

export default async function HighRiskPage() {
  let highRisk: Beneficiary[] = [];
  let apiError = false;

  try {
    const beneficiaries = await getBeneficiaries();
    highRisk = beneficiaries.filter((b) => b.risk.is_critical);
  } catch (err) {
    console.warn('Failed to load high-risk beneficiaries from local-api:', err);
    apiError = true;
  }

  return (
    <PageContainer
      pageTitle='High-Risk Pregnancy Reporting'
      pageDescription='Escalations for beneficiaries flagged critical, filterable by risk category.'
    >
      <div className='flex flex-col gap-4'>
        {apiError && <ApiErrorAlert />}
        <HighRiskBoard beneficiaries={highRisk} />
      </div>
    </PageContainer>
  );
}
