/**
 * PaymentHistoryPage.tsx
 * Shows the signed-in user's full Razorpay payment history.
 * Data is fetched from GET /billing/payments.
 */
import { useEffect, useState } from "react";
import { Receipt, RefreshCw, AlertCircle, CalendarDays, RefreshCcw, Clock, Gift, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { billingService, type PaymentRecord, type PlanInfo } from "@/services/billing.service";

// ── Status badge colour map ───────────────────────────────────────────────────
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  captured: "default",
  refunded: "secondary",
  failed:   "destructive",
  pending:  "outline",
};

const STATUS_LABEL: Record<string, string> = {
  captured: "Paid",
  refunded: "Refunded",
  failed:   "Failed",
  pending:  "Pending",
};

const PLAN_LABEL: Record<string, string> = {
  free:    "Free",
  student: "Student",
  pro:     "Pro",
  team:    "Team",
  founder: "Founder",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day:   "2-digit",
      month: "short",
      year:  "numeric",
    });
  } catch {
    return iso;
  }
}

// ── New Member Offer timeline ("Your Pro Plan") ───────────────────────────────
function fmt(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function ProOfferTimeline({ plan }: { plan: PlanInfo | null }) {
  const offer = plan?.offer;
  if (!plan || plan.plan !== "pro" || !offer?.started_at || !offer.end_date) return null;

  const now = new Date();
  const end = new Date(offer.end_date);
  const inOffer = now < end;
  const remaining = offer.free_months_remaining;
  const endingSoon = inOffer && end.getTime() - now.getTime() < 14 * 24 * 3600 * 1000;

  // Free months are the two 30-day windows immediately before the offer end
  // (this stays correct for both new subscribers and backfilled existing
  // users, whose paid period may be longer than one month). Dates come from
  // the backend — never computed from the frontend's idea of billing.
  const free1 = new Date(end.getTime() - 60 * 24 * 3600 * 1000);
  const free2 = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
  const steps = [
    { date: new Date(offer.started_at), label: "₹499 Paid", sub: "Pro activated", done: true },
    { date: free1, label: "Free month", sub: "No charge", done: now >= free1 },
    { date: free2, label: "Free month", sub: "No charge", done: now >= free2 },
    { date: end, label: "₹499/month", sub: "Recurring billing resumes", done: now >= end },
  ];

  return (
    <Card className="border-brand-500/25 bg-brand-500/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Gift className="h-4 w-4 text-brand-500" /> Your Pro Plan
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="text-[10px]">Active</Badge>
            <Badge variant="outline" className="border-brand-400/40 text-[10px] text-brand-600">
              🎁 Pro Bonus Offer Applied
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="mb-3 text-sm font-medium text-foreground">
          You received 2 extra months of Pro at no additional cost.
        </p>
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
          <span>
            You paid: <span className="font-semibold text-foreground">₹499</span>
          </span>
          <span>
            Access valid until: <span className="font-semibold text-foreground">✓ {fmt(end)}</span>
          </span>
          <span>
            Next payment:{" "}
            <span className="font-semibold text-foreground">
              {fmt(new Date(plan.next_payment_date ?? offer.end_date))} · ₹499/month
            </span>
          </span>
          {inOffer && remaining > 0 && (
            <span className="font-semibold text-brand-600">
              {remaining} free month{remaining === 1 ? "" : "s"} remaining
            </span>
          )}
        </div>

        {/* Payment timeline */}
        <ol className="relative space-y-0">
          {steps.map((s, i) => (
            <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
              {i < steps.length - 1 && (
                <span className="absolute left-[9px] top-5 h-full w-px bg-border" aria-hidden />
              )}
              <span
                className={`relative z-10 mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
                  s.done ? "bg-brand-500 text-white" : "border-2 border-border bg-card"
                }`}
              >
                {s.done && <CheckCircle2 className="h-3 w-3" />}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="text-xs font-semibold text-foreground">{fmt(s.date)}</span>
                <span className="text-xs font-medium text-brand-600">{s.label}</span>
                <span className="text-[11px] text-muted-foreground">{s.sub}</span>
              </div>
            </li>
          ))}
        </ol>

        {endingSoon && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            Your free Pro period ends on {fmt(end)}. Your next payment of ₹499 will be charged after that.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Subscription details pill row ─────────────────────────────────────────────
function SubscriptionDetailRow({ payment }: { payment: PaymentRecord }) {
  if (payment.status !== "captured") return null;
  const hasDetails = payment.started_on || payment.expires_on || payment.days_remaining !== null;
  if (!hasDetails) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground border-t border-border/30 pt-3">
      {payment.started_on && (
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3 shrink-0" />
          Started: <span className="text-foreground/80 ml-0.5">{formatDate(payment.started_on)}</span>
        </span>
      )}
      {payment.expires_on && (
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 shrink-0" />
          Expires: <span className="text-foreground/80 ml-0.5">{formatDate(payment.expires_on)}</span>
        </span>
      )}
      <span className="flex items-center gap-1">
        <RefreshCcw className="h-3 w-3 shrink-0" />
        Auto Renew:{" "}
        <span className={`ml-0.5 font-medium ${payment.auto_renew ? "text-green-600" : "text-amber-600"}`}>
          {payment.auto_renew ? "ON" : "OFF"}
        </span>
      </span>
      {payment.days_remaining !== null && (
        <span className="flex items-center gap-1">
          <span className="font-medium text-brand-500">{payment.days_remaining} days remaining</span>
        </span>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PaymentHistoryPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [plan, setPlan]       = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    // Plan (for the offer timeline) loads independently — a failure here
    // should never block the payment list.
    billingService.getPlan().then(setPlan).catch(() => {});
    try {
      const data = await billingService.getPaymentHistory();
      setPayments(data.payments);
    } catch (err: any) {
      setError(err?.message ?? "Could not load payment history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment History"
        description="All your Razorpay transactions — plans purchased, amounts, and statuses."
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* New Member Offer timeline — only for Pro users with the offer */}
      <ProOfferTimeline plan={plan} />

      {loading && (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && payments.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No payments yet.</p>
            <p className="text-xs text-muted-foreground/70">
              When you subscribe to a paid plan, your transactions will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && payments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {payments.length} transaction{payments.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* ── Desktop table ──────────────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-6 py-3 text-left font-medium">Date</th>
                    <th className="px-6 py-3 text-left font-medium">Plan</th>
                    <th className="px-6 py-3 text-left font-medium">Amount</th>
                    <th className="px-6 py-3 text-left font-medium">Status</th>
                    <th className="px-6 py-3 text-left font-medium">Started</th>
                    <th className="px-6 py-3 text-left font-medium">Expires</th>
                    <th className="px-6 py-3 text-left font-medium">Auto Renew</th>
                    <th className="px-6 py-3 text-left font-medium">Days Left</th>
                    <th className="px-6 py-3 text-left font-medium">Transaction ID</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr
                      key={p.id}
                      className={`border-b border-border/30 hover:bg-surface-1/40 transition-colors ${
                        i === payments.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-foreground/80 tabular-nums whitespace-nowrap">
                        {formatDate(p.purchase_date)}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        {PLAN_LABEL[p.plan_name] ?? p.plan_name}
                      </td>
                      <td className="px-6 py-4 tabular-nums font-semibold text-foreground">
                        {p.amount_display}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={STATUS_VARIANT[p.status] ?? "outline"} className="text-xs">
                          {STATUS_LABEL[p.status] ?? p.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-foreground/70 whitespace-nowrap">
                        {formatDate(p.started_on)}
                      </td>
                      <td className="px-6 py-4 text-foreground/70 whitespace-nowrap">
                        {formatDate(p.expires_on)}
                      </td>
                      <td className="px-6 py-4">
                        {p.status === "captured" ? (
                          <span className={`text-xs font-medium ${p.auto_renew ? "text-green-600" : "text-amber-600"}`}>
                            {p.auto_renew ? "ON" : "OFF"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 tabular-nums text-foreground/70">
                        {p.days_remaining !== null ? `${p.days_remaining}d` : "—"}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground break-all">
                        {p.payment_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ────────────────────────────────────────── */}
            <div className="md:hidden divide-y divide-border/30">
              {payments.map((p) => (
                <div key={p.id} className="px-4 py-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {PLAN_LABEL[p.plan_name] ?? p.plan_name} Plan
                    </span>
                    <Badge variant={STATUS_VARIANT[p.status] ?? "outline"} className="text-xs">
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{formatDate(p.purchase_date)}</span>
                    <span className="font-semibold tabular-nums">{p.amount_display}</span>
                  </div>
                  <SubscriptionDetailRow payment={p} />
                  <p className="font-mono text-[11px] text-muted-foreground/70 break-all">
                    {p.payment_id}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
