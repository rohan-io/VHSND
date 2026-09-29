'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { bucketRiskReasons } from '@/data/riskFlags';
import type { Beneficiary, RiskCategory } from '@/data/types';
import { acknowledgeHighRisk } from '@/features/beneficiaries/api/service';

import { RiskCategoryFilter } from './risk-category-filter';

export function HighRiskBoard({ beneficiaries }: { beneficiaries: Beneficiary[] }) {
  const [category, setCategory] = useState<RiskCategory | 'All'>('All');
  const router = useRouter();

  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeHighRisk,
    onSuccess: () => {
      toast.success('Marked reviewed');
      router.refresh();
    },
    onError: () => toast.error('Could not update — is local-api running?')
  });

  const visible = useMemo(() => {
    const active = beneficiaries.filter((b) => b.risk.status !== 'ACKNOWLEDGED');
    if (category === 'All') return active;
    return active.filter((b) => bucketRiskReasons(b.risk.reasons)[category].length > 0);
  }, [beneficiaries, category]);

  return (
    <div className='flex flex-col gap-4'>
      <RiskCategoryFilter active={category} onChange={setCategory} />
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {visible.map((b) => (
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
              {b.risk.flaggedAt && (
                <p className='text-muted-foreground text-xs'>
                  Flagged {formatDistanceToNow(new Date(b.risk.flaggedAt), { addSuffix: true })}
                </p>
              )}
            </CardHeader>
            <CardContent className='flex flex-col gap-3'>
              <ul className='list-inside list-disc space-y-1 text-sm'>
                {b.risk.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <Button
                size='sm'
                variant='outline'
                disabled={acknowledgeMutation.isPending}
                onClick={() => acknowledgeMutation.mutate(b.id)}
              >
                Mark Reviewed
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
