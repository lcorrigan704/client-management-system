import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/data-table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/date-picker";
import { useEffect, useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { fieldClass, labelClass } from "@/ui/formStyles";
import { formatDate } from "@/utils/format";

export default function AgreementsPage({
  agreements,
  clients,
  quotes,
  agreementColumns,
  agreementDialogOpen,
  setAgreementDialogOpen,
  agreementForm,
  setAgreementForm,
  editingAgreementId,
  resetAgreementForm,
  handleAgreementSubmit,
  onBulkDelete,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeQuotes = Array.isArray(quotes) ? quotes : [];
  const clientMap = new Map(safeClients.map((client) => [client.id, client]));
  const quoteMap = new Map(safeQuotes.map((quote) => [quote.id, quote]));
  const exportColumns = [
    { key: "display_id", header: "Agreement ID" },
    { key: "client", header: "Client" },
    { key: "quote", header: "Quote" },
    { key: "title", header: "Title" },
    { key: "start_date", header: "Start date" },
    { key: "end_date", header: "End date" },
    { key: "scope_of_services", header: "Scope of services" },
    { key: "duration", header: "Duration" },
    { key: "availability", header: "Availability" },
    { key: "meetings", header: "Meetings" },
    { key: "access_requirements", header: "Access requirements" },
    { key: "fees_payments", header: "Fees & payments" },
    { key: "data_protection", header: "Data protection" },
    { key: "termination", header: "Termination" },
    { key: "sla_items", header: "SLA items" },
    { key: "company_signatory_name", header: "Company signatory" },
    { key: "company_signed_date", header: "Company signed date" },
    { key: "client_signatory_name", header: "Client signatory" },
  ];
  const slaColumns = [
    { key: "agreement_display_id", header: "Agreement ID" },
    { key: "sla", header: "SLA" },
    { key: "timescale", header: "Timescale" },
  ];
  const exportConfig = {
    label: "Export agreements",
    mode: "zip",
    filenameBase: "agreements",
    parent: {
      columns: exportColumns,
      mapRow: (agreement) => {
        const client = clientMap.get(agreement.client_id);
        const quote = quoteMap.get(agreement.quote_id);
        const slaItems = (agreement.sla_items || [])
          .map((item) => `${item.sla} (${item.timescale})`)
          .join(" ; ");
        return {
          display_id: agreement.display_id || "",
          client: client?.company || client?.name || "",
          quote: quote?.display_id || quote?.title || "",
          title: agreement.title || "",
          start_date: formatDate(agreement.start_date),
          end_date: formatDate(agreement.end_date),
          scope_of_services: agreement.scope_of_services || "",
          duration: agreement.duration || "",
          availability: agreement.availability || "",
          meetings: agreement.meetings || "",
          access_requirements: agreement.access_requirements || "",
          fees_payments: agreement.fees_payments || "",
          data_protection: agreement.data_protection || "",
          termination: agreement.termination || "",
          sla_items: slaItems,
          company_signatory_name: agreement.company_signatory_name || "",
          company_signed_date: formatDate(agreement.company_signed_date),
          client_signatory_name: agreement.client_signatory_name || "",
        };
      },
    },
    child: {
      filename: "agreement_sla_items.csv",
      columns: slaColumns,
      mapRows: (parentRows) =>
        parentRows.flatMap((agreement) =>
          (agreement.sla_items || []).map((item) => ({
            agreement_display_id: agreement.display_id || "",
            sla: item.sla || "",
            timescale: item.timescale || "",
          }))
        ),
    },
  };

  useEffect(() => {
    if (agreementDialogOpen) {
      setStepIndex(0);
    }
  }, [agreementDialogOpen, editingAgreementId]);

  const availableQuotes = agreementForm.client_id
    ? safeQuotes.filter((quote) => String(quote.client_id) === String(agreementForm.client_id))
    : safeQuotes;

  const steps = useMemo(
    () => [
      { id: "basics", label: "Basics" },
      { id: "scope", label: "Scope" },
      { id: "sla", label: "SLAs" },
      { id: "terms", label: "Terms" },
      { id: "signatures", label: "Signatures" },
    ],
    []
  );

  const progressValue = ((stepIndex + 1) / steps.length) * 100;

  const canProceed = () => {
    if (stepIndex === 0) {
      return agreementForm.client_id && agreementForm.quote_id && agreementForm.title;
    }
    return true;
  };

  const updateSlaItem = (index, field, value) => {
    const nextItems = agreementForm.sla_items.map((item, idx) =>
      idx === index ? { ...item, [field]: value } : item
    );
    setAgreementForm({ ...agreementForm, sla_items: nextItems });
  };

  const addSlaItem = () => {
    setAgreementForm({
      ...agreementForm,
      sla_items: [...agreementForm.sla_items, { sla: "", timescale: "" }],
    });
  };

  const removeSlaItem = (index) => {
    const nextItems = agreementForm.sla_items.filter((_, idx) => idx !== index);
    setAgreementForm({ ...agreementForm, sla_items: nextItems.length ? nextItems : [{ sla: "", timescale: "" }] });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Agreements</h2>
          <p className="text-sm text-muted-foreground">Capture service agreements linked to client quotes.</p>
        </div>
        <Button
          onClick={() => {
            resetAgreementForm();
            setAgreementDialogOpen(true);
          }}
        >
          New agreement
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">

          <DataTable
            columns={agreementColumns}
            data={agreements}
            emptyMessage="No agreements yet."
            searchKey="title"
            searchPlaceholder="Search agreements..."
            exportConfig={exportConfig}
            enableRowSelection
            bulkActions={[
              {
                label: "Delete selected",
                variant: "destructive",
                onClick: (rows) => onBulkDelete?.(rows),
                confirm: {
                  title: "Delete selected agreements?",
                  description:
                    "This action cannot be undone. The selected agreements will be permanently removed.",
                  confirmLabel: "Delete agreements",
                },
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={agreementDialogOpen} onOpenChange={setAgreementDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingAgreementId ? "Edit agreement" : "New agreement"}</DialogTitle>
            <DialogDescription>Capture the agreement terms, SLA items, and signatures.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              if (stepIndex < steps.length - 1) {
                event.preventDefault();
                return;
              }
              handleAgreementSubmit(event);
            }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>{steps[stepIndex].label}</span>
                <span>
                  Step {stepIndex + 1} of {steps.length}
                </span>
              </div>
              <Progress value={progressValue} />
            </div>

            {stepIndex === 0 && (
              <div className="space-y-4">
                <div className={fieldClass}>
                  <label className={labelClass}>Custom agreement ID (optional)</label>
                  <Input
                    value={agreementForm.display_id || ""}
                    onChange={(event) =>
                      setAgreementForm({ ...agreementForm, display_id: event.target.value })
                    }
                    placeholder="AGR-1001"
                  />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Client</label>
                  <Select
                    value={agreementForm.client_id}
                    onValueChange={(value) =>
                      setAgreementForm({
                        ...agreementForm,
                        client_id: value,
                        quote_id: "",
                      })
                    }
                    disabled={editingAgreementId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {safeClients.length ? (
                        safeClients.map((client) => (
                          <SelectItem key={client.id} value={String(client.id)}>
                            {client.company || client.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-clients" disabled>
                          No clients found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Quote</label>
                  <Select
                    value={agreementForm.quote_id}
                    onValueChange={(value) =>
                      setAgreementForm({ ...agreementForm, quote_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select quote" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableQuotes.length ? (
                        availableQuotes.map((quote) => (
                          <SelectItem key={quote.id} value={String(quote.id)}>
                            {quote.display_id || `Quote ${quote.id}`} · {quote.title}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-quotes" disabled>
                          No quotes found for this client
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Title</label>
                  <Input
                    value={agreementForm.title}
                    onChange={(event) =>
                      setAgreementForm({ ...agreementForm, title: event.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className={fieldClass}>
                    <label className={labelClass}>Start date</label>
                    <DatePicker
                      value={agreementForm.start_date}
                      onChange={(value) =>
                        setAgreementForm({ ...agreementForm, start_date: value })
                      }
                      placeholder="Select start date"
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>End date</label>
                    <DatePicker
                      value={agreementForm.end_date}
                      onChange={(value) =>
                        setAgreementForm({ ...agreementForm, end_date: value })
                      }
                      placeholder="Select end date"
                    />
                  </div>
                </div>
              </div>
            )}

            {stepIndex === 1 && (
              <div className="space-y-4">
                <div className={fieldClass}>
                  <label className={labelClass}>Scope of services</label>
                  <Textarea
                    rows={5}
                    value={agreementForm.scope_of_services}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        scope_of_services: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className={fieldClass}>
                    <label className={labelClass}>Duration</label>
                    <Textarea
                      rows={4}
                      value={agreementForm.duration}
                      onChange={(event) =>
                        setAgreementForm({ ...agreementForm, duration: event.target.value })
                      }
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Availability</label>
                    <Textarea
                      rows={4}
                      value={agreementForm.availability}
                      onChange={(event) =>
                        setAgreementForm({ ...agreementForm, availability: event.target.value })
                      }
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Meetings</label>
                    <Textarea
                      rows={4}
                      value={agreementForm.meetings}
                      onChange={(event) =>
                        setAgreementForm({ ...agreementForm, meetings: event.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {stepIndex === 2 && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className={labelClass}>Service Level Agreements</label>
                    <Button type="button" variant="outline" size="sm" onClick={addSlaItem}>
                      Add SLA
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {agreementForm.sla_items.map((item, index) => (
                      <div key={index} className="grid gap-2 md:grid-cols-[2fr_1fr_auto]">
                        <Input
                          placeholder="SLA"
                          value={item.sla}
                          onChange={(event) => updateSlaItem(index, "sla", event.target.value)}
                        />
                        <Input
                          placeholder="Timescale"
                          value={item.timescale}
                          onChange={(event) => updateSlaItem(index, "timescale", event.target.value)}
                        />
                        <Button type="button" variant="ghost" onClick={() => removeSlaItem(index)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Access requirements</label>
                  <Textarea
                    rows={4}
                    value={agreementForm.access_requirements}
                    onChange={(event) =>
                      setAgreementForm({ ...agreementForm, access_requirements: event.target.value })
                    }
                  />
                </div>
              </div>
            )}

            {stepIndex === 3 && (
              <div className="space-y-4">
                <div className={fieldClass}>
                  <label className={labelClass}>Fees and payments</label>
                  <Textarea
                    rows={4}
                    value={agreementForm.fees_payments}
                    onChange={(event) =>
                      setAgreementForm({ ...agreementForm, fees_payments: event.target.value })
                    }
                  />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Data protection</label>
                  <Textarea
                    rows={4}
                    value={agreementForm.data_protection}
                    onChange={(event) =>
                      setAgreementForm({ ...agreementForm, data_protection: event.target.value })
                    }
                  />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Termination</label>
                  <Textarea
                    rows={4}
                    value={agreementForm.termination}
                    onChange={(event) =>
                      setAgreementForm({ ...agreementForm, termination: event.target.value })
                    }
                  />
                </div>
              </div>
            )}

            {stepIndex === 4 && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={fieldClass}>
                    <label className={labelClass}>Company signatory name</label>
                    <Input
                      value={agreementForm.company_signatory_name}
                      onChange={(event) =>
                        setAgreementForm({
                          ...agreementForm,
                          company_signatory_name: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Company signatory title</label>
                    <Input
                      value={agreementForm.company_signatory_title}
                      onChange={(event) =>
                        setAgreementForm({
                          ...agreementForm,
                          company_signatory_title: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={fieldClass}>
                    <label className={labelClass}>Company signed date</label>
                    <DatePicker
                      value={agreementForm.company_signed_date}
                      onChange={(value) =>
                        setAgreementForm({ ...agreementForm, company_signed_date: value })
                      }
                      placeholder="Select date"
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Client signatory name</label>
                    <Input
                      value={agreementForm.client_signatory_name}
                      onChange={(event) =>
                        setAgreementForm({
                          ...agreementForm,
                          client_signatory_name: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={resetAgreementForm}>
                  Cancel
                </Button>
              </DialogClose>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                  disabled={stepIndex === 0}
                >
                  Back
                </Button>
                {stepIndex < steps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (canProceed()) {
                        setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
                      }
                    }}
                    disabled={!canProceed()}
                  >
                    Next
                  </Button>
                ) : (
                  <Button type="submit">
                    {editingAgreementId ? "Update agreement" : "Create agreement"}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
