import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import { defaultSettings } from "@/constants/defaults";

const useAppData = ({ onError, enabled = true } = {}) => {
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [
        clientsData,
        invoicesData,
        quotesData,
        agreementsData,
        proposalsData,
        expensesData,
        settingsData,
      ] =
        await Promise.all([
          api.getClients(),
          api.getInvoices(),
          api.getQuotes(),
          api.getAgreements(),
          api.getProposals(),
          api.getExpenses(),
          api.getSettings(),
        ]);
      setClients(clientsData);
      setInvoices(invoicesData);
      setQuotes(quotesData);
      setAgreements(agreementsData);
      setProposals(proposalsData);
      setExpenses(expensesData);
      setSettings(settingsData || defaultSettings);
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }
  }, [onError]);

  useEffect(() => {
    if (enabled) {
      loadAll();
    }
  }, [enabled, loadAll]);

  const clientMap = useMemo(() => {
    const map = new Map();
    clients.forEach((client) => map.set(client.id, client));
    return map;
  }, [clients]);

  return {
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
  };
};

export default useAppData;
