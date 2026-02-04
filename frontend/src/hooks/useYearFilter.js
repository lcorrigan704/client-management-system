import { useEffect, useMemo, useState } from "react";
import { parseISO, isBefore } from "date-fns";

const useYearFilter = ({
  clients,
  invoices,
  quotes,
  agreements,
  proposals,
  expenses,
  settings,
}) => {
  const [selectedYear, setSelectedYear] = useState("all");

  const normalizeDate = (dateValue) => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) {
      return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    }
    if (typeof dateValue === "string") {
      const parsed = parseISO(dateValue);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getFiscalYear = (dateValue) => {
    const parsed = normalizeDate(dateValue);
    if (!parsed) return null;
    if (!settings) return parsed.getFullYear();
    const startMonth = settings.fy_start_month;
    const startDay = settings.fy_start_day;
    const fyStart = new Date(parsed.getFullYear(), startMonth - 1, startDay);
    return isBefore(parsed, fyStart) ? parsed.getFullYear() - 1 : parsed.getFullYear();
  };

  const financialYears = useMemo(() => {
    const years = new Set();
    const addYear = (dateValue) => {
      const year = getFiscalYear(dateValue);
      if (year) years.add(year);
    };
    invoices.forEach((invoice) => addYear(invoice.due_date));
    quotes.forEach((quote) => addYear(quote.valid_until));
    agreements.forEach((agreement) => addYear(agreement.start_date || agreement.created_at));
    proposals.forEach((proposal) => addYear(proposal.valid_until || proposal.submitted_on || proposal.created_at));
    expenses.forEach((expense) => addYear(expense.incurred_date));
    clients.forEach((client) => addYear(client.created_at));
    const currentYear = getFiscalYear(new Date().toISOString()) || new Date().getFullYear();
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [agreements, clients, expenses, invoices, proposals, quotes, settings]);

  useEffect(() => {
    if (financialYears.length && selectedYear !== "all") {
      const numeric = Number(selectedYear);
      if (!financialYears.includes(numeric)) {
        setSelectedYear("all");
      }
    }
  }, [financialYears, selectedYear]);

  const formatFinancialYearLabel = (yearValue) => {
    if (!yearValue) return "";
    const next = String((Number(yearValue) + 1) % 100).padStart(2, "0");
    return `FY ${yearValue}/${next}`;
  };

  const yearMatches = (dateValue) => {
    if (selectedYear === "all") return true;
    return getFiscalYear(dateValue) === Number(selectedYear);
  };

  const filteredClients = useMemo(
    () => clients.filter((client) => yearMatches(client.created_at)),
    [clients, selectedYear]
  );
  const filteredInvoices = useMemo(
    () => invoices.filter((invoice) => yearMatches(invoice.due_date || invoice.issued_at)),
    [invoices, selectedYear]
  );
  const filteredQuotes = useMemo(
    () => quotes.filter((quote) => yearMatches(quote.valid_until || quote.issued_at)),
    [quotes, selectedYear]
  );
  const filteredAgreements = useMemo(
    () =>
      agreements.filter((agreement) =>
        yearMatches(agreement.start_date || agreement.created_at)
      ),
    [agreements, selectedYear]
  );
  const filteredProposals = useMemo(
    () =>
      proposals.filter((proposal) =>
        yearMatches(proposal.valid_until || proposal.submitted_on || proposal.created_at)
      ),
    [proposals, selectedYear]
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((expense) => yearMatches(expense.incurred_date || expense.created_at)),
    [expenses, selectedYear]
  );

  const financialTotals = useMemo(() => {
    const totalQuoted = quotes
      .filter((quote) => yearMatches(quote.valid_until))
      .reduce((sum, quote) => sum + Number(quote.amount || 0), 0);
    const totalInvoiced = invoices
      .filter((invoice) =>
        yearMatches(invoice.due_date) &&
        ["sent", "paid", "overdue"].includes(String(invoice.status || "").toLowerCase())
      )
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const totalPaid = invoices
      .filter((invoice) => (invoice.status === "paid" ? yearMatches(invoice.due_date) : false))
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

    return { totalQuoted, totalInvoiced, totalPaid };
  }, [invoices, quotes, selectedYear]);

  const complianceDates = useMemo(() => {
    const complianceYear =
      selectedYear === "all" ? new Date().getFullYear() : Number(selectedYear);
    const filingDue = settings
      ? `${String(settings.accounts_due_day).padStart(2, "0")}/${String(
          settings.accounts_due_month
        ).padStart(2, "0")}`
      : "31/10";
    const confirmationDate = settings
      ? `${String(settings.confirmation_date_day).padStart(2, "0")}/${String(
          settings.confirmation_date_month
        ).padStart(2, "0")}`
      : "27/01";
    const confirmationDue = settings
      ? `${String(settings.confirmation_due_day).padStart(2, "0")}/${String(
          settings.confirmation_due_month
        ).padStart(2, "0")}`
      : "10/02";
    return { filingDue, confirmationDate, confirmationDue, complianceYear };
  }, [selectedYear, settings]);

  return {
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
  };
};

export default useYearFilter;
