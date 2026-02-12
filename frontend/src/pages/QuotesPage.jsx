import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/data-table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { gridTwo, fieldClass, labelClass } from "@/ui/formStyles";
import { formatGBP, formatDate } from "@/utils/format";

export default function QuotesPage({
  quotes,
  clients,
  quoteColumns,
  quoteDialogOpen,
  setQuoteDialogOpen,
  quoteForm,
  setQuoteForm,
  editingQuoteId,
  resetQuoteForm,
  handleQuoteSubmit,
  onBulkDelete,
  onBulkSendReminder,
  emptyQuote,
}) {
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const exportColumns = [
    { key: "display_id", header: "Quote ID" },
    { key: "client", header: "Client" },
    { key: "title", header: "Title" },
    { key: "status", header: "Status" },
    { key: "issued_at", header: "Issued at" },
    { key: "valid_until", header: "Valid until" },
    { key: "amount", header: "Amount" },
    { key: "line_items", header: "Line items" },
    { key: "notes", header: "Notes" },
  ];
  const lineItemColumns = [
    { key: "quote_display_id", header: "Quote ID" },
    { key: "description", header: "Description" },
    { key: "quantity", header: "Quantity" },
    { key: "unit_amount", header: "Unit amount" },
    { key: "line_total", header: "Line total" },
  ];
  const exportConfig = {
    label: "Export quotes",
    mode: "zip",
    filenameBase: "quotes",
    parent: {
      columns: exportColumns,
      mapRow: (quote) => {
        const client = clientMap.get(quote.client_id);
        const lineItems = (quote.line_items || [])
          .map(
            (item) =>
              `${item.description} | ${Number(item.quantity || 0)} x ${formatGBP(
                item.unit_amount
              )}`
          )
          .join(" ; ");
        return {
          display_id: quote.display_id || "",
          client: client?.company || client?.name || "",
          title: quote.title || "",
          status: quote.status || "",
          issued_at: formatDate(quote.issued_at),
          valid_until: formatDate(quote.valid_until),
          amount: formatGBP(quote.amount),
          line_items: lineItems,
          notes: quote.notes || "",
        };
      },
    },
    child: {
      filename: "quote_line_items.csv",
      columns: lineItemColumns,
      mapRows: (parentRows) =>
        parentRows.flatMap((quote) =>
          (quote.line_items || []).map((item) => ({
            quote_display_id: quote.display_id || "",
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
          <h2 className="text-2xl font-semibold text-foreground">Quotes</h2>
          <p className="text-sm text-muted-foreground">Create and update quotes by client.</p>
        </div>
        <Button
          onClick={() => {
            resetQuoteForm();
            setQuoteDialogOpen(true);
          }}
        >
          New quote
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">

          <DataTable
            columns={quoteColumns}
            data={quotes}
            emptyMessage="No quotes yet."
            searchKey="title"
            searchPlaceholder="Search quotes..."
            totalKey="amount"
            totalLabel="Total quoted"
            formatTotal={formatGBP}
            exportConfig={exportConfig}
            enableRowSelection
            bulkActions={[
              {
                label: "Send reminders",
                variant: "outline",
                onClick: (rows) => onBulkSendReminder?.(rows),
                confirm: {
                  title: "Send quote reminders?",
                  description:
                    "This will send reminder emails for the selected quotes using SMTP.",
                  confirmLabel: "Send reminders",
                },
              },
              {
                label: "Delete selected",
                variant: "destructive",
                onClick: (rows) => onBulkDelete?.(rows),
                confirm: {
                  title: "Delete selected quotes?",
                  description:
                    "This action cannot be undone. The selected quotes will be permanently removed.",
                  confirmLabel: "Delete quotes",
                },
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingQuoteId ? "Edit quote" : "New quote"}</DialogTitle>
            <DialogDescription>Track quote values and status.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleQuoteSubmit}>
            <div className={fieldClass}>
              <label className={labelClass}>Client</label>
              <Select
                value={quoteForm.client_id}
                onValueChange={(value) => setQuoteForm({ ...quoteForm, client_id: value })}
                disabled={editingQuoteId}
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
            <div className={gridTwo}>
              <div className={fieldClass}>
                <label className={labelClass}>Use custom ID</label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={quoteForm.is_legacy}
                    onChange={(event) =>
                      setQuoteForm({ ...quoteForm, is_legacy: event.target.checked })
                    }
                  />
                  Override auto-generated ID
                </label>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Custom ID</label>
                <Input
                  value={quoteForm.display_id}
                  onChange={(event) =>
                    setQuoteForm({ ...quoteForm, display_id: event.target.value })
                  }
                  placeholder="QUOTE-1001"
                  disabled={!quoteForm.is_legacy}
                />
              </div>
            </div>
            <div className={gridTwo}>
              <div className={fieldClass}>
                <label className={labelClass}>Title</label>
                <Input
                  value={quoteForm.title}
                  onChange={(event) => setQuoteForm({ ...quoteForm, title: event.target.value })}
                  required
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Status</label>
                <Select
                  value={quoteForm.status}
                  onValueChange={(value) => setQuoteForm({ ...quoteForm, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Valid until</label>
                <DatePicker
                  value={quoteForm.valid_until}
                  onChange={(date) => setQuoteForm({ ...quoteForm, valid_until: date })}
                  placeholder="Pick a valid until date"
                />
              </div>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Line items</label>
              <div className="space-y-2">
                {quoteForm.line_items.map((item, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(event) => {
                        const next = [...quoteForm.line_items];
                        next[index] = { ...item, description: event.target.value };
                        setQuoteForm({ ...quoteForm, line_items: next });
                      }}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(event) => {
                        const next = [...quoteForm.line_items];
                        next[index] = { ...item, quantity: event.target.value };
                        setQuoteForm({ ...quoteForm, line_items: next });
                      }}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Unit amount"
                      value={item.unit_amount}
                      onChange={(event) => {
                        const next = [...quoteForm.line_items];
                        next[index] = { ...item, unit_amount: event.target.value };
                        setQuoteForm({ ...quoteForm, line_items: next });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        const next = quoteForm.line_items.filter((_, i) => i !== index);
                        setQuoteForm({
                          ...quoteForm,
                          line_items: next.length ? next : emptyQuote.line_items,
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
                    setQuoteForm({
                      ...quoteForm,
                      line_items: [
                        ...quoteForm.line_items,
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
                value={quoteForm.notes}
                onChange={(event) => setQuoteForm({ ...quoteForm, notes: event.target.value })}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={resetQuoteForm}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">{editingQuoteId ? "Update quote" : "Create quote"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
