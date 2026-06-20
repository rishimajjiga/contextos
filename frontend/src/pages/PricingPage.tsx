import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import { billingService, openRazorpayCheckout } from "@/services/billing.service";

// Accepts .edu, .edu.<cc> (e.g. .edu.in), and .ac.<cc> (e.g. .ac.in, .ac.uk).
// Covers university domains like stanford.edu, iitb.ac.in, vit.ac.in.
function isEducationalEmail(email: string): boolean {
  const domain = (email.split("@")[1] ?? "").trim().toLowerCase();
  if (!domain) return false;
  return /\.edu$/.test(domain) || /\.edu\.[a-z]{2,}$/.test(domain) || /\.ac\.[a-z]{2,}$/.test(domain);
}

type Billing = "monthly" | "annual";

const PLANS = (billing: Billing) => [
  {
    id: "free" as const,
    name: "Free",
    price: "₹0",
    priceUSD: "$0",
    priceNote: "forever",
    annualNote: null,
    description: "Capture ideas, save notes, and organize your first projects — free forever.",
    cta: "Get started free",
    featured: false,
    badge: null,
    features: [
      "10 memories",
      "2 projects",
      "3 auto-injections / day",
      "1 API key",
      "Chrome extension",
    ],
    missing: ["Search", "Team sharing"],
  },
  {
    id: "student" as const,
    name: "Student",
    price: "₹199",
    priceUSD: "$2.10",
    priceNote: "/ month",
    annualNote: null,
    description: "For students with a college email. Includes 1 month free.",
    cta: "Claim student plan",
    featured: false,
    badge: "1 month free",
    features: [
      "200 memories",
      "5 projects",
      "Unlimited auto-inject",
      "3 API keys",
      "Chrome extension (all features)",
      ".edu / .ac.in email required",
    ],
    missing: ["Team sharing"],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: billing === "annual" ? "₹375" : "₹499",
    priceUSD: billing === "annual" ? "$3.95" : "$5.25",
    priceNote: "/ month",
    annualNote: billing === "annual" ? "billed ₹4,499 / year (~$47)" : "or ₹4,499 / year (save ₹1,500)",
    description: "Unlimited memories and projects. The full second brain experience.",
    cta: billing === "annual" ? "Get Pro — Annual" : "Upgrade to Pro",
    featured: true,
    badge: billing === "annual" ? "Save ₹1,500" : null,
    features: [
      "Unlimited memories",
      "Unlimited projects",
      "Unlimited auto-inject",
      "5 API keys",
      "Priority search",
      "Chrome extension (all features)",
    ],
    missing: ["Team sharing"],
  },
  {
    id: "team" as const,
    name: "Team",
    price: billing === "annual" ? "₹1,417" : "₹1,499",
    priceUSD: billing === "annual" ? "$14.90" : "$15.80",
    priceNote: "/ month",
    annualNote: billing === "annual" ? "billed ₹16,999 / year (~$179)" : "or ₹16,999 / year (save ₹980)",
    description: "A shared second brain for your whole team.",
    cta: billing === "annual" ? "Get Team — Annual" : "Upgrade to Team",
    featured: false,
    badge: billing === "annual" ? "Save ₹980" : null,
    features: [
      "Unlimited memories",
      "Unlimited projects",
      "Up to 5 seats",
      "Shared knowledge base",
      "Unlimited API keys",
      "Priority support",
    ],
    missing: [],
  },
];

// ── Student Claim Modal ────────────────────────────────────────────────────────

function StudentModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, user } = useUser();
  const [claiming, setClaiming] = useState(false);
  const [trialEnds, setTrialEnds] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [claimError, setClaimError] = useState(false);

  // Detect the student email directly from the authenticated Clerk user —
  // no server round-trip, so this never shows "Couldn't fetch account details".
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const eligible = isEducationalEmail(email);

  async function handleClaim() {
    setClaiming(true);
    setClaimError(false);
    try {
      const res = await billingService.studentClaim();
      setTrialEnds(res.trial_ends);
      setClaimed(true);
    } catch (err: any) {
      setClaimError(true);
      toast.error(err?.message ?? "Unable to verify your student account right now. Please try again later.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary">🎓 Student Plan</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {claimed ? (
          /* Claimed */
          <div className="space-y-4">
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-5 text-center">
              <p className="text-3xl mb-3">🎉</p>
              <p className="text-sm font-semibold text-green-400 mb-1">Trial activated!</p>
              <p className="text-xs text-text-secondary">
                Your free month runs until{" "}
                <strong>
                  {trialEnds
                    ? new Date(trialEnds).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                    : "30 days from now"}
                </strong>
                . After that, subscribe for ₹199/month to keep your memories.
              </p>
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Go to dashboard →
            </button>
          </div>
        ) : !isLoaded ? (
          /* Loading */
          <div className="py-10 text-center text-sm text-text-secondary">Checking your account…</div>
        ) : !isSignedIn ? (
          /* Signed out */
          <div className="space-y-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              Please sign in to check student eligibility.
            </p>
            <button
              onClick={() => navigate("/sign-in")}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Sign In
            </button>
          </div>
        ) : !email ? (
          /* Unable to read email */
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-300">
                Unable to verify your student account right now. Please try again later.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 border border-border hover:bg-surface-2 text-text-primary rounded-xl text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        ) : eligible ? (
          /* Eligible */
          <div className="space-y-4">
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 flex items-start gap-3">
              <span className="text-green-400 text-xl">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-400">Student account detected</p>
                <p className="text-xs text-text-secondary mt-1">
                  <strong>{email}</strong> is a verified student email.
                </p>
              </div>
            </div>
            <p className="text-sm text-text-secondary">
              Start your <strong>1-month free trial</strong> — no credit card needed. After 30 days,
              subscribe at ₹199/month to keep your memories.
            </p>
            {claimError && (
              <p className="text-xs text-amber-300">
                Unable to verify your student account right now. Please try again later.
              </p>
            )}
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {claiming ? "Starting…" : "Start Free Month"}
            </button>
          </div>
        ) : (
          /* Ineligible */
          <div className="space-y-4">
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
              <span className="text-red-400 text-xl">✗</span>
              <div>
                <p className="text-sm font-semibold text-red-400">Not eligible</p>
                <p className="text-xs text-text-secondary mt-1">
                  Student verification requires a valid educational email address (.edu or .ac.in).
                </p>
              </div>
            </div>
            <p className="text-xs text-text-secondary">
              Detected email: <strong>{email}</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 border border-border hover:bg-surface-2 text-text-primary rounded-xl text-sm font-medium transition-colors"
              >
                Close
              </button>
              <button
                disabled
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold opacity-50 cursor-not-allowed"
              >
                Start Free Month
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ── PricingPage ───────────────────────────────────────────────────────────────

export function PricingPage() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    billingService.getPlan().then(info => setCurrentPlan(info.plan)).catch(() => {});
  }, [isSignedIn]);

  async function handleCta(planId: "free" | "student" | "pro" | "team") {
    if (planId === "free") {
      navigate(isSignedIn ? "/dashboard" : "/sign-up");
      return;
    }

    if (planId === "student") {
      setShowStudentModal(true);
      return;
    }

    if (!isSignedIn) {
      navigate(`/sign-up?redirect_url=/pricing`);
      return;
    }

    const rzpPlan = billing === "annual"
      ? (planId === "pro" ? "pro_annual" : "team_annual")
      : planId;

    setLoading(planId);
    try {
      await openRazorpayCheckout(
        rzpPlan as any,
        () => {
          toast.success("Payment successful! Welcome to " + (planId === "pro" ? "Pro" : "Team") + " 🎉");
          navigate("/dashboard");
        },
        (err) => {
          if (err !== "cancelled") {
            toast.error(err || "Payment failed. Please try again.");
          }
        },
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const plans = PLANS(billing);

  return (
    <div className="min-h-screen bg-surface-0 py-20 px-4">
      {showStudentModal && <StudentModal onClose={() => setShowStudentModal(false)} />}

      <div className="max-w-6xl mx-auto">

        {/* Back button */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </button>

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-indigo-400 text-sm font-medium mb-3 tracking-wide uppercase">Pricing</p>
          <h1 className="text-4xl font-bold text-text-primary mb-4">Simple, honest pricing</h1>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            Start free. Upgrade when your knowledge grows.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <button
            onClick={() => setBilling("monthly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billing === "monthly"
                ? "bg-indigo-600 text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              billing === "annual"
                ? "bg-indigo-600 text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Annual
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              billing === "annual" ? "bg-white/20 text-white" : "bg-green-500/15 text-green-400"
            }`}>
              Save up to 25%
            </span>
          </button>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.featured
                  ? "border-indigo-500 border-2 bg-surface-1"
                  : "border-border bg-surface-1"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-indigo-600 text-white text-xs font-semibold px-4 py-1 rounded-full">
                    Most popular
                  </span>
                </div>
              )}

              {plan.badge && !plan.featured && currentPlan !== plan.id && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-green-600 text-white text-xs font-semibold px-4 py-1 rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}

              {currentPlan === plan.id && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-500 text-white text-xs font-semibold px-4 py-1 rounded-full">
                    ✓ Current plan
                  </span>
                </div>
              )}

              <div className="mb-5">
                <h2 className="text-base font-semibold text-text-primary mb-1">{plan.name}</h2>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-text-primary">{plan.price}</span>
                  <span className="text-text-secondary text-sm">{plan.priceNote}</span>
                </div>
                <p className="text-xs text-text-tertiary mb-1">
                  {plan.priceUSD}{plan.priceNote !== "forever" ? " / month" : ""}
                </p>
                {plan.annualNote && (
                  <p className="text-xs text-text-secondary mb-2">{plan.annualNote}</p>
                )}
                <p className="text-text-secondary text-sm">{plan.description}</p>
              </div>

              <hr className="border-border mb-5" />

              <ul className="flex flex-col gap-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-primary">
                    <svg className="w-4 h-4 mt-0.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
                {plan.missing?.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-tertiary">
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => currentPlan !== plan.id && handleCta(plan.id)}
                disabled={loading === plan.id || currentPlan === plan.id}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  currentPlan === plan.id
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-default"
                    : plan.featured
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : plan.id === "student"
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "border border-border hover:bg-surface-2 text-text-primary"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {loading === plan.id ? "Opening payment…" : currentPlan === plan.id ? "✓ Active" : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Student note */}
        <div className="mt-8 rounded-xl border border-green-500/30 bg-green-500/5 p-5 max-w-2xl mx-auto text-center">
          <p className="text-sm text-text-secondary">
            🎓 <strong className="text-text-primary">Student plan</strong> requires a college email ending in{" "}
            <code className="text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded text-xs">.edu</code> or{" "}
            <code className="text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded text-xs">.ac.in</code>.
            Includes <strong className="text-text-primary">1 month free</strong> — no card required to start.
          </p>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-text-primary mb-8 text-center">Common questions</h2>
          <div className="space-y-6">
            {[
              {
                q: "Can I cancel anytime?",
                a: "Yes. Cancel from your settings page — you keep access until the end of your billing cycle.",
              },
              {
                q: "What counts as a memory?",
                a: "Any note, idea, document, prompt, or file you save counts as one memory. Capture from anywhere — the web, AI tools, or directly in the app.",
              },
              {
                q: "Will my memories be deleted if I downgrade?",
                a: "No. Your memories are safe. You just can\'t add new ones past the free limit until you upgrade again.",
              },
              {
                q: "How does the student plan work?",
                a: "Click \'Claim student plan\', we check your .edu or .ac.in email instantly, then activate a 30-day free trial with no card required. After the trial, subscribe for ₹199/month.",
              },
              {
                q: "Which payment methods are accepted?",
                a: "All major Indian cards, UPI, net banking, and wallets via Razorpay.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-border pb-6">
                <p className="text-text-primary font-medium mb-2">{q}</p>
                <p className="text-text-secondary text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-text-tertiary text-sm mt-16">
          Payments secured by Razorpay. UPI, cards, net banking &amp; wallets accepted.
        </p>
      </div>
    </div>
  );
}
