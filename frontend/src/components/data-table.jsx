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
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  enableRowSelection = false,
  onSelectionChange,
  bulkActions = [],
}) {
  const [sorting, setSorting] = React.useState([]);
  const [columnFilters, setColumnFilters] = React.useState([]);
  const [rowSelection, setRowSelection] = React.useState({});
  const [isExporting, setIsExporting] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState(null);
  const selectionColumn = React.useMemo(() => {
    if (!enableRowSelection) return null;
    return {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllRowsSelected() ||
            (table.getIsSomeRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { headerClassName: "w-[48px]" },
    };
  }, [enableRowSelection]);
  const tableColumns = React.useMemo(
    () => (selectionColumn ? [selectionColumn, ...columns] : columns),
    [columns, selectionColumn]
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
    enableRowSelection: enableRowSelection,
  });
  const selectedRows = React.useMemo(
    () => table.getSelectedRowModel().rows.map((row) => row.original),
    [rowSelection, table]
  );
  React.useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange(selectedRows);
  }, [onSelectionChange, selectedRows]);
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

  const handleBulkActionClick = React.useCallback(
    (action) => {
      if (action.confirm) {
        setConfirmAction({ action, rows: selectedRows });
      } else {
        action.onClick(selectedRows);
      }
    },
    [selectedRows]
  );

  const handleConfirmAction = React.useCallback(async () => {
    if (!confirmAction) return;
    try {
      await Promise.resolve(confirmAction.action.onClick(confirmAction.rows));
    } finally {
      setConfirmAction(null);
      table.resetRowSelection();
    }
  }, [confirmAction, table]);

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
      {enableRowSelection && selectedRows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{selectedRows.length} selected</span>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                type="button"
                size="sm"
                variant={action.variant || "outline"}
                onClick={() => handleBulkActionClick(action)}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => table.resetRowSelection()}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}
      {confirmAction ? (
        <AlertDialog open onOpenChange={() => setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction.action.confirm?.title || "Confirm action"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction.action.confirm?.description ||
                  "Are you sure you want to proceed?"}
                <span className="mt-2 block text-xs text-muted-foreground">
                  {confirmAction.rows.length} selected
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmAction}>
                {confirmAction.action.confirm?.confirmLabel || "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortState = header.column.getIsSorted();
                  const isSelectionHeader = header.column.id === "select";
                  return (
                    <TableHead
                      key={header.id}
                      className={header.column.columnDef.meta?.headerClassName}
                    >
                      {header.isPlaceholder ? null : isSelectionHeader ? (
                        flexRender(header.column.columnDef.header, header.getContext())
                      ) : (
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
                <TableCell colSpan={tableColumns.length} className="h-24 text-center text-sm">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {totalKey ? (
            <TableFooter>
              <TableRow>
                {tableColumns.map((column, index) => {
                  const columnKey = column.id || column.accessorKey;
                  const isTotalColumn = columnKey === totalKey;
                  const isFirstColumn = enableRowSelection
                    ? index === 1
                    : index === 0;
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
