import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

export default function AppShell({
  companyName,
  navGroups,
  view,
  navigateTo,
  selectedYear,
  setSelectedYear,
  financialYears,
  formatFinancialYearLabel,
  logout,
  canManageSettings,
  isOwner,
  userEmail,
  children,
}) {
  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-background">
        <Toaster position="top-right" theme="system" richColors />
        <AppSidebar
          companyName={companyName}
          navGroups={navGroups}
          view={view}
          setView={navigateTo}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          financialYears={financialYears}
          formatFinancialYearLabel={formatFinancialYearLabel}
          onLogout={logout}
          showSettings={canManageSettings}
          showUsers={isOwner}
          userEmail={userEmail}
        />
        <SidebarInset>
          <header className="flex items-center justify-between gap-4 border-b bg-background px-4 py-3 lg:hidden">
            <SidebarTrigger />
            <div className="text-sm font-semibold text-foreground">Navigation</div>
          </header>
          <main className="w-full space-y-10 px-4 py-8">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

