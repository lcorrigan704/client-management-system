import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, Settings as SettingsIcon, User as UserIcon } from "lucide-react";

export default function NavBar({
  companyName,
  navItems,
  view,
  setView,
  selectedYear,
  setSelectedYear,
  financialYears,
  formatFinancialYearLabel,
  onLogout,
  showSettings = true,
  showUsers = false,
}) {
  const navMap = new Map(navItems.map((item) => [item.id, item]));
  const handleNavigate = (id) => {
    if (!id) return;
    setView(id);
  };
  const renderNavLink = (id) => {
    const item = navMap.get(id);
    if (!item) return null;
    return (
      <NavigationMenuLink
        className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          view === item.id
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
        onClick={() => handleNavigate(item.id)}
      >
        {item.label}
      </NavigationMenuLink>
    );
  };
  const renderSheetLink = (id) => {
    const item = navMap.get(id);
    if (!item) return null;
    return (
      <button
        type="button"
        className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
          view === item.id
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
        onClick={() => handleNavigate(item.id)}
      >
        {item.label}
      </button>
    );
  };

  const groupedNav = [
    { label: "Overview", items: ["dashboard"] },
    { label: "Clients", items: ["clients"] },
    { label: "Revenue", items: ["invoices", "quotes"] },
    { label: "Agreements", items: ["agreements", "proposals"] },
    { label: "Operations", items: ["expenses", "emails"] },
  ].filter((group) => group.items.some((id) => navMap.has(id)));

  return (
    <nav className="border-b bg-background">
      <div className="flex w-full flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {companyName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList className="relative">
              {groupedNav.map((group) => (
                <NavigationMenuItem key={group.label} className="relative">
                  <NavigationMenuTrigger>{group.label}</NavigationMenuTrigger>
                  <NavigationMenuContent className="absolute left-0 top-full w-[220px] rounded-md border bg-popover text-popover-foreground shadow-md">
                    <div className="grid w-[220px] gap-1 p-2">
                      {group.items.map((itemId) => (
                        <div key={itemId}>{renderNavLink(itemId)}</div>
                      ))}
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
          <div className="hidden items-center gap-2 lg:flex">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[150px]">
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
            {showSettings ? (
              <Button
                variant={view === "settings" ? "default" : "outline"}
                onClick={() => setView("settings")}
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            ) : null}
            {onLogout ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <UserIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {showUsers ? (
                    <DropdownMenuItem onClick={() => setView("users")}>
                      User management
                    </DropdownMenuItem>
                  ) : null}
                  {showUsers ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem onClick={onLogout}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[280px] overflow-y-auto sm:w-[320px]"
            >
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    {companyName}
                  </p>
                  <p className="text-lg font-semibold text-foreground">CRM Dashboard</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Financial year
                  </p>
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
                <div className="space-y-4">
                  {groupedNav.map((group) => (
                    <div key={group.label} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {group.label}
                      </p>
                      <div className="space-y-1">
                        {group.items.map((itemId) => (
                          <div key={itemId}>{renderSheetLink(itemId)}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {onLogout ? (
                  <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm text-foreground">Account</div>
                  </div>
                ) : null}
                {showSettings ? (
                  <Button
                    variant={view === "settings" ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setView("settings")}
                  >
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                ) : null}
                {showUsers ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setView("users")}
                  >
                    User management
                  </Button>
                ) : null}
                {onLogout ? (
                  <Button variant="outline" className="w-full justify-start" onClick={onLogout}>
                    Sign out
                  </Button>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
