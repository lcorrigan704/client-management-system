import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/date-picker";
import { Progress } from "@/components/ui/progress";
import { gridTwo, fieldClass, labelClass } from "@/ui/formStyles";
import { formatDate } from "@/utils/format";
import { API_URL, api } from "@/api/client";
import FieldCommentsDialog from "@/components/field-comments-dialog";
import { parseISO } from "date-fns";
import { MessageSquare } from "lucide-react";

export default function ProposalsPage({
  proposals,
  clients,
  quotes,
  proposalColumns,
  proposalDialogOpen,
  setProposalDialogOpen,
  proposalForm,
  setProposalForm,
  editingProposalId,
  resetProposalForm,
  handleProposalSubmit,
  handleProposalUpload,
  onBulkDelete,
  onBulkSendReminder,
  onReload,
  currentUserEmail,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [commentDialog, setCommentDialog] = useState({ open: false, fieldKey: "", fieldLabel: "" });
  const [commentCounts, setCommentCounts] = useState({});
  const [prefetchedComments, setPrefetchedComments] = useState({});
  const [initialSnapshot, setInitialSnapshot] = useState(null);

  useEffect(() => {
    if (proposalDialogOpen) {
      setStepIndex(0);
      if (editingProposalId) {
        setInitialSnapshot(normalizeProposal(proposalForm));
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
  }, [proposalDialogOpen, editingProposalId]);

  const safeClients = Array.isArray(clients) ? clients : [];
  const safeQuotes = Array.isArray(quotes) ? quotes : [];
  const clientMap = new Map(safeClients.map((client) => [client.id, client]));
  const quoteMap = new Map(safeQuotes.map((quote) => [quote.id, quote]));
  const currentVersionId = versions.find((version) => version.is_current)?.id;
  const exportColumns = [
    { key: "display_id", header: "Proposal ID" },
    { key: "client", header: "Client" },
    { key: "quote", header: "Quote" },
    { key: "title", header: "Title" },
    { key: "status", header: "Status" },
    { key: "submitted_on", header: "Submitted on" },
    { key: "valid_until", header: "Valid until" },
    { key: "summary", header: "Summary" },
    { key: "approach", header: "Approach" },
    { key: "timeline", header: "Timeline" },
    { key: "content", header: "Content" },
    { key: "requirements", header: "Requirements" },
    { key: "attachments", header: "Attachments" },
  ];
  const requirementColumns = [
    { key: "proposal_display_id", header: "Proposal ID" },
    { key: "description", header: "Requirement" },
  ];
  const exportConfig = {
    label: "Export proposals",
    mode: "zip",
    filenameBase: "proposals",
    parent: {
      columns: exportColumns,
      mapRow: (proposal) => {
        const client = clientMap.get(proposal.client_id);
        const quote = quoteMap.get(proposal.quote_id);
        const requirements = (proposal.requirements || [])
          .map((item) => item.description)
          .join(" ; ");
        const attachments = (proposal.attachments || [])
          .map((item) => item.filename || item.file_path || "")
          .join(" ; ");
        return {
          display_id: proposal.display_id || "",
          client: client?.company || client?.name || "",
          quote: quote?.display_id || quote?.title || "",
          title: proposal.title || "",
          status: proposal.status || "",
          submitted_on: formatDate(proposal.submitted_on),
          valid_until: formatDate(proposal.valid_until),
          summary: proposal.summary || "",
          approach: proposal.approach || "",
          timeline: proposal.timeline || "",
          content: proposal.content || "",
          requirements,
          attachments,
        };
      },
    },
    child: {
      filename: "proposal_requirements.csv",
      columns: requirementColumns,
      mapRows: (parentRows) =>
        parentRows.flatMap((proposal) =>
          (proposal.requirements || []).map((item) => ({
            proposal_display_id: proposal.display_id || "",
            description: item.description || "",
          }))
        ),
    },
    attachments: {
      getItems: (parentRows) =>
        parentRows.flatMap((proposal) =>
          (proposal.attachments || []).map((item) => {
            const filePath = item.file_path || "";
            const url = filePath.startsWith("http")
              ? filePath
              : `${API_URL}/${filePath.replace(/^\//, "")}`;
            return {
              url,
              filename: item.filename || filePath.split("/").pop() || "attachment",
            };
          })
        ),
    },
  };
  const availableQuotes = proposalForm.client_id
    ? safeQuotes.filter((quote) => String(quote.client_id) === String(proposalForm.client_id))
    : safeQuotes;

  const steps = useMemo(
    () => [
      { id: "basics", label: "Basics" },
      { id: "summary", label: "Summary" },
      { id: "requirements", label: "Requirements" },
      { id: "timeline", label: "Timeline & attachments" },
    ],
    []
  );

  const progressValue = ((stepIndex + 1) / steps.length) * 100;

  const canProceed = () => {
    if (stepIndex === 0) {
      return proposalForm.client_id && proposalForm.quote_id && proposalForm.title;
    }
    return true;
  };

  const updateRequirement = (index, value) => {
    const nextItems = proposalForm.requirements.map((item, idx) =>
      idx === index ? { ...item, description: value } : item
    );
    setProposalForm({ ...proposalForm, requirements: nextItems });
  };

  const addRequirement = () => {
    setProposalForm({
      ...proposalForm,
      requirements: [...proposalForm.requirements, { description: "" }],
    });
  };

  const removeRequirement = (index) => {
    const nextItems = proposalForm.requirements.filter((_, idx) => idx !== index);
    setProposalForm({
      ...proposalForm,
      requirements: nextItems.length ? nextItems : [{ description: "" }],
    });
  };

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !handleProposalUpload) return;
    setUploading(true);
    try {
      const response = await handleProposalUpload(files);
      const nextAttachments = [
        ...(proposalForm.attachments || []),
        ...(response?.files || []),
      ];
      setProposalForm({ ...proposalForm, attachments: nextAttachments });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const removeAttachment = (index) => {
    const nextAttachments = proposalForm.attachments.filter((_, idx) => idx !== index);
    setProposalForm({ ...proposalForm, attachments: nextAttachments });
  };

  useEffect(() => {
    if (!proposalDialogOpen || !editingProposalId) return;
    const loadVersions = async () => {
      try {
        const data = await api.listProposalVersions(editingProposalId);
        setVersions(data || []);
      } catch (error) {
        toast.error(error.message || "Unable to load proposal versions.");
      }
    };
    loadVersions();
  }, [proposalDialogOpen, editingProposalId]);

  const loadCommentCounts = async (versionId) => {
    if (!versionId) return;
    try {
      const data = await api.listProposalComments(versionId);
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
    if (!proposalDialogOpen || !currentVersionId) return;
    loadCommentCounts(currentVersionId);
    setPrefetchedComments({});
  }, [proposalDialogOpen, currentVersionId]);

  const prefetchComments = async (fieldKey) => {
    if (!currentVersionId || prefetchedComments[fieldKey]) return;
    try {
      const data = await api.listProposalComments(currentVersionId, fieldKey);
      setPrefetchedComments((prev) => ({ ...prev, [fieldKey]: data || [] }));
    } catch (error) {
      toast.error(error.message || "Unable to prefetch comments.");
    }
  };

  const normalizeProposal = (form) => ({
    client_id: form.client_id || "",
    display_id: (form.display_id || "").trim(),
    quote_id: form.quote_id || "",
    title: (form.title || "").trim(),
    status: form.status || "draft",
    submitted_on: form.submitted_on ? form.submitted_on.toISOString() : null,
    valid_until: form.valid_until ? form.valid_until.toISOString() : null,
    summary: (form.summary || "").trim(),
    approach: (form.approach || "").trim(),
    timeline: (form.timeline || "").trim(),
    content: (form.content || "").trim(),
    requirements: (form.requirements || []).map((item) => ({
      description: (item.description || "").trim(),
    })),
    attachments: (form.attachments || []).map((item) => ({
      filename: item.filename || "",
      file_path: item.file_path || "",
    })),
  });

  const isProposalDirty = () => {
    if (!editingProposalId || !initialSnapshot) return true;
    const current = normalizeProposal(proposalForm);
    return JSON.stringify(current) !== JSON.stringify(initialSnapshot);
  };

  const handleRestoreVersion = async (versionId) => {
    if (!editingProposalId) return;
    try {
      await api.restoreProposalVersion(editingProposalId, versionId);
      toast.success("Proposal version restored.");
      await onReload?.();
      const proposalsList = await api.getProposals();
      const restored = proposalsList?.find((item) => item.id === editingProposalId);
      if (restored) {
        const nextForm = {
          client_id: String(restored.client_id),
          title: restored.title,
          status: restored.status || "draft",
          display_id: restored.display_id || "",
          quote_id: restored.quote_id ? String(restored.quote_id) : "",
          submitted_on: restored.submitted_on ? parseISO(restored.submitted_on) : null,
          valid_until: restored.valid_until ? parseISO(restored.valid_until) : null,
          summary: restored.summary || "",
          approach: restored.approach || "",
          timeline: restored.timeline || "",
          content: restored.content || "",
          current_version: restored.current_version || 1,
          updated_at: restored.updated_at || null,
          updated_by_email: restored.updated_by_email || "",
          requirements:
            restored.requirements?.map((item) => ({
              description: item.description,
            })) || [{ description: "" }],
          attachments: restored.attachments || [],
        };
        setProposalForm(nextForm);
        setInitialSnapshot(normalizeProposal(nextForm));
      }
      const data = await api.listProposalVersions(editingProposalId);
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

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Proposals</h2>
          <p className="text-sm text-muted-foreground">Create proposal drafts and track status.</p>
        </div>
        <Button
          onClick={() => {
            resetProposalForm();
            setProposalDialogOpen(true);
          }}
        >
          New proposal
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={proposalColumns}
            data={proposals}
            emptyMessage="No proposals yet."
            searchKey="title"
            searchPlaceholder="Search proposals..."
            exportConfig={exportConfig}
            enableRowSelection
            bulkActions={[
              {
                label: "Send reminders",
                variant: "outline",
                onClick: (rows) => onBulkSendReminder?.(rows),
                confirm: {
                  title: "Send proposal reminders?",
                  description:
                    "This will send reminder emails for the selected proposals using SMTP.",
                  confirmLabel: "Send reminders",
                },
              },
              {
                label: "Delete selected",
                variant: "destructive",
                onClick: (rows) => onBulkDelete?.(rows),
                confirm: {
                  title: "Delete selected proposals?",
                  description:
                    "This action cannot be undone. The selected proposals will be permanently removed.",
                  confirmLabel: "Delete proposals",
                },
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingProposalId ? "Edit proposal" : "New proposal"}</DialogTitle>
            <DialogDescription>Capture the proposal details, requirements, and attachments.</DialogDescription>
            {editingProposalId ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Current version v{proposalForm.current_version || 1}</span>
                  {editingProposalId && isProposalDirty() ? (
                    <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300">
                      Unsaved changes
                    </Badge>
                  ) : null}
                </div>
                <span>
                  Last updated {formatDate(proposalForm.updated_at)}
                  {proposalForm.updated_by_email ? ` by ${proposalForm.updated_by_email}` : ""}
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
                  {renderLabel("Custom proposal ID (optional)", "display_id")}
                  <Input
                    value={proposalForm.display_id || ""}
                    onChange={(event) =>
                      setProposalForm({ ...proposalForm, display_id: event.target.value })
                    }
                    placeholder="PROP-1001"
                  />
                </div>
                <div className={fieldClass}>
                  {renderLabel("Client", "client_id")}
                  <Select
                    value={proposalForm.client_id}
                    onValueChange={(value) =>
                      setProposalForm({ ...proposalForm, client_id: value, quote_id: "" })
                    }
                    disabled={editingProposalId}
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
                    value={proposalForm.quote_id}
                    onValueChange={(value) => setProposalForm({ ...proposalForm, quote_id: value })}
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
                <div className={gridTwo}>
                  <div className={fieldClass}>
                    {renderLabel("Title", "title")}
                    <Input
                      value={proposalForm.title}
                      onChange={(event) =>
                        setProposalForm({ ...proposalForm, title: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className={fieldClass}>
                    {renderLabel("Status", "status")}
                    <Select
                      value={proposalForm.status}
                      onValueChange={(value) => setProposalForm({ ...proposalForm, status: value })}
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
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={fieldClass}>
                    {renderLabel("Submitted on", "submitted_on")}
                    <DatePicker
                      value={proposalForm.submitted_on}
                      onChange={(value) =>
                        setProposalForm({ ...proposalForm, submitted_on: value })
                      }
                      placeholder="Select date"
                    />
                  </div>
                  <div className={fieldClass}>
                    {renderLabel("Valid until", "valid_until")}
                    <DatePicker
                      value={proposalForm.valid_until}
                      onChange={(value) =>
                        setProposalForm({ ...proposalForm, valid_until: value })
                      }
                      placeholder="Select date"
                    />
                  </div>
                </div>
              </div>
            )}

            {stepIndex === 1 && (
              <div className="space-y-4">
                <div className={fieldClass}>
                  {renderLabel("Summary", "summary")}
                  <Textarea
                    rows={4}
                    value={proposalForm.summary}
                    onChange={(event) =>
                      setProposalForm({ ...proposalForm, summary: event.target.value })
                    }
                  />
                </div>
                <div className={fieldClass}>
                  {renderLabel("Approach", "approach")}
                  <Textarea
                    rows={5}
                    value={proposalForm.approach}
                    onChange={(event) =>
                      setProposalForm({ ...proposalForm, approach: event.target.value })
                    }
                  />
                </div>
              </div>
            )}

            {stepIndex === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {renderLabel("Requirements", "requirements")}
                  <Button type="button" variant="outline" size="sm" onClick={addRequirement}>
                    Add requirement
                  </Button>
                </div>
                <div className="space-y-2">
                  {proposalForm.requirements.map((item, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-[1fr_auto]">
                      <Input
                        placeholder="Requirement description"
                        value={item.description}
                        onChange={(event) => updateRequirement(index, event.target.value)}
                      />
                      <Button type="button" variant="ghost" onClick={() => removeRequirement(index)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stepIndex === 3 && (
              <div className="space-y-4">
                <div className={fieldClass}>
                  {renderLabel("Timeline", "timeline")}
                  <Textarea
                    rows={4}
                    value={proposalForm.timeline}
                    onChange={(event) =>
                      setProposalForm({ ...proposalForm, timeline: event.target.value })
                    }
                  />
                </div>
                <div className={fieldClass}>
                  {renderLabel("Additional notes", "content")}
                  <Textarea
                    rows={4}
                    value={proposalForm.content}
                    onChange={(event) =>
                      setProposalForm({ ...proposalForm, content: event.target.value })
                    }
                  />
                </div>
                <div className={fieldClass}>
                  {renderLabel("Supporting documentation", "attachments")}
                  <Input type="file" accept="image/*" multiple onChange={handleFilesSelected} />
                  {uploading && (
                    <p className="text-xs text-muted-foreground">Uploading…</p>
                  )}
                </div>
                {proposalForm.attachments.length > 0 && (
                  <div className="space-y-2">
                    {proposalForm.attachments.map((item, index) => (
                      <div key={`${item.file_path}-${index}`} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{item.filename}</span>
                        <Button type="button" variant="ghost" onClick={() => removeAttachment(index)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={resetProposalForm}>
                  Cancel
                </Button>
              </DialogClose>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setStepIndex((prev) => Math.max(0, prev - 1));
                  }}
                  disabled={stepIndex === 0}
                >
                  Back
                </Button>
                {stepIndex < steps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
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
                      if (editingProposalId && !isProposalDirty()) {
                        toast.info("No changes to save.");
                        setProposalDialogOpen(false);
                        return;
                      }
                      handleProposalSubmit(event);
                    }}
                    disabled={editingProposalId ? !isProposalDirty() : false}
                  >
                    {editingProposalId ? "Update proposal" : "Create proposal"}
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
            <DialogTitle>Proposal versions</DialogTitle>
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
        entityType="proposal"
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
