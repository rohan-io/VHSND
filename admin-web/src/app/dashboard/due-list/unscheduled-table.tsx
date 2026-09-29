'use client';

import { useReactTable, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import { Badge } from '@/components/ui/badge';

export interface UnscheduledRow {
  beneficiaryId: string;
  beneficiaryName: string;
  village: string;
  trimester: 1 | 2 | 3;
  isCritical: boolean;
}

const columns: ColumnDef<UnscheduledRow>[] = [
  { accessorKey: 'village', header: 'Village' },
  { accessorKey: 'beneficiaryName', header: 'Beneficiary Name' },
  { accessorKey: 'beneficiaryId', header: 'Beneficiary ID' },
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

// Registered mothers (mobile or admin) with no VHSND session expecting them
// yet — kept visually and structurally separate from the real session
// schedule above, which must stay exactly as it was.
export function UnscheduledTable({ data }: { data: UnscheduledRow[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return <DataTable table={table} />;
}
