'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { Referral } from '@/data/types';

export const columns: ColumnDef<Referral>[] = [
  {
    accessorKey: 'beneficiaryName',
    header: 'Beneficiary Name'
  },
  {
    accessorKey: 'facility',
    header: 'Facility'
  },
  {
    accessorKey: 'reason',
    header: 'Reason'
  },
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) =>
      new Date(row.original.date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
  },
  {
    accessorKey: 'followUpStatus',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.followUpStatus;
      if (status === 'Pending') return <Badge variant='destructive'>Pending</Badge>;
      if (status === 'Referred')
        return (
          <Badge
            variant='outline'
            className='bg-warning/15 text-warning-foreground border-warning/30'
          >
            Referred
          </Badge>
        );
      return (
        <Badge
          variant='outline'
          className='bg-success/15 text-success-foreground border-success/30'
        >
          Completed
        </Badge>
      );
    }
  }
];
