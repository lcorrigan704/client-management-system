function normalizeApiBaseUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  const unquoted = trimmed.replace(/^['"]+|['"]+$/g, "");
  const noTrailingSlash = unquoted.replace(/\/+$/, "");

  if (/^(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3}):\d+$/.test(noTrailingSlash)) {
    return `http://${noTrailingSlash}`;
  }

  return noTrailingSlash;
}

const API_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

function buildApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!API_URL) return normalizedPath;

  if (API_URL.startsWith("/")) {
    return `${API_URL}${normalizedPath}`;
  }

  if (/^https?:\/\//i.test(API_URL)) {
    return `${API_URL}${normalizedPath}`;
  }

  // Final fallback for odd env values.
  return `http://${API_URL}${normalizedPath}`;
}

function normalizeFetchError(error) {
  const message = String(error?.message || "");
  if (message.includes("did not match the expected pattern")) {
    return new Error(
      "Unable to call the API due to an invalid API URL. Check VITE_API_URL in frontend env."
    );
  }
  return error;
}

async function request(path, options = {}) {
  const url = buildApiUrl(path);
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      ...options,
    });
  } catch (error) {
    const normalized = normalizeFetchError(error);
    throw new Error(`${normalized.message} [${url}]`);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function requestForm(path, formData) {
  let response;
  try {
    response = await fetch(buildApiUrl(path), {
      method: "POST",
      body: formData,
      credentials: "include",
    });
  } catch (error) {
    throw normalizeFetchError(error);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }

  return response.json();
}

const api = {
  request,
  getClients: () => request("/clients"),
  getInvoices: () => request("/invoices"),
  getQuotes: () => request("/quotes"),
  getCreditNotes: () => request("/credit-notes"),
  getRefunds: () => request("/refunds"),
  getAgreements: () => request("/agreements"),
  getProposals: () => request("/proposals"),
  getExpenses: () => request("/expenses"),
  getSettings: () => request("/settings"),
  saveSettings: (settings) =>
    request("/settings", { method: "PUT", body: JSON.stringify(settings) }),
  testSmtp: () => request("/settings/smtp/test", { method: "POST" }),
  createClient: (payload) =>
    request("/clients", { method: "POST", body: JSON.stringify(payload) }),
  updateClient: (id, payload) =>
    request(`/clients/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteClient: (id) => request(`/clients/${id}`, { method: "DELETE" }),
  createInvoice: (clientId, payload) =>
    request(`/clients/${clientId}/invoices`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateInvoice: (id, payload) =>
    request(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  markInvoicePaid: (id) => request(`/invoices/${id}/mark-paid`, { method: "POST" }),
  deleteInvoice: (id) => request(`/invoices/${id}`, { method: "DELETE" }),
  createCreditNote: (payload) =>
    request("/credit-notes", { method: "POST", body: JSON.stringify(payload) }),
  updateCreditNote: (id, payload) =>
    request(`/credit-notes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCreditNote: (id) => request(`/credit-notes/${id}`, { method: "DELETE" }),
  createRefund: (payload) =>
    request("/refunds", { method: "POST", body: JSON.stringify(payload) }),
  updateRefund: (id, payload) =>
    request(`/refunds/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteRefund: (id) => request(`/refunds/${id}`, { method: "DELETE" }),
  createQuote: (clientId, payload) =>
    request(`/clients/${clientId}/quotes`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateQuote: (id, payload) =>
    request(`/quotes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteQuote: (id) => request(`/quotes/${id}`, { method: "DELETE" }),
  createAgreement: (clientId, payload) =>
    request(`/clients/${clientId}/agreements`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAgreement: (id, payload) =>
    request(`/agreements/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteAgreement: (id) => request(`/agreements/${id}`, { method: "DELETE" }),
  listAgreementVersions: (id) => request(`/agreements/${id}/versions`),
  restoreAgreementVersion: (agreementId, versionId) =>
    request(`/agreements/${agreementId}/versions/${versionId}/restore`, { method: "POST" }),
  listAgreementComments: (versionId, fieldKey) =>
    request(
      `/agreements/versions/${versionId}/comments${
        fieldKey ? `?field_key=${encodeURIComponent(fieldKey)}` : ""
      }`
    ),
  listAgreementCommentsAll: (versionId, fieldKey) =>
    request(
      `/agreements/versions/${versionId}/comments?all_versions=1${
        fieldKey ? `&field_key=${encodeURIComponent(fieldKey)}` : ""
      }`
    ),
  addAgreementComment: (versionId, payload) =>
    request(`/agreements/versions/${versionId}/comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  reactAgreementComment: (commentId, payload) =>
    request(`/agreements/comments/${commentId}/reaction`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAgreementCommentStatus: (commentId, payload) =>
    request(`/agreements/comments/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteAgreementComment: (commentId) =>
    request(`/agreements/comments/${commentId}`, { method: "DELETE" }),
  createProposal: (clientId, payload) =>
    request(`/clients/${clientId}/proposals`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProposal: (id, payload) =>
    request(`/proposals/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteProposal: (id) => request(`/proposals/${id}`, { method: "DELETE" }),
  listProposalVersions: (id) => request(`/proposals/${id}/versions`),
  restoreProposalVersion: (proposalId, versionId) =>
    request(`/proposals/${proposalId}/versions/${versionId}/restore`, { method: "POST" }),
  listProposalComments: (versionId, fieldKey) =>
    request(
      `/proposals/versions/${versionId}/comments${
        fieldKey ? `?field_key=${encodeURIComponent(fieldKey)}` : ""
      }`
    ),
  listProposalCommentsAll: (versionId, fieldKey) =>
    request(
      `/proposals/versions/${versionId}/comments?all_versions=1${
        fieldKey ? `&field_key=${encodeURIComponent(fieldKey)}` : ""
      }`
    ),
  addProposalComment: (versionId, payload) =>
    request(`/proposals/versions/${versionId}/comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  reactProposalComment: (commentId, payload) =>
    request(`/proposals/comments/${commentId}/reaction`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProposalCommentStatus: (commentId, payload) =>
    request(`/proposals/comments/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteProposalComment: (commentId) =>
    request(`/proposals/comments/${commentId}`, { method: "DELETE" }),
  uploadProposalAssets: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return requestForm("/proposals/uploads", formData);
  },
  uploadExpenseReceipts: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return requestForm("/expenses/uploads", formData);
  },
  createExpense: (payload) =>
    request("/expenses", { method: "POST", body: JSON.stringify(payload) }),
  createClientExpense: (clientId, payload) =>
    request(`/clients/${clientId}/expenses`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateExpense: (id, payload) =>
    request(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteExpense: (id) => request(`/expenses/${id}`, { method: "DELETE" }),
  draftEmail: (payload) =>
    request("/email/draft", { method: "POST", body: JSON.stringify(payload) }),
  composeEmail: (payload) =>
    request("/email/compose", { method: "POST", body: JSON.stringify(payload) }),
  getTaxRates: () => request("/tax/rates"),
  saveTaxRates: (payload) =>
    request("/tax/rates", { method: "PUT", body: JSON.stringify(payload) }),
  getVatSummary: (period = "all") => request(`/tax/vat-summary?period=${encodeURIComponent(period)}`),
  getDirectTaxSummary: (period = "all") =>
    request(`/tax/direct-summary?period=${encodeURIComponent(period)}`),
  getFilingPack: (period = "all") => request(`/tax/filing-pack?period=${encodeURIComponent(period)}`),
  downloadFilingPack: async ({ period = "all", format = "csv" } = {}) => {
    let response;
    try {
      response = await fetch(
        buildApiUrl(
          `/tax/filing-pack/export?period=${encodeURIComponent(period)}&format=${encodeURIComponent(format)}`
        ),
        { credentials: "include" }
      );
    } catch (error) {
      throw normalizeFetchError(error);
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "Request failed");
    }
    const disposition = response.headers.get("content-disposition") || "";
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    const filename = filenameMatch ? filenameMatch[1] : `tax-filing-pack.${format}`;
    const blob = await response.blob();
    return { blob, filename };
  },
  listEmailLogs: () => request("/email/logs"),
  resendEmailLog: (id) =>
    request(`/email/logs/${id}/resend`, { method: "POST" }),
  resendEmailLogsBulk: (logIds) =>
    request("/email/logs/resend/bulk", {
      method: "POST",
      body: JSON.stringify({ log_ids: logIds }),
    }),
  markEmailLogDelivered: (id) =>
    request(`/email/logs/${id}/mark-delivered`, { method: "POST" }),
  markEmailLogsDeliveredBulk: (logIds) =>
    request("/email/logs/mark-delivered/bulk", {
      method: "POST",
      body: JSON.stringify({ log_ids: logIds }),
    }),
  createBackup: async ({ download = true, store = true, scope = "workspace" } = {}) => {
    if (download) {
      let response;
      try {
        response = await fetch(buildApiUrl("/admin/backup"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ download, store, scope }),
        });
      } catch (error) {
        throw normalizeFetchError(error);
      }
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Request failed");
      }
      const disposition = response.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : "cms-backup.tar.gz";
      const blob = await response.blob();
      return { blob, filename, stored: store };
    }

    return request("/admin/backup", {
      method: "POST",
      body: JSON.stringify({ download, store, scope }),
    });
  },
  listBackups: () => request("/admin/backups"),
  restoreBackup: (filename, workspaceName) =>
    request("/admin/restore", {
      method: "POST",
      body: JSON.stringify({ filename, workspace_name: workspaceName }),
    }),
  restoreBackupUpload: (file, workspaceName) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("workspace_name", workspaceName);
    return requestForm("/admin/restore/upload", formData);
  },
  resetData: () => request("/admin/reset", { method: "POST" }),
  resetWorkspace: (workspaceNameConfirm) =>
    request("/admin/reset-workspace", {
      method: "POST",
      body: JSON.stringify({ workspace_name_confirm: workspaceNameConfirm }),
    }),
  authStatus: () => request("/auth/status"),
  authLogin: (payload) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  authSetup: (payload) =>
    request("/auth/setup", { method: "POST", body: JSON.stringify(payload) }),
  authLogout: () => request("/auth/logout", { method: "POST" }),
  listWorkspaces: () => request("/workspaces"),
  createWorkspace: (payload) =>
    request("/workspaces", { method: "POST", body: JSON.stringify(payload) }),
  updateWorkspace: (id, payload) =>
    request(`/workspaces/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  switchWorkspace: (workspaceId) =>
    request("/workspaces/switch", {
      method: "POST",
      body: JSON.stringify({ workspace_id: workspaceId }),
    }),
  setDefaultWorkspace: (workspaceId) =>
    request(`/workspaces/${workspaceId}/set-default`, { method: "POST" }),
  listWorkspaceMembers: (workspaceId) => request(`/workspaces/${workspaceId}/members`),
  updateWorkspaceMember: (workspaceId, userId, payload) =>
    request(`/workspaces/${workspaceId}/members/${userId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteWorkspaceMember: (workspaceId, userId) =>
    request(`/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" }),
  listUsers: () => request("/auth/users"),
  listAssignableUsers: () => request("/auth/users/assignable"),
  searchUsers: (query) => request(`/auth/users/search?q=${encodeURIComponent(query)}`),
  createUser: (payload) =>
    request("/auth/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id, payload) =>
    request(`/auth/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteUser: (id) => request(`/auth/users/${id}`, { method: "DELETE" }),
};

export { api, request, API_URL };
