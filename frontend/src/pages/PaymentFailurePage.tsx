/**
 * PaymentFailurePage.tsx
 * Shown when a Razorpay payment fails or is cancelled.
 * Can be navigated to programmatically from openRazorpayCheckout's onFailure
 * callback (pass the error reason as ?reason=...).
 *
 * Query params:
 *   reason — optional, e.g. "cancelled" | "failed" | error message
 *   plan   — optional, the plan the user was trying to purchase
 */
import { useSearchParams, Link } from "react-router-dom";
import { XCircle, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaymentFailurePage() {
  const [params]  = useSearchParams();
  const reason    = params.get("reason") ?? "";
  const plan      = params.get("plan") ?? "";
  const cancelled = reason === "cancelled";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* ── Icon ── */}
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/15">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
        </div>

        {/* ── Copy ── */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {cancelled ? "Payment cancelled" : "Payment failed"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {cancelled
              ? "You closed the payment window without completing the transaction. No money was charged."
              : reason
                ? `Something went wrong: ${reason}`
                : "We couldn't process your payment. Please try again or contact support if the issue persists."}
          </p>
        </div>

        {/* ── CTAs ── */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to={plan ? `/pricing?plan=${plan}` : "/pricing"}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Try again
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/settings">
              <Zap className="mr-1.5 h-4 w-4" />
              View plans
            </Link>
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground/60">
          No charge was applied to your account. You remain on your current plan.
        </p>
      </div>
    </div>
  );
}
