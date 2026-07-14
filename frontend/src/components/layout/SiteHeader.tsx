// ── SiteHeader · mobile-first marketing/site navigation ──────────────────────
// Desktop (≥768px): identical to the original landing nav — logo, Pricing,
// Sign in, Context Hub. Below 768px: hamburger + animated slide-down menu.
//
// WebView/TWA/Capacitor/PWA hardening:
// • Respects notch/status-bar via env(safe-area-inset-*) (viewport-fit=cover
//   is set in index.html). `max(..., fallback)` keeps Chrome desktop intact.
// • Fixed positioning with inset-x-0 + min-w-0/truncate prevents horizontal
//   overflow, wrapping, and clipping at any width.
// • 44×44px touch targets, aria-expanded/aria-controls, Escape-to-close,
//   backdrop tap-to-close, and body scroll lock while the menu is open.

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const MENU_ID = "site-header-mobile-menu";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the menu on route change.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Escape closes; lock body scroll while open (WebView keeps momentum
  // scrolling otherwise and the page scrolls behind the menu).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // pt-safe/px-safe: status-bar & notch clearance (Android WebView, TWA,
  // iOS PWA). The blurred backdrop extends under the status bar; content
  // starts below it.
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-surface-0/70 backdrop-blur-xl pt-safe px-safe">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6"
      >
        {/* Logo — min-w-0 + truncate so it can never push the nav wider */}
        <Link to="/" className="flex min-w-0 shrink items-center gap-2">
          <img src="/logo_mark.png" alt="ContextOS" className="h-7 w-7 shrink-0 rounded-md" />
          <span className="truncate whitespace-nowrap text-sm font-semibold">ContextOS</span>
        </Link>

        {/* Desktop nav — unchanged from the original */}
        <div className="hidden items-center gap-4 md:flex">
          <Link
            to="/pricing"
            className="whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
          <Link to="/sign-in">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/context-hub">
            <Button size="sm">
              <span className="sm:hidden">Hub</span>
              <span className="hidden sm:inline">Context Hub</span>
              <Send className="hidden sm:block" />
            </Button>
          </Link>
        </div>

        {/* Mobile controls — Hub CTA stays visible, hamburger opens the rest */}
        <div className="flex shrink-0 items-center gap-1.5 md:hidden">
          <Link to="/context-hub">
            <Button size="sm">
              <span className="sm:hidden">Hub</span>
              <span className="hidden sm:inline">Context Hub</span>
            </Button>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={MENU_ID}
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent active:bg-accent"
          >
            {/* Cross-fade Menu ⇄ X like a native toolbar icon */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? "close" : "open"}
                initial={{ opacity: 0, rotate: -45, scale: 0.8 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 45, scale: 0.8 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="flex"
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </nav>

      {/* Mobile menu — native-style sheet sliding down from the header */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop: tap outside to close */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 -z-10 bg-foreground/20 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              key="menu"
              id={MENU_ID}
              className="overflow-hidden border-t border-border/50 bg-surface-0/95 backdrop-blur-xl md:hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            >
              <motion.div
                className="flex flex-col gap-1 overscroll-contain px-4 pb-safe-or-4 pt-3"
                initial="hidden"
                animate="show"
                exit="hidden"
                variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } }}
              >
                <motion.div variants={{ hidden: { opacity: 0, y: -6 }, show: { opacity: 1, y: 0 } }}>
                  <Link
                    to="/pricing"
                    className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent active:bg-accent"
                    onClick={() => setOpen(false)}
                  >
                    Pricing
                  </Link>
                </motion.div>
                <motion.div variants={{ hidden: { opacity: 0, y: -6 }, show: { opacity: 1, y: 0 } }}>
                  <Link
                    to="/sign-in"
                    className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent active:bg-accent"
                    onClick={() => setOpen(false)}
                  >
                    Sign in
                  </Link>
                </motion.div>
                <motion.div variants={{ hidden: { opacity: 0, y: -6 }, show: { opacity: 1, y: 0 } }}>
                  <Link
                    to="/context-hub"
                    className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent active:bg-accent"
                    onClick={() => setOpen(false)}
                  >
                    Context Hub
                  </Link>
                </motion.div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
