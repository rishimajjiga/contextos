/**
 * PaymentSuccessPage.tsx
 * Shown after a successful Razorpay payment.
 * Can be used as a redirect target by setting Razorpay's callback_url,
 * or navigated to programmatically after openRazorpayCheckout succeeds.
 *
 * Query params:
 *   plan  — optional, e.g. "pro" | "team" | "student"
 */
import { useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { billingService } from "@/services/billing.service";

const PLAN_LABEL: Record<string, string> = {
  pro:         "Pro",
  pro_annual:  "Pro (Annual)",
  team:        "Team",
  team_annual: "Team (Annual)",
  student:     "Student",
};

export function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const plan      = params.get("plan") ?? "";
  const planLabel = PLAN_LABEL[plan] ?? "your new plan";

  // Run reconciliation on mount — ensures subscription is active even if the
  // webhook was delayed or the verify call hit a race condition.
  useEffect(() => {
    billingService.reconcile().catch(() => { /* non-fatal */ });
  }, []);

  // Auto-redirect to dashboard after 8 seconds so users who land here via
  // Razorpay callback_url aren't stranded.
  useEffect(() => {
    const t = setTimeout(() => navigate("/dashboard"), 8000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-0 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* ── Icon ── */}
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle2 className="h-10 w-10 text-green-400" />
          </div>
        </div>

        {/* ── Copy ── */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Payment successful!</h1>
          <p className="text-muted-foreground text-sm">
            You're now on the{" "}
            <span className="text-foreground font-semibold">{planLabel}</span>.
            Your subscription is active and all features are unlocked.
          </p>
        </div>

        {/* ── CTAs ── */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to="/dashboard">
              Go to Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/payment-history">
              <Receipt className="mr-1.5 h-4 w-4" />
              View receipt
            </Link>
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground/60">
          You'll be redirected to your dashboard in a few seconds…
        </p>
      </div>
    </div>
  );
}
