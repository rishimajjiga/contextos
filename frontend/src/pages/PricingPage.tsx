import { useState, useEffect } from "react";
import { setTokenGetter } from "@/services/api";
import { useNavigate } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";
import { motion, AnimatePresence } from "framer-motion";
import {
  billingService,
  openRazorpayCheckout,
  type StudentCheckResult,
  type AllPlanLimits,
  type PlanLimits,
  DEFAULT_PLAN_LIMITS,
} from "@/services/billing.service";

type Billing = "monthly" | "annual";

// ── Limit → feature string helpers ───────────────────────────────────────────
// Single source of truth: values come from GET /billing/plans (backend
// PLAN_LIMITS). Nothing is hardcoded here except the human-readable labels.

function fmt(n: number, one: string, many: string, unlimited: string): string {
  if (n === -1) return unlimited;
  return `${n} ${n === 1 ? one : many}`;
}

function limitFeatures(lim: PlanLimits): string[] {
  return [
    fmt(lim.memories,     "memory",              "memories",              "Unlimited memories"),
    fmt(lim.projects,     "project",             "projects",              "Unlimited projects"),
    fmt(lim.daily_inject, "auto-injection / day", "auto-injections / day", "Unlimited auto-inject"),
    fmt(lim.api_keys,     "API key",             "API keys",              "Unlimited API keys"),
  ];
}

// Static per-plan extras: features that are not captured by PLAN_LIMITS
// (browser integration, team features, institutional email requirement, etc.)
const PLAN_EXTRA: Record<string, { features: string[]; missing: string[] }> = {
  free:    { features: ["Chrome extension"],                                                        missing: ["Search", "Team sharing"] },
  student: { features: ["Chrome extension (all features)", "Verified institutional email required"], missing: ["Team sharing"] },
  pro:     { features: ["Priority search", "Chrome extension (all features)"],                      missing: ["Team sharing"] },
  team:    { features: ["Up to 5 seats", "Shared knowledge base", "Priority support"],              missing: [] },
};

// ── Plan card definitions ─────────────────────────────────────────────────────
// Pricing / CTA / descriptions stay here; limits come from the API.

const PLANS = (billing: Billing, allLimits: AllPlanLimits) => [
  {
    id: "free" as const,
    name: "Free",
    emoji: "🌱",
    price: "₹0",
    priceUSD: "$0",
    priceNote: "forever",
    annualNote: null,
    description: "Capture ideas, save notes, and organize your first projects — free forever.",
    cta: "Get started free",
    featured: false,
    badge: null,
    features: [...limitFeatures(allLimits.free),    ...PLAN_EXTRA.free.features],
    missing:  PLAN_EXTRA.free.missing,
  },
  {
    id: "student" as const,
    name: "Student",
    emoji: "🎓",
    price: "₹199",
    priceUSD: "$2.10",
    priceNote: "/ month",
    annualNote: null,
    description: "For students with a college email. Includes 1 month free.",
    cta: "Claim student plan",
    featured: false,
    badge: "1 month free",
    features: [...limitFeatures(allLimits.student), ...PLAN_EXTRA.student.features],
    missing:  PLAN_EXTRA.student.missing,
  },
  {
    id: "pro" as const,
    name: "Pro",
    emoji: "⚡",
    price: billing === "annual" ? "₹375" : "₹499",
    priceUSD: billing === "annual" ? "$3.95" : "$5.25",
    priceNote: "/ month",
    annualNote: billing === "annual" ? "billed ₹4,499 / year (~$47)" : "or ₹4,499 / year (save ₹1,500)",
    description: "Unlimited memories and projects. The full second brain experience.",
    cta: billing === "annual" ? "Get Pro — Annual" : "Upgrade to Pro",
    featured: true,
    badge: billing === "annual" ? "Save ₹1,500" : null,
    features: [...limitFeatures(allLimits.pro),     ...PLAN_EXTRA.pro.features],
    missing:  PLAN_EXTRA.pro.missing,
  },
  {
    id: "team" as const,
    name: "Team",
    emoji: "🏢",
    price: billing === "annual" ? "₹1,417" : "₹1,499",
    priceUSD: billing === "annual" ? "$14.90" : "$15.80",
    priceNote: "/ month",
    annualNote: billing === "annual" ? "billed ₹16,999 / year (~$179)" : "or ₹16,999 / year (save ₹980)",
    description: "A shared second brain for your whole team.",
    cta: billing === "annual" ? "Get Team — Annual" : "Upgrade to Team",
    featured: false,
    badge: billing === "annual" ? "Save ₹980" : null,
    features: [...limitFeatures(allLimits.team),    ...PLAN_EXTRA.team.features],
    missing:  PLAN_EXTRA.team.missing,
  },
];

