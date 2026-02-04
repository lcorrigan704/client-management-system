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
  createProposal: (clientId, payload) =>
    request(`/clients/${clientId}/proposals`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProposal: (id, payload) =>
    request(`/proposals/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteProposal: (id) => request(`/proposals/${id}`, { method: "DELETE" }),
  uploadProposalAssets: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return requestForm("/proposals/uploads", formData);
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
  authStatus: () => request("/auth/status"),
  authLogin: (payload) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  authSetup: (payload) =>
    request("/auth/setup", { method: "POST", body: JSON.stringify(payload) }),
  authLogout: () => request("/auth/logout", { method: "POST" }),
  listUsers: () => request("/auth/users"),
  listAssignableUsers: () => request("/auth/users/assignable"),
  createUser: (payload) =>
    request("/auth/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id, payload) =>
    request(`/auth/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteUser: (id) => request(`/auth/users/${id}`, { method: "DELETE" }),
};

export { api, request, API_URL };
