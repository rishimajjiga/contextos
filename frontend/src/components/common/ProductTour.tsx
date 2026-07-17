// ── ProductTour · first-time interactive walkthrough ─────────────────────────
// Self-contained guided tour of the real ContextOS app. No new dependencies
// (framer-motion is already used app-wide), no behavior changes anywhere else:
// it only reads the existing DOM via [data-tour] anchors & sidebar links,
// navigates between existing routes, and highlights what's already there.
//
// • Auto-starts once for first-time users (localStorage flag).
// • Next / Back / Skip / Finish, progress "3/9", keyboard (← → Esc).
// • Spotlight overlay + premium tooltip card; bottom-sheet card on mobile.
// • Restartable from Settings via startProductTour().

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";

const DONE_KEY = "ctxos_tour_done";
const TOUR_EVENT = "ctxos:start-tour";

/** Dispatch from anywhere (e.g. Settings) to replay the tour. */
export function startProductTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

export function isTourDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return true; // storage unavailable → never auto-start
  }
}

interface TourStep {
  route: string;
  /** CSS selector to spotlight; omitted → centered welcome-style card. */
  target?: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    route: "/dashboard",
    title: "Welcome to ContextOS 👋",
    body: "Your personal second brain. Save anything from any website, keep it organized, and reuse it anywhere. This quick tour shows you around — it takes under a minute.",
  },
  {
    route: "/dashboard",
    target: '[data-tour="sidebar"]',
    title: "Everything lives here",
    body: "The sidebar is home base: Dashboard, your Memories, Search, Projects, Team, API Keys, and Settings — one click away, always.",
  },
  {
    route: "/dashboard",
    target: '[data-tour="usage"]',
    title: "Your account at a glance",
    body: "These cards show how many memories and projects you have, plus your daily auto-inject allowance. Click any card to jump straight in.",
  },
  {
    route: "/memories",
    target: 'nav a[href="/memories"]',
    title: "Memories — everything you save",
    body: "Every note, idea, link, and snippet you save lands here. The easiest way to add one: on any website, select text → right-click → Save to ContextOS.",
  },
  {
    route: "/search",
    target: 'nav a[href="/search"]',
    title: "Find anything in seconds",
    body: "Search across everything you've ever saved. Pro tip: press Ctrl+K (⌘K on Mac) anywhere in the app to open the quick command palette.",
  },
  {
    route: "/projects",
    target: 'nav a[href="/projects"]',
    title: "Projects keep work together",
    body: "Create a workspace for each thing you're working on — its goals, notes, and memories stay in one place, so you get full context in seconds.",
  },
  {
    route: "/profile",
    target: 'nav a[href="/profile"]',
    title: "Tell it who you are — once",
    body: "Add your role, skills, and preferences here. Tools you connect can then know your context automatically, without you retyping it every time.",
  },
  {
    route: "/api-keys",
    target: 'nav a[href="/api-keys"]',
    title: "Connect your other tools",
    body: "Create an API key to link the Chrome extension, Claude Desktop (MCP), and other tools — so everything you save follows you everywhere.",
  },
  {
    route: "/settings",
    target: '[data-tour="settings-tour"]',
    title: "You're all set 🎉",
    body: "That's the whole loop: save → organize → reuse. You can replay this tour anytime from right here in Settings. Enjoy your second brain!",
  },
];