// ── Student Claim Modal ───────────────────────────────────────────────────────
// Eligibility is determined automatically from the user's login email domain.
// Flow: modal opens → calls /student-check → eligible/ineligible →
// if eligible, user clicks Claim → /student-claim activates the 30-day trial.

type StudentPhase =
  | "loading"       // calling /student-check
  | "not-signed-in" // user is signed out
  | "check-error"   // /student-check network error
  | "eligible"      // domain matched — show claim button
  | "ineligible"    // domain not recognised as educational
  | "claiming"      // POST /student-claim in flight
  | "claim-error"   // claim failed
  | "claimed";      // trial activated successfully

function StudentModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();

  const [phase, setPhase] = useState<StudentPhase>("loading");
  const [checkResult, setCheckResult] = useState<StudentCheckResult | null>(null);
  const [trialEnds, setTrialEnds] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-check on mount once auth is resolved
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setPhase("not-signed-in"); return; }

    billingService.studentCheck()
      .then((result) => {
        setCheckResult(result);
        setPhase(result.eligible ? "eligible" : "ineligible");
      })
      .catch(() => setPhase("check-error"));
  }, [isLoaded, isSignedIn]);

  async function handleClaim() {
    setPhase("claiming");
    try {
      const res = await billingService.studentClaim();
      setTrialEnds(res.trial_ends);
      setPhase("claimed");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Something went wrong. Please try again.");
      setPhase("claim-error");
    }
  }

  function renderContent() {
    switch (phase) {

      case "loading":
        return (
          <div className="py-10 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              className="inline-block text-2xl mb-3 opacity-50"
            >⟳</motion.div>
            <p className="text-sm text-foreground/60">Checking eligibility…</p>
          </div>
        );

      case "not-signed-in":
        return (
          <div className="space-y-4">
            <p className="text-sm text-foreground/70 leading-relaxed">
              Please sign in to activate your student plan.
            </p>
            <button
              onClick={() => navigate("/sign-in")}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-all"
            >
              Sign In
            </button>
          </div>
        );

      case "check-error":
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-4 flex items-start gap-3">
              <span className="text-red-600 text-xl mt-0.5">✗</span>
              <div>
                <p className="text-sm font-semibold text-red-600">Could not check eligibility</p>
                <p className="text-xs text-foreground/70 mt-1">Please try again in a moment.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 border border-foreground/10 hover:bg-foreground/5 text-foreground rounded-xl text-sm font-medium transition-all">Close</button>
              <button
                onClick={() => { setPhase("loading"); billingService.studentCheck().then(r => { setCheckResult(r); setPhase(r.eligible ? "eligible" : "ineligible"); }).catch(() => setPhase("check-error")); }}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-all"
              >Try Again</button>
            </div>
          </div>
        );

      case "eligible":
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-500/25 bg-green-500/8 p-4 flex items-start gap-3">
              <span className="text-green-700 text-xl mt-0.5">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-700">You're eligible!</p>
                <p className="text-xs text-foreground/70 mt-1">
                  Your institutional email qualifies you for 1 month free on the Student Plan.
                </p>
              </div>
            </div>
            <button
              onClick={handleClaim}
              className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white rounded-xl text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Activate 1 month free →
            </button>
            <p className="text-center text-xs text-foreground/50">No card required to start your trial.</p>
          </div>
        );

      case "ineligible":
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-4 flex items-start gap-3">
              <span className="text-amber-600 text-xl mt-0.5">✗</span>
              <div>
                <p className="text-sm font-semibold text-amber-600">Not eligible</p>
                <p className="text-xs text-foreground/70 mt-1 leading-relaxed">
                  {checkResult?.reason ?? "Your login email doesn't appear to be from a recognised educational institution."}
                </p>
              </div>
            </div>
            <p className="text-xs text-foreground/60 leading-relaxed text-center">
              The Student Plan requires a verified institutional email (.edu, .ac.in, .ac.uk, etc.).<br/>
              Sign in with your university email to qualify.
            </p>
            <button onClick={onClose} className="w-full py-3 border border-foreground/10 hover:bg-foreground/5 text-foreground rounded-xl text-sm font-medium transition-all">Close</button>
          </div>
        );

      case "claiming":
        return (
          <div className="py-10 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              className="inline-block text-2xl mb-3 opacity-50"
            >⟳</motion.div>
            <p className="text-sm text-foreground/60">Activating your trial…</p>
          </div>
        );

      case "claim-error":
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-4 flex items-start gap-3">
              <span className="text-red-600 text-xl mt-0.5">✗</span>
              <div>
                <p className="text-sm font-semibold text-red-600">Something went wrong</p>
                <p className="text-xs text-foreground/70 mt-1">{errorMsg}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 border border-foreground/10 hover:bg-foreground/5 text-foreground rounded-xl text-sm font-medium transition-all">Close</button>
              <button onClick={() => { setErrorMsg(""); setPhase("eligible"); }} className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-all">Try Again</button>
            </div>
          </div>
        );

      case "claimed":
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-500/25 bg-green-500/8 p-5 text-center">
              <p className="text-3xl mb-3">🎉</p>
              <p className="text-sm font-semibold text-green-700 mb-1">Trial activated!</p>
              <p className="text-xs text-foreground/70 leading-relaxed">
                Your free month runs until{" "}
                <strong className="text-foreground/70">
                  {trialEnds
                    ? new Date(trialEnds).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                    : "30 days from now"}
                </strong>
                . After that, subscribe for ₹199/month to keep your memories.
              </p>
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Go to dashboard →
            </button>
          </div>
        );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 pt-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="relative rounded-2xl p-px" style={{ background: "linear-gradient(135deg, #4f9437, #73b14f)" }}>
          <div className="rounded-[calc(1rem-1px)] p-6" style={{ background: "#ffffff" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: "linear-gradient(135deg, rgba(79,148,55,0.55), rgba(115,177,79,0.55))", border: "1px solid rgba(79,148,55,0.3)" }}
                >
                  🎓
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Student Plan</h2>
                  <p className="text-xs text-foreground/60">Verified by your institution email</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-all text-lg leading-none"
              >×</button>
            </div>

            {/* Single active phase — never two states at once */}
            {renderContent()}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Usage progress bar ────────────────────────────────────────────────────────

