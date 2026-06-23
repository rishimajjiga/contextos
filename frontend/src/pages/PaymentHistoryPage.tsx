/**
 * PaymentHistoryPage.tsx
 * Shows the signed-in user's full Razorpay payment history.
 * Data is fetched from GET /billing/payments.
 */
import { useEffect, useState } from "react";
import { Receipt, RefreshCw, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { billingService, type PaymentRecord } from "@/services/billing.service";

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

function formatDate(iso: string): string {
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

// ── Component ─────────────────────────────────────────────────────────────────

export function PaymentHistoryPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
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
