'use client';

import { useReactTable, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import type { AttendanceStatus } from '@/data/types';
import { columns } from './columns';

export interface AttendanceRow {
  sessionId: string;
  date: string;
  village: string;
  anmName: string;
  status: AttendanceStatus;
  checkInTime?: string;
}

export function AttendanceTable({ data }: { data: AttendanceRow[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return <DataTable table={table} />;
}
