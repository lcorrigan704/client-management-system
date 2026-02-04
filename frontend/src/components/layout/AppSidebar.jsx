import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck,
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Receipt,
  ScrollText,
  Settings,
  Users,
  User,
  Wallet,
} from "lucide-react";

export default function AppSidebar({
  companyName,
  navGroups,
  view,
  setView,
  selectedYear,
  setSelectedYear,
  financialYears,
  formatFinancialYearLabel,
  showSettings,
  showUsers,
  onLogout,
  userEmail,
}) {
  const iconMap = {
    dashboard: LayoutDashboard,
    clients: Users,
    invoices: Receipt,
    quotes: FileText,
    agreements: ScrollText,
    proposals: CalendarCheck,
    expenses: Wallet,
    emails: Mail,
  };

  const renderMenuItem = (id, label) => (
    <SidebarMenuItem key={id}>
      <SidebarMenuButton
        variant={view === id ? "active" : "default"}
        onClick={() => setView(id)}
      >
        {iconMap[id] ? (() => { const Icon = iconMap[id]; return <Icon className="h-4 w-4" />; })() : null}
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {companyName}
          </p>
        </div>
        <div className="mt-4">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger>
              <SelectValue placeholder="All FYs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All FYs</SelectItem>
              {financialYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {formatFinancialYearLabel ? formatFinancialYearLabel(year) : year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <div className="space-y-6">
          {navGroups.map((group, index) => (
            <div key={group.label} className="space-y-4">
              <SidebarGroup>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarMenu className="border-l border-border/60 pl-3">
                  {group.items.map((item) => renderMenuItem(item.id, item.label))}
                </SidebarMenu>
              </SidebarGroup>
              {index < navGroups.length - 1 ? (
                <div className="h-px w-full bg-border/60" />
              ) : null}
            </div>
          ))}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {userEmail || "Account"}
                  </p>
                  <p className="text-xs text-muted-foreground">Signed in</p>
                </div>
              </div>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {showUsers ? (
              <DropdownMenuItem onClick={() => setView("users")}>
                <Users className="mr-2 h-4 w-4" />
                User management
              </DropdownMenuItem>
            ) : null}
            {showSettings ? (
              <DropdownMenuItem onClick={() => setView("settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            ) : null}
            {showUsers || showSettings ? <DropdownMenuSeparator /> : null}
            {onLogout ? (
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
