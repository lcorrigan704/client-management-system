export const VIEWS = Object.freeze({
  DASHBOARD: "dashboard",
  CLIENTS: "clients",
  INVOICES: "invoices",
  QUOTES: "quotes",
  ADJUSTMENTS: "adjustments",
  AGREEMENTS: "agreements",
  PROPOSALS: "proposals",
  EXPENSES: "expenses",
  EMAILS: "emails",
  TAX: "tax",
  SETTINGS: "settings",
  USERS: "users",
});

export const VIEW_ORDER = Object.freeze([
  VIEWS.DASHBOARD,
  VIEWS.CLIENTS,
  VIEWS.INVOICES,
  VIEWS.QUOTES,
  VIEWS.ADJUSTMENTS,
  VIEWS.AGREEMENTS,
  VIEWS.PROPOSALS,
  VIEWS.EXPENSES,
  VIEWS.EMAILS,
  VIEWS.TAX,
  VIEWS.SETTINGS,
  VIEWS.USERS,
]);

export const NAV_ITEMS = Object.freeze([
  { id: VIEWS.DASHBOARD, label: "Dashboard" },
  { id: VIEWS.CLIENTS, label: "Clients" },
  { id: VIEWS.INVOICES, label: "Invoices" },
  { id: VIEWS.QUOTES, label: "Quotes" },
  { id: VIEWS.ADJUSTMENTS, label: "Adjustments" },
  { id: VIEWS.AGREEMENTS, label: "Agreements" },
  { id: VIEWS.PROPOSALS, label: "Proposals" },
  { id: VIEWS.EXPENSES, label: "Expenses" },
  { id: VIEWS.EMAILS, label: "Emails" },
  { id: VIEWS.TAX, label: "Tax" },
]);

export const NAV_GROUPS = Object.freeze([
  { label: "Overview", items: [VIEWS.DASHBOARD] },
  { label: "Clients", items: [VIEWS.CLIENTS] },
  { label: "Revenue", items: [VIEWS.INVOICES, VIEWS.QUOTES, VIEWS.ADJUSTMENTS] },
  { label: "Agreements", items: [VIEWS.AGREEMENTS, VIEWS.PROPOSALS] },
  { label: "Operations", items: [VIEWS.EXPENSES, VIEWS.EMAILS, VIEWS.TAX] },
]);

export function buildNavGroups(navItems = NAV_ITEMS, navGroups = NAV_GROUPS) {
  return navGroups
    .map((group) => ({
      label: group.label,
      items: group.items
        .map((id) => navItems.find((item) => item.id === id))
        .filter(Boolean),
    }))
    .filter((group) => group.items.length);
}
