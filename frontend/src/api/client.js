const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    ...options,
  });

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
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

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
  createBackup: async ({ download = true, store = true } = {}) => {
    if (download) {
      const response = await fetch(`${API_URL}/admin/backup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ download, store }),
      });
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
      body: JSON.stringify({ download, store }),
    });
  },
  listBackups: () => request("/admin/backups"),
  restoreBackup: (filename) =>
    request("/admin/restore", { method: "POST", body: JSON.stringify({ filename }) }),
  restoreBackupUpload: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return requestForm("/admin/restore/upload", formData);
  },
  resetData: () => request("/admin/reset", { method: "POST" }),
  resetWorkspace: () => request("/admin/reset-workspace", { method: "POST" }),
  authStatus: () => request("/auth/status"),
  authLogin: (payload) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  authSetup: (payload) =>
    request("/auth/setup", { method: "POST", body: JSON.stringify(payload) }),
  authLogout: () => request("/auth/logout", { method: "POST" }),
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
