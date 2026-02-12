import { useEffect, useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/date-picker";
import { Progress } from "@/components/ui/progress";
import { gridTwo, fieldClass, labelClass } from "@/ui/formStyles";
import { formatDate } from "@/utils/format";
import { API_URL } from "@/api/client";

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
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (proposalDialogOpen) {
      setStepIndex(0);
    }
  }, [proposalDialogOpen, editingProposalId]);

  const safeClients = Array.isArray(clients) ? clients : [];
  const safeQuotes = Array.isArray(quotes) ? quotes : [];
  const clientMap = new Map(safeClients.map((client) => [client.id, client]));
  const quoteMap = new Map(safeQuotes.map((quote) => [quote.id, quote]));
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
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              if (stepIndex < steps.length - 1) {
                event.preventDefault();
                return;
              }
              handleProposalSubmit(event);
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
                  <label className={labelClass}>Custom proposal ID (optional)</label>
                  <Input
                    value={proposalForm.display_id || ""}
                    onChange={(event) =>
                      setProposalForm({ ...proposalForm, display_id: event.target.value })
                    }
                    placeholder="PROP-1001"
                  />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Client</label>
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
                  <label className={labelClass}>Quote</label>
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
                    <label className={labelClass}>Title</label>
                    <Input
                      value={proposalForm.title}
                      onChange={(event) =>
                        setProposalForm({ ...proposalForm, title: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Status</label>
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
                    <label className={labelClass}>Submitted on</label>
                    <DatePicker
                      value={proposalForm.submitted_on}
                      onChange={(value) =>
                        setProposalForm({ ...proposalForm, submitted_on: value })
                      }
                      placeholder="Select date"
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Valid until</label>
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
                  <label className={labelClass}>Summary</label>
                  <Textarea
                    rows={4}
                    value={proposalForm.summary}
                    onChange={(event) =>
                      setProposalForm({ ...proposalForm, summary: event.target.value })
                    }
                  />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Approach</label>
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
                  <label className={labelClass}>Requirements</label>
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
                  <label className={labelClass}>Timeline</label>
                  <Textarea
                    rows={4}
                    value={proposalForm.timeline}
                    onChange={(event) =>
                      setProposalForm({ ...proposalForm, timeline: event.target.value })
                    }
                  />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Additional notes</label>
                  <Textarea
                    rows={4}
                    value={proposalForm.content}
                    onChange={(event) =>
                      setProposalForm({ ...proposalForm, content: event.target.value })
                    }
                  />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Supporting documentation</label>
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
                  <Button type="submit">
                    {editingProposalId ? "Update proposal" : "Create proposal"}
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
