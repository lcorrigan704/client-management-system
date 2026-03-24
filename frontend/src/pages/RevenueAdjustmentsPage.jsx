import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/data-table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { fieldClass, gridTwo, labelClass } from "@/ui/formStyles";
import { formatDate, formatGBP } from "@/utils/format";

export default function RevenueAdjustmentsPage({
  creditNotes,
  refunds,
  yearMatches,
  invoices,
  clients,
  creditNoteForm,
  setCreditNoteForm,
  refundForm,
  setRefundForm,
  creditNoteDialogOpen,
  setCreditNoteDialogOpen,
  refundDialogOpen,
  setRefundDialogOpen,
  editingCreditNoteId,
  editingRefundId,
  resetCreditNoteForm,
  resetRefundForm,
  handleCreditNoteSubmit,
  handleRefundSubmit,
  onEditCreditNote,
  onEditRefund,
  onDeleteCreditNote,
  onDeleteRefund,
  onCreateRefundForCreditNote,
  selectedInvoiceId,
  clearInvoiceFilter,
}) {
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const invoiceMap = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);
  const creditNoteMap = useMemo(
    () => new Map(creditNotes.map((creditNote) => [creditNote.id, creditNote])),
    [creditNotes]
  );

  const creditUsageByLine = useMemo(() => {
    const usage = new Map();
    creditNotes.forEach((creditNote) => {
      creditNote.line_items?.forEach((item) => {
        usage.set(
          item.invoice_line_item_id,
          (usage.get(item.invoice_line_item_id) || 0) + Number(item.credited_amount || 0)
        );
      });
    });
    return usage;
  }, [creditNotes]);

  const selectedInvoice = creditNoteForm.invoice_id
    ? invoiceMap.get(Number(creditNoteForm.invoice_id))
    : null;

  const invoiceOptions = selectedInvoiceId
    ? invoices.filter((invoice) => invoice.id === Number(selectedInvoiceId))
    : invoices;

  const visibleCreditNotes = creditNotes.filter((creditNote) => yearMatches(creditNote.issued_at));
  const visibleRefunds = refunds.filter((refund) => yearMatches(refund.refunded_at));
  const filteredCreditNotes = selectedInvoiceId
    ? visibleCreditNotes.filter((creditNote) => creditNote.invoice_id === Number(selectedInvoiceId))
    : visibleCreditNotes;
  const filteredRefunds = selectedInvoiceId
    ? visibleRefunds.filter((refund) => refund.invoice_id === Number(selectedInvoiceId))
    : visibleRefunds;

  const creditNoteColumns = [
    {
      accessorKey: "display_id",
      header: "Credit note ID",
      cell: ({ row }) => row.original.display_id || "—",
    },
    {
      accessorKey: "invoice_id",
      header: "Invoice",
      cell: ({ row }) => invoiceMap.get(row.original.invoice_id)?.display_id || "—",
    },
    {
      accessorKey: "client_id",
      header: "Client",
      cell: ({ row }) => clientMap.get(row.original.client_id)?.company || "—",
    },
    {
      accessorKey: "issued_at",
      header: "Issued at",
      cell: ({ row }) => formatDate(row.original.issued_at),
    },
    {
      accessorKey: "total_amount",
      header: "Amount",
      cell: ({ row }) => formatGBP(row.original.total_amount),
      meta: { footerClassName: "text-left" },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditCreditNote(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateRefundForCreditNote(row.original)}>
              Create refund
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDeleteCreditNote(row.original.id)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const refundColumns = [
    {
      accessorKey: "display_id",
      header: "Refund ID",
      cell: ({ row }) => row.original.display_id || "—",
    },
    {
      accessorKey: "credit_note_id",
      header: "Credit note",
      cell: ({ row }) => creditNoteMap.get(row.original.credit_note_id)?.display_id || "—",
    },
    {
      accessorKey: "invoice_id",
      header: "Invoice",
      cell: ({ row }) => invoiceMap.get(row.original.invoice_id)?.display_id || "—",
    },
    {
      accessorKey: "refunded_at",
      header: "Refunded at",
      cell: ({ row }) => formatDate(row.original.refunded_at),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => formatGBP(row.original.amount),
      meta: { footerClassName: "text-left" },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditRefund(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDeleteRefund(row.original.id)}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const creditExportConfig = {
    label: "Export credit notes",
    selectedLabel: "Export selected",
    filename: "credit_notes.csv",
    parent: {
      columns: [
        { key: "display_id", header: "Credit note ID" },
        { key: "invoice", header: "Invoice" },
        { key: "client", header: "Client" },
        { key: "issued_at", header: "Issued at" },
        { key: "total_amount", header: "Amount" },
        { key: "notes", header: "Notes" },
      ],
      mapRow: (creditNote) => ({
        display_id: creditNote.display_id || "",
        invoice: invoiceMap.get(creditNote.invoice_id)?.display_id || "",
        client: clientMap.get(creditNote.client_id)?.company || "",
        issued_at: formatDate(creditNote.issued_at),
        total_amount: formatGBP(creditNote.total_amount),
        notes: creditNote.notes || "",
      }),
    },
  };

  const refundExportConfig = {
    label: "Export refunds",
    selectedLabel: "Export selected",
    filename: "refunds.csv",
    parent: {
      columns: [
        { key: "display_id", header: "Refund ID" },
        { key: "credit_note", header: "Credit note" },
        { key: "invoice", header: "Invoice" },
        { key: "refunded_at", header: "Refunded at" },
        { key: "amount", header: "Amount" },
        { key: "notes", header: "Notes" },
      ],
      mapRow: (refund) => ({
        display_id: refund.display_id || "",
        credit_note: creditNoteMap.get(refund.credit_note_id)?.display_id || "",
        invoice: invoiceMap.get(refund.invoice_id)?.display_id || "",
        refunded_at: formatDate(refund.refunded_at),
        amount: formatGBP(refund.amount),
        notes: refund.notes || "",
      }),
    },
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Revenue adjustments</h2>
          <p className="text-sm text-muted-foreground">
            Create credit notes from invoices and track linked refunds.
          </p>
        </div>
        <div className="flex gap-2">
          {selectedInvoiceId ? (
            <Button type="button" variant="outline" onClick={clearInvoiceFilter}>
              Clear invoice filter
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => {
              resetCreditNoteForm();
              setCreditNoteDialogOpen(true);
            }}
          >
            New credit note
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credit notes</CardTitle>
          <CardDescription>Reduce invoiced totals without mutating the source invoice.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={creditNoteColumns}
            data={filteredCreditNotes}
            emptyMessage="No credit notes yet."
            searchKey="display_id"
            searchPlaceholder="Search credit notes..."
            totalKey="total_amount"
            totalLabel="Total credited"
            formatTotal={formatGBP}
            exportConfig={creditExportConfig}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Refunds</CardTitle>
          <CardDescription>Track cash returned against existing credit notes.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={refundColumns}
            data={filteredRefunds}
            emptyMessage="No refunds yet."
            searchKey="display_id"
            searchPlaceholder="Search refunds..."
            totalKey="amount"
            totalLabel="Total refunded"
            formatTotal={formatGBP}
            exportConfig={refundExportConfig}
          />
        </CardContent>
      </Card>

      <Dialog open={creditNoteDialogOpen} onOpenChange={setCreditNoteDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingCreditNoteId ? "Edit credit note" : "New credit note"}</DialogTitle>
            <DialogDescription>
              Create partial or full credits from invoice line items.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreditNoteSubmit}>
            <div className={gridTwo}>
              <div className={fieldClass}>
                <label className={labelClass}>Invoice</label>
                <Select
                  value={creditNoteForm.invoice_id}
                  onValueChange={(value) =>
                    setCreditNoteForm({ ...creditNoteForm, invoice_id: value })
                  }
                  disabled={Boolean(editingCreditNoteId)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceOptions.map((invoice) => (
                      <SelectItem key={invoice.id} value={String(invoice.id)}>
                        {invoice.display_id || `INV-${invoice.id}`} · {invoice.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Issued date</label>
                <DatePicker
                  value={creditNoteForm.issued_at}
                  onChange={(value) => setCreditNoteForm({ ...creditNoteForm, issued_at: value })}
                  placeholder="Pick a date"
                />
              </div>
            </div>

            {!editingCreditNoteId && selectedInvoice ? (
              <div className="space-y-3">
                <div className="rounded-md border">
                  <div className="grid grid-cols-[1.6fr_0.9fr_0.9fr_0.9fr_0.9fr] gap-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                    <span>Description</span>
                    <span>Line total</span>
                    <span>Remaining</span>
                    <span>Qty</span>
                    <span>Credit</span>
                  </div>
                  {(creditNoteForm.line_items || []).map((item, index) => {
                    const sourceLine = selectedInvoice.line_items?.find(
                      (line) => line.id === item.invoice_line_item_id
                    );
                    const lineTotal =
                      Number(sourceLine?.quantity || 0) * Number(sourceLine?.unit_amount || 0);
                    const alreadyCredited = creditUsageByLine.get(item.invoice_line_item_id) || 0;
                    const remaining = Math.max(0, lineTotal - alreadyCredited);
                    return (
                      <div
                        key={item.invoice_line_item_id}
                        className="grid grid-cols-[1.6fr_0.9fr_0.9fr_0.9fr_0.9fr] gap-3 border-b px-3 py-3 last:border-b-0"
                      >
                        <div className="text-sm text-foreground">{item.description}</div>
                        <div className="text-sm text-muted-foreground">{formatGBP(lineTotal)}</div>
                        <div className="text-sm text-muted-foreground">{formatGBP(remaining)}</div>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.credited_quantity}
                          onChange={(event) => {
                            const nextItems = [...creditNoteForm.line_items];
                            nextItems[index] = {
                              ...item,
                              credited_quantity: event.target.value,
                            };
                            setCreditNoteForm({ ...creditNoteForm, line_items: nextItems });
                          }}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={item.credited_amount}
                          onChange={(event) => {
                            const nextItems = [...creditNoteForm.line_items];
                            nextItems[index] = {
                              ...item,
                              credited_amount: event.target.value,
                            };
                            setCreditNoteForm({ ...creditNoteForm, line_items: nextItems });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground">
                  Total credit:{" "}
                  {formatGBP(
                    (creditNoteForm.line_items || []).reduce(
                      (sum, item) => sum + Number(item.credited_amount || 0),
                      0
                    )
                  )}
                </p>
              </div>
            ) : null}

            {editingCreditNoteId ? (
              <div className="space-y-2 rounded-md border p-3 text-sm text-muted-foreground">
                {(creditNoteForm.line_items || []).map((item) => (
                  <div key={item.id || item.invoice_line_item_id} className="flex items-center justify-between gap-3">
                    <span>{item.description}</span>
                    <span>{formatGBP(item.credited_amount)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className={fieldClass}>
              <label className={labelClass}>Notes</label>
              <Textarea
                value={creditNoteForm.notes}
                onChange={(event) => setCreditNoteForm({ ...creditNoteForm, notes: event.target.value })}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={resetCreditNoteForm}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">{editingCreditNoteId ? "Update credit note" : "Create credit note"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRefundId ? "Edit refund" : "New refund"}</DialogTitle>
            <DialogDescription>Create a partial or full refund from a credit note.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleRefundSubmit}>
            <div className={gridTwo}>
              <div className={fieldClass}>
                <label className={labelClass}>Credit note</label>
                <Select
                  value={refundForm.credit_note_id}
                  onValueChange={(value) =>
                    setRefundForm({ ...refundForm, credit_note_id: value })
                  }
                  disabled={Boolean(editingRefundId)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select credit note" />
                  </SelectTrigger>
                  <SelectContent>
                    {creditNotes.map((creditNote) => (
                      <SelectItem key={creditNote.id} value={String(creditNote.id)}>
                        {creditNote.display_id || `CN-${creditNote.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Refunded date</label>
                <DatePicker
                  value={refundForm.refunded_at}
                  onChange={(value) => setRefundForm({ ...refundForm, refunded_at: value })}
                  placeholder="Pick a date"
                />
              </div>
            </div>
            {refundForm.credit_note_id ? (
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                {(() => {
                  const creditNote = creditNoteMap.get(Number(refundForm.credit_note_id));
                  const refunded = refunds
                    .filter(
                      (refund) =>
                        refund.credit_note_id === Number(refundForm.credit_note_id) &&
                        refund.id !== editingRefundId
                    )
                    .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
                  const remaining = Math.max(0, Number(creditNote?.total_amount || 0) - refunded);
                  return (
                    <>
                      <p>Credit note total: {formatGBP(creditNote?.total_amount || 0)}</p>
                      <p>Already refunded: {formatGBP(refunded)}</p>
                      <p>Remaining refundable: {formatGBP(remaining)}</p>
                    </>
                  );
                })()}
              </div>
            ) : null}
            <div className={fieldClass}>
              <label className={labelClass}>Amount</label>
              <Input
                type="number"
                step="0.01"
                value={refundForm.amount}
                onChange={(event) => setRefundForm({ ...refundForm, amount: event.target.value })}
                required
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Notes</label>
              <Textarea
                value={refundForm.notes}
                onChange={(event) => setRefundForm({ ...refundForm, notes: event.target.value })}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={resetRefundForm}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">{editingRefundId ? "Update refund" : "Create refund"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
