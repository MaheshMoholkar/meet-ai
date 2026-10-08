"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Optional `meta` on a column definition. */
export interface ColumnMeta {
  /** Applied to the column's header and cells, e.g. "hidden sm:table-cell". */
  className?: string;
}

const classOf = (meta: unknown) => (meta as ColumnMeta | undefined)?.className;

interface Props<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
}

/** A list on the canvas: a header row, then rows divided by hairlines. The whole row is the link. */
export function DataTable<TData, TValue>({ columns, data, onRowClick }: Props<TData, TValue>) {
  // TanStack Table returns non-memoizable functions; the compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id} scope="col" className={classOf(header.column.columnDef.meta)}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className={onRowClick ? "cursor-pointer" : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className={classOf(cell.column.columnDef.meta)}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="h-19 text-center! text-muted-foreground">
              No results
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
