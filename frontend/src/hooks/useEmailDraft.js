import { useCallback, useRef, useState } from "react";
import { api } from "@/api/client";
import { emptyEmailDraft } from "@/constants/defaults";

const useEmailDraft = ({ onError, onCopySuccess, onCopyError, onSendSuccess } = {}) => {
  const [emailForm, setEmailFormState] = useState(emptyEmailDraft);
  const [emailResponse, setEmailResponse] = useState(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [composeState, setComposeState] = useState({
    isSubmitting: false,
    action: null,
    groupId: null,
  });
  const composeCacheRef = useRef(new Map());

  const setEmailForm = useCallback((next) => {
    setEmailResponse(null);
    if (typeof next === "function") {
      setEmailFormState((prev) => next(prev));
      return;
    }
    setEmailFormState(next);
  }, []);

  const submitCompose = useCallback(
    async (sendOverride = null, options = {}) => {
      const selectedItemsOverride = options.selectedItems || null;
      const toEmailOverrides = options.toEmailOverrides || emailForm.to_email_overrides || {};
      const subjectOverrides = options.subjectOverrides || emailForm.subject_overrides || {};
      const bodyOverrides = options.bodyOverrides || emailForm.body_overrides || {};
      const keepDialogOpen = options.keepDialogOpen === true;
      const groupId = options.groupId || null;
      try {
        const selectedItems =
          selectedItemsOverride ||
          (emailForm.selected_items?.length
            ? emailForm.selected_items.map((item) => ({
                entity_type: item.entity_type,
                entity_id: Number(item.entity_id),
              }))
            : emailForm.entity_id
              ? [{ entity_type: emailForm.entity_type, entity_id: Number(emailForm.entity_id) }]
              : []);

        const payload = {
          items: selectedItems,
          to_email_overrides: toEmailOverrides,
          subject_overrides: subjectOverrides,
          body_overrides: bodyOverrides,
          include_proposal_assets: emailForm.include_proposal_assets !== false,
          send: sendOverride ?? emailForm.send,
        };
        setComposeState({
          isSubmitting: true,
          action: payload.send ? "send" : "generate",
          groupId,
        });
        const cacheKey =
          payload.send
            ? null
            : JSON.stringify({
                items: payload.items,
                to_email_overrides: payload.to_email_overrides,
                subject_overrides: payload.subject_overrides,
                body_overrides: payload.body_overrides,
                include_proposal_assets: payload.include_proposal_assets,
              });
        const cached = cacheKey ? composeCacheRef.current.get(cacheKey) : null;
        const response = cached || (await api.composeEmail(payload));
        if (cacheKey && !cached) {
          composeCacheRef.current.set(cacheKey, response);
        }
        setEmailResponse(response);
        if (payload.send && onSendSuccess) {
          const sent = Number(response?.summary?.sent_groups || 0);
          const failed = Number(response?.summary?.failed_groups || 0);
          if (failed > 0) {
            onSendSuccess(`Sent ${sent} group${sent === 1 ? "" : "s"}. ${failed} failed.`);
          } else {
            onSendSuccess(`Sent ${sent} group${sent === 1 ? "" : "s"}.`);
          }
        }
        if (!keepDialogOpen) {
          setEmailDialogOpen(false);
        }
        return response;
      } catch (error) {
        if (onError) onError(error);
        return null;
      } finally {
        setComposeState({
          isSubmitting: false,
          action: null,
          groupId: null,
        });
      }
    },
    [emailForm, onError, onSendSuccess]
  );

  const sendGroupViaSmtp = useCallback(
    async (group) => {
      if (!group?.group_id || !Array.isArray(group?.entities)) return;
      const selectedItems = group.entities.map((entity) => ({
        entity_type: entity.entity_type,
        entity_id: Number(entity.entity_id),
      }));
      const toEmailOverrides = group.to_email ? { [group.group_id]: group.to_email } : {};
      const subjectOverrides = { [group.group_id]: group.subject || "" };
      const bodyOverrides = { [group.group_id]: group.body || "" };

      const response = await submitCompose(true, {
        selectedItems,
        toEmailOverrides,
        subjectOverrides,
        bodyOverrides,
        keepDialogOpen: true,
        groupId: group.group_id,
      });

      if (!response?.groups?.length) return;
      const nextGroup = response.groups[0];
      setEmailResponse((prev) => {
        if (!prev?.groups?.length) return response;
        const nextGroups = prev.groups.map((item) =>
          item.group_id === nextGroup.group_id ? nextGroup : item
        );
        const nextSummary = {
          ...(prev.summary || {}),
          sent_groups: nextGroups.filter((item) => item.send_result?.sent).length,
          failed_groups: nextGroups.filter(
            (item) => item.send_result && item.send_result.sent === false
          ).length,
        };
        return { ...prev, groups: nextGroups, summary: nextSummary };
      });
    },
    [submitCompose]
  );

  const handleEmailDraftSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      await submitCompose();
    },
    [submitCompose]
  );

  const handleCopyEmail = useCallback(async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (onCopySuccess) onCopySuccess("Copied to clipboard.");
    } catch (error) {
      if (onCopyError) onCopyError(error);
    }
  }, [onCopyError, onCopySuccess]);

  const buildMailto = useCallback((group) => {
    if (!group) return "#";
    const subject = encodeURIComponent(group.subject || "");
    const body = encodeURIComponent(group.body || "");
    const to = encodeURIComponent(group.to_email || group.to_email_default || "");
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, []);

  return {
    emailForm,
    setEmailForm,
    emailResponse,
    setEmailResponse,
    emailDialogOpen,
    setEmailDialogOpen,
    handleEmailDraftSubmit,
    submitCompose,
    sendGroupViaSmtp,
    composeState,
    handleCopyEmail,
    buildMailto,
  };
};

export default useEmailDraft;
