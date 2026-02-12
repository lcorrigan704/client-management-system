import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/date-picker";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import FieldCommentsDialog from "@/components/field-comments-dialog";
import { Progress } from "@/components/ui/progress";
import { fieldClass, labelClass } from "@/ui/formStyles";
import { formatDate } from "@/utils/format";
import { parseISO } from "date-fns";
import { MessageSquare } from "lucide-react";

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
  onReload,
  currentUserEmail,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [commentDialog, setCommentDialog] = useState({ open: false, fieldKey: "", fieldLabel: "" });
  const [commentCounts, setCommentCounts] = useState({});
  const [prefetchedComments, setPrefetchedComments] = useState({});
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeQuotes = Array.isArray(quotes) ? quotes : [];
  const clientMap = new Map(safeClients.map((client) => [client.id, client]));
  const quoteMap = new Map(safeQuotes.map((quote) => [quote.id, quote]));
  const currentVersionId = versions.find((version) => version.is_current)?.id;
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
      if (editingAgreementId) {
        setInitialSnapshot(normalizeAgreement(agreementForm));
      } else {
        setInitialSnapshot(null);
      }
    } else {
      setVersions([]);
      setVersionDialogOpen(false);
      setCommentDialog({ open: false, fieldKey: "", fieldLabel: "" });
      setCommentCounts({});
      setPrefetchedComments({});
      setInitialSnapshot(null);
    }
  }, [agreementDialogOpen, editingAgreementId]);

  useEffect(() => {
    if (!agreementDialogOpen || !editingAgreementId) return;
    const loadVersions = async () => {
      try {
        const data = await api.listAgreementVersions(editingAgreementId);
        setVersions(data || []);
      } catch (error) {
        toast.error(error.message || "Unable to load agreement versions.");
      }
    };
    loadVersions();
  }, [agreementDialogOpen, editingAgreementId]);

  const loadCommentCounts = async (versionId) => {
    if (!versionId) return;
    try {
      const data = await api.listAgreementComments(versionId);
      const counts = (data || []).reduce((acc, comment) => {
        const key = comment.field_key || "unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      setCommentCounts(counts);
    } catch (error) {
      toast.error(error.message || "Unable to load comment counts.");
    }
  };

  useEffect(() => {
    if (!agreementDialogOpen || !currentVersionId) return;
    loadCommentCounts(currentVersionId);
    setPrefetchedComments({});
  }, [agreementDialogOpen, currentVersionId]);

  const prefetchComments = async (fieldKey) => {
    if (!currentVersionId || prefetchedComments[fieldKey]) return;
    try {
      const data = await api.listAgreementComments(currentVersionId, fieldKey);
      setPrefetchedComments((prev) => ({ ...prev, [fieldKey]: data || [] }));
    } catch (error) {
      toast.error(error.message || "Unable to prefetch comments.");
    }
  };

  const normalizeAgreement = (form) => ({
    client_id: form.client_id || "",
    display_id: (form.display_id || "").trim(),
    quote_id: form.quote_id || "",
    title: (form.title || "").trim(),
    start_date: form.start_date ? form.start_date.toISOString() : null,
    end_date: form.end_date ? form.end_date.toISOString() : null,
    scope_of_services: (form.scope_of_services || "").trim(),
    duration: (form.duration || "").trim(),
    availability: (form.availability || "").trim(),
    meetings: (form.meetings || "").trim(),
    access_requirements: (form.access_requirements || "").trim(),
    fees_payments: (form.fees_payments || "").trim(),
    data_protection: (form.data_protection || "").trim(),
    termination: (form.termination || "").trim(),
    company_signatory_name: (form.company_signatory_name || "").trim(),
    company_signatory_title: (form.company_signatory_title || "").trim(),
    company_signed_date: form.company_signed_date ? form.company_signed_date.toISOString() : null,
    client_signatory_name: (form.client_signatory_name || "").trim(),
    sla_items: (form.sla_items || []).map((item) => ({
      sla: (item.sla || "").trim(),
      timescale: (item.timescale || "").trim(),
    })),
  });

  const isAgreementDirty = () => {
    if (!editingAgreementId || !initialSnapshot) return true;
    const current = normalizeAgreement(agreementForm);
    return JSON.stringify(current) !== JSON.stringify(initialSnapshot);
  };

  const handleRestoreVersion = async (versionId) => {
    if (!editingAgreementId) return;
    try {
      await api.restoreAgreementVersion(editingAgreementId, versionId);
      toast.success("Agreement version restored.");
      await onReload?.();
      const agreementsList = await api.getAgreements();
      const restored = agreementsList?.find((item) => item.id === editingAgreementId);
      if (restored) {
        const nextForm = {
          client_id: String(restored.client_id),
          display_id: restored.display_id || "",
          quote_id: restored.quote_id ? String(restored.quote_id) : "",
          title: restored.title,
          start_date: restored.start_date ? parseISO(restored.start_date) : null,
          end_date: restored.end_date ? parseISO(restored.end_date) : null,
          current_version: restored.current_version || 1,
          updated_at: restored.updated_at || null,
          updated_by_email: restored.updated_by_email || "",
          scope_of_services: restored.scope_of_services || "",
          duration: restored.duration || "",
          availability: restored.availability || "",
          meetings: restored.meetings || "",
          access_requirements: restored.access_requirements || "",
          fees_payments: restored.fees_payments || "",
          data_protection: restored.data_protection || "",
          termination: restored.termination || "",
          company_signatory_name: restored.company_signatory_name || "",
          company_signatory_title: restored.company_signatory_title || "",
          company_signed_date: restored.company_signed_date
            ? parseISO(restored.company_signed_date)
            : null,
          client_signatory_name: restored.client_signatory_name || "",
          sla_items:
            restored.sla_items?.map((item) => ({
              sla: item.sla,
              timescale: item.timescale,
            })) || [{ sla: "", timescale: "" }],
        };
        setAgreementForm(nextForm);
        setInitialSnapshot(normalizeAgreement(nextForm));
      }
      const data = await api.listAgreementVersions(editingAgreementId);
      setVersions(data || []);
      await loadCommentCounts(data?.find((item) => item.is_current)?.id);
    } catch (error) {
      toast.error(error.message || "Unable to restore version.");
    }
  };

  const renderLabel = (label, fieldKey) => (
    <div className="flex items-center justify-between">
      <label className={labelClass}>{label}</label>
      <div className="inline-flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCommentDialog({ open: true, fieldKey, fieldLabel: label })}
          onMouseEnter={() => prefetchComments(fieldKey)}
          disabled={!currentVersionId}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
        {commentCounts[fieldKey] ? (
          <Badge className="h-5 min-w-5 justify-center px-1.5 text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
            {commentCounts[fieldKey]}
          </Badge>
        ) : null}
      </div>
    </div>
  );

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
            {editingAgreementId ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Current version v{agreementForm.current_version || 1}</span>
                  {editingAgreementId && isAgreementDirty() ? (
                    <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300">
                      Unsaved changes
                    </Badge>
                  ) : null}
                </div>
                <span>
                  Last updated {formatDate(agreementForm.updated_at)}
                  {agreementForm.updated_by_email ? ` by ${agreementForm.updated_by_email}` : ""}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setVersionDialogOpen(true)}
                >
                  Version history
                </Button>
              </div>
            ) : null}
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
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
                  {renderLabel("Custom agreement ID (optional)", "display_id")}
                  <Input
                    value={agreementForm.display_id || ""}
                    onChange={(event) =>
                      setAgreementForm({ ...agreementForm, display_id: event.target.value })
                    }
                    placeholder="AGR-1001"
                  />
                </div>
                <div className={fieldClass}>
                  {renderLabel("Client", "client_id")}
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
                  {renderLabel("Quote", "quote_id")}
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
                  {renderLabel("Title", "title")}
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
                    {renderLabel("Start date", "start_date")}
                    <DatePicker
                      value={agreementForm.start_date}
                      onChange={(value) =>
                        setAgreementForm({ ...agreementForm, start_date: value })
                      }
                      placeholder="Select start date"
                    />
                  </div>
                  <div className={fieldClass}>
                    {renderLabel("End date", "end_date")}
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
                  {renderLabel("Scope of services", "scope_of_services")}
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
                    {renderLabel("Duration", "duration")}
                    <Textarea
                      rows={4}
                      value={agreementForm.duration}
                      onChange={(event) =>
                        setAgreementForm({ ...agreementForm, duration: event.target.value })
                      }
                    />
                  </div>
                  <div className={fieldClass}>
                    {renderLabel("Availability", "availability")}
                    <Textarea
                      rows={4}
                      value={agreementForm.availability}
                      onChange={(event) =>
                        setAgreementForm({ ...agreementForm, availability: event.target.value })
                      }
                    />
                  </div>
                  <div className={fieldClass}>
                    {renderLabel("Meetings", "meetings")}
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
                    {renderLabel("Service Level Agreements", "sla_items")}
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
                  {renderLabel("Access requirements", "access_requirements")}
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
                  {renderLabel("Fees and payments", "fees_payments")}
                  <Textarea
                    rows={4}
                    value={agreementForm.fees_payments}
                    onChange={(event) =>
                      setAgreementForm({ ...agreementForm, fees_payments: event.target.value })
                    }
                  />
                </div>
                <div className={fieldClass}>
                  {renderLabel("Data protection", "data_protection")}
                  <Textarea
                    rows={4}
                    value={agreementForm.data_protection}
                    onChange={(event) =>
                      setAgreementForm({ ...agreementForm, data_protection: event.target.value })
                    }
                  />
                </div>
                <div className={fieldClass}>
                  {renderLabel("Termination", "termination")}
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
                    {renderLabel("Company signatory name", "company_signatory_name")}
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
                    {renderLabel("Company signatory title", "company_signatory_title")}
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
                    {renderLabel("Company signed date", "company_signed_date")}
                    <DatePicker
                      value={agreementForm.company_signed_date}
                      onChange={(value) =>
                        setAgreementForm({ ...agreementForm, company_signed_date: value })
                      }
                      placeholder="Select date"
                    />
                  </div>
                  <div className={fieldClass}>
                    {renderLabel("Client signatory name", "client_signatory_name")}
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
                  <Button
                    type="button"
                    onClick={(event) => {
                      if (editingAgreementId && !isAgreementDirty()) {
                        toast.info("No changes to save.");
                        setAgreementDialogOpen(false);
                        return;
                      }
                      handleAgreementSubmit(event);
                    }}
                    disabled={editingAgreementId ? !isAgreementDirty() : false}
                  >
                    {editingAgreementId ? "Update agreement" : "Create agreement"}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Agreement versions</DialogTitle>
            <DialogDescription>Review or restore previous versions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {versions.length ? (
              versions.map((version) => (
                <div
                  key={version.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      v{version.version_number}
                      {version.is_current ? " · Current" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(version.created_at)}
                      {version.created_by_email ? ` · ${version.created_by_email}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={version.is_current}
                    onClick={() => handleRestoreVersion(version.id)}
                  >
                    Restore
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No versions yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <FieldCommentsDialog
        open={commentDialog.open}
        onOpenChange={(open) => setCommentDialog((prev) => ({ ...prev, open }))}
        entityType="agreement"
        versionId={currentVersionId}
        fieldKey={commentDialog.fieldKey}
        fieldLabel={commentDialog.fieldLabel}
        currentUserEmail={currentUserEmail}
        onCommentsUpdated={() => loadCommentCounts(currentVersionId)}
        initialComments={prefetchedComments[commentDialog.fieldKey]}
      />
    </section>
  );
}
