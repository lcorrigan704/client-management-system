import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/data-table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { gridTwo, fieldClass, labelClass } from "@/ui/formStyles";
import { formatGBP } from "@/utils/format";

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
  handleMarkInvoicePaid,
  emptyInvoice,
}) {
  const clientQuotes = quotes.filter(
    (quote) => String(quote.client_id) === String(invoiceForm.client_id)
  );

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
          />
        </CardContent>
      </Card>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingInvoiceId ? "Edit invoice" : "New invoice"}</DialogTitle>
            <DialogDescription>Attach invoices to clients.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleInvoiceSubmit}>
            <div className={fieldClass}>
              <label className={labelClass}>Client</label>
              <Select
                value={invoiceForm.client_id}
                onValueChange={(value) => setInvoiceForm({ ...invoiceForm, client_id: value })}
                disabled={editingInvoiceId}
              >
                <SelectTrigger>
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
                <SelectTrigger>
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
            <div className={gridTwo}>
              <div className={fieldClass}>
                <label className={labelClass}>Use custom ID</label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={invoiceForm.is_legacy}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, is_legacy: event.target.checked })
                    }
                  />
                  Override auto-generated ID
                </label>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Custom ID</label>
                <Input
                  value={invoiceForm.display_id}
                  onChange={(event) =>
                    setInvoiceForm({ ...invoiceForm, display_id: event.target.value })
                  }
                  placeholder="INV-1001"
                  disabled={!invoiceForm.is_legacy}
                />
              </div>
            </div>
            <div className={gridTwo}>
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
                  <SelectTrigger>
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
                <label className={labelClass}>Due date</label>
                <DatePicker
                  value={invoiceForm.due_date}
                  onChange={(date) => setInvoiceForm({ ...invoiceForm, due_date: date })}
                  placeholder="Pick a due date"
                />
              </div>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Line items</label>
              <div className="space-y-2">
                {invoiceForm.line_items.map((item, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(event) => {
                        const next = [...invoiceForm.line_items];
                        next[index] = { ...item, description: event.target.value };
                        setInvoiceForm({ ...invoiceForm, line_items: next });
                      }}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(event) => {
                        const next = [...invoiceForm.line_items];
                        next[index] = { ...item, quantity: event.target.value };
                        setInvoiceForm({ ...invoiceForm, line_items: next });
                      }}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Unit amount"
                      value={item.unit_amount}
                      onChange={(event) => {
                        const next = [...invoiceForm.line_items];
                        next[index] = { ...item, unit_amount: event.target.value };
                        setInvoiceForm({ ...invoiceForm, line_items: next });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        const next = invoiceForm.line_items.filter((_, i) => i !== index);
                        setInvoiceForm({
                          ...invoiceForm,
                          line_items: next.length ? next : emptyInvoice.line_items,
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setInvoiceForm({
                      ...invoiceForm,
                      line_items: [
                        ...invoiceForm.line_items,
                        { description: "", quantity: 1, unit_amount: "" },
                      ],
                    })
                  }
                >
                  Add line item
                </Button>
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
