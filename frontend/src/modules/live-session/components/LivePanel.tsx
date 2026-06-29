// ── Live Session module · full-screen panel ──────────────────────────────────
// Portal-mounted overlay that behaves like an in-page extension popup:
//   • does NOT navigate or reload (pure React state)
//   • full-screen takeover (slides in from right on desktop, up on mobile)
//   • glassmorphism backdrop; listeners init on open and tear down on close.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Radio, BarChart3, MoreVertical, Mail } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isLiveConfigured } from "../lib/supabaseClient";
import { useLiveSession } from "../hooks/useLiveSession";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { CONTACT_EMAIL } from "../config";
import { LiveTab } from "./LiveTab";
import { PollsTab } from "./PollsTab";

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setMobile(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

// 3-dots menu — contact for promotions / poll sponsorship.
function OptionsMenu() {
  const [open, setOpen] = useState(false);
  const subject = encodeURIComponent("Promotion / poll sponsorship — ContextOS Live");
  const body = encodeURIComponent(
    "Hi ContextOS team,\n\nI'd like to discuss promotions / sponsored polls in the Live Session.\n\nDetails:\n",
  );
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <div className="border-b border-border/60 px-3 py-2">
              <p className="text-xs font-semibold text-foreground">Promote here</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Feature your poll or promotion in the live session.
              </p>
            </div>
            <a
              href={mailto}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-accent"
            >
              <Mail className="h-4 w-4 text-brand-600" />
              <span className="truncate">{CONTACT_EMAIL}</span>
            </a>
          </div>
        </>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Which tab to show first (shared poll links open "polls"). */
  initialTab?: "live" | "polls";
}

export function LivePanel({ open, onClose, initialTab = "live" }: Props) {
  const isMobile = useIsMobile();
  const { isAdmin } = useIsAdmin();
  const { session, loading, createSession, endSession } = useLiveSession(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const hidden = isMobile ? { y: "100%" } : { x: "100%" };
  const shown = isMobile ? { y: 0 } : { x: 0 };
  const panelPos = "inset-0 h-full w-full";

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] font-sans text-foreground">
          <motion.div
            className="absolute inset-0 bg-brand-950/30 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Live Session"
            className={`absolute ${panelPos} flex flex-col bg-surface-1/95 shadow-card backdrop-blur-2xl`}
            initial={hidden}
            animate={shown}
            exit={hidden}
            transition={{ type: "spring", stiffness: 320, damping: 34, mass: 0.9 }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500/60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
                </span>
                <h2 className="text-sm font-semibold">Live Session</h2>
              </div>
              <div className="flex items-center gap-1">
                <OptionsMenu />
                <button
                  onClick={onClose}
                  aria-label="Close panel"
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {!isLiveConfigured() ? (
                <NotConfigured />
              ) : (
                <Tabs defaultValue={initialTab} className="mx-auto flex h-full w-full max-w-3xl flex-col">
                  <div className="px-5 pt-4">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="live" className="gap-1.5">
                        <Radio className="h-3.5 w-3.5" /> Live Session
                      </TabsTrigger>
                      <TabsTrigger value="polls" className="gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5" /> Polls
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="live" className="mt-0 flex-1 overflow-hidden px-0">
                    <LiveTab
                      session={session}
                      loading={loading}
                      isAdmin={isAdmin}
                      onCreateSession={createSession}
                      onEndSession={endSession}
                    />
                  </TabsContent>

                  <TabsContent value="polls" className="mt-0 flex-1 overflow-hidden px-0">
                    <PollsTab open={open} isAdmin={isAdmin} session={session} />
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function NotConfigured() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <p className="text-sm font-medium text-foreground">Live Session isn’t configured yet</p>
      <p className="text-xs text-muted-foreground">
        Add <code className="rounded bg-muted px-1">VITE_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-muted px-1">VITE_SUPABASE_ANON_KEY</code>, then run the SQL in{" "}
        <code className="rounded bg-muted px-1">supabase-setup-all.sql</code>.
      </p>
    </div>
  );
}
