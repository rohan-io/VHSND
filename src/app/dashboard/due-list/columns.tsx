'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { DueListRow } from './due-list-table';

export const columns: ColumnDef<DueListRow>[] = [
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
    accessorKey: 'beneficiaryName',
    header: 'Beneficiary Name'
  },
  {
    accessorKey: 'beneficiaryId',
    header: 'Beneficiary ID'
  },
  {
    accessorKey: 'trimester',
    header: 'Trimester',
    cell: ({ row }) => `T${row.original.trimester}`
  },
  {
    id: 'risk',
    header: 'Risk',
    cell: ({ row }) =>
      row.original.isCritical ? (
        <Badge variant='destructive'>High Risk</Badge>
      ) : (
        <Badge variant='secondary'>Routine</Badge>
      )
  }
];