const PAD = 8; // spotlight padding around the target
const CARD_W = 344;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(selector?: string): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // display:none / collapsed (e.g. desktop sidebar on mobile) → treat as absent
  if (r.width < 4 || r.height < 4) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function ProductTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const pollRef = useRef<number | null>(null);

  const step = STEPS[idx];

  // ── Auto-start for first-time users; restart on demand ──────────────────
  useEffect(() => {
    const restart = () => {
      setIdx(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, restart);
    let t: number | undefined;
    if (!isTourDone()) {
      // small delay so the dashboard has painted before the spotlight appears
      t = window.setTimeout(() => setOpen(true), 1100);
    }
    return () => {
      window.removeEventListener(TOUR_EVENT, restart);
      if (t) clearTimeout(t);
    };
  }, []);

  const finish = useCallback((markDone: boolean) => {
    setOpen(false);
    if (markDone) {
      try {
        localStorage.setItem(DONE_KEY, "1");
      } catch {
        /* storage unavailable — tour just won't be remembered */
      }
    }
  }, []);

  const go = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= STEPS.length) {
        finish(true);
        return;
      }
      setIdx(next);
    },
    [finish],
  );

  // ── Route sync + target measurement (poll briefly while pages lazy-load) ─
  useEffect(() => {
    if (!open) return;
    if (location.pathname !== step.route) {
      navigate(step.route);
      return; // effect re-runs when location updates
    }

    let tries = 0;
    setRect(measure(step.target));
    const poll = () => {
      const r = measure(step.target);
      if (r) {
        setRect((prev) =>
          prev && Math.abs(prev.top - r.top) < 1 && Math.abs(prev.left - r.left) < 1 &&
          Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
            ? prev
            : r,
        );
        const el = document.querySelector(step.target!);
        if (el && tries === 0) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      tries += 1;
      if (tries < 25) pollRef.current = window.setTimeout(poll, 120);
    };
    poll();

    const onReflow = () => setRect(measure(step.target));
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, idx, location.pathname, navigate, step.route, step.target]);

  // ── Keyboard: ← → navigate, Esc skips ───────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(true);
      else if (e.key === "ArrowRight") go(idx + 1);
      else if (e.key === "ArrowLeft") go(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, idx, go, finish]);

  if (!open) return null;

  const isLast = idx === STEPS.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isMobileSheet = vw < 640;

  // ── Tooltip-card placement (desktop) ─────────────────────────────────────
  // Preference order: below → above → beside (for tall targets like the
  // sidebar) → centered. Always clamped fully inside the viewport so the
  // card with its buttons can never end up off-screen.
  let cardStyle: React.CSSProperties;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  if (isMobileSheet) {
    // Bottom sheet, kept above Android gesture nav / iOS home indicator.
    cardStyle = { left: 16, right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))" };
  } else if (rect) {
    const gap = PAD + 12;
    const estH = 280; // safe card-height estimate for clamping
    const spaceBelow = vh - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const spaceRight = vw - (rect.left + rect.width);
    const centeredX = clamp(rect.left + rect.width / 2 - CARD_W / 2, 16, vw - CARD_W - 16);
    const centeredY = clamp(rect.top + rect.height / 2 - estH / 2, 16, Math.max(16, vh - estH - 16));

    if (spaceBelow > estH) {
      cardStyle = { top: rect.top + rect.height + gap, left: centeredX, width: CARD_W };
    } else if (spaceAbove > estH) {
      cardStyle = { bottom: vh - rect.top + gap, left: centeredX, width: CARD_W };
    } else if (spaceRight > CARD_W + 32) {
      cardStyle = { top: centeredY, left: rect.left + rect.width + gap, width: CARD_W };
    } else if (rect.left > CARD_W + 32) {
      cardStyle = { top: centeredY, left: rect.left - CARD_W - gap, width: CARD_W };
    } else {
      cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: Math.min(CARD_W, vw - 32) };
    }
  } else {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: Math.min(CARD_W, vw - 32) };
  }

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* Dim layer: with a spotlight hole when we have a target, plain otherwise */}
      {rect ? (
        <motion.div
          className="absolute rounded-2xl"
          initial={false}
          animate={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          style={{
            boxShadow:
              "0 0 0 9999px rgba(15, 23, 42, 0.55), 0 0 0 2px rgba(55, 178, 77, 0.95), 0 0 28px 4px rgba(55, 178, 77, 0.35)",
          }}
        />
      ) : (
        <motion.div
          className="absolute inset-0 bg-[#0F172A]/55"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="absolute rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_8px_rgba(30,41,59,0.08),0_28px_70px_-18px_rgba(30,41,59,0.35)]"
          style={cardStyle}
        >
          {/* header row: progress + skip */}
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#37B24D]/12 px-2.5 py-1 text-[11px] font-bold text-[#2F9E44]">
              <Sparkles className="h-3 w-3" />
              {idx + 1}/{STEPS.length}
            </span>
            <button
              type="button"
              onClick={() => finish(true)}
              aria-label="Skip tour"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#1E293B]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h3 className="mb-1.5 text-base font-bold text-[#1E293B]">{step.title}</h3>
          <p className="mb-4 text-sm leading-relaxed text-[#64748B]">{step.body}</p>

          {/* progress bar */}
          <div className="mb-4 h-1 overflow-hidden rounded-full bg-[#E5E7EB]">
            <motion.div
              className="h-full rounded-full bg-[#2F9E44]"
              animate={{ width: `${((idx + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => finish(true)}
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-[#64748B] transition-colors hover:text-[#1E293B]"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => go(idx - 1)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm font-medium text-[#1E293B] transition-colors hover:border-[#2F9E44]/40 hover:bg-[#37B24D]/8"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
              )}
              <button
                type="button"
                onClick={() => go(idx + 1)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2F9E44] px-4 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(47,158,68,0.55)] transition-colors hover:bg-[#37B24D]"
              >
                {isLast ? "Finish" : "Next"}
                {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
