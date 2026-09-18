'use client';

import { useReactTable, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import type { DueBucket } from '@/data/dueReport';
import { columns } from './columns';

export interface DueReportRow {
  sessionId: string;
  village: string;
  date: string;
  anmName: string;
  expectedCount: number;
  status: DueBucket;
}

export function DueReportTable({ data }: { data: DueReportRow[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return <DataTable table={table} />;
}
