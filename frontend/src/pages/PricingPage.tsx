import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { billingService, openRazorpayCheckout, type PlanInfo, type StudentCheckResult } from "@/services/billing.service";

type Billing = "monthly" | "annual";

// ── Plan data (unchanged logic, added emoji) ──────────────────────────────────

const PLANS = (billing: Billing) => [
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
    features: ["10 memories", "2 projects", "3 auto-injections / day", "1 API key", "Chrome extension"],
    missing: ["Search", "Team sharing"],
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
    features: ["200 memories", "5 projects", "Unlimited auto-inject", "3 API keys", "Chrome extension (all features)", ".edu / .ac.in email required"],
    missing: ["Team sharing"],
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
    features: ["Unlimited memories", "Unlimited projects", "Unlimited auto-inject", "5 API keys", "Priority search", "Chrome extension (all features)"],
    missing: ["Team sharing"],
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
    features: ["Unlimited memories", "Unlimited projects", "Up to 5 seats", "Shared knowledge base", "Unlimited API keys", "Priority support"],
    missing: [],
  },
];

// ── Student Claim Modal ───────────────────────────────────────────────────────
// Uses the backend /billing/student-check endpoint as the single source of
// truth. The old client-side isEducationalEmail() regex is intentionally
// removed — only what the server says counts.

type StudentPhase =
  | "loading"       // waiting for isLoaded or the API call
  | "not-signed-in" // Clerk says the user is signed out
  | "check-error"   // /student-check API call failed
  | "eligible"      // backend says eligible, ready to claim
  | "ineligible"    // backend says not eligible
  | "claiming"      // POST /student-claim in flight
  | "claim-error"   // POST /student-claim failed
  | "claimed";      // trial activated successfully

function StudentModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();

  const [phase, setPhase] = useState<StudentPhase>("loading");
  const [checkData, setCheckData] = useState<StudentCheckResult | null>(null);
  const [trialEnds, setTrialEnds] = useState<string | null>(null);
  const [claimErrorMsg, setClaimErrorMsg] = useState("");

  // ── Step 1: ask the backend whether this email is eligible ───────────────
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setPhase("not-signed-in"); return; }

    billingService
      .studentCheck()
      .then((res) => {
        setCheckData(res);
        setPhase(res.eligible ? "eligible" : "ineligible");
      })
      .catch(() => setPhase("check-error"));
  }, [isLoaded, isSignedIn]);

  // ── Step 2: claim the trial (only if backend said eligible) ──────────────
  async function handleClaim() {
    setPhase("claiming");
    try {
      const res = await billingService.studentClaim();
      setTrialEnds(res.trial_ends);
      setPhase("claimed");
    } catch (err: any) {
      setClaimErrorMsg(
        err?.message ?? "Unable to activate your student trial. Please try again."
      );
      setPhase("claim-error");
    }
  }

  // ── Content for each phase (exactly one block renders at a time) ─────────
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
            <p className="text-sm text-white/30">Verifying your account…</p>
          </div>
        );

      case "not-signed-in":
        return (
          <div className="space-y-4">
            <p className="text-sm text-white/40 leading-relaxed">
              Please sign in to check your student eligibility.
            </p>
            <button
              onClick={() => navigate("/sign-in")}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all"
            >
              Sign In
            </button>
          </div>
        );

      case "check-error":
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-4 flex items-start gap-3">
              <span className="text-amber-400 text-lg mt-0.5">⚠</span>
              <p className="text-sm text-amber-300 leading-relaxed">
                Unable to verify your student account right now. Please try again in a moment.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 border border-white/10 hover:bg-white/5 text-white rounded-xl text-sm font-medium transition-all"
            >
              Close
            </button>
          </div>
        );

      case "eligible":
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-500/25 bg-green-500/8 p-4 flex items-start gap-3">
              <span className="text-green-400 text-xl mt-0.5">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-400">Student account verified</p>
                <p className="text-xs text-white/40 mt-1">
                  <strong className="text-white/60">{checkData?.email}</strong> is a verified student email.
                </p>
              </div>
            </div>
            <p className="text-sm text-white/40 leading-relaxed">
              Start your <strong className="text-white/80">1-month free trial</strong> — no credit card needed.
              After 30 days, subscribe at ₹199/month to keep your memories.
            </p>
            <button
              onClick={handleClaim}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Start Free Month
            </button>
          </div>
        );

      case "ineligible":
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-4 flex items-start gap-3">
              <span className="text-red-400 text-xl mt-0.5">✗</span>
              <div>
                <p className="text-sm font-semibold text-red-400">Not eligible</p>
                <p className="text-xs text-white/40 mt-1">
                  {checkData?.reason ?? "Student verification requires a valid educational email (.edu or .ac.in)."}
                </p>
              </div>
            </div>
            {checkData?.email && (
              <p className="text-xs text-white/30">
                Email on file: <strong className="text-white/50">{checkData.email}</strong>
              </p>
            )}
            <button
              onClick={onClose}
              className="w-full py-3 border border-white/10 hover:bg-white/5 text-white rounded-xl text-sm font-medium transition-all"
            >
              Close
            </button>
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
            <p className="text-sm text-white/30">Activating your trial…</p>
          </div>
        );

      case "claim-error":
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-4 flex items-start gap-3">
              <span className="text-red-400 text-xl mt-0.5">✗</span>
              <div>
                <p className="text-sm font-semibold text-red-400">Activation failed</p>
                <p className="text-xs text-white/40 mt-1">{claimErrorMsg}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 border border-white/10 hover:bg-white/5 text-white rounded-xl text-sm font-medium transition-all"
              >
                Close
              </button>
              <button
                onClick={() => { setClaimErrorMsg(""); setPhase("eligible"); }}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        );

      case "claimed":
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-500/25 bg-green-500/8 p-5 text-center">
              <p className="text-3xl mb-3">🎉</p>
              <p className="text-sm font-semibold text-green-400 mb-1">Trial activated!</p>
              <p className="text-xs text-white/40 leading-relaxed">
                Your free month runs until{" "}
                <strong className="text-white/70">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="relative rounded-2xl p-px" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
          <div className="rounded-[calc(1rem-1px)] p-6" style={{ background: "#0f0f12" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))", border: "1px solid rgba(99,102,241,0.3)" }}
                >
                  🎓
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Student Plan</h2>
                  <p className="text-xs text-white/30">Verified by your institution email</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all text-lg leading-none"
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

