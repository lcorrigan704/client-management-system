import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { api } from "@/api/client";
import { formatDateTime } from "@/utils/format";
import { toast } from "sonner";
import { gridTwo, fieldClass, labelClass } from "@/ui/formStyles";

const PRESET_STORAGE_KEY = "email_compose_presets_v2";
const DEFAULT_PRESETS = [
  {
    name: "Monthly billing pack",
    entity_types: ["invoice", "agreement"],
    include_proposal_assets: true,
  },
  {
    name: "Proposal follow-up",
    entity_types: ["proposal"],
    include_proposal_assets: true,
  },
];

const ENTITY_TYPES = [
  { value: "invoice", label: "Invoice" },
  { value: "quote", label: "Quote" },
  { value: "proposal", label: "Proposal" },
  { value: "agreement", label: "Agreement" },
  { value: "expense", label: "Expense" },
];

function formatStatus(value) {
  if (!value) return "";
  return String(value)
    .trim()
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function readSavedPresets() {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.name && Array.isArray(item?.entity_types));
  } catch {
    return [];
  }
}

function savePresets(presets) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

export default function EmailsPage({
  emailResponse,
  setEmailResponse,
  emailDialogOpen,
  setEmailDialogOpen,
  emailForm,
  setEmailForm,
  handleEmailDraftSubmit,
  submitCompose,
  sendGroupViaSmtp,
  composeState,
  handleCopyEmail,
  buildMailto,
  clients,
  composeEntities,
}) {
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTypes, setFilterTypes] = useState(() => ENTITY_TYPES.map((item) => item.value));
  const [presetName, setPresetName] = useState("");
  const [savedPresets, setSavedPresets] = useState(() => readSavedPresets());
  const [sendAllDialogOpen, setSendAllDialogOpen] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logActionState, setLogActionState] = useState({ action: null, logId: null });

  const allPresets = useMemo(() => [...DEFAULT_PRESETS, ...savedPresets], [savedPresets]);

  const visibleEntities = useMemo(() => {
    return composeEntities
      .filter((item) => (filterClient ? String(item.client_id || "") === String(filterClient) : true))
      .filter((item) => (filterStatus ? String(item.status || "").toLowerCase() === filterStatus : true))
      .filter((item) => filterTypes.includes(item.entity_type))
      .filter((item) => {
        if (!search.trim()) return true;
        const haystack = `${item.label} ${item.client_label} ${item.status || ""}`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      });
  }, [composeEntities, filterClient, filterStatus, filterTypes, search]);

  const selectedKeySet = useMemo(
    () =>
      new Set(
        (emailForm.selected_items || []).map((item) => `${item.entity_type}:${String(item.entity_id)}`)
      ),
    [emailForm.selected_items]
  );

  const selectedEntities = useMemo(
    () =>
      composeEntities.filter((item) =>
        selectedKeySet.has(`${item.entity_type}:${String(item.entity_id)}`)
      ),
    [composeEntities, selectedKeySet]
  );

  const uniqueStatuses = useMemo(() => {
    const values = new Set();
    composeEntities.forEach((item) => {
      if (item.status) values.add(String(item.status).toLowerCase());
    });
    return Array.from(values).sort();
  }, [composeEntities]);

  const allVisibleSelected =
    visibleEntities.length > 0 &&
    visibleEntities.every((item) =>
      selectedKeySet.has(`${item.entity_type}:${String(item.entity_id)}`)
    );

  const toggleSelectedEntity = (entity, checked) => {
    const key = `${entity.entity_type}:${String(entity.entity_id)}`;
    const next = checked
      ? [
          ...(emailForm.selected_items || []),
          { entity_type: entity.entity_type, entity_id: entity.entity_id },
        ]
      : (emailForm.selected_items || []).filter(
          (item) => `${item.entity_type}:${String(item.entity_id)}` !== key
        );
    setEmailForm({ ...emailForm, selected_items: next });
  };

  const toggleAllVisible = (checked) => {
    if (!checked) {
      const visibleKeys = new Set(
        visibleEntities.map((item) => `${item.entity_type}:${String(item.entity_id)}`)
      );
      const next = (emailForm.selected_items || []).filter(
        (item) => !visibleKeys.has(`${item.entity_type}:${String(item.entity_id)}`)
      );
      setEmailForm({ ...emailForm, selected_items: next });
      return;
    }
    const dedupe = new Map(
      (emailForm.selected_items || []).map((item) => [
        `${item.entity_type}:${String(item.entity_id)}`,
        item,
      ])
    );
    visibleEntities.forEach((item) => {
      dedupe.set(`${item.entity_type}:${String(item.entity_id)}`, {
        entity_type: item.entity_type,
        entity_id: item.entity_id,
      });
    });
    setEmailForm({ ...emailForm, selected_items: Array.from(dedupe.values()) });
  };

  const applyPreset = (presetNameValue) => {
    const preset = allPresets.find((item) => item.name === presetNameValue);
    if (!preset) return;
    setFilterTypes(preset.entity_types);
    setEmailForm({
      ...emailForm,
      include_proposal_assets: preset.include_proposal_assets !== false,
    });
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const next = [
      ...savedPresets.filter((item) => item.name !== name),
      {
        name,
        entity_types: filterTypes,
        include_proposal_assets: emailForm.include_proposal_assets !== false,
      },
    ];
    setSavedPresets(next);
    savePresets(next);
    setPresetName("");
  };

  const updateGroupField = (group, field, value) => {
    const mapKey = group.group_id;
    const overridesKey =
      field === "to_email"
        ? "to_email_overrides"
        : field === "subject"
          ? "subject_overrides"
          : "body_overrides";
    setEmailForm({
      ...emailForm,
      [overridesKey]: {
        ...(emailForm[overridesKey] || {}),
        [mapKey]: value,
      },
    });
    if (!emailResponse) return;
    setEmailResponse({
      ...emailResponse,
      groups: (emailResponse.groups || []).map((item) =>
        item.group_id === group.group_id ? { ...item, [field]: value } : item
      ),
    });
  };

  const downloadAttachment = (attachment) => {
    if (!attachment?.content_base64) return;
    const bytes = atob(attachment.content_base64);
    const buffer = Uint8Array.from(bytes, (char) => char.charCodeAt(0));
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.filename || "attachment";
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadGroupAttachments = (group) => {
    (group.attachments || []).forEach(downloadAttachment);
  };

  const downloadAllAttachments = () => {
    (emailResponse?.groups || []).forEach((group) => downloadGroupAttachments(group));
  };

  const handleOpenMailClient = (group) => {
    downloadGroupAttachments(group);
    setTimeout(() => {
      window.location.href = buildMailto(group);
    }, 250);
  };

  const hasGroups = Boolean(emailResponse?.groups?.length);
  const isSubmitting = Boolean(composeState?.isSubmitting);
  const isGenerating = isSubmitting && composeState?.action === "generate";
  const isSending = isSubmitting && composeState?.action === "send";
  const isLogActionRunning = Boolean(logActionState.action);

  const getStatusVariant = useCallback((status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "failed") return "destructive";
    if (normalized === "delivered") return "secondary";
    if (normalized === "sent") return "outline";
    return "outline";
  }, []);

  const loadEmailLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const data = await api.listEmailLogs();
      setEmailLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.message || "Unable to load email logs.");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmailLogs();
  }, [loadEmailLogs]);

  useEffect(() => {
    if (!emailResponse?.summary) return;
    if ((emailResponse.summary.sent_groups || 0) > 0 || (emailResponse.summary.failed_groups || 0) > 0) {
      loadEmailLogs();
    }
  }, [emailResponse, loadEmailLogs]);

  const handleResendLog = useCallback(async (logId) => {
    try {
      setLogActionState({ action: "resend", logId });
      await api.resendEmailLog(logId);
      toast.success("Email resend attempted.");
      await loadEmailLogs();
    } catch (error) {
      toast.error(error.message || "Unable to resend email.");
    } finally {
      setLogActionState({ action: null, logId: null });
    }
  }, [loadEmailLogs]);

  const handleMarkDelivered = useCallback(async (logId) => {
    try {
      setLogActionState({ action: "delivered", logId });
      await api.markEmailLogDelivered(logId);
      toast.success("Email marked as delivered.");
      await loadEmailLogs();
    } catch (error) {
      toast.error(error.message || "Unable to mark email as delivered.");
    } finally {
      setLogActionState({ action: null, logId: null });
    }
  }, [loadEmailLogs]);

  const emailLogColumns = useMemo(
    () => [
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
      {
        accessorKey: "client_label",
        header: "Client",
      },
      {
        accessorKey: "to_email",
        header: "Recipient",
        cell: ({ row }) => row.original.to_email || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={getStatusVariant(row.original.status)}>
            {formatStatus(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "attachment_count",
        header: "Attachments",
      },
      {
        accessorKey: "sent_at",
        header: "Sent",
        cell: ({ row }) => formatDateTime(row.original.sent_at),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const log = row.original;
          const isThisResending =
            logActionState.action === "resend" && logActionState.logId === log.id;
          const isThisDelivering =
            logActionState.action === "delivered" && logActionState.logId === log.id;
          const normalizedStatus = String(log.status || "").toLowerCase();
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" variant="ghost" aria-label={`Actions for log ${log.id}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={isLogActionRunning}
                  onClick={() => handleResendLog(log.id)}
                >
                  {isThisResending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Resend
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isLogActionRunning || normalizedStatus === "delivered"}
                  onClick={() => handleMarkDelivered(log.id)}
                >
                  {isThisDelivering ? <Loader2 className="size-4 animate-spin" /> : null}
                  Mark delivered
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [getStatusVariant, handleMarkDelivered, handleResendLog, isLogActionRunning, logActionState]
  );

  const emailLogBulkActions = useMemo(
    () => [
      {
        label: "Resend selected",
        onClick: async (rows) => {
          const ids = rows.map((row) => row.id);
          if (!ids.length) return;
          setLogActionState({ action: "bulk-resend", logId: null });
          try {
            await api.resendEmailLogsBulk(ids);
            toast.success(`Resend attempted for ${ids.length} log${ids.length === 1 ? "" : "s"}.`);
            await loadEmailLogs();
          } catch (error) {
            toast.error(error.message || "Unable to resend selected logs.");
          } finally {
            setLogActionState({ action: null, logId: null });
          }
        },
        confirm: {
          title: "Resend selected emails",
          description: "This will trigger SMTP resend attempts for the selected logs.",
          confirmLabel: "Resend selected",
        },
        disabled: isLogActionRunning,
      },
      {
        label: "Mark selected delivered",
        onClick: async (rows) => {
          const ids = rows.map((row) => row.id);
          if (!ids.length) return;
          setLogActionState({ action: "bulk-delivered", logId: null });
          try {
            await api.markEmailLogsDeliveredBulk(ids);
            toast.success(`Marked ${ids.length} log${ids.length === 1 ? "" : "s"} as delivered.`);
            await loadEmailLogs();
          } catch (error) {
            toast.error(error.message || "Unable to mark selected logs as delivered.");
          } finally {
            setLogActionState({ action: null, logId: null });
          }
        },
        confirm: {
          title: "Mark selected as delivered",
          description: "Use this when you have confirmation from your email provider.",
          confirmLabel: "Mark delivered",
        },
        disabled: isLogActionRunning,
      },
    ],
    [isLogActionRunning, loadEmailLogs]
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Emails</h2>
          <p className="text-sm text-muted-foreground">
            Multi-entity composer grouped by client.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasGroups ? (
            <>
              <Button type="button" variant="outline" onClick={downloadAllAttachments}>
                Download all attachments
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => setSendAllDialogOpen(true)}
              >
                {isSending && !composeState?.groupId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Send all via SMTP
              </Button>
            </>
          ) : null}
          <Button type="button" disabled={isSubmitting} onClick={() => setEmailDialogOpen(true)}>
            Compose email
          </Button>
        </div>
      </div>
      {isSubmitting ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>
            {isGenerating
              ? "Generating drafts..."
              : composeState?.groupId
                ? "Sending selected draft via SMTP..."
                : "Sending drafts via SMTP..."}
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Draft groups</CardTitle>
          <CardDescription>One draft per client group. Edit before sending.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasGroups ? (
            <p className="text-sm text-muted-foreground">No drafts generated yet.</p>
          ) : (
            (emailResponse.groups || []).map((group) => (
              <div key={group.group_id} className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{group.client_label}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.entities.length} item{group.entities.length === 1 ? "" : "s"} ·{" "}
                      {group.attachments.length} attachment{group.attachments.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="icon" variant="ghost" aria-label={`Actions for ${group.client_label}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleCopyEmail(group.body)}>
                        Copy body
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopyEmail(`Subject: ${group.subject}\n\n${group.body}`)}>
                        Copy subject + body
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenMailClient(group)}>
                        Open mail client
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadGroupAttachments(group)}>
                        Download attachments
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={isSubmitting || !(group.to_email || group.to_email_default)}
                        onClick={() => sendGroupViaSmtp(group)}
                      >
                        {isSending && composeState?.groupId === group.group_id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        Send via SMTP
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className={gridTwo}>
                  <div className={fieldClass}>
                    <label className={labelClass}>To</label>
                    <Input
                      type="email"
                      value={group.to_email || ""}
                      placeholder={group.to_email_default || "No default recipient"}
                      onChange={(event) => updateGroupField(group, "to_email", event.target.value)}
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Subject</label>
                    <Input
                      value={group.subject || ""}
                      onChange={(event) => updateGroupField(group, "subject", event.target.value)}
                    />
                  </div>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Body</label>
                  <Textarea
                    rows={8}
                    value={group.body || ""}
                    onChange={(event) => updateGroupField(group, "body", event.target.value)}
                  />
                </div>
                {group.warnings?.length ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {group.warnings.map((item, idx) => (
                      <p key={`${group.group_id}-warning-${idx}`}>{item}</p>
                    ))}
                  </div>
                ) : null}
                {group.send_result ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={group.send_result.sent ? "secondary" : "destructive"}>
                      {group.send_result.sent ? "Sent" : "Failed"}
                    </Badge>
                    <span>{group.send_result.message}</span>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email audit log</CardTitle>
          <CardDescription>Track sends, failures, delivery updates, and resend actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={logsLoading || isLogActionRunning}
              onClick={loadEmailLogs}
            >
              {logsLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              Refresh logs
            </Button>
          </div>
          <DataTable
            columns={emailLogColumns}
            data={emailLogs}
            emptyMessage={logsLoading ? "Loading email logs..." : "No email logs yet."}
            searchKey="client_label"
            searchPlaceholder="Search logs by client..."
            enableRowSelection
            bulkActions={emailLogBulkActions}
          />
        </CardContent>
      </Card>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Compose multi-entity email</DialogTitle>
            <DialogDescription>
              Select records, generate grouped drafts, then edit and send.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleEmailDraftSubmit}>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3 rounded-xl border p-3">
                <p className="text-sm font-semibold text-foreground">Filters</p>
                <div className={fieldClass}>
                  <label className={labelClass}>Client</label>
                  <Select
                    value={filterClient || "all"}
                    onValueChange={(value) => setFilterClient(value === "all" ? "" : value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All clients</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={String(client.id)}>
                          {client.company || client.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Status</label>
                  <Select
                    value={filterStatus || "all"}
                    onValueChange={(value) => setFilterStatus(value === "all" ? "" : value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {uniqueStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {formatStatus(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Search</label>
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Entity types</label>
                  {ENTITY_TYPES.map((item) => (
                    <label key={item.value} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={filterTypes.includes(item.value)}
                        onCheckedChange={(value) => {
                          const checked = value === true;
                          const next = checked
                            ? Array.from(new Set([...filterTypes, item.value]))
                            : filterTypes.filter((value) => value !== item.value);
                          setFilterTypes(next.length ? next : [item.value]);
                        }}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Presets</label>
                  <Select
                    onValueChange={(value) => {
                      if (value === "none") return;
                      applyPreset(value);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Apply preset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Apply preset</SelectItem>
                      {allPresets.map((preset) => (
                        <SelectItem key={preset.name} value={preset.name}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Preset name"
                      value={presetName}
                      onChange={(event) => setPresetName(event.target.value)}
                    />
                    <Button type="button" variant="outline" onClick={handleSavePreset}>
                      Save
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border p-3 lg:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Entity picker</p>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(value) => toggleAllVisible(value === true)}
                    />
                    Select all visible ({visibleEntities.length})
                  </label>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {visibleEntities.map((item) => {
                    const key = `${item.entity_type}:${String(item.entity_id)}`;
                    return (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-sm hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={selectedKeySet.has(key)}
                          onCheckedChange={(value) => toggleSelectedEntity(item, value === true)}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-foreground">{item.label}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="truncate text-muted-foreground">{item.client_label}</span>
                            <Badge variant="outline">{formatStatus(item.entity_type)}</Badge>
                            {item.status ? (
                              <Badge variant="secondary">{formatStatus(item.status)}</Badge>
                            ) : null}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                  {!visibleEntities.length ? (
                    <p className="text-xs text-muted-foreground">No entities match your filters.</p>
                  ) : null}
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {selectedEntities.length} selected · grouped automatically by client at draft time
                </div>
                <div className="space-y-2">
                  <p className={labelClass}>Options</p>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={emailForm.include_proposal_assets !== false}
                      onCheckedChange={(value) =>
                        setEmailForm({ ...emailForm, include_proposal_assets: value === true })
                      }
                    />
                    Include proposal uploaded assets
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={emailForm.send}
                      onCheckedChange={(value) =>
                        setEmailForm({ ...emailForm, send: value === true })
                      }
                    />
                    Send via SMTP after draft generation
                  </label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={!selectedEntities.length || isSubmitting}>
                {isGenerating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating drafts...
                  </>
                ) : emailForm.send ? (
                  "Generate + send"
                ) : (
                  "Generate drafts"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={sendAllDialogOpen} onOpenChange={setSendAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm send all via SMTP</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to send one email per draft group.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
            {(emailResponse?.groups || []).map((group) => {
              const recipient = group.to_email || group.to_email_default || "No recipient set";
              const hasRecipient = Boolean(group.to_email || group.to_email_default);
              return (
                <div key={`send-all-preview-${group.group_id}`} className="rounded-md border p-2">
                  <p className="text-sm font-medium text-foreground">{group.client_label}</p>
                  <p className="text-xs text-muted-foreground">
                    To: {recipient}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <Badge variant={hasRecipient ? "secondary" : "destructive"}>
                      {hasRecipient ? "Ready" : "Missing recipient"}
                    </Badge>
                    <span className="text-muted-foreground">
                      {group.entities?.length || 0} item{(group.entities?.length || 0) === 1 ? "" : "s"} ·{" "}
                      {group.attachments?.length || 0} attachment{(group.attachments?.length || 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={async () => {
                await submitCompose(true);
                setSendAllDialogOpen(false);
              }}
            >
              {isSending && !composeState?.groupId ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Confirm send all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
