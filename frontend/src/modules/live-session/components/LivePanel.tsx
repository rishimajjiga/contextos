// ── Live Session module · slide-in panel ─────────────────────────────────────
// Portal-mounted overlay that behaves like an in-page extension popup:
//   • does NOT navigate or reload (pure React state)
//   • desktop → right-side drawer (~45% width)
//   • mobile  → full-screen bottom sheet
//   • glassmorphism backdrop, 320ms spring-eased slide
// All listeners initialise on open and tear down on close.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Radio, BarChart3 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isLiveConfigured } from "../lib/supabaseClient";
import { useLiveSession } from "../hooks/useLiveSession";
import { useIsAdmin } from "../hooks/useIsAdmin";
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

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LivePanel({ open, onClose }: Props) {
  const isMobile = useIsMobile();
  const { isAdmin } = useIsAdmin();
  // Subscriptions activate only while the panel is open.
  const { session, loading, createSession, endSession } = useLiveSession(open);

  // ESC to close + body scroll lock while open.
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

  const panelPos = isMobile
    ? "inset-x-0 bottom-0 h-[92vh] rounded-t-3xl"
    : "right-0 top-0 h-full w-[45%] min-w-[380px] max-w-[640px] rounded-l-3xl";

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] font-sans text-foreground">
          {/* Glassmorphism backdrop */}
          <motion.div
            className="absolute inset-0 bg-brand-950/30 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          {/* Drawer / sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Live Session"
            className={`absolute ${panelPos} flex flex-col border-border/60 bg-surface-1/95 shadow-card backdrop-blur-2xl ${
              isMobile ? "border-t" : "border-l"
            }`}
            initial={hidden}
            animate={shown}
            exit={hidden}
            transition={{ type: "spring", stiffness: 320, damping: 34, mass: 0.9 }}
          >
            {/* Mobile grab handle */}
            {isMobile && (
              <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-border" />
            )}

            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500/60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
                </span>
                <h2 className="text-sm font-semibold">Live Session</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close panel"
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden">
              {!isLiveConfigured() ? (
                <NotConfigured />
              ) : (
                <Tabs defaultValue="live" className="flex h-full flex-col">
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
                    <PollsTab open={open} isAdmin={isAdmin} />
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
        <code className="rounded bg-muted px-1">VITE_SUPABASE_ANON_KEY</code> to the frontend
        environment, then run the SQL in <code className="rounded bg-muted px-1">supabase-schema.sql</code>.
      </p>
    </div>
  );
}
