// ── NotificationBell · the Topbar bell + its inbox dropdown ────────────────
// Consumes the endpoints that already exist (GET /inbox/notifications,
// POST /inbox/notifications/{id}/read). No new notification system, no extra
// global store — the panel owns its own fetch state, which is all it needs.
//
// The trigger keeps the exact Button markup the Topbar had before (ghost /
// icon / h-8 w-8 / same classes / same aria-label), so the bar looks
// unchanged; the only addition is the unread dot, which renders nothing when
// the count is zero.
//
// Styling reuses existing tokens and the AnimatePresence pattern already used
// by SiteHeader's mobile menu — no new UI primitives, no new dependencies.

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Loader2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  notificationService,
  type AppNotification,
} from "@/services/notification.service";

const TYPE_DOT: Record<string, string> = {
  update: "bg-brand-500",
  announcement: "bg-brand-500",
  feature: "bg-emerald-500",
  maintenance: "bg-amber-500",
  warning: "bg-destructive",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await notificationService.list();
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch the unread count once on mount so the badge is correct before the
  // user ever opens the panel — and again on every open, so a panel that's
  // been sitting closed for an hour doesn't show stale content.
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onItemClick = async (n: AppNotification) => {
    if (n.read) return;
    // Optimistic: flip locally first so the row responds instantly, then
    // persist. On failure we roll back, because the badge lying about state
    // is worse than a click that visibly didn't take.
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await notificationService.markRead(n.id);
    } catch {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: false } : i)));
      setUnread((u) => u + 1);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger — same Button props/classes as the original inert bell */}
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 flex h-2 w-2 items-center justify-center rounded-full bg-brand-500 ring-2 ring-surface-1"
          />
        )}
        {unread > 0 && <span className="sr-only">{unread} unread notifications</span>}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              {unread > 0 && (
                <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-xs font-medium text-brand-400">
                  {unread} new
                </span>
              )}
            </div>

            <div className="max-h-[22rem] overflow-y-auto overscroll-contain">
              {loading && items.length === 0 && (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              )}

              {error && items.length === 0 && !loading && (
                <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <p className="text-sm text-muted-foreground">
                    Couldn't load notifications.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => void load()}>
                    Try again
                  </Button>
                </div>
              )}

              {!loading && !error && items.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">You're all caught up</p>
                  <p className="text-xs text-muted-foreground">
                    New updates will show up here.
                  </p>
                </div>
              )}

              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void onItemClick(n)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent",
                    !n.read && "bg-brand-500/5"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : TYPE_DOT[n.type] ?? "bg-brand-500"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-sm text-foreground",
                          n.read ? "font-medium" : "font-semibold"
                        )}
                      >
                        {n.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </span>
                    {n.message && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {n.message}
                      </span>
                    )}
                  </span>
                  {n.read && (
                    <Check aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
