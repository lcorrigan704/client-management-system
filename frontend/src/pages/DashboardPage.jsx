import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function DashboardCard({ title, description, value, onClick }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
      </CardContent>
      <CardFooter>
        <Button onClick={onClick}>Open</Button>
      </CardFooter>
    </Card>
  );
}

export default function DashboardPage({
  selectedYear,
  financialTotals,
  filteredClients,
  filteredProposals,
  filteredAgreements,
  complianceDates,
  settings,
  onNavigate,
  formatGBP,
}) {
  const yearDescription =
    selectedYear === "all" ? "All years" : `Financial year ${selectedYear}`;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Overview</h2>
        <p className="text-sm text-muted-foreground">
          Financials and compliance at a glance.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          title="Total quoted"
          description={yearDescription}
          value={formatGBP(financialTotals.totalQuoted)}
          onClick={() => onNavigate("quotes")}
        />
        <DashboardCard
          title="Total invoiced"
          description={yearDescription}
          value={formatGBP(financialTotals.totalInvoiced)}
          onClick={() => onNavigate("invoices")}
        />
        <DashboardCard
          title="Total paid"
          description={yearDescription}
          value={formatGBP(financialTotals.totalPaid)}
          onClick={() => onNavigate("invoices")}
        />
        <DashboardCard
          title="Clients"
          description="Active client records"
          value={filteredClients.length}
          onClick={() => onNavigate("clients")}
        />
        <DashboardCard
          title="Proposals"
          description="Tracked proposals"
          value={filteredProposals.length}
          onClick={() => onNavigate("proposals")}
        />
        <DashboardCard
          title="Service agreements"
          description="Stored agreements"
          value={filteredAgreements.length}
          onClick={() => onNavigate("agreements")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Financial year snapshot</CardTitle>
            <CardDescription>
              January to January reporting with October filing deadline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Financial year: {String(settings?.fy_start_day || 1).padStart(2, "0")}/
              {String(settings?.fy_start_month || 1).padStart(2, "0")} –
              {" "}
              {String(settings?.fy_end_day || 31).padStart(2, "0")}/
              {String(settings?.fy_end_month || 12).padStart(2, "0")}
            </p>
            <p>Accounts due: {complianceDates.filingDue}</p>
            <p>Total quoted: {formatGBP(financialTotals.totalQuoted)}</p>
            <p>Total invoiced: {formatGBP(financialTotals.totalInvoiced)}</p>
            <p>Total paid: {formatGBP(financialTotals.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Compliance reminders</CardTitle>
            <CardDescription>Annual company dates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Confirmation date: {complianceDates.confirmationDate}</p>
            <p>Confirmation due: {complianceDates.confirmationDue}</p>
            <p>Accounts filing due: {complianceDates.filingDue}</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
