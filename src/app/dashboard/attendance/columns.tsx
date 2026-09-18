'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { AttendanceRow } from './attendance-table';

export const columns: ColumnDef<AttendanceRow>[] = [
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
    accessorKey: 'village',
    header: 'Village'
  },
  {
    accessorKey: 'anmName',
    header: 'ANM Name'
  },
  {
    accessorKey: 'status',
    header: 'Attendance',
    cell: ({ row }) => {
      const status = row.original.status;
      if (status === 'Present') {
        return (
          <Badge
            variant='outline'
            className='bg-success/15 text-success-foreground border-success/30'
          >
            Present
          </Badge>
        );
      }
      if (status === 'Absent') {
        return <Badge variant='destructive'>Absent</Badge>;
      }
      return <Badge variant='outline'>Not Recorded</Badge>;
    }
  },
  {
    accessorKey: 'checkInTime',
    header: 'Check-in Time',
    cell: ({ row }) => row.original.checkInTime ?? '—'
  }
];
