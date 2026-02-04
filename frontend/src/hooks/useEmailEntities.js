import { useMemo } from "react";

const useEmailEntities = ({
  entityType,
  clientId,
  clientMap,
  filteredInvoices,
  filteredQuotes,
  filteredAgreements,
  filteredProposals,
}) =>
  useMemo(() => {
    const matchesClient = (item) => (clientId ? String(item.client_id) === String(clientId) : true);
    switch (entityType) {
      case "quote":
        return {
          label: "Quote",
          items: filteredQuotes
            .filter(matchesClient)
            .map((item) => ({
              id: String(item.id),
              label: `${item.display_id || `QUOTE-${item.id}`} · ${
                clientMap.get(item.client_id)?.company ||
                clientMap.get(item.client_id)?.name ||
                "Unknown client"
              }`,
              clientId: item.client_id,
              email:
                clientMap.get(item.client_id)?.contact_email ||
                clientMap.get(item.client_id)?.email,
            })),
        };
      case "proposal":
        return {
          label: "Proposal",
          items: filteredProposals
            .filter(matchesClient)
            .map((item) => ({
              id: String(item.id),
              label: `${item.display_id || `PROP-${item.id}`} · ${
                clientMap.get(item.client_id)?.company ||
                clientMap.get(item.client_id)?.name ||
                "Unknown client"
              }`,
              clientId: item.client_id,
              email:
                clientMap.get(item.client_id)?.contact_email ||
                clientMap.get(item.client_id)?.email,
            })),
        };
      case "agreement":
        return {
          label: "Service agreement",
          items: filteredAgreements
            .filter(matchesClient)
            .map((item) => ({
              id: String(item.id),
              label: `${item.display_id || `AGR-${item.id}`} · ${
                clientMap.get(item.client_id)?.company ||
                clientMap.get(item.client_id)?.name ||
                "Unknown client"
              }`,
              clientId: item.client_id,
              email:
                clientMap.get(item.client_id)?.contact_email ||
                clientMap.get(item.client_id)?.email,
            })),
        };
      case "invoice":
      default:
        return {
          label: "Invoice",
          items: filteredInvoices
            .filter(matchesClient)
            .map((item) => ({
              id: String(item.id),
              label: `${item.display_id || `INV-${item.id}`} · ${
                clientMap.get(item.client_id)?.company ||
                clientMap.get(item.client_id)?.name ||
                "Unknown client"
              }`,
              clientId: item.client_id,
              email:
                clientMap.get(item.client_id)?.invoice_email ||
                clientMap.get(item.client_id)?.contact_email ||
                clientMap.get(item.client_id)?.email,
            })),
        };
    }
  }, [
    clientMap,
    clientId,
    entityType,
    filteredAgreements,
    filteredInvoices,
    filteredProposals,
    filteredQuotes,
  ]);

export default useEmailEntities;
