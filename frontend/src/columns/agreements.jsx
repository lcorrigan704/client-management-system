import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { formatDate } from "@/utils/format";

const getAgreementColumns = ({
  clientMap,
  quoteMap,
  onEdit,
  onDelete,
  onGenerateEmail,
  onGeneratePdf,
  onSendReminder,
}) => [
  {
    accessorKey: "display_id",
    header: "Agreement ID",
    cell: ({ row }) => row.original.display_id || "—",
  },
  { accessorKey: "title", header: "Title" },
  {
    accessorKey: "client_id",
    header: "Client",
    cell: ({ row }) => clientMap.get(row.original.client_id)?.company || "—",
  },
  {
    accessorKey: "quote_id",
    header: "Quote",
    cell: ({ row }) => {
      const quote = quoteMap?.get(row.original.quote_id);
      return quote?.display_id || "—";
    },
  },
  {
    accessorKey: "start_date",
    header: "Start date",
    cell: ({ row }) => formatDate(row.original.start_date),
  },
  {
    accessorKey: "end_date",
    header: "End date",
    cell: ({ row }) => formatDate(row.original.end_date),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(row.original)}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onGenerateEmail(row.original.id)}>
            Generate email
          </DropdownMenuItem>
          {onGeneratePdf && (
            <DropdownMenuItem onClick={() => onGeneratePdf(row.original.id)}>
              Generate PDF
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onSendReminder(row.original.id)}>
            Send reminder
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDelete(row.original.id)}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
  },
];

export { getAgreementColumns };
