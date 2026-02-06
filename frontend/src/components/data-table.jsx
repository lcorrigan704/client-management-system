import * as React from "react";
import JSZip from "jszip";
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
  exportConfig,
}) {
  const [sorting, setSorting] = React.useState([]);
  const [columnFilters, setColumnFilters] = React.useState([]);
  const [isExporting, setIsExporting] = React.useState(false);

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

  const buildCsv = React.useCallback((rows, columnsConfig) => {
    if (!columnsConfig || columnsConfig.length === 0) return "";
    const headers = columnsConfig.map((column) => column.header);
    const body = rows.map((row) =>
      columnsConfig
        .map((column) => {
          const value = row?.[column.key];
          const normalized = value === null || value === undefined ? "" : String(value);
          return `"${normalized.replace(/"/g, '""')}"`
        })
        .join(",")
    );
    return [headers.join(","), ...body].join("\n");
  }, []);

  const handleExport = React.useCallback(async () => {
    if (!exportConfig || isExporting) return;
    setIsExporting(true);
    try {
      const parentRows = table.getFilteredRowModel().rows.map((row) => row.original);
      const parentData = exportConfig.parent?.mapRow
        ? parentRows.map(exportConfig.parent.mapRow)
        : parentRows;
      const parentCsv = buildCsv(parentData, exportConfig.parent?.columns || []);

      if (exportConfig.mode === "zip") {
        const zip = new JSZip();
        const filenameBase = exportConfig.filenameBase || "export";
        zip.file(`${filenameBase}.csv`, parentCsv);

        if (exportConfig.child?.columns && exportConfig.child?.mapRows) {
          const childRows = exportConfig.child.mapRows(parentRows);
          const childCsv = buildCsv(childRows, exportConfig.child.columns);
          zip.file(exportConfig.child.filename || `${filenameBase}_items.csv`, childCsv);
        }

        if (exportConfig.attachments?.getItems) {
          const items = exportConfig.attachments.getItems(parentRows);
          const folder = zip.folder("attachments");
          await Promise.all(
            items.map(async (item) => {
              if (!item?.url || !folder) return;
              try {
                const response = await fetch(item.url, { credentials: "include" });
                if (!response.ok) return;
                const blob = await response.blob();
                const name = item.filename || item.url.split("/").pop() || "file";
                folder.file(name, blob);
              } catch (error) {
                console.error("Failed to fetch attachment", error);
              }
            })
          );
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${exportConfig.filenameBase || "export"}.zip`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([parentCsv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = exportConfig.filename || "export.csv";
        link.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsExporting(false);
    }
  }, [buildCsv, exportConfig, isExporting, table]);

  return (
    <div className="space-y-3">
      {searchKey ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={searchPlaceholder}
            value={table.getColumn(searchKey)?.getFilterValue() ?? ""}
            onChange={(event) => table.getColumn(searchKey)?.setFilterValue(event.target.value)}
            className="max-w-xs"
          />
          {exportConfig ? (
            <Button type="button" variant="outline" onClick={handleExport} disabled={isExporting}>
              {exportConfig.label || "Export"}
            </Button>
          ) : null}
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
