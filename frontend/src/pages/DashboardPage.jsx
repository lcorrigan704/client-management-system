import {
  ArrowRight,
  FileText,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function SummaryStat({ label, value, tone = "default" }) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border/50 bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold leading-tight ${toneClass}`}>{value}</span>
    </div>
  );
}

function SummaryActionStat({ label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${label.toLowerCase()}`}
      className="flex w-full items-center justify-between rounded-2xl border border-border/50 bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {value}
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    </button>
  );
}

function MetricTile({ label, value, description, className = "" }) {
  return (
    <div className={`min-w-0 rounded-3xl border border-border/50 bg-card p-4 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2.5 break-words text-[clamp(1.5rem,1.8vw,1.95rem)] font-semibold leading-tight tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function ReminderItem({ icon, label, value }) {
  const IconComponent = icon;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/40 px-4 py-4">
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
        <IconComponent className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function ProgressBand({ label, value, amount, tint = "slate" }) {
  const width = Math.max(8, Math.min(100, value));
  const bandClass = {
    slate: "bg-foreground/85",
    blue: "bg-blue-600 dark:bg-blue-500",
    emerald: "bg-emerald-600 dark:bg-emerald-500",
    amber: "bg-amber-600 dark:bg-amber-500",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-8 py-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">{amount}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${bandClass[tint] || bandClass.slate}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function AdjustmentTile({ label, value, detail, tone = "slate" }) {
  const toneStyles = {
    slate: "bg-muted text-muted-foreground",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneStyles[tone]}`}>
          {detail}
        </div>
      </div>
    </div>
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
  const yearLabel =
    selectedYear === "all" ? "All financial years" : `Financial year ${selectedYear}`;
  const fyRange = `${String(settings?.fy_start_day || 1).padStart(2, "0")}/${String(
    settings?.fy_start_month || 1
  ).padStart(2, "0")} - ${String(settings?.fy_end_day || 31).padStart(2, "0")}/${String(
    settings?.fy_end_month || 12
  ).padStart(2, "0")}`;
  const totalInvoiced = Number(financialTotals?.totalInvoiced || 0);
  const totalPaid = Number(financialTotals?.totalPaid || 0);
  const totalCredited = Number(financialTotals?.totalCredited || 0);
  const totalRefunded = Number(financialTotals?.totalRefunded || 0);
  const grossBilling = totalInvoiced + totalCredited;
  const portfolioTotal = filteredClients.length + filteredProposals.length + filteredAgreements.length;
  const collectedRatio = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;
  const grossDelta = grossBilling - totalPaid;

  return (
    <section className="space-y-5">
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[28px] border-border/60 bg-card shadow-sm">
          <CardContent className="p-5 lg:p-6">
          <div className="space-y-5">
            <div className="space-y-6">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground shadow-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                    Client Management App
                  </div>
                  <div className="space-y-2.5">
                    <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                      Clean financial control, live workload visibility, and less dashboard noise.
                    </h2>
                    <p className="text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
                      {yearLabel}. Track net invoicing, credits, refunds, and the active delivery
                      portfolio from one operational view.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <MetricTile
                    label="Net paid"
                    value={formatGBP(totalPaid)}
                    description="Collected cash after refund activity."
                  />
                  <MetricTile
                    label="Net invoiced"
                    value={formatGBP(totalInvoiced)}
                    description="Issued invoices less credit notes."
                  />
                  <MetricTile
                    label="Financial year"
                    value={fyRange}
                    description="Active reporting window used across the workspace."
                    className="sm:col-span-2 xl:col-span-1"
                  />
                </div>
              </div>

            <div className="rounded-[28px] border border-border/50 bg-background/70 p-5 backdrop-blur lg:p-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Financial posture
                </p>
                  <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                    Gross to net position
                  </h3>
                  <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                    A cleaner view of billed revenue, adjustment activity, and retained cash for
                    the selected period.
                  </p>
                </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-4 rounded-3xl border border-border/50 bg-muted/35 p-5">
                    <div className="grid gap-3 lg:grid-cols-2">
                      <SummaryStat label="Gross billing" value={formatGBP(grossBilling)} />
                      <SummaryStat label="Net collected" value={formatGBP(totalPaid)} tone="positive" />
                      <SummaryStat label="Invoice base" value={formatGBP(totalInvoiced)} />
                      <SummaryStat label="Gross-to-net gap" value={formatGBP(grossDelta)} tone="negative" />
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-card p-4">
                      <ProgressBand
                        label="Collection rate"
                        value={collectedRatio}
                        amount={`${Math.round(collectedRatio)}% of net invoiced collected`}
                        tint="emerald"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <AdjustmentTile
                      label="Credits issued"
                      value={formatGBP(totalCredited)}
                      detail={totalCredited > 0 ? "Revenue reduced" : "No credits"}
                      tone="amber"
                    />
                    <AdjustmentTile
                      label="Refunds processed"
                      value={formatGBP(totalRefunded)}
                      detail={totalRefunded > 0 ? "Cash returned" : "No refunds"}
                      tone="blue"
                    />
                    <AdjustmentTile
                      label="Adjustments total"
                      value={formatGBP(totalCredited + totalRefunded)}
                      detail={totalCredited + totalRefunded > 0 ? "Under review" : "No activity"}
                      tone="slate"
                    />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Button type="button" className="h-11 justify-between rounded-xl" onClick={() => onNavigate("invoices")}>
                    Invoices
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 justify-between rounded-xl"
                    onClick={() => onNavigate("adjustments")}
                  >
                    Adjustments
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      <Card className="w-full rounded-[28px] border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="px-6 pb-2 pt-6">
            <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em]">
              Operations
            </CardDescription>
            <CardTitle className="text-2xl">Workspace load</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6 pt-4">
            <div className="rounded-3xl border border-border/50 bg-muted/35 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Active portfolio
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
                  {portfolioTotal}
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Combined client, proposal, and service agreement workload in the selected period.
              </p>
            </div>

            <div className="space-y-3">
              <SummaryActionStat
                label="Clients"
                value={String(filteredClients.length)}
                onClick={() => onNavigate("clients")}
              />
              <SummaryActionStat
                label="Proposals"
                value={String(filteredProposals.length)}
                onClick={() => onNavigate("proposals")}
              />
              <SummaryActionStat
                label="Service agreements"
                value={String(filteredAgreements.length)}
                onClick={() => onNavigate("agreements")}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-sm">
        <CardHeader className="px-6 pb-2 pt-6">
          <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em]">
            Compliance
          </CardDescription>
          <CardTitle className="text-2xl">Upcoming company dates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 px-6 pb-6 pt-4 md:grid-cols-3">
          <ReminderItem icon={ShieldCheck} label="Confirmation date" value={complianceDates.confirmationDate} />
          <ReminderItem icon={FileText} label="Confirmation due" value={complianceDates.confirmationDue} />
          <ReminderItem icon={WalletCards} label="Accounts filing due" value={complianceDates.filingDue} />
        </CardContent>
      </Card>
    </section>
  );
}
