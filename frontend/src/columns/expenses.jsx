import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { toTimestamp } from "@/utils/format";

const getExpenseColumns = ({
  clientMap,
  userMap,
  formatDate,
  formatGBP,
  onEdit,
  onDelete,
  onGeneratePdf,
}) => [
  {
    accessorKey: "display_id",
    header: "Expense ID",
    cell: ({ row }) => row.original.display_id || "—",
  },
  { accessorKey: "title", header: "Title" },
  {
    accessorKey: "client_id",
    header: "Client",
    cell: ({ row }) => clientMap.get(row.original.client_id)?.company || "—",
  },
  {
    accessorKey: "user_id",
    header: "User",
    cell: ({ row }) => userMap.get(row.original.user_id)?.email || "—",
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => formatGBP(row.original.amount),
    meta: { footerClassName: "text-left" },
  },
  {
    accessorKey: "incurred_date",
    header: "Incurred date",
    cell: ({ row }) => formatDate(row.original.incurred_date),
    sortingFn: (rowA, rowB) =>
      toTimestamp(rowA.original.incurred_date) - toTimestamp(rowB.original.incurred_date),
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
          <DropdownMenuItem onClick={() => onGeneratePdf(row.original.id)}>
            Generate PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDelete(row.original.id)}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
  },
];

export { getExpenseColumns };
