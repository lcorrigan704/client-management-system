import { Button } from "@/components/ui/button";
import StatusBadge from "@/ui/statusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { formatDate } from "@/utils/format";

const getProposalColumns = ({
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
    header: "Proposal ID",
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
    cell: ({ row }) => quoteMap?.get(row.original.quote_id)?.display_id || "—",
  },
  {
    accessorKey: "submitted_on",
    header: "Submitted",
    cell: ({ row }) => formatDate(row.original.submitted_on),
  },
  {
    accessorKey: "valid_until",
    header: "Valid until",
    cell: ({ row }) => formatDate(row.original.valid_until),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
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

export { getProposalColumns };
