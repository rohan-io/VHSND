'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { DueReportRow } from './due-report-table';

export const columns: ColumnDef<DueReportRow>[] = [
  {
    accessorKey: 'village',
    header: 'Village'
  },
  {
    accessorKey: 'date',
    header: 'Session Date',
    cell: ({ row }) =>
      new Date(row.original.date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
  },
  {
    accessorKey: 'anmName',
    header: 'ANM Name'
  },
  {
    accessorKey: 'expectedCount',
    header: 'Expected Count'
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      if (status === 'Overdue' || status === 'Due Today') {
        return <Badge variant='destructive'>{status}</Badge>;
      }
      if (status === 'Due This Week') {
        return (
          <Badge
            variant='outline'
            className='bg-warning/15 text-warning-foreground border-warning/30'
          >
            Due This Week
          </Badge>
        );
      }
      return <Badge variant='secondary'>Upcoming</Badge>;
    }
  }
];
