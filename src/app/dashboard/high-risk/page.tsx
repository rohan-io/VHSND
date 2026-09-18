'use client';

import { useMemo, useState } from 'react';

import PageContainer from '@/components/layout/page-container';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BENEFICIARIES } from '@/data/beneficiaries';
import { bucketRiskReasons } from '@/data/riskFlags';
import type { RiskCategory } from '@/data/types';

import { RiskCategoryFilter } from './risk-category-filter';

export default function HighRiskPage() {
  const [category, setCategory] = useState<RiskCategory | 'All'>('All');

  const beneficiaries = useMemo(() => {
    const highRisk = BENEFICIARIES.filter((b) => b.risk.is_critical);
    if (category === 'All') return highRisk;
    return highRisk.filter((b) => bucketRiskReasons(b.risk.reasons)[category].length > 0);
  }, [category]);

  return (
    <PageContainer
      pageTitle='High-Risk Pregnancy Reporting'
      pageDescription='Escalations for beneficiaries flagged critical, filterable by risk category.'
    >
      <div className='flex flex-col gap-4'>
        <RiskCategoryFilter active={category} onChange={setCategory} />
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {beneficiaries.map((b) => (
            <Card key={b.id}>
              <CardHeader>
                <div className='flex items-center justify-between gap-2'>
                  <div className='flex items-center gap-2'>
                    <Icons.warning className='text-destructive size-4' aria-hidden />
                    <CardTitle>{b.name}</CardTitle>
                  </div>
                  <Badge variant='destructive'>Critical</Badge>
                </div>
                <p className='text-muted-foreground text-sm'>
                  {b.village} &middot; {b.gestationalAgeLabel}
                </p>
              </CardHeader>
              <CardContent>
                <ul className='list-inside list-disc space-y-1 text-sm'>
                  {b.risk.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
