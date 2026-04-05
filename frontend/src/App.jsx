import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/app-shell";
import AuthPage from "@/pages/AuthPage";
import SetupWizard from "@/pages/SetupWizard";
import { api } from "@/api/client";
import {
  emptyClient,
  emptyInvoice,
  emptyQuote,
  emptyAgreement,
  emptyProposal,
  emptyExpense,
  emptyCreditNote,
  emptyRefund,
} from "@/constants/defaults";
import { toDateTime, formatDate, formatGBP } from "@/utils/format";
import useAppData from "@/hooks/useAppData";
import useAuth from "@/hooks/useAuth";
import useSettings from "@/hooks/useSettings";
import useEmailDraft from "@/hooks/useEmailDraft";
import useYearFilter from "@/hooks/useYearFilter";
import { getClientColumns } from "@/columns/clients.jsx";
import { getInvoiceColumns } from "@/columns/invoices.jsx";
import { getQuoteColumns } from "@/columns/quotes.jsx";
import { getAgreementColumns } from "@/columns/agreements.jsx";
import { getProposalColumns } from "@/columns/proposals.jsx";
import { getExpenseColumns } from "@/columns/expenses.jsx";
import { getUserColumns } from "@/columns/users.jsx";
import ViewLoadingFallback from "@/components/view-loading-fallback";
import { VIEWS, NAV_ITEMS, NAV_GROUPS, buildNavGroups } from "@/navigation/views";
import useViewNavigation from "@/hooks/useViewNavigation";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const ClientsPage = lazy(() => import("@/pages/ClientsPage"));
const InvoicesPage = lazy(() => import("@/pages/InvoicesPage"));
const RevenueAdjustmentsPage = lazy(() => import("@/pages/RevenueAdjustmentsPage"));
const QuotesPage = lazy(() => import("@/pages/QuotesPage"));
const AgreementsPage = lazy(() => import("@/pages/AgreementsPage"));
const ProposalsPage = lazy(() => import("@/pages/ProposalsPage"));
const ExpensesPage = lazy(() => import("@/pages/ExpensesPage"));
const EmailsPage = lazy(() => import("@/pages/EmailsPage"));
const TaxPage = lazy(() => import("@/pages/TaxPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));

export default function App() {
  const { view, navDirection, navigateTo } = useViewNavigation(VIEWS.DASHBOARD);
  const handleLoadError = useCallback(
    (error) => toast.error(error.message || "Unable to load data."),
    []
  );
  const handleSettingsSaved = useCallback((message) => toast.success(message), []);
  const handleSettingsError = useCallback(
    (error) => toast.error(error.message || "Unable to save settings."),
    []
  );
  const handleEmailError = useCallback(
    (error) => toast.error(error.message || "Unable to generate email."),
    []
  );
  const handleEmailCopySuccess = useCallback(
    (message) => toast.success(message),
    []
  );
  const handleEmailSendSuccess = useCallback(
    (message) => toast.success(message),
    []
  );
  const handleEmailCopyError = useCallback(
    (error) => toast.error(error.message || "Unable to copy email body."),
    []
  );
  const handlePdfError = useCallback(
    (error) => toast.error(error.message || "Unable to generate PDF."),
    []
  );
  const handlePdfSuccess = useCallback((message) => toast.success(message), []);
  const handleAuthError = useCallback(
    (error) => toast.error(error.message || "Authentication failed."),
    []
  );

  const {
    user,
    activeWorkspace,
    workspaceRole,
    workspaces,
    needsSetup,
    loading,
    login,
    setup,
    logout,
    switchWorkspace,
    createWorkspace,
    setDefaultWorkspace,
    updateWorkspace,
  } = useAuth();

  const {
    clients,
    invoices,
    quotes,
    creditNotes,
    refunds,
    agreements,
    proposals,
    expenses,
    settings,
    setSettings,
    loadAll,
    clientMap,
  } = useAppData({
    onError: handleLoadError,
    enabled: Boolean(user),
  });

  useEffect(() => {
    const fallbackTitle = "Client Management System";
    document.title = settings?.company_name || fallbackTitle;
  }, [settings?.company_name]);

  const [clientForm, setClientForm] = useState(emptyClient);
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoice);
  const [quoteForm, setQuoteForm] = useState(emptyQuote);
  const [agreementForm, setAgreementForm] = useState(emptyAgreement);
  const [proposalForm, setProposalForm] = useState(emptyProposal);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [creditNoteForm, setCreditNoteForm] = useState(emptyCreditNote);
  const [refundForm, setRefundForm] = useState(emptyRefund);
  const [users, setUsers] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [userForm, setUserForm] = useState({
    email: "",
    role: "user",
    is_active: true,
    password: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_sort_code: "",
  });
  const [editingUserId, setEditingUserId] = useState(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);

  const [editingClientId, setEditingClientId] = useState(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [editingAgreementId, setEditingAgreementId] = useState(null);
  const [editingProposalId, setEditingProposalId] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingCreditNoteId, setEditingCreditNoteId] = useState(null);
  const [editingRefundId, setEditingRefundId] = useState(null);

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [creditNoteDialogOpen, setCreditNoteDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedAdjustmentInvoiceId, setSelectedAdjustmentInvoiceId] = useState(null);
  const {
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
  } = useEmailDraft({
    onError: handleEmailError,
    onCopySuccess: handleEmailCopySuccess,
    onCopyError: handleEmailCopyError,
    onSendSuccess: handleEmailSendSuccess,
  });

  const { updateSettings, saveSettings } = useSettings({
    settings,
    setSettings,
    onSuccess: handleSettingsSaved,
    onError: handleSettingsError,
  });


  const downloadPdf = (pdfBase64, filename) => {
    const byteCharacters = atob(pdfBase64);
    const byteNumbers = Array.from(byteCharacters, (char) => char.charCodeAt(0));
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "document.pdf";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleGeneratePdf = useCallback(
    async (entityType, entityId) => {
      try {
        const response = await api.draftEmail({
          entity_type: entityType,
          entity_id: entityId,
          to_email: null,
          send: false,
        });
        if (!response?.pdf_base64) {
          throw new Error("No PDF generated.");
        }
        downloadPdf(response.pdf_base64, response.pdf_filename);
        handlePdfSuccess("PDF generated.");
      } catch (error) {
        handlePdfError(error);
      }
    },
    [handlePdfError, handlePdfSuccess]
  );

  const handleLogin = useCallback(
    async (payload) => {
      try {
        await login(payload);
      } catch (error) {
        handleAuthError(error);
      }
    },
    [handleAuthError, login]
  );

  const handleSetup = useCallback(
    async (payload) => {
      try {
        await setup(payload);
      } catch (error) {
        handleAuthError(error);
      }
    },
    [handleAuthError, setup]
  );

  const resetClientForm = () => {
    setClientForm(emptyClient);
    setEditingClientId(null);
  };

  const resetInvoiceForm = () => {
    setInvoiceForm(emptyInvoice);
    setEditingInvoiceId(null);
  };

  const resetQuoteForm = () => {
    setQuoteForm(emptyQuote);
    setEditingQuoteId(null);
  };

  const resetAgreementForm = () => {
    setAgreementForm(emptyAgreement);
    setEditingAgreementId(null);
  };

  const resetProposalForm = () => {
    setProposalForm(emptyProposal);
    setEditingProposalId(null);
  };

  const resetExpenseForm = () => {
    setExpenseForm(emptyExpense);
    setEditingExpenseId(null);
  };
  const resetCreditNoteForm = () => {
    setCreditNoteForm(emptyCreditNote);
    setEditingCreditNoteId(null);
  };
  const resetRefundForm = () => {
    setRefundForm(emptyRefund);
    setEditingRefundId(null);
  };
  const resetUserForm = () => {
    setUserForm({
      email: "",
      role: "user",
      is_active: true,
      password: "",
      bank_account_name: "",
      bank_account_number: "",
      bank_sort_code: "",
    });
    setEditingUserId(null);
  };

  const handleBackup = useCallback(async ({ download, store, scope = "workspace" }) => {
    try {
      const response = await api.createBackup({ download, store, scope });
      if (download && response?.blob) {
        const { blob, filename } = response;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename || "cms-backup.tar.gz";
        link.click();
        URL.revokeObjectURL(url);
      }
      if (store && download) {
        handleSettingsSaved("Backup created and stored.");
      } else if (store) {
        handleSettingsSaved("Backup stored.");
      } else {
        handleSettingsSaved("Backup created.");
      }
    } catch (error) {
      handleSettingsError(error);
    }
  }, [handleSettingsError, handleSettingsSaved]);

  const handleTestSmtp = useCallback(async () => {
    try {
      const response = await api.testSmtp();
      handleSettingsSaved(response?.message || "SMTP connection successful.");
    } catch (error) {
      handleSettingsError(error);
    }
  }, [handleSettingsError, handleSettingsSaved]);

  const handleResetData = useCallback(async () => {
    try {
      await api.resetData();
      await loadAll();
      resetClientForm();
      resetInvoiceForm();
      resetQuoteForm();
      resetAgreementForm();
      resetProposalForm();
      resetExpenseForm();
      handleSettingsSaved("Business data reset.");
    } catch (error) {
      handleSettingsError(error);
    }
  }, [
    handleSettingsError,
    handleSettingsSaved,
    loadAll,
    resetAgreementForm,
    resetClientForm,
    resetExpenseForm,
    resetInvoiceForm,
    resetProposalForm,
    resetQuoteForm,
  ]);

  const handleResetWorkspace = useCallback(async (workspaceNameConfirm) => {
    try {
      await api.resetWorkspace(workspaceNameConfirm);
      handleSettingsSaved("Workspace reset. Reloading...");
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      handleSettingsError(error);
    }
  }, [handleSettingsError, handleSettingsSaved]);

  const handleListBackups = useCallback(async () => {
    try {
      return await api.listBackups();
    } catch (error) {
      handleSettingsError(error);
      return { backups: [] };
    }
  }, [handleSettingsError]);

  const handleRestoreBackup = useCallback(
    async (filename, workspaceName) => {
      try {
        await api.restoreBackup(filename, workspaceName);
        handleSettingsSaved("Backup restored. Reloading...");
        setTimeout(() => window.location.reload(), 800);
      } catch (error) {
        handleSettingsError(error);
      }
    },
    [handleSettingsError, handleSettingsSaved]
  );

  const handleRestoreUpload = useCallback(
    async (file, workspaceName) => {
      try {
        await api.restoreBackupUpload(file, workspaceName);
        handleSettingsSaved("Backup restored. Reloading...");
        setTimeout(() => window.location.reload(), 800);
      } catch (error) {
        handleSettingsError(error);
      }
    },
    [handleSettingsError, handleSettingsSaved]
  );

  const loadUsers = useCallback(async () => {
    const role = workspaceRole || user?.role;
    if (!user || role !== "owner") return;
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (error) {
      handleLoadError(error);
    }
  }, [handleLoadError, user, workspaceRole]);

  const loadAssignableUsers = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.listAssignableUsers();
      setAssignableUsers(data);
    } catch (error) {
      handleLoadError(error);
    }
  }, [handleLoadError, user]);

  useEffect(() => {
    const role = workspaceRole || user?.role;
    if (role === "owner") {
      loadUsers();
    } else {
      setUsers([]);
    }
  }, [loadUsers, workspaceRole, user?.role]);

  useEffect(() => {
    loadAssignableUsers();
  }, [loadAssignableUsers]);

  const handleUserSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      try {
        if (editingUserId) {
          const payload = {
            email: userForm.email,
            role: userForm.role,
            is_active: userForm.is_active,
            bank_account_name: userForm.bank_account_name,
            bank_account_number: userForm.bank_account_number,
            bank_sort_code: userForm.bank_sort_code,
          };
          if (userForm.password) {
            payload.password = userForm.password;
          }
          await api.updateUser(editingUserId, payload);
        } else {
          await api.createUser(userForm);
        }
        await loadUsers();
        setUserDialogOpen(false);
        resetUserForm();
        toast.success("User saved.");
      } catch (error) {
        handleAuthError(error);
      }
    },
    [editingUserId, handleAuthError, loadUsers, userForm]
  );

  const handleDeleteUser = useCallback(
    async (id) => {
      try {
        await api.deleteUser(id);
        await loadUsers();
        toast.success("User deleted.");
      } catch (error) {
        handleAuthError(error);
      }
    },
    [handleAuthError, loadUsers]
  );

  const handleClientSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingClientId) {
        await api.updateClient(editingClientId, clientForm);
      } else {
        await api.createClient(clientForm);
      }
      resetClientForm();
      setClientDialogOpen(false);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to save client.");
    }
  };

  const handleInvoiceSubmit = async (event) => {
    event.preventDefault();
    try {
      if (invoiceForm.recurrence_enabled && !invoiceForm.issued_at) {
        toast.error("Please select an invoice date for the schedule.");
        return;
      }
      const lineItems = invoiceForm.line_items.filter(
        (item) => item.description && item.unit_amount !== ""
      );
      const computedTotal = lineItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_amount || 0),
        0
      );
      const payload = {
        title: invoiceForm.title,
        amount: Number(computedTotal || 0),
        status: invoiceForm.status,
        issued_at: toDateTime(invoiceForm.issued_at),
        due_date: toDateTime(invoiceForm.due_date),
        notes: invoiceForm.notes || null,
        quote_id: invoiceForm.quote_id ? Number(invoiceForm.quote_id) : null,
        display_id: invoiceForm.is_legacy ? invoiceForm.display_id || null : null,
        is_legacy: invoiceForm.is_legacy,
        recurrence_enabled: invoiceForm.recurrence_enabled,
        recurrence_frequency: invoiceForm.recurrence_enabled
          ? invoiceForm.recurrence_frequency
          : null,
        recurrence_count: invoiceForm.recurrence_enabled
          ? Number(invoiceForm.recurrence_count || 1)
          : null,
        recurrence_day_of_month: invoiceForm.recurrence_enabled
          ? Number(invoiceForm.recurrence_day_of_month || 0) || null
          : null,
        due_rule_unit: invoiceForm.recurrence_enabled ? invoiceForm.due_rule_unit : null,
        due_rule_value: invoiceForm.recurrence_enabled
          ? Number(invoiceForm.due_rule_value || 0) || null
          : null,
        send_now: invoiceForm.recurrence_enabled ? invoiceForm.send_now : false,
        line_items: lineItems.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity || 0),
          unit_amount: Number(item.unit_amount || 0),
          tax_kind: item.tax_kind || "vat",
          tax_code: item.tax_code || settings?.default_vat_code || "standard",
          tax_rate: Number(item.tax_rate ?? settings?.default_vat_rate ?? 20),
          tax_inclusive:
            item.tax_inclusive === true ||
            (item.tax_inclusive !== false && settings?.vat_inclusive_default === true),
          tax_override: item.tax_override === true,
        })),
      };

      if (editingInvoiceId) {
        await api.updateInvoice(editingInvoiceId, payload);
      } else {
        await api.createInvoice(invoiceForm.client_id, payload);
      }

      resetInvoiceForm();
      setInvoiceDialogOpen(false);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to save invoice.");
    }
  };

  const handleQuoteSubmit = async (event) => {
    event.preventDefault();
    try {
      const lineItems = quoteForm.line_items.filter(
        (item) => item.description && item.unit_amount !== ""
      );
      const computedTotal = lineItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_amount || 0),
        0
      );
      const payload = {
        title: quoteForm.title,
        amount: Number(computedTotal || 0),
        status: quoteForm.status,
        valid_until: toDateTime(quoteForm.valid_until),
        notes: quoteForm.notes || null,
        display_id: quoteForm.is_legacy ? quoteForm.display_id || null : null,
        is_legacy: quoteForm.is_legacy,
        line_items: lineItems.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity || 0),
          unit_amount: Number(item.unit_amount || 0),
          tax_kind: item.tax_kind || "vat",
          tax_code: item.tax_code || settings?.default_vat_code || "standard",
          tax_rate: Number(item.tax_rate ?? settings?.default_vat_rate ?? 20),
          tax_inclusive:
            item.tax_inclusive === true ||
            (item.tax_inclusive !== false && settings?.vat_inclusive_default === true),
          tax_override: item.tax_override === true,
        })),
      };

      if (editingQuoteId) {
        await api.updateQuote(editingQuoteId, payload);
      } else {
        await api.createQuote(quoteForm.client_id, payload);
      }

      resetQuoteForm();
      setQuoteDialogOpen(false);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to save quote.");
    }
  };

  const handleAgreementSubmit = async (event) => {
    event.preventDefault();
    try {
      if (!agreementForm.quote_id) {
        toast.error("Please select a quote for this agreement.");
        return;
      }
      const payload = {
        title: agreementForm.title,
        display_id: agreementForm.display_id || null,
        quote_id: Number(agreementForm.quote_id),
        start_date: toDateTime(agreementForm.start_date),
        end_date: toDateTime(agreementForm.end_date),
        scope_of_services: agreementForm.scope_of_services || null,
        duration: agreementForm.duration || null,
        availability: agreementForm.availability || null,
        meetings: agreementForm.meetings || null,
        access_requirements: agreementForm.access_requirements || null,
        fees_payments: agreementForm.fees_payments || null,
        data_protection: agreementForm.data_protection || null,
        termination: agreementForm.termination || null,
        company_signatory_name: agreementForm.company_signatory_name || null,
        company_signatory_title: agreementForm.company_signatory_title || null,
        company_signed_date: toDateTime(agreementForm.company_signed_date),
        client_signatory_name: agreementForm.client_signatory_name || null,
        sla_items: (agreementForm.sla_items || [])
          .filter((item) => item.sla && item.timescale)
          .map((item) => ({ sla: item.sla, timescale: item.timescale })),
      };

      if (editingAgreementId) {
        await api.updateAgreement(editingAgreementId, payload);
      } else {
        await api.createAgreement(agreementForm.client_id, payload);
      }

      resetAgreementForm();
      setAgreementDialogOpen(false);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to save agreement.");
    }
  };

  const handleProposalSubmit = async (event) => {
    event.preventDefault();
    try {
      if (!proposalForm.quote_id) {
        toast.error("Please select a quote for this proposal.");
        return;
      }
      const payload = {
        title: proposalForm.title,
        status: proposalForm.status,
        display_id: proposalForm.display_id || null,
        quote_id: Number(proposalForm.quote_id),
        submitted_on: toDateTime(proposalForm.submitted_on),
        valid_until: toDateTime(proposalForm.valid_until),
        summary: proposalForm.summary || null,
        approach: proposalForm.approach || null,
        timeline: proposalForm.timeline || null,
        content: proposalForm.content || null,
        requirements: (proposalForm.requirements || [])
          .filter((item) => item.description)
          .map((item) => ({ description: item.description })),
        attachments: proposalForm.attachments || [],
      };

      if (editingProposalId) {
        await api.updateProposal(editingProposalId, payload);
      } else {
        await api.createProposal(proposalForm.client_id, payload);
      }

      resetProposalForm();
      setProposalDialogOpen(false);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to save proposal.");
    }
  };

  const handleProposalUpload = useCallback(
    async (files) => {
      try {
        return await api.uploadProposalAssets(files);
      } catch (error) {
        toast.error(error.message || "Unable to upload files.");
        return null;
      }
    },
    []
  );

  const handleExpenseUpload = useCallback(
    async (files) => {
      try {
        return await api.uploadExpenseReceipts(files);
      } catch (error) {
        toast.error(error.message || "Unable to upload receipts.");
        return null;
      }
    },
    []
  );

  const handleExpenseSubmit = async (event) => {
    event.preventDefault();
    try {
      if (!expenseForm.receipts || expenseForm.receipts.length === 0) {
        toast.error("At least one receipt is required.");
        return;
      }
      const payload = {
        title: expenseForm.title,
        amount: Number(expenseForm.amount || 0),
        incurred_date: toDateTime(expenseForm.incurred_date),
        notes: expenseForm.notes || null,
        display_id: expenseForm.is_legacy ? expenseForm.display_id || null : null,
        is_legacy: expenseForm.is_legacy,
        user_id: expenseForm.user_id ? Number(expenseForm.user_id) : null,
        tax_code: expenseForm.tax_code || settings?.default_vat_code || "standard",
        tax_rate: Number(expenseForm.tax_rate ?? settings?.default_vat_rate ?? 20),
        tax_kind: expenseForm.tax_kind || "vat",
        tax_inclusive:
          expenseForm.tax_inclusive === true ||
          (expenseForm.tax_inclusive !== false && settings?.vat_inclusive_default === true),
        vat_reclaimable: expenseForm.vat_reclaimable === true,
        receipts: expenseForm.receipts || [],
      };
      if (editingExpenseId) {
        await api.updateExpense(editingExpenseId, {
          ...payload,
          client_id: expenseForm.client_id ? Number(expenseForm.client_id) : null,
        });
      } else if (expenseForm.client_id) {
        await api.createClientExpense(expenseForm.client_id, payload);
      } else {
        await api.createExpense(payload);
      }
      resetExpenseForm();
      setExpenseDialogOpen(false);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to save expense.");
    }
  };

  const handleCreditNoteSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingCreditNoteId) {
        await api.updateCreditNote(editingCreditNoteId, {
          issued_at: toDateTime(creditNoteForm.issued_at),
          notes: creditNoteForm.notes || null,
        });
      } else {
        const lineItems = (creditNoteForm.line_items || [])
          .filter((item) => Number(item.credited_amount || 0) > 0)
          .map((item) => ({
            invoice_line_item_id: Number(item.invoice_line_item_id),
            credited_quantity: Number(item.credited_quantity || 0),
            credited_amount: Number(item.credited_amount || 0),
          }));
        if (!creditNoteForm.invoice_id || !lineItems.length) {
          toast.error("Select an invoice and at least one credited line.");
          return;
        }
        await api.createCreditNote({
          invoice_id: Number(creditNoteForm.invoice_id),
          issued_at: toDateTime(creditNoteForm.issued_at),
          notes: creditNoteForm.notes || null,
          line_items: lineItems,
        });
      }
      resetCreditNoteForm();
      setCreditNoteDialogOpen(false);
      await loadAll();
      toast.success("Credit note saved.");
    } catch (error) {
      toast.error(error.message || "Unable to save credit note.");
    }
  };

  const handleRefundSubmit = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        credit_note_id: Number(refundForm.credit_note_id),
        refunded_at: toDateTime(refundForm.refunded_at),
        amount: Number(refundForm.amount || 0),
        notes: refundForm.notes || null,
      };
      if (editingRefundId) {
        await api.updateRefund(editingRefundId, {
          refunded_at: payload.refunded_at,
          amount: payload.amount,
          notes: payload.notes,
        });
      } else {
        await api.createRefund(payload);
      }
      resetRefundForm();
      setRefundDialogOpen(false);
      await loadAll();
      toast.success("Refund saved.");
    } catch (error) {
      toast.error(error.message || "Unable to save refund.");
    }
  };

  const handleMarkInvoicePaid = async (invoiceId) => {
    try {
      await api.markInvoicePaid(invoiceId);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to update invoice.");
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!clientId) return;
    try {
      await api.deleteClient(clientId);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to delete client.");
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!invoiceId) return;
    try {
      await api.deleteInvoice(invoiceId);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to delete invoice.");
    }
  };

  const handleDeleteQuote = async (quoteId) => {
    if (!quoteId) return;
    try {
      await api.deleteQuote(quoteId);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to delete quote.");
    }
  };

  const handleDeleteAgreement = async (agreementId) => {
    if (!agreementId) return;
    try {
      await api.deleteAgreement(agreementId);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to delete agreement.");
    }
  };

  const handleDeleteProposal = async (proposalId) => {
    if (!proposalId) return;
    try {
      await api.deleteProposal(proposalId);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to delete proposal.");
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!expenseId) return;
    try {
      await api.deleteExpense(expenseId);
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Unable to delete expense.");
    }
  };

  const handleDeleteCreditNote = async (creditNoteId) => {
    if (!creditNoteId) return;
    try {
      await api.deleteCreditNote(creditNoteId);
      await loadAll();
      toast.success("Credit note deleted.");
    } catch (error) {
      toast.error(error.message || "Unable to delete credit note.");
    }
  };

  const handleDeleteRefund = async (refundId) => {
    if (!refundId) return;
    try {
      await api.deleteRefund(refundId);
      await loadAll();
      toast.success("Refund deleted.");
    } catch (error) {
      toast.error(error.message || "Unable to delete refund.");
    }
  };

  const getEntityEmail = (entityType, entityId) => {
    const id = Number(entityId);
    switch (entityType) {
      case "quote": {
        const quote = quotes.find((item) => item.id === id);
        if (!quote) return "";
        const client = clientMap.get(quote.client_id);
        return client?.contact_email || client?.email || "";
      }
      case "proposal": {
        const proposal = proposals.find((item) => item.id === id);
        if (!proposal) return "";
        const client = clientMap.get(proposal.client_id);
        return client?.contact_email || client?.email || "";
      }
      case "agreement": {
        const agreement = agreements.find((item) => item.id === id);
        if (!agreement) return "";
        const client = clientMap.get(agreement.client_id);
        return client?.contact_email || client?.email || "";
      }
      case "invoice":
      default: {
        const invoice = invoices.find((item) => item.id === id);
        if (!invoice) return "";
        const client = clientMap.get(invoice.client_id);
        return (
          client?.invoice_email ||
          client?.contact_email ||
          client?.email ||
          ""
        );
      }
    }
  };

  const openEmailForEntity = (entityType, entityId, sendNow = false) => {
    const normalizedType = String(entityType || "").toLowerCase();
    const idNum = Number(entityId);
    navigateTo(VIEWS.EMAILS);
    const toEmail = getEntityEmail(normalizedType, entityId);
    setEmailForm((prev) => ({
      ...prev,
      selected_items: [
        ...(prev.selected_items || []).filter(
          (item) =>
            !(
              item.entity_type === normalizedType &&
              String(item.entity_id) === String(idNum)
            )
        ),
        { entity_type: normalizedType, entity_id: idNum },
      ],
      entity_type: normalizedType,
      entity_id: String(idNum),
      send: sendNow,
      to_email: "",
      to_email_overrides: {},
      subject_overrides: {},
      body_overrides: {},
      include_proposal_assets: true,
    }));
    if (!toEmail) {
      setEmailDialogOpen(true);
      return;
    }
    setEmailDialogOpen(true);
  };

  const openComposeForRows = useCallback(
    (entityType, rows) => {
      if (!rows?.length) return;
      navigateTo(VIEWS.EMAILS);
      const items = rows.map((row) => ({
        entity_type: entityType,
        entity_id: row.id,
      }));
      setEmailForm((prev) => ({
        ...prev,
        selected_items: items,
        send: false,
        to_email: "",
        to_email_overrides: {},
        subject_overrides: {},
        body_overrides: {},
        include_proposal_assets: true,
      }));
      setEmailDialogOpen(true);
    },
    [navigateTo, setEmailForm]
  );

  const openCreditNoteForInvoice = useCallback(
    (invoice) => {
      setSelectedAdjustmentInvoiceId(invoice.id);
      navigateTo(VIEWS.ADJUSTMENTS);
      setCreditNoteForm({
        invoice_id: String(invoice.id),
        issued_at: new Date(),
        notes: "",
        line_items: (invoice.line_items || []).map((item) => ({
          invoice_line_item_id: item.id,
          description: item.description,
          source_quantity: item.quantity,
          source_unit_amount: item.unit_amount,
          credited_quantity: item.quantity,
          credited_amount: "",
        })),
      });
      setEditingCreditNoteId(null);
      setCreditNoteDialogOpen(true);
    },
    [navigateTo]
  );

  const handleViewInvoiceAdjustments = useCallback((invoice) => {
    setSelectedAdjustmentInvoiceId(invoice.id);
    navigateTo(VIEWS.ADJUSTMENTS);
  }, [navigateTo]);

  const handleEditCreditNote = useCallback((creditNote) => {
    setCreditNoteForm({
      invoice_id: String(creditNote.invoice_id),
      issued_at: creditNote.issued_at ? parseISO(creditNote.issued_at) : null,
      notes: creditNote.notes || "",
      line_items: creditNote.line_items || [],
    });
    setEditingCreditNoteId(creditNote.id);
    setCreditNoteDialogOpen(true);
  }, []);

  const handleCreateRefundForCreditNote = useCallback((creditNote) => {
    setRefundForm({
      credit_note_id: String(creditNote.id),
      refunded_at: new Date(),
      amount: "",
      notes: "",
    });
    setEditingRefundId(null);
    setRefundDialogOpen(true);
  }, []);

  const handleEditRefund = useCallback((refund) => {
    setRefundForm({
      credit_note_id: String(refund.credit_note_id),
      refunded_at: refund.refunded_at ? parseISO(refund.refunded_at) : null,
      amount: refund.amount,
      notes: refund.notes || "",
    });
    setEditingRefundId(refund.id);
    setRefundDialogOpen(true);
  }, []);

  const handleBulkDeleteInvoices = useCallback(
    async (rows) => {
      if (!rows?.length) return;
      try {
        await Promise.all(rows.map((row) => api.deleteInvoice(row.id)));
        await loadAll();
        toast.success("Invoices deleted.");
      } catch (error) {
        toast.error(error.message || "Unable to delete invoices.");
      }
    },
    [loadAll]
  );

  const handleBulkMarkInvoicesPaid = useCallback(
    async (rows) => {
      if (!rows?.length) return;
      const unpaidRows = rows.filter((row) => row.status !== "paid");
      if (!unpaidRows.length) {
        toast.error("All selected invoices are already paid.");
        return;
      }
      try {
        await Promise.all(unpaidRows.map((row) => api.markInvoicePaid(row.id)));
        await loadAll();
        toast.success(
          `${unpaidRows.length} invoice${unpaidRows.length === 1 ? "" : "s"} marked as paid.`
        );
      } catch (error) {
        toast.error(error.message || "Unable to update invoices.");
      }
    },
    [loadAll]
  );

  const handleBulkSendInvoiceReminders = useCallback(
    async (rows) => {
      if (!rows?.length) return;
      try {
        const results = await Promise.allSettled(
          rows.map((row) =>
            api.draftEmail({
              entity_type: "invoice",
              entity_id: row.id,
              to_email: getEntityEmail("invoice", row.id),
              send: true,
            })
          )
        );
        const successes = results.filter((result) => result.status === "fulfilled").length;
        const failures = results.length - successes;
        if (successes) {
          await loadAll();
        }
        if (failures) {
          toast.error(`Sent ${successes}. ${failures} failed.`);
        } else {
          toast.success(`Sent ${successes} reminder${successes === 1 ? "" : "s"}.`);
        }
      } catch (error) {
        toast.error(error.message || "Unable to send reminders.");
      }
    },
    [getEntityEmail, loadAll]
  );

  const handleBulkDeleteQuotes = useCallback(
    async (rows) => {
      if (!rows?.length) return;
      try {
        await Promise.all(rows.map((row) => api.deleteQuote(row.id)));
        await loadAll();
        toast.success("Quotes deleted.");
      } catch (error) {
        toast.error(error.message || "Unable to delete quotes.");
      }
    },
    [loadAll]
  );

  const handleBulkSendQuoteReminders = useCallback(
    async (rows) => {
      if (!rows?.length) return;
      try {
        const results = await Promise.allSettled(
          rows.map((row) =>
            api.draftEmail({
              entity_type: "quote",
              entity_id: row.id,
              to_email: getEntityEmail("quote", row.id),
              send: true,
            })
          )
        );
        const successes = results.filter((result) => result.status === "fulfilled").length;
        const failures = results.length - successes;
        if (successes) {
          await loadAll();
        }
        if (failures) {
          toast.error(`Sent ${successes}. ${failures} failed.`);
        } else {
          toast.success(`Sent ${successes} reminder${successes === 1 ? "" : "s"}.`);
        }
      } catch (error) {
        toast.error(error.message || "Unable to send reminders.");
      }
    },
    [getEntityEmail, loadAll]
  );

  const handleBulkDeleteProposals = useCallback(
    async (rows) => {
      if (!rows?.length) return;
      try {
        await Promise.all(rows.map((row) => api.deleteProposal(row.id)));
        await loadAll();
        toast.success("Proposals deleted.");
      } catch (error) {
        toast.error(error.message || "Unable to delete proposals.");
      }
    },
    [loadAll]
  );

  const handleBulkSendProposalReminders = useCallback(
    async (rows) => {
      if (!rows?.length) return;
      try {
        const results = await Promise.allSettled(
          rows.map((row) =>
            api.draftEmail({
              entity_type: "proposal",
              entity_id: row.id,
              to_email: getEntityEmail("proposal", row.id),
              send: true,
            })
          )
        );
        const successes = results.filter((result) => result.status === "fulfilled").length;
        const failures = results.length - successes;
        if (successes) {
          await loadAll();
        }
        if (failures) {
          toast.error(`Sent ${successes}. ${failures} failed.`);
        } else {
          toast.success(`Sent ${successes} reminder${successes === 1 ? "" : "s"}.`);
        }
      } catch (error) {
        toast.error(error.message || "Unable to send reminders.");
      }
    },
    [getEntityEmail, loadAll]
  );

  const handleBulkDeleteClients = useCallback(
    async (rows) => {
      if (!rows?.length) return;
      try {
        await Promise.all(rows.map((row) => api.deleteClient(row.id)));
        await loadAll();
        toast.success("Clients deleted.");
      } catch (error) {
        toast.error(error.message || "Unable to delete clients.");
      }
    },
    [loadAll]
  );

  const handleBulkDeleteAgreements = useCallback(
    async (rows) => {
      if (!rows?.length) return;
      try {
        await Promise.all(rows.map((row) => api.deleteAgreement(row.id)));
        await loadAll();
        toast.success("Agreements deleted.");
      } catch (error) {
        toast.error(error.message || "Unable to delete agreements.");
      }
    },
    [loadAll]
  );

  const handleBulkDeleteExpenses = useCallback(
    async (rows) => {
      if (!rows?.length) return;
      try {
        await Promise.all(rows.map((row) => api.deleteExpense(row.id)));
        await loadAll();
        toast.success("Expenses deleted.");
      } catch (error) {
        toast.error(error.message || "Unable to delete expenses.");
      }
    },
    [loadAll]
  );

  const handleBulkDeleteUsers = useCallback(
    async (rows) => {
      if (!rows?.length) return;
      try {
        await Promise.all(rows.map((row) => api.deleteUser(row.id)));
        await loadAll();
        toast.success("Users deleted.");
      } catch (error) {
        toast.error(error.message || "Unable to delete users.");
      }
    },
    [loadAll]
  );

  const navGroups = useMemo(() => buildNavGroups(NAV_ITEMS, NAV_GROUPS), []);

  const userMap = useMemo(() => {
    const map = new Map();
    assignableUsers.forEach((person) => map.set(person.id, person));
    return map;
  }, [assignableUsers]);

  const {
    selectedYear,
    setSelectedYear,
    financialYears,
    yearMatches,
    formatFinancialYearLabel,
    filteredClients,
    filteredInvoices,
    filteredQuotes,
    filteredAgreements,
    filteredProposals,
    filteredExpenses,
    financialTotals,
    complianceDates,
  } = useYearFilter({
    clients,
    invoices,
    quotes,
    creditNotes,
    refunds,
    agreements,
    proposals,
    expenses,
    settings,
  });

  const composeEntities = useMemo(() => {
    const toEntry = (entityType, item) => {
      const client = item.client_id ? clientMap.get(item.client_id) : null;
      const labelId = item.display_id || `${entityType.toUpperCase()}-${item.id}`;
      const title = item.title || "";
      return {
        entity_type: entityType,
        entity_id: item.id,
        client_id: item.client_id || "unassigned",
        client_label: client?.company || client?.name || "Unassigned",
        label: `${labelId}${title ? ` · ${title}` : ""}`,
        status: item.status || "",
      };
    };
    return [
      ...filteredInvoices.map((item) => toEntry("invoice", item)),
      ...filteredQuotes.map((item) => toEntry("quote", item)),
      ...filteredProposals.map((item) => toEntry("proposal", item)),
      ...filteredAgreements.map((item) => toEntry("agreement", item)),
      ...filteredExpenses.map((item) => toEntry("expense", item)),
    ];
  }, [
    clientMap,
    filteredAgreements,
    filteredExpenses,
    filteredInvoices,
    filteredProposals,
    filteredQuotes,
  ]);

  const clientColumns = useMemo(
    () =>
      getClientColumns({
        onEdit: (client) => {
          setClientForm({
            name: client.name,
            contact_name: client.contact_name || "",
            email: client.email || "",
            contact_email: client.contact_email || "",
            phone: client.phone || "",
            contact_phone: client.contact_phone || "",
            company: client.company || "",
            website: client.website || "",
            invoice_email: client.invoice_email || "",
            address: client.address || "",
          });
          setEditingClientId(client.id);
          setClientDialogOpen(true);
        },
        onDelete: handleDeleteClient,
      }),
    [handleDeleteClient]
  );

  const invoiceColumns = useMemo(
    () =>
      getInvoiceColumns({
        clientMap,
        formatDate,
        formatGBP,
        onEdit: (invoice) => {
          setInvoiceForm({
            client_id: String(invoice.client_id),
            quote_id: invoice.quote_id ? String(invoice.quote_id) : "",
            display_id: invoice.display_id || "",
            is_legacy: Boolean(invoice.is_legacy),
            title: invoice.title,
            status: invoice.status,
            issued_at: invoice.issued_at ? parseISO(invoice.issued_at) : null,
            due_date: invoice.due_date ? parseISO(invoice.due_date) : null,
            notes: invoice.notes || "",
            recurrence_enabled: false,
            recurrence_frequency: "monthly",
            recurrence_count: 1,
            recurrence_day_of_month: "",
            due_rule_unit: "days",
            due_rule_value: 30,
            line_items:
              invoice.line_items && invoice.line_items.length
                ? invoice.line_items.map((item) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unit_amount: item.unit_amount,
                    tax_kind: item.tax_kind || "vat",
                    tax_code: item.tax_code || settings?.default_vat_code || "standard",
                    tax_rate:
                      item.tax_rate ?? settings?.default_vat_rate ?? 20,
                    tax_inclusive:
                      item.tax_inclusive === true ||
                      (item.tax_inclusive !== false &&
                        settings?.vat_inclusive_default === true),
                    tax_override: item.tax_override === true,
                  }))
                : emptyInvoice.line_items,
          });
          setEditingInvoiceId(invoice.id);
          setInvoiceDialogOpen(true);
        },
        onCreateCreditNote: openCreditNoteForInvoice,
        onMarkPaid: handleMarkInvoicePaid,
        onViewAdjustments: handleViewInvoiceAdjustments,
        onDelete: handleDeleteInvoice,
        onGenerateEmail: (id) => openEmailForEntity("invoice", id, false),
        onGeneratePdf: (id) => handleGeneratePdf("invoice", id),
        onSendReminder: (id) => openEmailForEntity("invoice", id, true),
      }),
    [
      clientMap,
      handleDeleteInvoice,
      handleMarkInvoicePaid,
      handleGeneratePdf,
      handleViewInvoiceAdjustments,
      openCreditNoteForInvoice,
      settings?.default_vat_code,
      settings?.default_vat_rate,
      settings?.vat_inclusive_default,
    ]
  );

  const quoteColumns = useMemo(
    () =>
      getQuoteColumns({
        clientMap,
        formatDate,
        formatGBP,
        onEdit: (quote) => {
                setQuoteForm({
                  client_id: String(quote.client_id),
                  display_id: quote.display_id || "",
                  is_legacy: Boolean(quote.is_legacy),
                  title: quote.title,
                  status: quote.status,
                  valid_until: quote.valid_until ? parseISO(quote.valid_until) : null,
                  notes: quote.notes || "",
            line_items:
              quote.line_items && quote.line_items.length
                ? quote.line_items.map((item) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unit_amount: item.unit_amount,
                    tax_kind: item.tax_kind || "vat",
                    tax_code: item.tax_code || settings?.default_vat_code || "standard",
                    tax_rate:
                      item.tax_rate ?? settings?.default_vat_rate ?? 20,
                    tax_inclusive:
                      item.tax_inclusive === true ||
                      (item.tax_inclusive !== false &&
                        settings?.vat_inclusive_default === true),
                    tax_override: item.tax_override === true,
                  }))
                : emptyQuote.line_items,
          });
          setEditingQuoteId(quote.id);
          setQuoteDialogOpen(true);
        },
        onDelete: handleDeleteQuote,
        onGenerateEmail: (id) => openEmailForEntity("quote", id, false),
        onGeneratePdf: (id) => handleGeneratePdf("quote", id),
        onSendReminder: (id) => openEmailForEntity("quote", id, true),
      }),
    [
      clientMap,
      handleDeleteQuote,
      handleGeneratePdf,
      settings?.default_vat_code,
      settings?.default_vat_rate,
      settings?.vat_inclusive_default,
    ]
  );

  const agreementColumns = useMemo(
    () =>
      getAgreementColumns({
        clientMap,
        quoteMap: new Map(quotes.map((quote) => [quote.id, quote])),
        onEdit: (agreement) => {
          setAgreementForm({
            client_id: String(agreement.client_id),
            display_id: agreement.display_id || "",
            quote_id: agreement.quote_id ? String(agreement.quote_id) : "",
            title: agreement.title,
            start_date: agreement.start_date ? parseISO(agreement.start_date) : null,
            end_date: agreement.end_date ? parseISO(agreement.end_date) : null,
            current_version: agreement.current_version || 1,
            updated_at: agreement.updated_at || null,
            updated_by_email: agreement.updated_by_email || "",
            scope_of_services: agreement.scope_of_services || "",
            duration: agreement.duration || "",
            availability: agreement.availability || "",
            meetings: agreement.meetings || "",
            access_requirements: agreement.access_requirements || "",
            fees_payments: agreement.fees_payments || "",
            data_protection: agreement.data_protection || "",
            termination: agreement.termination || "",
            company_signatory_name: agreement.company_signatory_name || "",
            company_signatory_title: agreement.company_signatory_title || "",
            company_signed_date: agreement.company_signed_date
              ? parseISO(agreement.company_signed_date)
              : null,
            client_signatory_name: agreement.client_signatory_name || "",
            sla_items:
              agreement.sla_items?.map((item) => ({
                sla: item.sla,
                timescale: item.timescale,
              })) || [{ sla: "", timescale: "" }],
          });
          setEditingAgreementId(agreement.id);
          setAgreementDialogOpen(true);
        },
        onDelete: handleDeleteAgreement,
        onGenerateEmail: (id) => openEmailForEntity("agreement", id, false),
        onGeneratePdf: (id) => handleGeneratePdf("agreement", id),
        onSendReminder: (id) => openEmailForEntity("agreement", id, true),
      }),
    [clientMap, handleDeleteAgreement, handleGeneratePdf, quotes]
  );

  const proposalColumns = useMemo(
    () =>
      getProposalColumns({
        clientMap,
        quoteMap: new Map(quotes.map((quote) => [quote.id, quote])),
        onEdit: (proposal) => {
          setProposalForm({
            client_id: String(proposal.client_id),
            title: proposal.title,
            status: proposal.status || "draft",
            display_id: proposal.display_id || "",
            quote_id: proposal.quote_id ? String(proposal.quote_id) : "",
            submitted_on: proposal.submitted_on ? parseISO(proposal.submitted_on) : null,
            valid_until: proposal.valid_until ? parseISO(proposal.valid_until) : null,
            current_version: proposal.current_version || 1,
            updated_at: proposal.updated_at || null,
            updated_by_email: proposal.updated_by_email || "",
            summary: proposal.summary || "",
            approach: proposal.approach || "",
            timeline: proposal.timeline || "",
            content: proposal.content || "",
            requirements:
              proposal.requirements?.map((item) => ({
                description: item.description,
              })) || [{ description: "" }],
            attachments: proposal.attachments || [],
          });
          setEditingProposalId(proposal.id);
          setProposalDialogOpen(true);
        },
        onDelete: handleDeleteProposal,
        onGenerateEmail: (id) => openEmailForEntity("proposal", id, false),
        onGeneratePdf: (id) => handleGeneratePdf("proposal", id),
        onSendReminder: (id) => openEmailForEntity("proposal", id, true),
      }),
    [clientMap, handleDeleteProposal, handleGeneratePdf, quotes]
  );

  const expenseColumns = useMemo(
    () =>
      getExpenseColumns({
        clientMap,
        userMap,
        formatDate,
        formatGBP,
        onEdit: (expense) => {
          setExpenseForm({
            client_id: expense.client_id ? String(expense.client_id) : "",
            user_id: expense.user_id ? String(expense.user_id) : "",
            display_id: expense.display_id || "",
            is_legacy: Boolean(expense.is_legacy),
            title: expense.title,
            amount: expense.amount,
            tax_code: expense.tax_code || settings?.default_vat_code || "standard",
            tax_rate: expense.tax_rate ?? settings?.default_vat_rate ?? 20,
            tax_kind: expense.tax_kind || "vat",
            tax_inclusive:
              expense.tax_inclusive === true ||
              (expense.tax_inclusive !== false &&
                settings?.vat_inclusive_default === true),
            vat_reclaimable: expense.vat_reclaimable === true,
            incurred_date: expense.incurred_date ? parseISO(expense.incurred_date) : null,
            notes: expense.notes || "",
            receipts: expense.receipts || [],
          });
          setEditingExpenseId(expense.id);
          setExpenseDialogOpen(true);
        },
        onDelete: handleDeleteExpense,
        onGeneratePdf: (id) => handleGeneratePdf("expense", id),
      }),
    [
      clientMap,
      userMap,
      handleDeleteExpense,
      handleGeneratePdf,
      settings?.default_vat_code,
      settings?.default_vat_rate,
      settings?.vat_inclusive_default,
    ]
  );

  const userColumns = useMemo(
    () =>
      getUserColumns({
        onEdit: (selected) => {
          setUserForm({
            email: selected.email,
            role: selected.role || "user",
            is_active: Boolean(selected.is_active),
            password: "",
            bank_account_name: selected.bank_account_name || "",
            bank_account_number: selected.bank_account_number || "",
            bank_sort_code: selected.bank_sort_code || "",
          });
          setEditingUserId(selected.id);
          setUserDialogOpen(true);
        },
        onDelete: handleDeleteUser,
        formatDate,
      }),
    [handleDeleteUser]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (needsSetup && !user) {
    return (
      <div className="min-h-screen bg-background">
        <Toaster position="top-right" theme="system" richColors />
        <SetupWizard onSubmit={handleSetup} onCancel={() => {}} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Toaster position="top-right" theme="system" richColors />
        <AuthPage onLogin={handleLogin} />
      </div>
    );
  }

  const effectiveRole = workspaceRole || user.role;
  const canManageSettings = effectiveRole !== "user";

  return (
    <AppShell
      companyName={activeWorkspace?.name || settings?.company_name || "Your Company"}
      workspaces={workspaces}
      activeWorkspace={activeWorkspace}
      onSwitchWorkspace={async (workspaceId) => {
        await switchWorkspace(workspaceId);
        await loadAll();
      }}
      onCreateWorkspace={createWorkspace}
      onSetDefaultWorkspace={setDefaultWorkspace}
      onUpdateWorkspace={updateWorkspace}
      navGroups={navGroups}
      view={view}
      navigateTo={navigateTo}
      selectedYear={selectedYear}
      setSelectedYear={setSelectedYear}
      financialYears={financialYears}
      formatFinancialYearLabel={formatFinancialYearLabel}
      logout={logout}
      canManageSettings={canManageSettings}
      isOwner={effectiveRole === "owner"}
      userEmail={user?.email}
    >
      <div className="app-view-transition" data-nav-direction={navDirection}>
        <Suspense fallback={<ViewLoadingFallback />}>
        {view === VIEWS.DASHBOARD && (
          <DashboardPage
            selectedYear={selectedYear}
            financialTotals={financialTotals}
            filteredClients={filteredClients}
            filteredProposals={filteredProposals}
            filteredAgreements={filteredAgreements}
            complianceDates={complianceDates}
            settings={settings}
            onNavigate={navigateTo}
            formatGBP={formatGBP}
          />
        )}
        {view === VIEWS.CLIENTS && (
          <ClientsPage
            clients={filteredClients}
            clientColumns={clientColumns}
            clientDialogOpen={clientDialogOpen}
            setClientDialogOpen={setClientDialogOpen}
            clientForm={clientForm}
            setClientForm={setClientForm}
            editingClientId={editingClientId}
            resetClientForm={resetClientForm}
            handleClientSubmit={handleClientSubmit}
            onBulkDelete={handleBulkDeleteClients}
          />
        )}
        {view === VIEWS.INVOICES && (
          <InvoicesPage
            invoices={filteredInvoices}
            clients={clients}
            quotes={quotes}
            settings={settings}
            invoiceColumns={invoiceColumns}
            invoiceDialogOpen={invoiceDialogOpen}
            setInvoiceDialogOpen={setInvoiceDialogOpen}
            invoiceForm={invoiceForm}
            setInvoiceForm={setInvoiceForm}
            editingInvoiceId={editingInvoiceId}
            resetInvoiceForm={resetInvoiceForm}
            handleInvoiceSubmit={handleInvoiceSubmit}
            onBulkMarkPaid={handleBulkMarkInvoicesPaid}
            onBulkDelete={handleBulkDeleteInvoices}
            onBulkSendReminder={handleBulkSendInvoiceReminders}
            onBulkCompose={(rows) => openComposeForRows("invoice", rows)}
            emptyInvoice={emptyInvoice}
          />
        )}
        {view === VIEWS.QUOTES && (
          <QuotesPage
            quotes={filteredQuotes}
            clients={clients}
            settings={settings}
            quoteColumns={quoteColumns}
            quoteDialogOpen={quoteDialogOpen}
            setQuoteDialogOpen={setQuoteDialogOpen}
            quoteForm={quoteForm}
            setQuoteForm={setQuoteForm}
            editingQuoteId={editingQuoteId}
            resetQuoteForm={resetQuoteForm}
            handleQuoteSubmit={handleQuoteSubmit}
            onBulkDelete={handleBulkDeleteQuotes}
            onBulkSendReminder={handleBulkSendQuoteReminders}
            onBulkCompose={(rows) => openComposeForRows("quote", rows)}
            emptyQuote={emptyQuote}
          />
        )}
        {view === VIEWS.ADJUSTMENTS && (
          <RevenueAdjustmentsPage
            creditNotes={creditNotes}
            refunds={refunds}
            yearMatches={yearMatches}
            invoices={filteredInvoices}
            clients={clients}
            creditNoteForm={creditNoteForm}
            setCreditNoteForm={setCreditNoteForm}
            refundForm={refundForm}
            setRefundForm={setRefundForm}
            creditNoteDialogOpen={creditNoteDialogOpen}
            setCreditNoteDialogOpen={setCreditNoteDialogOpen}
            refundDialogOpen={refundDialogOpen}
            setRefundDialogOpen={setRefundDialogOpen}
            editingCreditNoteId={editingCreditNoteId}
            editingRefundId={editingRefundId}
            resetCreditNoteForm={resetCreditNoteForm}
            resetRefundForm={resetRefundForm}
            handleCreditNoteSubmit={handleCreditNoteSubmit}
            handleRefundSubmit={handleRefundSubmit}
            onEditCreditNote={handleEditCreditNote}
            onEditRefund={handleEditRefund}
            onDeleteCreditNote={handleDeleteCreditNote}
            onDeleteRefund={handleDeleteRefund}
            onCreateRefundForCreditNote={handleCreateRefundForCreditNote}
            selectedInvoiceId={selectedAdjustmentInvoiceId}
            clearInvoiceFilter={() => setSelectedAdjustmentInvoiceId(null)}
          />
        )}
        {view === VIEWS.AGREEMENTS && (
          <AgreementsPage
            agreements={filteredAgreements}
            clients={clients}
            quotes={quotes}
            agreementColumns={agreementColumns}
            agreementDialogOpen={agreementDialogOpen}
            setAgreementDialogOpen={setAgreementDialogOpen}
            agreementForm={agreementForm}
            setAgreementForm={setAgreementForm}
            editingAgreementId={editingAgreementId}
            resetAgreementForm={resetAgreementForm}
            handleAgreementSubmit={handleAgreementSubmit}
            onBulkDelete={handleBulkDeleteAgreements}
            onBulkCompose={(rows) => openComposeForRows("agreement", rows)}
            onReload={loadAll}
            currentUserEmail={user?.email}
          />
        )}
        {view === VIEWS.PROPOSALS && (
          <ProposalsPage
            proposals={filteredProposals}
            clients={clients}
            quotes={quotes}
            proposalColumns={proposalColumns}
            proposalDialogOpen={proposalDialogOpen}
            setProposalDialogOpen={setProposalDialogOpen}
            proposalForm={proposalForm}
            setProposalForm={setProposalForm}
            editingProposalId={editingProposalId}
            resetProposalForm={resetProposalForm}
            handleProposalSubmit={handleProposalSubmit}
            handleProposalUpload={handleProposalUpload}
            onBulkDelete={handleBulkDeleteProposals}
            onBulkSendReminder={handleBulkSendProposalReminders}
            onBulkCompose={(rows) => openComposeForRows("proposal", rows)}
            onReload={loadAll}
            currentUserEmail={user?.email}
          />
        )}
        {view === VIEWS.EXPENSES && (
          <ExpensesPage
            expenses={filteredExpenses}
            clients={clients}
            users={assignableUsers}
            settings={settings}
            expenseColumns={expenseColumns}
            expenseDialogOpen={expenseDialogOpen}
            setExpenseDialogOpen={setExpenseDialogOpen}
            expenseForm={expenseForm}
            setExpenseForm={setExpenseForm}
            editingExpenseId={editingExpenseId}
            resetExpenseForm={resetExpenseForm}
            handleExpenseSubmit={handleExpenseSubmit}
            handleExpenseUpload={handleExpenseUpload}
            onBulkDelete={handleBulkDeleteExpenses}
            onBulkCompose={(rows) => openComposeForRows("expense", rows)}
          />
        )}
        {view === VIEWS.EMAILS && (
          <EmailsPage
            emailResponse={emailResponse}
            setEmailResponse={setEmailResponse}
            emailDialogOpen={emailDialogOpen}
            setEmailDialogOpen={setEmailDialogOpen}
            emailForm={emailForm}
            setEmailForm={setEmailForm}
            handleEmailDraftSubmit={handleEmailDraftSubmit}
            submitCompose={submitCompose}
            sendGroupViaSmtp={sendGroupViaSmtp}
            composeState={composeState}
            handleCopyEmail={handleCopyEmail}
            buildMailto={buildMailto}
            composeEntities={composeEntities}
            clients={clients}
          />
        )}
        {view === VIEWS.TAX && canManageSettings && (
          <TaxPage
            settings={settings}
            updateSettings={updateSettings}
            onSaveSettings={saveSettings}
            selectedYear={selectedYear}
            formatFinancialYearLabel={formatFinancialYearLabel}
          />
        )}
        {view === VIEWS.SETTINGS && canManageSettings && (
          <SettingsPage
            settings={settings}
            activeWorkspaceName={activeWorkspace?.name || settings?.company_name || "Workspace"}
            updateSettings={updateSettings}
            onSaveSettings={saveSettings}
            onSaveSmtp={saveSettings}
            onTestSmtp={handleTestSmtp}
            onBackup={handleBackup}
            onResetData={handleResetData}
            onListBackups={handleListBackups}
            onRestoreBackup={handleRestoreBackup}
            onRestoreUpload={handleRestoreUpload}
            onResetWorkspace={handleResetWorkspace}
          />
        )}
        {view === VIEWS.USERS && user?.role === "owner" && (
          <UsersPage
            users={users}
            userColumns={userColumns}
            userDialogOpen={userDialogOpen}
            setUserDialogOpen={setUserDialogOpen}
            userForm={userForm}
            setUserForm={setUserForm}
            editingUserId={editingUserId}
            resetUserForm={resetUserForm}
            handleUserSubmit={handleUserSubmit}
            onBulkDelete={handleBulkDeleteUsers}
          />
        )}
        </Suspense>
      </div>
    </AppShell>
  );
}
