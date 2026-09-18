import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { REFERRALS } from '@/data/referrals';
import { ReferralTable } from './referral-table';

export default function ReferralPage() {
  return (
    <PageContainer
      pageTitle='Referrals'
      pageDescription='Referral of beneficiaries to higher-level facilities'
      pageHeaderAction={
        <Button render={<Link href='/dashboard/referral/new'>New Referral</Link>} />
      }
    >
      <ReferralTable data={REFERRALS} />
    </PageContainer>
  );
}