function UsageBar({ used, limit, color = "#4f9437" }: { used: number; limit: number; color?: string }) {
  const unlimited = limit <= 0 || limit >= 10000;
  const pct = unlimited ? 100 : Math.min(100, (used / limit) * 100);
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(45,70,35,0.05)" }}>
      {unlimited ? (
        <div className="h-full w-full rounded-full" style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.4), rgba(16,185,129,0.4))" }} />
      ) : (
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, rgba(115,177,79,0.6))` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
        />
      )}
    </div>
  );
}

// ── Animation variants ────────────────────────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
};

const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const cardContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] } },
};

// ── Pricing Page ──────────────────────────────────────────────────────────────

export function PricingPage() {
  const { isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();

  // Wire Clerk's getToken into the Axios interceptor so billing requests
  // include Authorization headers (PricingPage renders outside AppLayout
  // where AuthProvider normally handles this).
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);
  const [loading, setLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");
  const [showStudentModal, setShowStudentModal] = useState(false);
  const { plan: planInfo } = usePlan();   // shared cached subscription (deduped)
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  // allLimits starts with the known defaults so cards render immediately;
  // the backend response overwrites them (same values, but keeps us honest
  // if PLAN_LIMITS ever changes server-side).
  const [allLimits, setAllLimits] = useState<AllPlanLimits>(DEFAULT_PLAN_LIMITS);

  // currentPlan derived from the richer PlanInfo (same field as before)
  const currentPlan = planInfo?.plan ?? null;

  useEffect(() => {
    // Fetch authoritative plan limits (public endpoint, no auth needed)
    billingService.getPlans().then(setAllLimits).catch(() => {/* keep defaults */});
  }, []);

  // handleCta — identical to original
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
          toast.success("Payment successful! Welcome to " + (planId === "pro" ? "Pro" : "Team") + " 🎉", { id: "pay-verify" });
          navigate("/dashboard");
        },
        (err) => {
          if (err === "cancelled") { toast.dismiss("pay-verify"); return; }
          toast.error(err || "Payment failed. Please try again.", { id: "pay-verify", duration: 10000 });
        },
        () => toast.loading("Verifying payment…", { id: "pay-verify" }),
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to open payment. Please refresh and try again.");
    } finally {
      setLoading(null);
    }
  }

  const plans = PLANS(billing, allLimits);

  const FAQ_ITEMS = [
    { q: "Can I upgrade anytime?", a: "Yes — upgrades take effect instantly. You're only charged the prorated difference for the remaining billing cycle." },
    { q: "What happens when my plan expires?", a: "You're automatically moved to the Free tier. Your memories are always preserved — you just can't add new ones past the free limit until you re-subscribe." },
    { q: "Will my memories be deleted?", a: "Never. Your data belongs to you. Downgrading only limits new additions — it never deletes your existing memories." },
    { q: "Can I cancel anytime?", a: "Absolutely. Cancel from your Settings page — you keep full access until the end of your current billing cycle, with no questions asked." },
    { q: "Which payment methods are accepted?", a: "All major Indian cards, UPI, net banking, and wallets via Razorpay. Safe, fast, and secure." },
  ];

  return (
    <div className="relative min-h-dvh overflow-x-hidden" style={{ background: "#eef3e7" }}>

      {/* ── Aurora background ─────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Primary glow — top center */}
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-25 rounded-full"
          style={{ background: "radial-gradient(ellipse at center, #4f9437 0%, #73b14f 40%, transparent 70%)", filter: "blur(60px)" }}
        />
        {/* Left emerald blob */}
        <div
          className="absolute top-1/3 -left-48 w-[640px] h-[640px] opacity-12 rounded-full"
          style={{ background: "radial-gradient(circle, #73b14f 0%, transparent 70%)", filter: "blur(80px)" }}
        />
        {/* Right green blob */}
        <div
          className="absolute bottom-1/4 -right-48 w-[560px] h-[560px] opacity-10 rounded-full"
          style={{ background: "radial-gradient(circle, #4f9437 0%, transparent 70%)", filter: "blur(80px)" }}
        />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: "radial-gradient(rgba(45,70,35,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Floating particles */}
        {[
          { size: 4,  x: "14%",  y: "18%",  color: "#6fae54", dur: 3.8, delay: 0 },
          { size: 6,  x: "82%",  y: "12%",  color: "#6fae54", dur: 4.2, delay: 1.4 },
          { size: 3,  x: "67%",  y: "38%",  color: "#73b14f", dur: 3.5, delay: 0.8 },
          { size: 5,  x: "8%",   y: "62%",  color: "#73b14f", dur: 4.6, delay: 2.1 },
          { size: 4,  x: "91%",  y: "52%",  color: "#4f9437", dur: 3.9, delay: 0.4 },
          { size: 3,  x: "44%",  y: "82%",  color: "#4f9437", dur: 4.1, delay: 1.2 },
          { size: 6,  x: "28%",  y: "32%",  color: "#6fae54", dur: 4.8, delay: 1.9 },
          { size: 4,  x: "72%",  y: "68%",  color: "#73b14f", dur: 3.6, delay: 0.6 },
          { size: 3,  x: "55%",  y: "22%",  color: "#4f9437", dur: 4.3, delay: 2.5 },
        ].map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ width: p.size, height: p.size, background: p.color, left: p.x, top: p.y }}
            animate={{ y: [0, -18, 0], opacity: [0.25, 0.65, 0.25] }}
            transition={{ duration: p.dur, repeat: Infinity, ease: "easeInOut", delay: p.delay }}
          />
        ))}
      </div>

      {/* ── Page layout ───────────────────────────────────────────────────────── */}
      {/* pt clears the status bar — this page renders standalone (no Topbar) */}
      <div className="relative max-w-6xl mx-auto px-4 pt-[calc(1rem+var(--safe-top))] pb-[max(6rem,calc(5rem+var(--safe-bottom)))]">
        {showStudentModal && <StudentModal onClose={() => setShowStudentModal(false)} />}

        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          onClick={() => navigate("/dashboard")}
          className="group flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground/70 transition-all mb-4"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </motion.button>

        {/* ── Hero ──────────────────────────────────────────────────────────────── */}
        <motion.div
          className="text-center mb-6"
          initial="hidden"
          animate="show"
          variants={heroContainer}
        >
          {/* Glowing brain icon */}
          <motion.div variants={fadeInUp} className="flex justify-center mb-3">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-2xl blur-2xl"
                style={{ background: "linear-gradient(135deg, #4f9437, #73b14f)", opacity: 0.5 }}
              />
              <motion.div
                animate={{ boxShadow: ["0 0 20px rgba(79,148,55,0.25)", "0 0 40px rgba(115,177,79,0.72)", "0 0 20px rgba(79,148,55,0.25)"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                style={{
                  background: "linear-gradient(135deg, rgba(79,148,55,0.12), rgba(115,177,79,0.12))",
                  border: "1px solid rgba(79,148,55,0.25)",
                  backdropFilter: "blur(12px)",
                }}
              >
                🧠
              </motion.div>
            </div>
          </motion.div>

          <motion.span variants={fadeInUp} className="text-[11px] font-bold tracking-[0.25em] uppercase text-green-700/70 block mb-2">
            Pricing
          </motion.span>

          <motion.h1
            variants={fadeInUp}
            className="text-4xl md:text-5xl font-bold tracking-tight mb-3 leading-none"
            style={{
              background: "linear-gradient(135deg, #1e3a16 10%, #4f9437 95%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ContextOS Plans
          </motion.h1>

          <motion.p variants={fadeInUp} className="text-foreground/65 text-base max-w-md mx-auto leading-relaxed">
            Choose your perfect second brain.
          </motion.p>
        </motion.div>

        {/* ── Billing toggle ─────────────────────────────────────────────────── */}
        {/* Uses Framer Motion layoutId so the pill smoothly follows the active   */}
        {/* button regardless of each button's individual width.                  */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="flex justify-center mb-8"
        >
          <div
            className="relative flex items-center p-1 gap-1 rounded-2xl"
            style={{ background: "rgba(45,70,35,0.03)", border: "1px solid rgba(45,70,35,0.07)" }}
          >
            {(["monthly", "annual"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setBilling(mode)}
                className="relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors z-10"
                style={{
                  color: billing === mode ? "#fff" : "rgba(45,70,35,0.72)",
                  minWidth: mode === "annual" ? "148px" : "108px",
                }}
              >
                {/* Animated pill lives inside the active button so layoutId  */}
                {/* auto-animates it from one button's bounds to the other.   */}
                {billing === mode && (
                  <motion.div
                    layoutId="billing-toggle-pill"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "linear-gradient(135deg, #4f9437, #73b14f)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative z-10">
                  {mode === "monthly" ? "Monthly" : "Annual"}
                </span>
                {mode === "annual" && (
                  <span
                    className={`relative z-10 text-[10px] px-2 py-0.5 rounded-full font-bold transition-all duration-300 ${
                      billing === "annual"
                        ? "bg-white/25 text-white"
                        : "bg-emerald-500/15 text-emerald-700"
                    }`}
                  >
                    Save 25%
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>


        {/* ── Pricing cards ──────────────────────────────────────────────────── */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16"
          initial="hidden"
          animate="show"
          variants={cardContainer}
        >
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isPro    = plan.id === "pro";
            const isStudent = plan.id === "student";
            const isTeam   = plan.id === "team";

            // ── Inner card body (shared) ──────────────────────────────────────
            const body = (
              <div className="p-6 flex flex-col h-full">

                {/* Top badge */}
                <div className="h-7 mb-4 flex justify-center items-center">
                  {isCurrent ? (
                    <span className="text-[11px] font-bold bg-emerald-500/12 text-emerald-700 border border-emerald-500/25 px-3 py-1 rounded-full">✓ Current plan</span>
                  ) : isPro ? (
                    <span
                      className="text-[11px] font-bold px-3 py-1 rounded-full"
                      style={{ background: "rgba(79,148,55,0.12)", color: "#2f6b34", border: "1px solid rgba(79,148,55,0.25)" }}
                    >
                      ⭐ Most Popular
                    </span>
                  ) : isStudent ? (
                    <span className="text-[11px] font-bold bg-emerald-500/12 text-emerald-700 border border-emerald-500/25 px-3 py-1 rounded-full">
                      🎓 Perfect for students
                    </span>
                  ) : plan.badge ? (
                    <span className="text-[11px] font-bold bg-green-500/12 text-green-700 border border-green-500/25 px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>

                {/* Plan name + emoji */}
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-xl">{plan.emoji}</span>
                  <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span className="text-4xl font-bold text-foreground tracking-tight">{plan.price}</span>
                    <span className="text-foreground/60 text-sm">{plan.priceNote}</span>
                  </div>
                  <p className="text-foreground/45 text-xs">{plan.priceUSD}{plan.priceNote !== "forever" ? " / month" : ""}</p>
                  {plan.annualNote && <p className="text-foreground/55 text-xs mt-1">{plan.annualNote}</p>}
                  <p className="text-foreground/70 text-sm mt-3 leading-relaxed">{plan.description}</p>
                </div>

                {/* Divider */}
                <div className="h-px mb-4" style={{ background: "rgba(45,70,35,0.06)" }} />

                {/* Feature list */}
                <ul className="flex-1 space-y-2 mb-6">
                  {plan.features.map((f, fi) => (
                    <motion.li
                      key={f}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + fi * 0.04, duration: 0.35 }}
                      className="flex items-start gap-2.5 text-sm"
                      style={{ color: "rgba(45,70,35,0.92)" }}
                    >
                      <svg
                        className="w-4 h-4 mt-0.5 shrink-0"
                        style={{ color: isPro ? "#6fae54" : isStudent ? "#5a9c3e" : isTeam ? "#6fae54" : "#4f9437" }}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </motion.li>
                  ))}
                  {plan.missing?.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "rgba(45,70,35,0.5)" }}>
                      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                <motion.button
                  whileHover={isCurrent ? {} : { scale: 1.02 }}
                  whileTap={isCurrent ? {}  : { scale: 0.97 }}
                  onClick={() => !isCurrent && handleCta(plan.id)}
                  disabled={loading === plan.id || isCurrent}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={
                    isCurrent
                      ? { background: "rgba(52,211,153,0.08)", color: "#2e7d32", border: "1px solid rgba(52,211,153,0.55)", cursor: "default" }
                      : isPro
                      ? { background: "linear-gradient(135deg, #4f9437, #73b14f)", color: "#fff", boxShadow: "0 0 24px rgba(79,148,55,0.72), 0 4px 16px rgba(115,177,79,0.55)" }
                      : isStudent
                      ? { background: "linear-gradient(135deg, #2f6b34, #73b14f)", color: "#fff", boxShadow: "0 0 20px rgba(47,107,52,0.25)" }
                      : isTeam
                      ? { background: "rgba(79,148,55,0.9)", color: "#fff" }
                      : { background: "transparent", color: "rgba(45,70,35,0.85)", border: "1px solid rgba(45,70,35,0.1)" }
                  }
                >
                  {loading === plan.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                        style={{ display: "inline-block" }}
                      >
                        ⟳
                      </motion.span>
                      Opening payment…
                    </span>
                  ) : isCurrent ? (
                    "✓ Active plan"
                  ) : (
                    plan.cta
                  )}
                </motion.button>
              </div>
            );

            // ── Pro card — gradient border + outer glow ───────────────────────
            if (isPro) {
              return (
                <motion.div key={plan.id} variants={cardVariant} className="relative">
                  {/* Outer glow halo */}
                  <div
                    className="absolute -inset-[3px] rounded-[28px] blur-xl opacity-35"
                    style={{ background: "linear-gradient(135deg, #4f9437, #73b14f)" }}
                  />
                  {/* Animated glow pulse */}
                  <motion.div
                    className="absolute -inset-[2px] rounded-[27px] blur-sm opacity-20"
                    style={{ background: "linear-gradient(135deg, #4f9437, #73b14f)" }}
                    animate={{ opacity: [0.15, 0.35, 0.15] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* Gradient border */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 280, damping: 22 }}
                    className="relative rounded-3xl p-px"
                    style={{ background: "linear-gradient(135deg, #4f9437, #73b14f, #6fae54)" }}
                  >
                    <div className="h-full flex flex-col" style={{ background: "#ffffff", borderRadius: "calc(1.5rem - 1px)" }}>
                      {body}
                    </div>
                  </motion.div>
                </motion.div>
              );
            }

            // ── Student card — emerald/pink gradient border ────────────────────
            if (isStudent) {
              return (
                <motion.div key={plan.id} variants={cardVariant} className="relative">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 280, damping: 22 }}
                    className="relative rounded-3xl p-px"
                    style={{ background: "linear-gradient(135deg, rgba(79,148,55,0.5), rgba(115,177,79,0.5))" }}
                  >
                    <div className="h-full flex flex-col" style={{ background: "#ffffff", borderRadius: "calc(1.5rem - 1px)" }}>
                      {body}
                    </div>
                  </motion.div>
                </motion.div>
              );
            }

            // ── Default cards (Free, Team) ────────────────────────────────────
            return (
              <motion.div
                key={plan.id}
                variants={cardVariant}
                whileHover={{ scale: 1.015 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className="relative rounded-3xl flex flex-col"
                style={{
                  background: "#ffffff",
                  border: isTeam ? "1px solid rgba(79,148,55,0.55)" : "1px solid rgba(45,70,35,0.14)",
                  boxShadow: "0 2px 10px -3px rgba(45,80,35,0.08), 0 16px 40px -18px rgba(45,80,35,0.12)",
                }}
              >
                {body}
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Usage section (only when signed in + plan loaded) ─────────────── */}
        <AnimatePresence>
          {isSignedIn && planInfo && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="mb-16"
            >
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-foreground/45 text-center mb-6">Your usage</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">

                {/* Memories */}
                <div className="rounded-2xl p-4" style={{ background: "#ffffff", border: "1px solid rgba(45,70,35,0.14)", boxShadow: "0 2px 10px -3px rgba(45,80,35,0.08)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg">🧠</span>
                    <span className="text-[10px] text-foreground/50 font-semibold uppercase tracking-wide">Memories</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground mb-2">
                    {planInfo.usage.memories.toLocaleString()}
                    <span className="text-foreground/45 text-sm font-normal ml-0.5">
                      /{planInfo.limits.memories >= 10000 ? "∞" : planInfo.limits.memories}
                    </span>
                  </p>
                  <UsageBar used={planInfo.usage.memories} limit={planInfo.limits.memories} color="#4f9437" />
                </div>

                {/* Projects */}
                <div className="rounded-2xl p-4" style={{ background: "#ffffff", border: "1px solid rgba(45,70,35,0.14)", boxShadow: "0 2px 10px -3px rgba(45,80,35,0.08)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg">📁</span>
                    <span className="text-[10px] text-foreground/50 font-semibold uppercase tracking-wide">Projects</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground mb-2">
                    {planInfo.usage.projects}
                    <span className="text-foreground/45 text-sm font-normal ml-0.5">
                      /{planInfo.limits.projects >= 1000 ? "∞" : planInfo.limits.projects}
                    </span>
                  </p>
                  <UsageBar used={planInfo.usage.projects} limit={planInfo.limits.projects} color="#6fae54" />
                </div>

                {/* Auto-inject */}
                <div className="rounded-2xl p-4" style={{ background: "#ffffff", border: "1px solid rgba(45,70,35,0.14)", boxShadow: "0 2px 10px -3px rgba(45,80,35,0.08)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg">⚡</span>
                    <span className="text-[10px] text-foreground/50 font-semibold uppercase tracking-wide">Auto-inject</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground mb-2">
                    {planInfo.limits.daily_inject < 0 || planInfo.limits.daily_inject >= 10000 ? "∞" : planInfo.limits.daily_inject}
                    <span className="text-foreground/45 text-sm font-normal ml-1">/day</span>
                  </p>
                  <div className="h-1.5 rounded-full w-full" style={{ background: "linear-gradient(90deg, rgba(250,204,21,0.3), rgba(234,179,8,0.3))" }} />
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Student email note ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="max-w-2xl mx-auto mb-20 rounded-2xl p-5 flex items-start gap-4"
          style={{ background: "#f4faee", border: "1px solid rgba(115,177,79,0.3)" }}
        >
          <span className="text-2xl shrink-0 mt-0.5">🎓</span>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(45,70,35,0.72)" }}>
            <strong style={{ color: "rgba(45,70,35,0.92)" }}>Student plan</strong> eligibility is checked automatically from your login email.
            Sign in with your university or college email to qualify.
            {" "}Includes <strong style={{ color: "rgba(45,70,35,0.92)" }}>1 month free</strong> — no card required to start.
          </p>
        </motion.div>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="max-w-2xl mx-auto mb-20"
        >
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-center mb-3" style={{ color: "rgba(45,70,35,0.55)" }}>FAQ</p>
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">Common questions</h2>

          <div className="space-y-2">
            {FAQ_ITEMS.map(({ q, a }, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden"
                style={{ background: "#ffffff", border: "1px solid rgba(45,70,35,0.14)", boxShadow: "0 2px 10px -3px rgba(45,80,35,0.08)" }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left gap-3 group"
                >
                  <span className="text-sm font-semibold transition-colors" style={{ color: openFaq === i ? "#2f6b34" : "rgba(45,70,35,0.9)" }}>
                    {q}
                  </span>
                  <motion.span
                    animate={{ rotate: openFaq === i ? 45 : 0 }}
                    transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                    className="text-xl leading-none shrink-0 font-light transition-colors"
                    style={{ color: openFaq === i ? "rgba(111,174,84,0.9)" : "rgba(45,70,35,0.55)" }}
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: "rgba(45,70,35,0.72)" }}>{a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-xs" style={{ color: "rgba(45,70,35,0.5)" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Payments secured by Razorpay · UPI, cards, net banking &amp; wallets accepted
          </div>
        </div>

      </div>
    </div>
  );
}
