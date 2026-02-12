import * as React from "react";
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
import { fieldClass, gridTwo, labelClass } from "@/ui/formStyles";
import { formatGBP, formatDate } from "@/utils/format";
import { API_URL } from "@/api/client";

export default function ExpensesPage({
  expenses,
  clients,
  users,
  expenseColumns,
  expenseDialogOpen,
  setExpenseDialogOpen,
  expenseForm,
  setExpenseForm,
  editingExpenseId,
  resetExpenseForm,
  handleExpenseSubmit,
  handleExpenseUpload,
  onBulkDelete,
}) {
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const userMap = new Map(users.map((person) => [person.id, person]));
  const [uploading, setUploading] = React.useState(false);
  const exportColumns = [
    { key: "display_id", header: "Expense ID" },
    { key: "client", header: "Client" },
    { key: "user", header: "User" },
    { key: "title", header: "Title" },
    { key: "amount", header: "Amount" },
    { key: "incurred_date", header: "Incurred date" },
    { key: "notes", header: "Notes" },
    { key: "receipts", header: "Receipts" },
  ];
  const exportConfig = {
    label: "Export expenses",
    mode: "zip",
    filenameBase: "expenses",
    parent: {
      columns: exportColumns,
      mapRow: (expense) => {
        const client = clientMap.get(expense.client_id);
        const user = userMap.get(expense.user_id);
        const receiptNames = (expense.receipts || [])
          .map((item) => item.filename || item.file_path || "")
          .join(" ; ");
        return {
          display_id: expense.display_id || "",
          client: client?.company || client?.name || "",
          user: user?.email || "",
          title: expense.title || "",
          amount: formatGBP(expense.amount),
          incurred_date: formatDate(expense.incurred_date),
          notes: expense.notes || "",
          receipts: receiptNames,
        };
      },
    },
    child: {
      filename: "expense_receipts.csv",
      columns: [
        { key: "expense_display_id", header: "Expense ID" },
        { key: "filename", header: "Filename" },
        { key: "file_path", header: "File path" },
      ],
      mapRows: (parentRows) =>
        parentRows.flatMap((expense) =>
          (expense.receipts || []).map((receipt) => ({
            expense_display_id: expense.display_id || "",
            filename: receipt.filename || "",
            file_path: receipt.file_path || "",
          }))
        ),
    },
    attachments: {
      getItems: (parentRows) =>
        parentRows.flatMap((expense) =>
          (expense.receipts || []).map((receipt) => {
            const filePath = receipt.file_path || "";
            const url = filePath.startsWith("http")
              ? filePath
              : `${API_URL}/${filePath.replace(/^\//, "")}`;
            return {
              url,
              filename: receipt.filename || filePath.split("/").pop() || "receipt",
            };
          })
        ),
    },
  };

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !handleExpenseUpload) return;
    setUploading(true);
    try {
      const response = await handleExpenseUpload(files);
      const nextReceipts = [
        ...(expenseForm.receipts || []),
        ...(response?.files || []),
      ];
      setExpenseForm({ ...expenseForm, receipts: nextReceipts });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const removeReceipt = (index) => {
    const nextReceipts = expenseForm.receipts.filter((_, idx) => idx !== index);
    setExpenseForm({ ...expenseForm, receipts: nextReceipts });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Expenses</h2>
          <p className="text-sm text-muted-foreground">
            Track client-related or standalone expenses.
          </p>
        </div>
        <Button
          onClick={() => {
            resetExpenseForm();
            setExpenseDialogOpen(true);
          }}
        >
          New expense
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">

          <DataTable
            columns={expenseColumns}
            data={expenses}
            emptyMessage="No expenses yet."
            searchKey="title"
            searchPlaceholder="Search expenses..."
            totalKey="amount"
            totalLabel="Total expenses"
            formatTotal={formatGBP}
            exportConfig={exportConfig}
            enableRowSelection
            bulkActions={[
              {
                label: "Delete selected",
                variant: "destructive",
                onClick: (rows) => onBulkDelete?.(rows),
                confirm: {
                  title: "Delete selected expenses?",
                  description:
                    "This action cannot be undone. The selected expenses will be permanently removed.",
                  confirmLabel: "Delete expenses",
                },
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpenseId ? "Edit expense" : "New expense"}</DialogTitle>
            <DialogDescription>Attach to a client or leave standalone.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleExpenseSubmit}>
            <div className={fieldClass}>
              <label className={labelClass}>Client (optional)</label>
              <Select
                value={expenseForm.client_id}
                onValueChange={(value) =>
                  setExpenseForm({ ...expenseForm, client_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.company || client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>User (optional)</label>
              <Select
                value={expenseForm.user_id}
                onValueChange={(value) =>
                  setExpenseForm({ ...expenseForm, user_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No user</SelectItem>
                  {users.map((person) => (
                    <SelectItem key={person.id} value={String(person.id)}>
                      {person.email}
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
                    checked={expenseForm.is_legacy}
                    onChange={(event) =>
                      setExpenseForm({ ...expenseForm, is_legacy: event.target.checked })
                    }
                  />
                  Override auto-generated ID
                </label>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Custom ID</label>
                <Input
                  value={expenseForm.display_id}
                  onChange={(event) =>
                    setExpenseForm({ ...expenseForm, display_id: event.target.value })
                  }
                  placeholder="EXP-1001"
                  disabled={!expenseForm.is_legacy}
                />
              </div>
            </div>
            <div className={gridTwo}>
              <div className={fieldClass}>
                <label className={labelClass}>Title</label>
                <Input
                  value={expenseForm.title}
                  onChange={(event) => setExpenseForm({ ...expenseForm, title: event.target.value })}
                  required
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
                  required
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Incurred date</label>
                <DatePicker
                  value={expenseForm.incurred_date}
                  onChange={(date) => setExpenseForm({ ...expenseForm, incurred_date: date })}
                  placeholder="Pick a date"
                />
              </div>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Notes</label>
              <Textarea
                value={expenseForm.notes}
                onChange={(event) => setExpenseForm({ ...expenseForm, notes: event.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Receipts</label>
              <Input
                type="file"
                accept=".pdf,image/*"
                multiple
                onChange={handleFilesSelected}
                disabled={uploading}
              />
              <div className="mt-2 space-y-2">
                {(expenseForm.receipts || []).map((receipt, index) => (
                  <div key={`${receipt.file_path}-${index}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{receipt.filename || "Receipt"}</p>
                      <p className="truncate text-xs text-muted-foreground">{receipt.file_path}</p>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => removeReceipt(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
                {!(expenseForm.receipts || []).length ? (
                  <p className="text-xs text-muted-foreground">At least one receipt is required.</p>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={resetExpenseForm}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">{editingExpenseId ? "Update expense" : "Create expense"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
