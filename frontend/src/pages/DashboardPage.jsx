import {
  ArrowRight,
  ClipboardList,
  Coins,
  FileText,
  ReceiptPoundSterling,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function KpiCard({ eyebrow, title, value, detail, icon: Icon, tone = "slate", onClick }) {
  const toneStyles = {
    slate: "from-slate-100 via-white to-slate-50",
    blue: "from-blue-100 via-white to-sky-50",
    emerald: "from-emerald-100 via-white to-emerald-50",
    amber: "from-amber-100 via-white to-amber-50",
    rose: "from-rose-100 via-white to-rose-50",
  };

  return (
    <Card className="group relative overflow-hidden border-0 bg-card/95 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${toneStyles[tone]} opacity-70`} />
      <CardContent className="relative space-y-5 p-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {eyebrow}
          </p>
          <div>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
          </div>
        </div>
        <div className="flex items-end justify-between gap-4">
          <p className="max-w-[16rem] text-sm leading-6 text-muted-foreground">{detail}</p>
          {onClick ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1 px-2 text-muted-foreground"
              onClick={onClick}
            >
              Open
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryStat({ label, value, tone = "default" }) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : "text-foreground";

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50/90 px-4 py-3.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

function MetricTile({ label, value, description }) {
  return (
    <div className="rounded-3xl bg-white/88 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function ReminderItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50/85 px-4 py-4">
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Icon className="h-4 w-4" />
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
  const bandStyles = {
    slate: "#0f172a",
    blue: "#2563eb",
    emerald: "#059669",
    amber: "#d97706",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-8 py-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">{amount}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 ">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, backgroundColor: bandStyles[tint] }}
        />
      </div>
    </div>
  );
}

function AdjustmentTile({ label, value, detail, tone = "slate" }) {
  const toneStyles = {
    slate: "bg-slate-50 text-slate-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="rounded-2xl bg-white/90 p-4">
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
  const totalQuoted = Number(financialTotals?.totalQuoted || 0);
  const totalInvoiced = Number(financialTotals?.totalInvoiced || 0);
  const totalPaid = Number(financialTotals?.totalPaid || 0);
  const totalCredited = Number(financialTotals?.totalCredited || 0);
  const totalRefunded = Number(financialTotals?.totalRefunded || 0);
  const grossBilling = totalInvoiced + totalCredited;
  const portfolioTotal = filteredClients.length + filteredProposals.length + filteredAgreements.length;
  const collectedRatio = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;
  const grossDelta = grossBilling - totalPaid;

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.7fr_0.85fr]">
        <Card className="overflow-hidden rounded-[28px] border-border/60 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,0.96),rgba(14,165,233,0.06))] shadow-sm">
          <CardContent className="p-6 lg:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                    Client Management App
                  </div>
                  <div className="space-y-3">
                    <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                      Clean financial control, live workload visibility, and less dashboard noise.
                    </h2>
                    <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                      {yearLabel}. Track net invoicing, credits, refunds, and the active delivery
                      portfolio from one operational view.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
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
                  />
                </div>
              </div>

              <div className="rounded-[28px] bg-white/90 py-6 backdrop-blur lg:p-7">
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

                <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-4 rounded-3xl bg-slate-50/90 p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SummaryStat label="Gross billing" value={formatGBP(grossBilling)} />
                      <SummaryStat label="Net collected" value={formatGBP(totalPaid)} tone="positive" />
                      <SummaryStat label="Invoice base" value={formatGBP(totalInvoiced)} />
                      <SummaryStat label="Gross-to-net gap" value={formatGBP(grossDelta)} tone="negative" />
                    </div>
                    <div className="rounded-2xl bg-white/90 p-4">
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

        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="px-6 pb-2 pt-6">
            <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em]">
              Operations
            </CardDescription>
            <CardTitle className="text-2xl">Workspace load</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6 pt-4">
            <div className="rounded-3xl bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.98))] p-5">
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
              <SummaryStat label="Clients" value={String(filteredClients.length)} />
              <SummaryStat label="Proposals" value={String(filteredProposals.length)} />
              <SummaryStat label="Service agreements" value={String(filteredAgreements.length)} />
            </div>

            <div className="grid gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-11 justify-between rounded-xl bg-white"
                onClick={() => onNavigate("clients")}
              >
                Open clients
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 justify-between rounded-xl bg-white"
                onClick={() => onNavigate("proposals")}
              >
                Open proposals
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 justify-between rounded-xl bg-white"
                onClick={() => onNavigate("agreements")}
              >
                Open agreements
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          eyebrow="Pipeline"
          title="Quoted pipeline"
          value={formatGBP(totalQuoted)}
          detail="Outstanding quote value available to convert into revenue."
          icon={ClipboardList}
          tone="blue"
          onClick={() => onNavigate("quotes")}
        />
        <KpiCard
          eyebrow="Billing"
          title="Net invoiced"
          value={formatGBP(totalInvoiced)}
          detail="Issued invoices after credit note adjustments."
          icon={ReceiptPoundSterling}
          tone="slate"
          onClick={() => onNavigate("invoices")}
        />
        <KpiCard
          eyebrow="Cash"
          title="Net paid"
          value={formatGBP(totalPaid)}
          detail="Paid invoice value retained after refunds."
          icon={WalletCards}
          tone="emerald"
          onClick={() => onNavigate("adjustments")}
        />
        <KpiCard
          eyebrow="Adjustments"
          title="Credit and refund activity"
          value={formatGBP(totalCredited + totalRefunded)}
          detail="Combined revenue adjustments requiring active oversight."
          icon={Coins}
          tone="amber"
          onClick={() => onNavigate("adjustments")}
        />
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
