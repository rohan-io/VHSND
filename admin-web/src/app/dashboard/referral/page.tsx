import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { Button } from '@/components/ui/button';
import { getReferrals } from '@/features/referrals/api/service';
import type { Referral } from '@/data/types';
import { ReferralTable } from './referral-table';

export default async function ReferralPage() {
  let referrals: Referral[] = [];
  let apiError = false;

  try {
    referrals = await getReferrals();
  } catch (err) {
    console.warn('Failed to load referrals from local-api:', err);
    apiError = true;
  }

  return (
    <PageContainer
      pageTitle='Referrals'
      pageDescription='Referral of beneficiaries to higher-level facilities'
      pageHeaderAction={
        <Button
          nativeButton={false}
          render={<Link href='/dashboard/referral/new'>New Referral</Link>}
        />
      }
    >
      <div className='flex flex-col gap-4'>
        {apiError && <ApiErrorAlert />}
        <ReferralTable data={referrals} />
      </div>
    </PageContainer>
  );
}
