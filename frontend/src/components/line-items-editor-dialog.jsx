import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { fieldClass, labelClass } from "@/ui/formStyles";

function toNumber(value) {
  return Number(value || 0);
}

export default function LineItemsEditorDialog({
  title = "Edit line items",
  lineItems = [],
  onChange,
  emptyLineItem,
  showVatControls = false,
}) {
  const [open, setOpen] = useState(false);

  const subtotal = useMemo(
    () =>
      lineItems.reduce(
        (sum, item) => sum + toNumber(item.quantity) * toNumber(item.unit_amount),
        0
      ),
    [lineItems]
  );

  const updateLineItem = (index, patch) => {
    const next = [...lineItems];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeLineItem = (index) => {
    const next = lineItems.filter((_, i) => i !== index);
    onChange(next.length ? next : [{ ...emptyLineItem }]);
  };

  const addLineItem = () => {
    onChange([...lineItems, { ...emptyLineItem }]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full sm:w-auto">
          Edit line items
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
          {lineItems.map((item, index) => {
            const lineTotal = toNumber(item.quantity) * toNumber(item.unit_amount);
            return (
              <div
                key={index}
                className="space-y-3 border-b border-border/70 pb-3 last:border-b-0 last:pb-1"
              >
                <div className="grid gap-2 md:grid-cols-[2.5fr_1fr_1fr_1fr_auto]">
                  <div className={fieldClass}>
                    <label className={labelClass}>Description</label>
                    <Input
                      className="w-full"
                      value={item.description}
                      onChange={(event) =>
                        updateLineItem(index, { description: event.target.value })
                      }
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Qty</label>
                    <Input
                      className="w-full"
                      type="number"
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) =>
                        updateLineItem(index, { quantity: event.target.value })
                      }
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Unit amount</label>
                    <Input
                      className="w-full"
                      type="number"
                      step="0.01"
                      value={item.unit_amount}
                      onChange={(event) =>
                        updateLineItem(index, { unit_amount: event.target.value })
                      }
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Line total</label>
                    <Input className="w-full" value={lineTotal.toFixed(2)} readOnly />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeLineItem(index)}
                      aria-label="Remove line item"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {showVatControls ? (
                  <div className="grid gap-2 md:grid-cols-4">
                    <div className={fieldClass}>
                      <label className={labelClass}>Tax code</label>
                      <Select
                        value={item.tax_code || "standard"}
                        onValueChange={(value) =>
                          updateLineItem(index, { tax_code: value, tax_override: true })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Tax code" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="reduced">Reduced</SelectItem>
                          <SelectItem value="zero">Zero</SelectItem>
                          <SelectItem value="exempt">Exempt</SelectItem>
                          <SelectItem value="out_of_scope">Out of scope</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={fieldClass}>
                      <label className={labelClass}>Tax rate %</label>
                      <Input
                        className="w-full"
                        type="number"
                        step="0.01"
                        value={item.tax_rate ?? 0}
                        onChange={(event) =>
                          updateLineItem(index, {
                            tax_rate: Number(event.target.value || 0),
                            tax_override: true,
                          })
                        }
                      />
                    </div>
                    <div className={fieldClass}>
                      <label className={labelClass}>Tax mode</label>
                      <Select
                        value={item.tax_inclusive ? "inclusive" : "exclusive"}
                        onValueChange={(value) =>
                          updateLineItem(index, {
                            tax_inclusive: value === "inclusive",
                            tax_override: true,
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Tax mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exclusive">Exclusive</SelectItem>
                          <SelectItem value="inclusive">Inclusive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={fieldClass}>
                      <label className={labelClass}>Override</label>
                      <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
                        <Checkbox
                          checked={Boolean(item.tax_override)}
                          onCheckedChange={(value) =>
                            updateLineItem(index, { tax_override: value === true })
                          }
                        />
                        Manual line override
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <DialogFooter className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            {lineItems.length} item{lineItems.length === 1 ? "" : "s"} · Subtotal {subtotal.toFixed(2)}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={addLineItem}>
              Add line item
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
