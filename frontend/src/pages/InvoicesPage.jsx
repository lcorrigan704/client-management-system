import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/data-table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import LineItemsEditorDialog from "@/components/line-items-editor-dialog";
import { gridTwo, fieldClass, labelClass } from "@/ui/formStyles";
import { formatGBP, formatDate } from "@/utils/format";

export default function InvoicesPage({
  invoices,
  clients,
  quotes,
  invoiceColumns,
  invoiceDialogOpen,
  setInvoiceDialogOpen,
  invoiceForm,
  setInvoiceForm,
  editingInvoiceId,
  resetInvoiceForm,
  handleInvoiceSubmit,
  onBulkMarkPaid,
  onBulkDelete,
  onBulkSendReminder,
  onBulkCompose,
  emptyInvoice,
  settings,
}) {
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const showVatControls = Boolean(settings?.vat_registered);
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const quoteMap = new Map(quotes.map((quote) => [quote.id, quote]));
  const clientQuotes = quotes.filter(
    (quote) => String(quote.client_id) === String(invoiceForm.client_id)
  );
  const exportColumns = [
    { key: "display_id", header: "Invoice ID" },
    { key: "client", header: "Client" },
    { key: "quote", header: "Quote" },
    { key: "title", header: "Title" },
    { key: "status", header: "Status" },
    { key: "issued_at", header: "Issued at" },
    { key: "due_date", header: "Due date" },
    { key: "amount", header: "Amount" },
    { key: "line_items", header: "Line items" },
    { key: "notes", header: "Notes" },
  ];
  const lineItemColumns = [
    { key: "invoice_display_id", header: "Invoice ID" },
    { key: "description", header: "Description" },
    { key: "quantity", header: "Quantity" },
    { key: "unit_amount", header: "Unit amount" },
    { key: "line_total", header: "Line total" },
  ];
  const exportConfig = {
    label: "Export invoices",
    selectedLabel: "Export selected",
    mode: "zip",
    filenameBase: "invoices",
    parent: {
      columns: exportColumns,
      mapRow: (invoice) => {
        const client = clientMap.get(invoice.client_id);
        const quote = quoteMap.get(invoice.quote_id);
        const lineItems = (invoice.line_items || [])
          .map(
            (item) =>
              `${item.description} | ${Number(item.quantity || 0)} x ${formatGBP(
                item.unit_amount
              )}`
          )
          .join(" ; ");
        return {
          display_id: invoice.display_id || "",
          client: client?.company || client?.name || "",
          quote: quote?.display_id || quote?.title || "",
          title: invoice.title || "",
          status: invoice.status || "",
          issued_at: formatDate(invoice.issued_at),
          due_date: formatDate(invoice.due_date),
          amount: formatGBP(invoice.amount),
          line_items: lineItems,
          notes: invoice.notes || "",
        };
      },
    },
    child: {
      filename: "invoice_line_items.csv",
      columns: lineItemColumns,
      mapRows: (parentRows) =>
        parentRows.flatMap((invoice) =>
          (invoice.line_items || []).map((item) => ({
            invoice_display_id: invoice.display_id || "",
            description: item.description || "",
            quantity: Number(item.quantity || 0),
            unit_amount: Number(item.unit_amount || 0),
            line_total: Number(item.quantity || 0) * Number(item.unit_amount || 0),
          }))
        ),
    },
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Invoices</h2>
          <p className="text-sm text-muted-foreground">Create invoices and track payment status.</p>
        </div>
        <Button
          onClick={() => {
            resetInvoiceForm();
            setInvoiceDialogOpen(true);
          }}
        >
          New invoice
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={invoiceColumns}
            data={invoices}
            emptyMessage="No invoices yet."
            searchKey="title"
            searchPlaceholder="Search invoices..."
            getRowClassName={(row) => {
              if (!row.due_date) return "";
              if (row.status === "paid") return "";
              const due = new Date(row.due_date);
              if (Number.isNaN(due.getTime())) return "";
              if (due.getTime() < new Date().setHours(0, 0, 0, 0)) {
                return "bg-rose-50 text-rose-900 dark:bg-rose-900/20 dark:text-rose-100";
              }
              return "";
            }}
            totalKey="amount"
            totalLabel="Total invoiced"
            formatTotal={formatGBP}
            exportConfig={exportConfig}
            enableRowSelection
            bulkActions={[
              {
                label: "Compose from selected",
                variant: "outline",
                onClick: (rows) => onBulkCompose?.(rows),
              },
              {
                label: "Mark as paid",
                variant: "outline",
                onClick: (rows) => onBulkMarkPaid?.(rows),
                confirm: {
                  title: "Mark selected invoices as paid?",
                  description:
                    "This will update the selected unpaid invoices to paid.",
                  confirmLabel: "Mark as paid",
                },
              },
              {
                label: "Send reminders",
                variant: "outline",
                onClick: (rows) => onBulkSendReminder?.(rows),
                confirm: {
                  title: "Send invoice reminders?",
                  description:
                    "This will send reminder emails for the selected invoices using SMTP.",
                  confirmLabel: "Send reminders",
                },
              },
              {
                label: "Delete selected",
                variant: "destructive",
                onClick: (rows) => onBulkDelete?.(rows),
                confirm: {
                  title: "Delete selected invoices?",
                  description:
                    "This action cannot be undone. The selected invoices will be permanently removed.",
                  confirmLabel: "Delete invoices",
                },
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editingInvoiceId ? "Edit invoice" : "New invoice"}</DialogTitle>
            <DialogDescription>Attach invoices to clients.</DialogDescription>
          </DialogHeader>
          <form className="min-w-0 space-y-4" onSubmit={handleInvoiceSubmit}>
            <div className={`${gridTwo} [&>*]:min-w-0`}>
              <div className={fieldClass}>
                <label className={labelClass}>Client</label>
                <Select
                  value={invoiceForm.client_id}
                  onValueChange={(value) => setInvoiceForm({ ...invoiceForm, client_id: value })}
                  disabled={editingInvoiceId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={String(client.id)}>
                        {client.company || client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Quote (optional)</label>
                <Select
                  value={invoiceForm.quote_id}
                  onValueChange={(value) => {
                    const quoteId = value === "none" ? "" : value;
                    const selectedQuote = clientQuotes.find(
                      (quote) => String(quote.id) === String(quoteId)
                    );
                    const nextLineItems =
                      selectedQuote?.line_items && selectedQuote.line_items.length
                        ? selectedQuote.line_items.map((item) => ({
                            description: item.description,
                            quantity: item.quantity,
                            unit_amount: item.unit_amount,
                            tax_kind: item.tax_kind || "vat",
                            tax_code: item.tax_code || "standard",
                            tax_rate:
                              item.tax_rate ??
                              (settings?.vat_registered
                                ? settings?.default_vat_rate ?? 20
                                : 0),
                            tax_inclusive: item.tax_inclusive === true,
                            tax_override: item.tax_override === true,
                          }))
                        : emptyInvoice.line_items;
                    setInvoiceForm({
                      ...invoiceForm,
                      quote_id: quoteId,
                      line_items: selectedQuote ? nextLineItems : invoiceForm.line_items,
                    });
                  }}
                  disabled={!invoiceForm.client_id}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select quote" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No quote</SelectItem>
                    {clientQuotes.map((quote) => (
                      <SelectItem key={quote.id} value={String(quote.id)}>
                        {quote.display_id || quote.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className={`${gridTwo} [&>*]:min-w-0`}>
              <div className={fieldClass}>
                <label className={labelClass}>Title</label>
                <Input
                  value={invoiceForm.title}
                  onChange={(event) => setInvoiceForm({ ...invoiceForm, title: event.target.value })}
                  required
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Status</label>
                <Select
                  value={invoiceForm.status}
                  onValueChange={(value) => setInvoiceForm({ ...invoiceForm, status: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Invoice date</label>
                <DatePicker
                  value={invoiceForm.issued_at}
                  onChange={(date) => setInvoiceForm({ ...invoiceForm, issued_at: date })}
                  placeholder="Pick invoice date"
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Due date</label>
                <DatePicker
                  value={invoiceForm.due_date}
                  onChange={(date) => setInvoiceForm({ ...invoiceForm, due_date: date })}
                  placeholder="Pick a due date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Recurring schedule</label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={invoiceForm.recurrence_enabled}
                    onCheckedChange={(value) => {
                      const enabled = value === true;
                      setInvoiceForm({ ...invoiceForm, recurrence_enabled: enabled });
                      if (enabled) {
                        setRecurringDialogOpen(true);
                      }
                    }}
                  />
                  Generate recurring invoices
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRecurringDialogOpen(true)}
                  disabled={!invoiceForm.recurrence_enabled}
                >
                  Configure schedule
                </Button>
                {invoiceForm.recurrence_enabled && (
                  <span className="text-xs text-muted-foreground">
                    {invoiceForm.recurrence_frequency} · {invoiceForm.recurrence_count} invoices ·
                    due {invoiceForm.due_rule_value} {invoiceForm.due_rule_unit}
                  </span>
                )}
              </div>
              <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Recurring invoice schedule</DialogTitle>
                    <DialogDescription>
                      Set how often invoices should be generated and when they are due.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm md:col-span-2">
                      <div>
                        <p className="font-medium text-foreground">Send first invoice now</p>
                        <p className="text-xs text-muted-foreground">
                          If enabled, the first invoice is marked as sent.
                        </p>
                      </div>
                      <Switch
                        checked={invoiceForm.send_now}
                        onCheckedChange={(checked) =>
                          setInvoiceForm({ ...invoiceForm, send_now: checked })
                        }
                      />
                    </div>
                    <div className={fieldClass}>
                      <label className={labelClass}>Frequency</label>
                      <Select
                        value={invoiceForm.recurrence_frequency}
                        onValueChange={(value) =>
                          setInvoiceForm({ ...invoiceForm, recurrence_frequency: value })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={fieldClass}>
                      <label className={labelClass}>Occurrences</label>
                      <Input
                        type="number"
                        min="1"
                        value={invoiceForm.recurrence_count}
                        onChange={(event) =>
                          setInvoiceForm({
                            ...invoiceForm,
                            recurrence_count: Number(event.target.value || 1),
                          })
                        }
                      />
                    </div>
                    <div className={fieldClass}>
                      <label className={labelClass}>Day of month</label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={invoiceForm.recurrence_day_of_month}
                        onChange={(event) =>
                          setInvoiceForm({
                            ...invoiceForm,
                            recurrence_day_of_month: event.target.value,
                          })
                        }
                        disabled={invoiceForm.recurrence_frequency === "weekly"}
                        placeholder="Use invoice date day"
                      />
                    </div>
                    <div className={fieldClass}>
                      <label className={labelClass}>Due date unit</label>
                      <Select
                        value={invoiceForm.due_rule_unit}
                        onValueChange={(value) =>
                          setInvoiceForm({ ...invoiceForm, due_rule_unit: value })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="weeks">Weeks</SelectItem>
                          <SelectItem value="months">Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={fieldClass}>
                      <label className={labelClass}>Due date value</label>
                      <Input
                        type="number"
                        min="1"
                        value={invoiceForm.due_rule_value}
                        onChange={(event) =>
                          setInvoiceForm({
                            ...invoiceForm,
                            due_rule_value: Number(event.target.value || 1),
                          })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-2">
                    <DialogClose asChild>
                      <Button type="button">Done</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className={`${gridTwo} [&>*]:min-w-0`}>
              <div className={fieldClass}>
                <label className={labelClass}>Use custom ID</label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={invoiceForm.is_legacy}
                    onCheckedChange={(value) =>
                      setInvoiceForm({ ...invoiceForm, is_legacy: value === true })
                    }
                    disabled={invoiceForm.recurrence_enabled}
                  />
                  Override auto-generated ID
                </label>
                {invoiceForm.recurrence_enabled && (
                  <p className="text-xs text-muted-foreground">
                    Custom IDs are disabled for recurring invoices.
                  </p>
                )}
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Custom ID</label>
                <Input
                  value={invoiceForm.display_id}
                  onChange={(event) =>
                    setInvoiceForm({ ...invoiceForm, display_id: event.target.value })
                  }
                  placeholder="INV-1001"
                  disabled={!invoiceForm.is_legacy || invoiceForm.recurrence_enabled}
                />
              </div>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Line items</label>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">
                    {invoiceForm.line_items.length} item
                    {invoiceForm.line_items.length === 1 ? "" : "s"} · Subtotal{" "}
                    {formatGBP(
                      invoiceForm.line_items.reduce(
                        (sum, item) =>
                          sum + Number(item.quantity || 0) * Number(item.unit_amount || 0),
                        0
                      )
                    )}
                  </div>
                  <LineItemsEditorDialog
                    title="Edit invoice line items"
                    lineItems={invoiceForm.line_items}
                    onChange={(nextLineItems) =>
                      setInvoiceForm({ ...invoiceForm, line_items: nextLineItems })
                    }
                    emptyLineItem={emptyInvoice.line_items[0]}
                    showVatControls={showVatControls}
                  />
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {invoiceForm.line_items.slice(0, 3).map((item, idx) => (
                    <p key={`${item.description}-${idx}`} className="break-words">
                      {item.description || "Untitled line"} · {Number(item.quantity || 0)} ×{" "}
                      {formatGBP(item.unit_amount)}
                    </p>
                  ))}
                  {invoiceForm.line_items.length > 3 ? (
                    <p>+{invoiceForm.line_items.length - 3} more line items</p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Notes</label>
              <Textarea
                value={invoiceForm.notes}
                onChange={(event) => setInvoiceForm({ ...invoiceForm, notes: event.target.value })}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={resetInvoiceForm}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">{editingInvoiceId ? "Update invoice" : "Create invoice"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
