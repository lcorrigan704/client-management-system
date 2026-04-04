import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ReceiptsEditorDialog({
  receipts = [],
  onChange,
  onUpload,
  uploading = false,
}) {
  const [open, setOpen] = useState(false);

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !onUpload) return;
    const uploaded = await onUpload(files);
    if (uploaded?.length) {
      onChange([...(receipts || []), ...uploaded]);
    }
    event.target.value = "";
  };

  const removeReceipt = (index) => {
    const next = receipts.filter((_, idx) => idx !== index);
    onChange(next);
  };

  const receiptCount = useMemo(() => receipts.length, [receipts.length]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full sm:w-auto">
          Edit receipts
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit receipts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="file"
            accept=".pdf,image/*"
            multiple
            onChange={handleFilesSelected}
            disabled={uploading}
            className="w-full"
          />
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {(receipts || []).map((receipt, index) => (
              <div
                key={`${receipt.file_path}-${index}`}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{receipt.filename || "Receipt"}</p>
                  <p className="truncate text-xs text-muted-foreground">{receipt.file_path}</p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => removeReceipt(index)}
                  aria-label="Remove receipt"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {!(receipts || []).length ? (
              <p className="text-sm text-muted-foreground">No receipts added yet.</p>
            ) : null}
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {receiptCount} receipt{receiptCount === 1 ? "" : "s"}
          </p>
          <Button type="button" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
