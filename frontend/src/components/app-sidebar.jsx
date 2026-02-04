import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeamSwitcher } from "@/components/team-switcher";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  FileText,
  LayoutDashboard,
  Mail,
  ScrollText,
  Users,
  Wallet,
  Building2 
} from "lucide-react";

export function AppSidebar({
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
  ...props
}) {
  const teams = React.useMemo(
    () => [
      {
        name: companyName || "Workspace",
        logo: Building2,
        plan: "Workspace",
      },
    ],
    [companyName]
  );

  const iconMap = {
    Overview: LayoutDashboard,
    Clients: Users,
    Revenue: FileText,
    Agreements: ScrollText,
    Operations: Wallet,
  };

  const groupsWithIcons = navGroups.map((group) => ({
    ...group,
    icon: iconMap[group.label] || Mail,
  }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
        <div className="px-2 pb-2">
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
        <NavMain groups={groupsWithIcons} activeId={view} onNavigate={setView} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: userEmail || "Account",
            email: userEmail || "",
            avatar: "",
          }}
          showSettings={showSettings}
          showUsers={showUsers}
          onNavigate={setView}
          onLogout={onLogout}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