function UsageBar({ used, limit, color = "#6366f1" }: { used: number; limit: number; color?: string }) {
  const unlimited = limit <= 0 || limit >= 10000;
  const pct = unlimited ? 100 : Math.min(100, (used / limit) * 100);
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
      {unlimited ? (
        <div className="h-full w-full rounded-full" style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.4), rgba(16,185,129,0.4))" }} />
      ) : (
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, rgba(168,85,247,0.6))` }}
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
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // currentPlan derived from the richer PlanInfo (same field as before)
  const currentPlan = planInfo?.plan ?? null;

  useEffect(() => {
    if (!isSignedIn) return;
    billingService.getPlan().then(setPlanInfo).catch(() => {});
  }, [isSignedIn]);

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
          toast.success("Payment successful! Welcome to " + (planId === "pro" ? "Pro" : "Team") + " 🎉");
          navigate("/dashboard");
        },
        (err) => {
          if (err !== "cancelled") toast.error(err || "Payment failed. Please try again.");
        },
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to open payment. Please refresh and try again.");
    } finally {
      setLoading(null);
    }
  }

  const plans = PLANS(billing);

  const FAQ_ITEMS = [
    { q: "Can I upgrade anytime?", a: "Yes — upgrades take effect instantly. You're only charged the prorated difference for the remaining billing cycle." },
    { q: "What happens when my plan expires?", a: "You're automatically moved to the Free tier. Your memories are always preserved — you just can't add new ones past the free limit until you re-subscribe." },
    { q: "Will my memories be deleted?", a: "Never. Your data belongs to you. Downgrading only limits new additions — it never deletes your existing memories." },
    { q: "Can I cancel anytime?", a: "Absolutely. Cancel from your Settings page — you keep full access until the end of your current billing cycle, with no questions asked." },
    { q: "Which payment methods are accepted?", a: "All major Indian cards, UPI, net banking, and wallets via Razorpay. Safe, fast, and secure." },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "#09090b" }}>

      {/* ── Aurora background ─────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Primary glow — top center */}
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-25 rounded-full"
          style={{ background: "radial-gradient(ellipse at center, #6366f1 0%, #a855f7 40%, transparent 70%)", filter: "blur(60px)" }}
        />
        {/* Left purple blob */}
        <div
          className="absolute top-1/3 -left-48 w-[640px] h-[640px] opacity-12 rounded-full"
          style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 70%)", filter: "blur(80px)" }}
        />
        {/* Right indigo blob */}
        <div
          className="absolute bottom-1/4 -right-48 w-[560px] h-[560px] opacity-10 rounded-full"
          style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)", filter: "blur(80px)" }}
        />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Floating particles */}
        {[
          { size: 4,  x: "14%",  y: "18%",  color: "#818cf8", dur: 3.8, delay: 0 },
          { size: 6,  x: "82%",  y: "12%",  color: "#818cf8", dur: 4.2, delay: 1.4 },
          { size: 3,  x: "67%",  y: "38%",  color: "#a855f7", dur: 3.5, delay: 0.8 },
          { size: 5,  x: "8%",   y: "62%",  color: "#a855f7", dur: 4.6, delay: 2.1 },
          { size: 4,  x: "91%",  y: "52%",  color: "#6366f1", dur: 3.9, delay: 0.4 },
          { size: 3,  x: "44%",  y: "82%",  color: "#6366f1", dur: 4.1, delay: 1.2 },
          { size: 6,  x: "28%",  y: "32%",  color: "#818cf8", dur: 4.8, delay: 1.9 },
          { size: 4,  x: "72%",  y: "68%",  color: "#a855f7", dur: 3.6, delay: 0.6 },
          { size: 3,  x: "55%",  y: "22%",  color: "#6366f1", dur: 4.3, delay: 2.5 },
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

      {/* �