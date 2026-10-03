"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

interface Props<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({ columns, data, onRowClick }: Props<TData, TValue>) {
  // TanStack Table returns non-memoizable functions; the compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={onRowClick ? "cursor-pointer" : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="p-4 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-19 text-center text-muted-foreground">
                No results
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
