import * as React from "react";
import {
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DataTable({
  columns,
  data,
  emptyMessage,
  searchKey,
  searchPlaceholder = "Search...",
  getRowClassName,
  totalKey,
  totalLabel = "Total",
  formatTotal,
}) {
  const [sorting, setSorting] = React.useState([]);
  const [columnFilters, setColumnFilters] = React.useState([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });
  const totalValue = React.useMemo(() => {
    if (!totalKey) return null;
    return table
      .getFilteredRowModel()
      .rows.reduce((sum, row) => sum + Number(row.original?.[totalKey] || 0), 0);
  }, [data, totalKey, columnFilters, sorting]);

  return (
    <div className="space-y-3">
      {searchKey ? (
        <div className="flex items-center gap-2">
          <Input
            placeholder={searchPlaceholder}
            value={table.getColumn(searchKey)?.getFilterValue() ?? ""}
            onChange={(event) => table.getColumn(searchKey)?.setFilterValue(event.target.value)}
            className="max-w-xs"
          />
        </div>
      ) : null}
      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortState = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={header.column.columnDef.meta?.headerClassName}
                    >
                      {header.isPlaceholder ? null : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={`-ml-2 h-8 px-2 ${canSort ? "" : "pointer-events-none"}`}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortState === "asc" ? " ▲" : sortState === "desc" ? " ▼" : ""}
                        </Button>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={getRowClassName ? getRowClassName(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.cellClassName}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {totalKey ? (
            <TableFooter>
              <TableRow>
                {columns.map((column) => {
                  const columnKey = column.id || column.accessorKey;
                  const isTotalColumn = columnKey === totalKey;
                  const isFirstColumn = column === columns[0];
                  return (
                    <TableCell
                      key={columnKey || String(isFirstColumn)}
                      className={column.meta?.footerClassName}
                    >
                      {isFirstColumn ? totalLabel : null}
                      {isTotalColumn
                        ? formatTotal
                          ? formatTotal(totalValue)
                          : totalValue
                        : null}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          {table.getFilteredRowModel().rows.length} result
          {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
