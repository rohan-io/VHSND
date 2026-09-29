'use client';

import { useReactTable, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import { columns } from './columns';

export interface MissReportRow {
  beneficiaryId: string;
  beneficiaryName: string;
  village: string;
  sessionDate: string;
  reason?: string;
  followUpStatus: 'Pending' | 'Contacted' | 'Rescheduled';
}

export function MissReportTable({ data }: { data: MissReportRow[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return <DataTable table={table} />;
}
