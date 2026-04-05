import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/api/client";
import { formatDateTime, formatGBP } from "@/utils/format";
import { fieldClass, labelClass } from "@/ui/formStyles";

const FILING_CHECKLIST_ITEMS = [
  { id: "export_data", label: "Export filing bundle" },
  { id: "gather_bank_statements", label: "Gather bank statements" },
  { id: "gather_p60s", label: "Gather P60s / payroll documents" },
  { id: "share_with_accountant", label: "Share pack with accountant / prepare HMRC filing" },
  { id: "submit_filing", label: "Submit filing" },
  { id: "record_reference", label: "Record confirmation/reference" },
];

export default function TaxPage({
  settings,
  updateSettings,
  onSaveSettings,
  selectedYear = "all",
  formatFinancialYearLabel,
}) {
  const [activeTab, setActiveTab] = useState("vat");
  const [vatSummary, setVatSummary] = useState(null);
  const [directSummary, setDirectSummary] = useState(null);
  const [filingPack, setFilingPack] = useState(null);
  const [ratesCatalog, setRatesCatalog] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [checklistSaving, setChecklistSaving] = useState(false);
  const lastErrorToastRef = useRef({ message: "", at: 0 });
  const period = useMemo(
    () => (selectedYear === "all" ? "all" : `fy_${selectedYear}`),
    [selectedYear]
  );
  const isSpecificFinancialYear = selectedYear !== "all";
  const filingChecklistState = settings?.filing_checklist_state || {};
  const activeChecklist = useMemo(() => {
    if (!isSpecificFinancialYear) return {};
    return filingChecklistState[period] || {};
  }, [filingChecklistState, isSpecificFinancialYear, period]);
  const checklistCompletedCount = useMemo(
    () => FILING_CHECKLIST_ITEMS.filter((item) => activeChecklist[item.id] === true).length,
    [activeChecklist]
  );
  const vatEnabled = Boolean(settings?.vat_registered);

  useEffect(() => {
    if (!vatEnabled && activeTab === "vat") {
      setActiveTab("direct");
    }
  }, [activeTab, vatEnabled]);

  const loadTaxData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        api.getVatSummary(period),
        api.getDirectTaxSummary(period),
        api.getFilingPack(period),
        api.getTaxRates(),
      ]);
      const labels = ["VAT summary", "Direct tax summary", "Filing pack", "Tax rates"];
      const firstErrorIndex = results.findIndex((result) => result.status === "rejected");
      if (firstErrorIndex !== -1) {
        const reason = results[firstErrorIndex].reason;
        throw new Error(
          `${labels[firstErrorIndex]} failed: ${
            reason?.message || "Unable to load tax data."
          }`
        );
      }
      setVatSummary(results[0].value);
      setDirectSummary(results[1].value);
      setFilingPack(results[2].value);
      setRatesCatalog(results[3].value);
    } catch (error) {
      const message = error?.message || "Unable to load tax data.";
      const now = Date.now();
      if (
        lastErrorToastRef.current.message !== message ||
        now - lastErrorToastRef.current.at > 1500
      ) {
        toast.error(message);
        lastErrorToastRef.current = { message, at: now };
      }
    }
  }, [period]);

  useEffect(() => {
    loadTaxData();
  }, [loadTaxData]);

  const handleSaveRates = useCallback(async () => {
    if (!ratesCatalog) return;
    try {
      setRatesLoading(true);
      const response = await api.saveTaxRates(ratesCatalog);
      setRatesCatalog(response);
      toast.success("Tax rates saved.");
    } catch (error) {
      toast.error(error.message || "Unable to save tax rates.");
    } finally {
      setRatesLoading(false);
    }
  }, [ratesCatalog]);

  const saveChecklistState = useCallback(
    async (nextChecklistState, errorMessage = "Unable to save checklist.") => {
      const previous = settings?.filing_checklist_state || {};
      updateSettings({ filing_checklist_state: nextChecklistState });
      try {
        setChecklistSaving(true);
        await api.saveSettings({ filing_checklist_state: nextChecklistState });
      } catch (error) {
        updateSettings({ filing_checklist_state: previous });
        toast.error(error?.message || errorMessage);
      } finally {
        setChecklistSaving(false);
      }
    },
    [settings?.filing_checklist_state, updateSettings]
  );

  const toggleChecklistItem = useCallback(
    async (itemId, checked) => {
      if (!isSpecificFinancialYear) return;
      const nextChecklistState = {
        ...(settings?.filing_checklist_state || {}),
        [period]: {
          ...((settings?.filing_checklist_state || {})[period] || {}),
          [itemId]: checked === true,
        },
      };
      await saveChecklistState(nextChecklistState);
    },
    [isSpecificFinancialYear, period, saveChecklistState, settings?.filing_checklist_state]
  );

  const downloadPack = async () => {
    if (!isSpecificFinancialYear) {
      toast.error("Select a specific financial year before exporting.");
      return;
    }
    try {
      const { blob, filename } = await api.downloadFilingPack({ period, format: "zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      const existing = (settings?.filing_checklist_state || {})[period] || {};
      if (!existing.export_data) {
        const nextChecklistState = {
          ...(settings?.filing_checklist_state || {}),
          [period]: {
            ...existing,
            export_data: true,
          },
        };
        await saveChecklistState(nextChecklistState, "Filing bundle exported, but checklist was not saved.");
      }
    } catch (error) {
      toast.error(error.message || "Unable to export filing pack.");
    }
  };

  const vatCodeOptions = useMemo(
    () =>
      (ratesCatalog?.vat_rates || []).map((item) => ({
        value: item.code,
        label: `${item.label} (${Number(item.rate || 0).toFixed(2)}%)`,
      })),
    [ratesCatalog?.vat_rates]
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Tax</h2>
          <p className="text-sm text-muted-foreground">
            UK VAT and direct-tax estimates. Not tax advice.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline">
                Configure tax settings
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Tax configuration</DialogTitle>
                <DialogDescription>
                  Workspace defaults and tax identity details.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                  <div className={fieldClass}>
                    <label className={labelClass}>Business tax mode</label>
                    <Select
                      value={settings?.business_tax_mode || "limited_company"}
                      onValueChange={(value) => updateSettings({ business_tax_mode: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="limited_company">Limited company</SelectItem>
                        <SelectItem value="sole_trader">Sole trader</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>UTR</label>
                    <Input
                      className="w-full"
                      value={settings?.utr || ""}
                      onChange={(event) => updateSettings({ utr: event.target.value })}
                      placeholder="1234567890"
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Company number</label>
                    <Input
                      className="w-full"
                      value={settings?.company_number || ""}
                      onChange={(event) => updateSettings({ company_number: event.target.value })}
                      placeholder="01234567"
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>VAT number</label>
                    <Input
                      className="w-full"
                      value={settings?.vat_number || ""}
                      onChange={(event) => updateSettings({ vat_number: event.target.value })}
                      placeholder="GB123456789"
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>VAT registered</label>
                    <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
                      <Checkbox
                        checked={Boolean(settings?.vat_registered)}
                        onCheckedChange={(value) => updateSettings({ vat_registered: value === true })}
                      />
                      Registered for VAT
                    </label>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Default VAT code</label>
                    <Combobox
                      value={settings?.default_vat_code || "standard"}
                      onValueChange={(value) =>
                        updateSettings({ default_vat_code: value || settings?.default_vat_code || "standard" })
                      }
                      options={vatCodeOptions}
                      placeholder="Select VAT code"
                      searchPlaceholder="Search VAT codes..."
                      emptyLabel="No VAT code found."
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Default VAT rate %</label>
                    <Input
                      className="w-full"
                      type="number"
                      step="0.01"
                      value={settings?.default_vat_rate ?? 20}
                      onChange={(event) => updateSettings({ default_vat_rate: Number(event.target.value || 0) })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Tax policy review notes</label>
                    <Textarea
                      rows={3}
                      value={settings?.tax_policy_review_notes || ""}
                      onChange={(event) => updateSettings({ tax_policy_review_notes: event.target.value })}
                      placeholder="Add assumptions, accountant notes, or annual review outcomes."
                    />
                  </div>
              </div>
              <DialogFooter className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleSaveRates} disabled={ratesLoading}>
                  Save tax rates
                </Button>
                <Button type="button" onClick={onSaveSettings}>
                  Save tax settings
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Badge variant="outline">
            {selectedYear === "all"
              ? "All financial years"
              : formatFinancialYearLabel?.(selectedYear) ||
                `FY ${selectedYear}`}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {vatEnabled ? (
          <Button type="button" variant={activeTab === "vat" ? "default" : "outline"} onClick={() => setActiveTab("vat")}>
            VAT
          </Button>
        ) : null}
        <Button type="button" variant={activeTab === "direct" ? "default" : "outline"} onClick={() => setActiveTab("direct")}>
          Direct Tax
        </Button>
        <Button type="button" variant={activeTab === "filing" ? "default" : "outline"} onClick={() => setActiveTab("filing")}>
          Filing Pack
        </Button>
      </div>

      {vatEnabled && activeTab === "vat" ? (
        <Card>
          <CardHeader>
            <CardTitle>VAT summary</CardTitle>
            <CardDescription>Accrual/cash VAT due estimates by selected period.</CardDescription>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Estimates are guidance only. This app does not replace an accountant, and VAT liabilities
              must be confirmed before filing.
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className={fieldClass}>
              <label className={labelClass}>Output VAT</label>
              <p className="text-2xl font-semibold">{formatGBP(vatSummary?.output_vat)}</p>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Input VAT (reclaimable)</label>
              <p className="text-2xl font-semibold">{formatGBP(vatSummary?.input_vat)}</p>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Net VAT due</label>
              <p className="text-2xl font-semibold">{formatGBP(vatSummary?.net_vat_due)}</p>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Credit note VAT</label>
              <p>{formatGBP(vatSummary?.credit_note_vat)}</p>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Refund VAT</label>
              <p>{formatGBP(vatSummary?.refund_vat)}</p>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Accounting method</label>
              <Badge variant="outline">{String(vatSummary?.accounting_method || "accrual").toUpperCase()}</Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "direct" ? (
        <Card>
          <CardHeader>
            <CardTitle>Direct tax estimate</CardTitle>
            <CardDescription>
              Mode: {settings?.business_tax_mode === "sole_trader" ? "Sole trader" : "Limited company"}.
            </CardDescription>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Figures are planning suggestions only, not final liabilities. Confirm tax with a qualified
              accountant before submitting to HMRC.
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {directSummary?.corporation ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className={fieldClass}>
                  <label className={labelClass}>Estimated profit</label>
                  <p className="text-2xl font-semibold">{formatGBP(directSummary.corporation.estimated_profit)}</p>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Estimated corporation tax</label>
                  <p className="text-2xl font-semibold">{formatGBP(directSummary.corporation.estimated_tax_due)}</p>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Effective rate</label>
                  <p className="text-2xl font-semibold">{Number(directSummary.corporation.rate || 0).toFixed(2)}%</p>
                </div>
              </div>
            ) : null}
            {directSummary?.sole_trader ? (
              <div className="grid gap-4 md:grid-cols-4">
                <div className={fieldClass}>
                  <label className={labelClass}>Estimated profit</label>
                  <p>{formatGBP(directSummary.sole_trader.estimated_profit)}</p>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Estimated income tax</label>
                  <p>{formatGBP(directSummary.sole_trader.estimated_income_tax_due)}</p>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Estimated Class 4 NIC</label>
                  <p>{formatGBP(directSummary.sole_trader.estimated_class4_nic_due)}</p>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Class 2 threshold</label>
                  <p>{formatGBP(directSummary.sole_trader.class2_small_profits_threshold)}</p>
                </div>
              </div>
            ) : null}
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {(directSummary?.assumptions?.warnings || []).join(" ")}
            </div>
            {directSummary?.corporation?.profit_breakdown ? (
              <div className="rounded-md border">
                <div className="grid grid-cols-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>Metric</span>
                  <span className="text-right">Gross</span>
                  <span className="text-right">Net</span>
                </div>
                {[
                  {
                    label: "Invoices in period (by issue date)",
                    gross: directSummary.corporation.profit_breakdown.invoice_gross,
                    net: directSummary.corporation.profit_breakdown.invoice_net,
                  },
                  {
                    label: "Less credit notes",
                    gross: directSummary.corporation.profit_breakdown.credit_note_gross,
                    net: directSummary.corporation.profit_breakdown.credit_note_net,
                  },
                  {
                    label: "Less refunds",
                    gross: directSummary.corporation.profit_breakdown.refund_gross,
                    net: directSummary.corporation.profit_breakdown.refund_net,
                  },
                  {
                    label: "Less expenses",
                    gross: directSummary.corporation.profit_breakdown.expense_gross,
                    net: directSummary.corporation.profit_breakdown.expense_net,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-3 px-3 py-2 text-sm odd:bg-background even:bg-muted/20"
                  >
                    <span>{row.label}</span>
                    <span className="text-right">{formatGBP(row.gross)}</span>
                    <span className="text-right">{formatGBP(row.net)}</span>
                  </div>
                ))}
                <div className="grid grid-cols-3 border-t bg-muted/40 px-3 py-2 text-sm font-semibold">
                  <span>Estimated profit</span>
                  <span className="text-right">
                    {formatGBP(
                      directSummary.corporation.profit_breakdown.estimated_profit_gross
                    )}
                  </span>
                  <span className="text-right">
                    {formatGBP(
                      directSummary.corporation.profit_breakdown.estimated_profit_net
                    )}
                  </span>
                </div>
              </div>
            ) : null}
            {directSummary?.sole_trader?.profit_breakdown ? (
              <div className="rounded-md border">
                <div className="grid grid-cols-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>Metric</span>
                  <span className="text-right">Gross</span>
                  <span className="text-right">Net</span>
                </div>
                {[
                  {
                    label: "Invoices in period (by issue date)",
                    gross: directSummary.sole_trader.profit_breakdown.invoice_gross,
                    net: directSummary.sole_trader.profit_breakdown.invoice_net,
                  },
                  {
                    label: "Less credit notes",
                    gross: directSummary.sole_trader.profit_breakdown.credit_note_gross,
                    net: directSummary.sole_trader.profit_breakdown.credit_note_net,
                  },
                  {
                    label: "Less refunds",
                    gross: directSummary.sole_trader.profit_breakdown.refund_gross,
                    net: directSummary.sole_trader.profit_breakdown.refund_net,
                  },
                  {
                    label: "Less expenses",
                    gross: directSummary.sole_trader.profit_breakdown.expense_gross,
                    net: directSummary.sole_trader.profit_breakdown.expense_net,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-3 px-3 py-2 text-sm odd:bg-background even:bg-muted/20"
                  >
                    <span>{row.label}</span>
                    <span className="text-right">{formatGBP(row.gross)}</span>
                    <span className="text-right">{formatGBP(row.net)}</span>
                  </div>
                ))}
                <div className="grid grid-cols-3 border-t bg-muted/40 px-3 py-2 text-sm font-semibold">
                  <span>Estimated profit</span>
                  <span className="text-right">
                    {formatGBP(
                      directSummary.sole_trader.profit_breakdown.estimated_profit_gross
                    )}
                  </span>
                  <span className="text-right">
                    {formatGBP(
                      directSummary.sole_trader.profit_breakdown.estimated_profit_net
                    )}
                  </span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "filing" ? (
        <Card>
          <CardHeader>
            <CardTitle>Filing pack</CardTitle>
            <CardDescription>Export a structured FY handoff bundle and track filing completion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={downloadPack}
                disabled={!isSpecificFinancialYear}
              >
                Export filing bundle (ZIP)
              </Button>
              {!isSpecificFinancialYear ? (
                <span className="text-xs text-muted-foreground">
                  Select a specific FY in the sidebar to enable export.
                </span>
              ) : null}
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              This app supports admin preparation only. It does not replace accountant advice or guarantee
              final HMRC payable amounts.
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Filing checklist</p>
                <Badge variant="outline">
                  {checklistCompletedCount}/{FILING_CHECKLIST_ITEMS.length} complete
                </Badge>
              </div>
              <div className="space-y-2">
                {FILING_CHECKLIST_ITEMS.map((item) => (
                  <label
                    key={item.id}
                    className="flex min-h-9 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{item.label}</span>
                    <Checkbox
                      checked={activeChecklist[item.id] === true}
                      disabled={!isSpecificFinancialYear || checklistSaving}
                      onCheckedChange={(value) => toggleChecklistItem(item.id, value === true)}
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Generated {formatDateTime(filingPack?.assumptions?.generated_at)} ·{" "}
              {filingPack?.assumptions?.source_label || "HMRC guidance"} ·{" "}
              {filingPack?.assumptions?.version_label || "baseline"}
            </div>
          </CardContent>
        </Card>
      ) : null}

    </section>
  );
}
