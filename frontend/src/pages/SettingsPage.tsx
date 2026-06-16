import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { PlanBadge } from "@/components/common/PlanBadge";
import { billingService, openRazorpayCheckout, type PlanInfo } from "@/services/billing.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("upgraded") === "1") {
      toast.success("You're now on Pro. Enjoy unlimited memory!");
      setSearchParams({});
    }
  }, []);

  useEffect(() => {
    billingService.getPlan().then(setPlan).catch(() => {});
  }, []);

  async function handleCancel() {
    if (!confirm("Cancel your subscription? You'll keep access until the end of your billing period.")) return;
    setCancelLoading(true);
    try {
      await billingService.cancelSubscription(true);
      toast.success("Subscription cancelled. You'll keep access until your billing period ends.");
      setPlan((p) => p ? { ...p, plan: "free", is_trialing: false } : p);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not cancel subscription.");
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleStudentSubscribe() {
    setSubscribeLoading(true);
    try {
      await openRazorpayCheckout(
        "student",
        () => {
          toast.success("Subscribed! Your student plan is now active.");
          billingService.getPlan().then(setPlan).catch(() => {});
        },
        (err) => {
          if (err !== "cancelled") toast.error(err || "Payment failed. Please try again.");
        },
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong.");
    } finally {
      setSubscribeLoading(false);
    }
  }

  const daysLeft = plan?.is_trialing && plan.current_period_end
    ? Math.max(0, Math.ceil((new Date(plan.current_period_end).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account and subscription."
      />

      {/* Account */}
      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {user && (
            <div className="flex items-center gap-4">
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || ""}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white font-semibold">
                  {(user.fullName || user.primaryEmailAddress?.emailAddress || "U")[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-medium text-foreground">{user.fullName || "—"}</p>
                <p className="text-sm text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</p>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            To change your name, email, or password, visit{" "}
            <a
              href="https://accounts.clerk.dev/user"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              your Clerk account
            </a>
            .
          </p>
        </CardContent>
      </Card>

      {/* Plan & billing */}
      {plan && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Plan &amp; billing</CardTitle>
              <div className="flex items-center gap-2">
                <PlanBadge plan={plan.plan} />
                {plan.is_trialing && (
                  <span className="inline-flex items-center border border-green-500/30 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-600/10 text-green-400">
                    Trial
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Trial banner */}
            {plan.is_trialing && plan.current_period_end && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/8 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-green-400 mb-1">
                      🎓 Free trial — {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Trial ends{" "}
                      <strong className="text-foreground">
                        {new Date(plan.current_period_end).toLocaleDateString("en-IN", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </strong>
                      . Subscribe before then to keep your memories and stay on the Student plan.
                    </p>
                  </div>
                  <button
                    onClick={handleStudentSubscribe}
                    disabled={subscribeLoading}
                    className="shrink-0 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
                  >
                    {subscribeLoading ? "Opening…" : "Subscribe — ₹199/mo"}
                  </button>
                </div>
              </div>
            )}

            {/* Usage bars */}
            {(["documents", "projects"] as const).map((resource) => {
              const used = plan.usage[resource];
              const limit = plan.limits[resource];
              const unlimited = limit === -1;
              const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
              const label = resource === "documents" ? "Memories" : "Projects";
              return (
                <div key={resource}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-foreground font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {used} / {unlimited ? "∞" : limit}
                    </span>
                  </div>
                  {!unlimited && (
                    <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-brand-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  {unlimited && (
                    <div className="h-1.5 w-full rounded-full bg-brand-500/20">
                      <div className="h-full w-full rounded-full bg-brand-500/40" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Student plan details card */}
            {plan.plan === "student" && (
              <div className="rounded-lg border border-green-500/25 bg-green-500/5 p-4 space-y-2">
                <p className="text-sm font-medium text-green-400">🎓 Student Plan</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• 100 memories, 3 projects, 3 API keys</li>
                  <li>• Unlimited auto-inject</li>
                  <li>• All Chrome extension features</li>
                  <li>• No team sharing</li>
                </ul>
                <p className="text-xs text-muted-foreground pt-1 border-t border-green-500/20">
                  Verified via{" "}
                  <code className="text-green-400 bg-green-500/10 px-1 rounded">.edu</code> or{" "}
                  <code className="text-green-400 bg-green-500/10 px-1 rounded">.ac.in</code> email.
                  Need more? Upgrade to Pro for 500 memories and unlimited projects.
                </p>
              </div>
            )}

            {/* Renewal date (non-trial paid plans) */}
            {!plan.is_trialing && plan.current_period_end && plan.plan !== "free" && (
              <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                Renews on{" "}
                {new Date(plan.current_period_end).toLocaleDateString("en-IN", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              {plan.plan === "free" && (
                <button
                  onClick={() => navigate("/pricing")}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  ⚡ Upgrade plan
                </button>
              )}
              {plan.plan === "student" && !plan.is_trialing && (
                <button
                  onClick={() => navigate("/pricing")}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Upgrade to Pro
                </button>
              )}
              {plan.plan !== "free" && (
                <button
                  onClick={handleCancel}
                  disabled={cancelLoading}
                  className="px-4 py-2 border border-border hover:bg-surface-2 text-muted-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {cancelLoading ? "Cancelling…" : "Cancel subscription"}
                </button>
              )}
            </div>

          </CardContent>
        </Card>
      )}
    </div>
  );
}
