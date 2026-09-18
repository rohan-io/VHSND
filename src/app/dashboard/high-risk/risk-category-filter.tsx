'use client';

import { Badge } from '@/components/ui/badge';
import type { RiskCategory } from '@/data/types';

const CATEGORIES: RiskCategory[] = [
  'Maternal Age',
  'Previous Obstetric History',
  'Current Pregnancy Complications',
  'Maternal Medical Conditions',
  'Pregnancy-Related Factors'
];

export function RiskCategoryFilter({
  active,
  onChange
}: {
  active: RiskCategory | 'All';
  onChange: (category: RiskCategory | 'All') => void;
}) {
  const options: (RiskCategory | 'All')[] = ['All', ...CATEGORIES];

  return (
    <div className='flex flex-wrap gap-2'>
      {options.map((option) => (
        <button key={option} type='button' onClick={() => onChange(option)}>
          <Badge variant={active === option ? 'default' : 'outline'}>{option}</Badge>
        </button>
      ))}
    </div>
  );
}
