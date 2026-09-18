'use client';

import { useReactTable, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import type { Referral } from '@/data/types';
import { columns } from './columns';

export function ReferralTable({ data }: { data: Referral[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return <DataTable table={table} />;
}
