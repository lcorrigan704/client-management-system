import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ArrowUp, ArrowDown } from "lucide-react";
import { api } from "@/api/client";
import { formatDateTime } from "@/utils/format";

const entityApi = {
  agreement: {
    list: api.listAgreementComments,
    listAll: api.listAgreementCommentsAll,
    add: api.addAgreementComment,
    react: api.reactAgreementComment,
    updateStatus: api.updateAgreementCommentStatus,
    remove: api.deleteAgreementComment,
  },
  proposal: {
    list: api.listProposalComments,
    listAll: api.listProposalCommentsAll,
    add: api.addProposalComment,
    react: api.reactProposalComment,
    updateStatus: api.updateProposalCommentStatus,
    remove: api.deleteProposalComment,
  },
};

export default function FieldCommentsDialog({
  open,
  onOpenChange,
  entityType,
  versionId,
  fieldKey,
  fieldLabel,
  currentUserEmail,
  onCommentsUpdated,
  initialComments,
}) {
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedMentions, setSelectedMentions] = useState([]);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(null);
  const [mentionUsers, setMentionUsers] = useState([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [usedInitialComments, setUsedInitialComments] = useState(false);
  const textareaRef = useRef(null);
  const apiClient = useMemo(() => entityApi[entityType], [entityType]);

  const loadComments = useCallback(async () => {
    if (!apiClient || !versionId || !fieldKey) return;
    try {
      const data = showAllVersions
        ? await apiClient.listAll(versionId, fieldKey)
        : await apiClient.list(versionId, fieldKey);
      setComments(data || []);
    } catch (error) {
      toast.error(error.message || "Unable to load comments.");
    }
  }, [apiClient, fieldKey, showAllVersions, versionId]);

  useEffect(() => {
    if (open) {
      if (!showAllVersions && Array.isArray(initialComments) && !usedInitialComments) {
        setComments(initialComments);
        setUsedInitialComments(true);
      } else {
        loadComments();
      }
    } else {
      setComments([]);
      setMessage("");
      setSelectedMentions([]);
      setShowAllVersions(false);
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
      setMentionUsers([]);
      setUsedInitialComments(false);
    }
  }, [open, loadComments, showAllVersions, initialComments, usedInitialComments]);

  useEffect(() => {
    if (!open) return;
    if (showAllVersions || usedInitialComments) {
      loadComments();
    }
  }, [open, showAllVersions, fieldKey, versionId, usedInitialComments, loadComments]);

  const extractMentions = (value) =>
    selectedMentions.filter((mention) => value.includes(mention));

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) return;
    try {
      await apiClient.add(versionId, {
        field_key: fieldKey,
        comment: message.trim(),
        mentions: extractMentions(message),
      });
      setMessage("");
      setSelectedMentions([]);
      await loadComments();
      onCommentsUpdated?.();
    } catch (error) {
      toast.error(error.message || "Unable to add comment.");
    }
  }, [apiClient, fieldKey, loadComments, message, onCommentsUpdated, versionId]);

  const handleReaction = useCallback(
    async (commentId, reaction) => {
      try {
        await apiClient.react(commentId, { reaction });
        await loadComments();
        onCommentsUpdated?.();
      } catch (error) {
        toast.error(error.message || "Unable to update reaction.");
      }
    },
    [apiClient, loadComments, onCommentsUpdated]
  );

  useEffect(() => {
    if (!mentionOpen) {
      setMentionUsers([]);
      return;
    }
    let active = true;
    setMentionLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const trimmed = mentionQuery.trim();
        const data = trimmed
          ? await api.searchUsers(trimmed)
          : await api.listAssignableUsers();
        if (active) {
          setMentionUsers(data || []);
        }
      } catch (error) {
        if (active) {
          toast.error(error.message || "Unable to search users.");
        }
      } finally {
        if (active) {
          setMentionLoading(false);
        }
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [mentionOpen, mentionQuery]);

  const handleMessageChange = (event) => {
    const value = event.target.value;
    setMessage(value);
    const cursor = event.target.selectionStart ?? value.length;
    const lastAt = value.lastIndexOf("@", cursor - 1);
    if (lastAt === -1) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
      return;
    }
    const before = lastAt > 0 ? value[lastAt - 1] : " ";
    if (!/\s/.test(before)) {
      setMentionOpen(false);
      return;
    }
    const query = value.slice(lastAt + 1, cursor);
    if (/\s/.test(query)) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
      return;
    }
    setMentionStart(lastAt);
    setMentionQuery(query);
    setMentionOpen(true);
  };

  const handleMentionSelect = (user) => {
    if (mentionStart === null) return;
    const cursor = textareaRef.current?.selectionStart ?? message.length;
    const before = message.slice(0, mentionStart);
    const after = message.slice(cursor);
    const insert = `${user.email} `;
    const nextValue = `${before}${insert}${after}`;
    setMessage(nextValue);
    setSelectedMentions((prev) =>
      prev.includes(user.email) ? prev : [...prev, user.email]
    );
    setMentionOpen(false);
    setMentionQuery("");
    setMentionStart(null);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const nextPos = before.length + insert.length;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
        textareaRef.current.focus();
      }
    });
  };

  const handleStatusUpdate = useCallback(
    async (commentId, implemented) => {
      try {
        await apiClient.updateStatus(commentId, { implemented });
        await loadComments();
        onCommentsUpdated?.();
      } catch (error) {
        toast.error(error.message || "Unable to update comment status.");
      }
    },
    [apiClient, loadComments, onCommentsUpdated]
  );

  const handleDelete = useCallback(
    async (commentId) => {
      try {
        await apiClient.remove(commentId);
        await loadComments();
        onCommentsUpdated?.();
      } catch (error) {
        toast.error(error.message || "Unable to delete comment.");
      }
    },
    [apiClient, loadComments, onCommentsUpdated]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Comments · {fieldLabel}</DialogTitle>
          <DialogDescription>
            Field-level comments for version {versionId || "—"}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
          <span className="text-muted-foreground">Show all versions</span>
          <Switch checked={showAllVersions} onCheckedChange={setShowAllVersions} />
        </div>
        <div className="space-y-3">
          {comments.length ? (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{comment.created_by_email || "Unknown"}</span>
                  <span>{formatDateTime(comment.created_at)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {comment.version_number ? (
                    <Badge variant={comment.is_current ? "default" : "outline"}>
                      v{comment.version_number}
                    </Badge>
                  ) : null}
                  {showAllVersions && comment.is_current ? (
                    <Badge variant="secondary">Current version</Badge>
                  ) : null}
                  {comment.implemented ? (
                    <Badge variant="secondary">Implemented</Badge>
                  ) : (
                    <Badge variant="outline">Not implemented</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                  {comment.mentions?.length
                    ? comment.comment
                        .split(
                          new RegExp(
                            `(${comment.mentions
                              .map((mention) =>
                                mention.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                              )
                              .join("|")})`
                          )
                        )
                        .map((part, index) =>
                          comment.mentions?.includes(part) ? (
                            <span
                              key={`${comment.id}-mention-${index}`}
                              className="rounded bg-sky-500/15 px-1 text-sky-700 dark:text-sky-300"
                            >
                              {part}
                            </span>
                          ) : (
                            <span key={`${comment.id}-text-${index}`}>{part}</span>
                          )
                        )
                    : comment.comment}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-1.5 py-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleReaction(comment.id, "like")}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <span
                      className={`text-[11px] font-semibold ${
                        (comment.like_count || 0) - (comment.dislike_count || 0) >= 0
                          ? "text-emerald-600 dark:text-emerald-300"
                          : "text-rose-600 dark:text-rose-300"
                      }`}
                    >
                      {Math.abs((comment.like_count || 0) - (comment.dislike_count || 0))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleReaction(comment.id, "dislike")}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusUpdate(comment.id, !comment.implemented)}
                  >
                    {comment.implemented ? "Mark not implemented" : "Mark implemented"}
                  </Button>
                  {currentUserEmail && comment.created_by_email === currentUserEmail ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(comment.id)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          )}
        </div>
        <div className="space-y-2">
          <Popover
            open={mentionOpen}
            onOpenChange={(open) => {
              if (!open) {
                setMentionOpen(false);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Textarea
                ref={textareaRef}
                placeholder="Add a comment. Use @ to tag someone."
                value={message}
                onChange={handleMessageChange}
              />
            </PopoverTrigger>
            {mentionOpen ? (
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search users..."
                    value={mentionQuery}
                    onValueChange={setMentionQuery}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {mentionLoading ? "Searching..." : "No users found."}
                    </CommandEmpty>
                    <CommandGroup heading="Users">
                      {mentionUsers.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={user.email}
                          onSelect={() => handleMentionSelect(user)}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm">{user.email}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            ) : null}
          </Popover>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={!message.trim()}>
            Add comment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
