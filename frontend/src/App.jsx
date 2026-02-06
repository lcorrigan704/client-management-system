import { useCallback, useEffect, useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/app-sidebar";
import DashboardPage from "@/pages/DashboardPage";
import AuthPage from "@/pages/AuthPage";
import SetupWizard from "@/pages/SetupWizard";
import ClientsPage from "@/pages/ClientsPage";
import InvoicesPage from "@/pages/InvoicesPage";
import QuotesPage from "@/pages/QuotesPage";
import AgreementsPage from "@/pages/AgreementsPage";
import ProposalsPage from "@/pages/ProposalsPage";
import ExpensesPage from "@/pages/ExpensesPage";
import EmailsPage from "@/pages/EmailsPage";
import SettingsPage from "@/pages/SettingsPage";
import UsersPage from "@/pages/UsersPage";
import { api } from "@/api/client";
import {
  emptyClient,
  emptyInvoice,
  emptyQuote,
  emptyAgreement,
  emptyProposal,
  emptyExpense,
} from "@/constants/defaults";
import { toDateTime, formatDate, formatGBP } from "@/utils/format";
import useAppData from "@/hooks/useAppData";
import useAuth from "@/hooks/useAuth";
import useSettings from "@/hooks/useSettings";
import useEmailDraft from "@/hooks/useEmailDraft";
import useYearFilter from "@/hooks/useYearFilter";
import useEmailEntities from "@/hooks/useEmailEntities";
import { getClientColumns } from "@/columns/clients.jsx";
import { getInvoiceColumns } from "@/columns/invoices.jsx";
import { getQuoteColumns } from "@/columns/quotes.jsx";
import { getAgreementColumns } from "@/columns/agreements.jsx";
import { getProposalColumns } from "@/columns/proposals.jsx";
import { getExpenseColumns } from "@/columns/expenses.jsx";
import { getUserColumns } from "@/columns/users.jsx";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function App() {
  const [view, setView] = useState("dashboard");
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

  const { user, needsSetup, loading, login, setup, logout } = useAuth();

  const {
    clients,
    invoices,
    quotes,
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

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const {
    emailForm,
    setEmailForm,
    emailResponse,
    emailDialogOpen,
    setEmailDialogOpen,
    handleEmailDraftSubmit,
    handleCopyEmail,
    buildMailto,
  } = useEmailDraft({
    onError: handleEmailError,
    onCopySuccess: handleEmailCopySuccess,
    onCopyError: handleEmailCopyError,
    isActive: view === "emails",
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

  const handleBackup = useCallback(async ({ download, store }) => {
    try {
      const response = await api.createBackup({ download, store });
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

  const handleResetWorkspace = useCallback(async () => {
    try {
      await api.resetWorkspace();
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
    async (filename) => {
      try {
        await api.restoreBackup(filename);
        handleSettingsSaved("Backup restored. Reloading...");
        setTimeout(() => window.location.reload(), 800);
      } catch (error) {
        handleSettingsError(error);
      }
    },
    [handleSettingsError, handleSettingsSaved]
  );

  const handleRestoreUpload = useCallback(
    async (file) => {
      try {
        await api.restoreBackupUpload(file);
        handleSettingsSaved("Backup restored. Reloading...");
        setTimeout(() => window.location.reload(), 800);
      } catch (error) {
        handleSettingsError(error);
      }
    },
    [handleSettingsError, handleSettingsSaved]
  );

  const loadUsers = useCallback(async () => {
    if (!user || user.role !== "owner") return;
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (error) {
      handleLoadError(error);
    }
  }, [handleLoadError, user]);

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
    if (user?.role === "owner") {
      loadUsers();
    } else {
      setUsers([]);
    }
  }, [loadUsers, user]);

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
        due_date: toDateTime(invoiceForm.due_date),
        notes: invoiceForm.notes || null,
        quote_id: invoiceForm.quote_id ? Number(invoiceForm.quote_id) : null,
        display_id: invoiceForm.is_legacy ? invoiceForm.display_id || null : null,
        is_legacy: invoiceForm.is_legacy,
        line_items: lineItems.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity || 0),
          unit_amount: Number(item.unit_amount || 0),
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

  const handleExpenseSubmit = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        title: expenseForm.title,
        amount: Number(expenseForm.amount || 0),
        incurred_date: toDateTime(expenseForm.incurred_date),
        notes: expenseForm.notes || null,
        display_id: expenseForm.is_legacy ? expenseForm.display_id || null : null,
        is_legacy: expenseForm.is_legacy,
        user_id: expenseForm.user_id ? Number(expenseForm.user_id) : null,
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
    const idNum = Number(entityId);
    let clientId = "";
    if (entityType === "invoice") {
      const invoice = invoices.find((item) => item.id === idNum);
      clientId = invoice ? String(invoice.client_id) : "";
    } else if (entityType === "quote") {
      const quote = quotes.find((item) => item.id === idNum);
      clientId = quote ? String(quote.client_id) : "";
    } else if (entityType === "proposal") {
      const proposal = proposals.find((item) => item.id === idNum);
      clientId = proposal ? String(proposal.client_id) : "";
    } else if (entityType === "agreement") {
      const agreement = agreements.find((item) => item.id === idNum);
      clientId = agreement ? String(agreement.client_id) : "";
    }
    setView("emails");
    const toEmail = getEntityEmail(entityType, entityId);
    setEmailForm((prev) => ({
      ...prev,
      entity_type: entityType,
      entity_id: String(entityId),
      client_id: clientId,
      send: sendNow,
      to_email: toEmail || "",
    }));
    setEmailDialogOpen(true);
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "clients", label: "Clients" },
    { id: "invoices", label: "Invoices" },
    { id: "quotes", label: "Quotes" },
    { id: "agreements", label: "Agreements" },
    { id: "proposals", label: "Proposals" },
    { id: "expenses", label: "Expenses" },
    { id: "emails", label: "Emails" },
  ];

  const navGroups = [
    { label: "Overview", items: ["dashboard"] },
    { label: "Clients", items: ["clients"] },
    { label: "Revenue", items: ["invoices", "quotes"] },
    { label: "Agreements", items: ["agreements", "proposals"] },
    { label: "Operations", items: ["expenses", "emails"] },
  ]
    .map((group) => ({
      label: group.label,
      items: group.items
        .map((id) => navItems.find((item) => item.id === id))
        .filter(Boolean),
    }))
    .filter((group) => group.items.length);

  const userMap = useMemo(() => {
    const map = new Map();
    assignableUsers.forEach((person) => map.set(person.id, person));
    return map;
  }, [assignableUsers]);

  const {
    selectedYear,
    setSelectedYear,
    financialYears,
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
    agreements,
    proposals,
    expenses,
    settings,
  });

  const emailEntityOptions = useEmailEntities({
    entityType: emailForm.entity_type,
    clientId: emailForm.client_id,
    clientMap,
    filteredInvoices,
    filteredQuotes,
    filteredAgreements,
    filteredProposals,
  });

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
                  due_date: invoice.due_date ? parseISO(invoice.due_date) : null,
                  notes: invoice.notes || "",
            line_items:
              invoice.line_items && invoice.line_items.length
                ? invoice.line_items.map((item) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unit_amount: item.unit_amount,
                  }))
                : emptyInvoice.line_items,
          });
          setEditingInvoiceId(invoice.id);
          setInvoiceDialogOpen(true);
        },
        onMarkPaid: handleMarkInvoicePaid,
        onDelete: handleDeleteInvoice,
        onGenerateEmail: (id) => openEmailForEntity("invoice", id, false),
        onGeneratePdf: (id) => handleGeneratePdf("invoice", id),
        onSendReminder: (id) => openEmailForEntity("invoice", id, true),
      }),
    [clientMap, handleDeleteInvoice, handleMarkInvoicePaid, handleGeneratePdf]
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
    [clientMap, handleDeleteQuote, handleGeneratePdf]
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
            incurred_date: expense.incurred_date ? parseISO(expense.incurred_date) : null,
            notes: expense.notes || "",
          });
          setEditingExpenseId(expense.id);
          setExpenseDialogOpen(true);
        },
        onDelete: handleDeleteExpense,
        onGeneratePdf: (id) => handleGeneratePdf("expense", id),
      }),
    [clientMap, userMap, handleDeleteExpense, handleGeneratePdf]
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

  const canManageSettings = user.role !== "user";

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-background">
        <Toaster position="top-right" theme="system" richColors />
        <AppSidebar
          companyName={settings?.company_name || "Your Company"}
          navGroups={navGroups}
          view={view}
          setView={setView}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          financialYears={financialYears}
          formatFinancialYearLabel={formatFinancialYearLabel}
          onLogout={logout}
          showSettings={canManageSettings}
          showUsers={user?.role === "owner"}
          userEmail={user?.email}
        />
        <SidebarInset>
          <header className="flex items-center justify-between gap-4 border-b bg-background px-4 py-3 lg:hidden">
            <SidebarTrigger />
            <div className="text-sm font-semibold text-foreground">Navigation</div>
          </header>
          <main className="w-full space-y-10 px-4 py-8">
        {view === "dashboard" && (
          <DashboardPage
            selectedYear={selectedYear}
            financialTotals={financialTotals}
            filteredClients={filteredClients}
            filteredProposals={filteredProposals}
            filteredAgreements={filteredAgreements}
            complianceDates={complianceDates}
            settings={settings}
            onNavigate={setView}
            formatGBP={formatGBP}
          />
        )}
        {view === "clients" && (
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
          />
        )}
        {view === "invoices" && (
          <InvoicesPage
            invoices={filteredInvoices}
            clients={clients}
            quotes={quotes}
            invoiceColumns={invoiceColumns}
            invoiceDialogOpen={invoiceDialogOpen}
            setInvoiceDialogOpen={setInvoiceDialogOpen}
            invoiceForm={invoiceForm}
            setInvoiceForm={setInvoiceForm}
            editingInvoiceId={editingInvoiceId}
            resetInvoiceForm={resetInvoiceForm}
            handleInvoiceSubmit={handleInvoiceSubmit}
            handleMarkInvoicePaid={handleMarkInvoicePaid}
            emptyInvoice={emptyInvoice}
          />
        )}
        {view === "quotes" && (
          <QuotesPage
            quotes={filteredQuotes}
            clients={clients}
            quoteColumns={quoteColumns}
            quoteDialogOpen={quoteDialogOpen}
            setQuoteDialogOpen={setQuoteDialogOpen}
            quoteForm={quoteForm}
            setQuoteForm={setQuoteForm}
            editingQuoteId={editingQuoteId}
            resetQuoteForm={resetQuoteForm}
            handleQuoteSubmit={handleQuoteSubmit}
            emptyQuote={emptyQuote}
          />
        )}
        {view === "agreements" && (
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
          />
        )}
        {view === "proposals" && (
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
          />
        )}
        {view === "expenses" && (
          <ExpensesPage
            expenses={filteredExpenses}
            clients={clients}
            users={assignableUsers}
            expenseColumns={expenseColumns}
            expenseDialogOpen={expenseDialogOpen}
            setExpenseDialogOpen={setExpenseDialogOpen}
            expenseForm={expenseForm}
            setExpenseForm={setExpenseForm}
            editingExpenseId={editingExpenseId}
            resetExpenseForm={resetExpenseForm}
            handleExpenseSubmit={handleExpenseSubmit}
          />
        )}
        {view === "emails" && (
          <EmailsPage
            emailResponse={emailResponse}
            emailDialogOpen={emailDialogOpen}
            setEmailDialogOpen={setEmailDialogOpen}
            emailForm={emailForm}
            setEmailForm={setEmailForm}
            handleEmailDraftSubmit={handleEmailDraftSubmit}
            handleCopyEmail={handleCopyEmail}
            buildMailto={buildMailto}
            emailEntityOptions={emailEntityOptions}
            clients={clients}
          />
        )}
        {view === "settings" && canManageSettings && (
          <SettingsPage
            settings={settings}
            updateSettings={updateSettings}
            onSaveSettings={saveSettings}
            onSaveSmtp={saveSettings}
            onBackup={handleBackup}
            onResetData={handleResetData}
            onListBackups={handleListBackups}
            onRestoreBackup={handleRestoreBackup}
            onRestoreUpload={handleRestoreUpload}
            onResetWorkspace={handleResetWorkspace}
          />
        )}
        {view === "users" && user?.role === "owner" && (
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
          />
        )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
