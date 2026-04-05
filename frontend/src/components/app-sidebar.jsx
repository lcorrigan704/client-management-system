import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeamSwitcher } from "@/components/team-switcher";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CalendarDays,
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
  workspaces,
  activeWorkspace,
  onSwitchWorkspace,
  onCreateWorkspace,
  onSetDefaultWorkspace,
  onUpdateWorkspace,
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
    () => {
      const mapped = (workspaces || []).map((membership) => ({
        id: membership.workspace.id,
        name: membership.workspace.name || companyName || "Workspace",
        logo: Building2,
        plan: membership.role || "Workspace",
        isDefault: Boolean(membership.is_default),
      }));
      if (mapped.length) return mapped;
      return [
        {
          id: 0,
          name: companyName || "Workspace",
          logo: Building2,
          plan: "Workspace",
          isDefault: true,
        },
      ];
    },
    [companyName, workspaces]
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
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          teams={teams}
          activeTeamId={activeWorkspace?.id}
          onTeamSwitch={onSwitchWorkspace}
          onCreateTeam={onCreateWorkspace}
          onSetDefaultTeam={onSetDefaultWorkspace}
          onUpdateTeam={onUpdateWorkspace}
        />
        <div className={isCollapsed ? "pb-2" : "px-2 pb-2"}>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger className="mx-auto h-8 w-8 items-center justify-center gap-0 rounded-md border-0 bg-transparent px-0 shadow-none [&>svg:last-child]:hidden">
                    <CalendarDays className="h-4 w-4" />
                    <span className="sr-only">Select financial year</span>
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Financial year
                </TooltipContent>
              </Tooltip>
            ) : (
              <SelectTrigger>
                <SelectValue placeholder="All FYs" />
              </SelectTrigger>
            )}
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
