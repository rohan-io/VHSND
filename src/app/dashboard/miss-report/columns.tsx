'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { MissReportRow } from './miss-report-table';

export const columns: ColumnDef<MissReportRow>[] = [
  {
    accessorKey: 'beneficiaryName',
    header: 'Beneficiary Name'
  },
  {
    accessorKey: 'village',
    header: 'Village'
  },
  {
    accessorKey: 'sessionDate',
    header: 'Missed Session Date',
    cell: ({ row }) =>
      new Date(row.original.sessionDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
  },
  {
    accessorKey: 'reason',
    header: 'Reason',
    cell: ({ row }) => row.original.reason ?? 'Not captured'
  },
  {
    id: 'followUpStatus',
    header: 'Follow-up Status',
    cell: ({ row }) => {
      const status = row.original.followUpStatus;
      if (status === 'Pending') return <Badge variant='destructive'>Pending</Badge>;
      if (status === 'Contacted')
        return (
          <Badge
            variant='outline'
            className='bg-warning/15 text-warning-foreground border-warning/30'
          >
            Contacted
          </Badge>
        );
      return (
        <Badge
          variant='outline'
          className='bg-success/15 text-success-foreground border-success/30'
        >
          Rescheduled
        </Badge>
      );
    }
  }
];
