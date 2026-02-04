import { Button } from "@/components/ui/button";
import StatusBadge from "@/ui/statusBadge";
import { toTimestamp } from "@/utils/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

const getInvoiceColumns = ({
  clientMap,
  formatDate,
  formatGBP,
  onEdit,
  onMarkPaid,
  onDelete,
  onGenerateEmail,
  onGeneratePdf,
  onSendReminder,
}) => [
  {
    accessorKey: "display_id",
    header: "Invoice ID",
    cell: ({ row }) => row.original.display_id || "—",
  },
  { accessorKey: "title", header: "Title" },
  {
    accessorKey: "client_id",
    header: "Client",
    cell: ({ row }) => clientMap.get(row.original.client_id)?.company || "—",
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => formatGBP(row.original.amount),
    meta: { footerClassName: "text-left" },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "due_date",
    header: "Due date",
    cell: ({ row }) => formatDate(row.original.due_date),
    sortingFn: (rowA, rowB) =>
      toTimestamp(rowA.original.due_date) - toTimestamp(rowB.original.due_date),
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
          <DropdownMenuItem onClick={() => onGeneratePdf(row.original.id)}>
            Generate PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSendReminder(row.original.id)}>
            Send reminder
          </DropdownMenuItem>
          {row.original.status !== "paid" ? (
            <DropdownMenuItem onClick={() => onMarkPaid(row.original.id)}>
              Mark paid
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDelete(row.original.id)}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
  },
];

export { getInvoiceColumns };
