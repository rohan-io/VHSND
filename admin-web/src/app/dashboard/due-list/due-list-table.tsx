'use client';

import { useReactTable, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import { columns } from './columns';

export interface DueListRow {
  sessionId: string;
  village: string;
  date: string;
  beneficiaryId: string;
  beneficiaryName: string;
  trimester: 1 | 2 | 3;
  isCritical: boolean;
}

export function DueListTable({ data }: { data: DueListRow[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return <DataTable table={table} />;
}
