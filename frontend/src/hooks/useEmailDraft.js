import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { emptyEmailDraft } from "@/constants/defaults";

const useEmailDraft = ({ onError, onCopySuccess, onCopyError, isActive } = {}) => {
  const [emailForm, setEmailForm] = useState(emptyEmailDraft);
  const [emailResponse, setEmailResponse] = useState(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  useEffect(() => {
    setEmailResponse(null);
  }, [emailForm.entity_type, emailForm.entity_id]);

  useEffect(() => {
    if (!isActive && emailResponse) {
      setEmailResponse(null);
    }
  }, [emailResponse, isActive]);

  const handleEmailDraftSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      try {
        const payload = {
          entity_type: emailForm.entity_type,
          entity_id: Number(emailForm.entity_id || 0),
          to_email: emailForm.to_email || null,
          send: emailForm.send,
        };
        const response = await api.draftEmail(payload);
        setEmailResponse(response);
        setEmailDialogOpen(false);
      } catch (error) {
        if (onError) onError(error);
      }
    },
    [emailForm, onError]
  );

  const handleCopyEmail = useCallback(async () => {
    if (!emailResponse) return;
    try {
      await navigator.clipboard.writeText(emailResponse.body);
      if (onCopySuccess) onCopySuccess("Email body copied to clipboard.");
    } catch (error) {
      if (onCopyError) onCopyError(error);
    }
  }, [emailResponse, onCopyError, onCopySuccess]);

  const buildMailto = useCallback(() => {
    if (!emailResponse) return "#";
    const subject = encodeURIComponent(emailResponse.subject || "");
    const body = encodeURIComponent(emailResponse.body || "");
    const to = encodeURIComponent(emailForm.to_email || "");
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [emailForm.to_email, emailResponse]);

  return {
    emailForm,
    setEmailForm,
    emailResponse,
    setEmailResponse,
    emailDialogOpen,
    setEmailDialogOpen,
    handleEmailDraftSubmit,
    handleCopyEmail,
    buildMailto,
  };
};

export default useEmailDraft;
