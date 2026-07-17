import { useCallback, useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/common/CommandPalette";
import { ProductTour } from "@/components/common/ProductTour";
import { BubbleExtensionPrompts } from "@/components/common/BubbleExtensionPrompts";
import { AuthProvider } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/usePlan";
import { apiClient } from "@/services/api";

function GracePeriodBanner() {
  const { plan } = usePlan();
  const [downloading, setDownloading] = useState(false);

  if (!plan || !plan.is_in_grace_period) return null;

  const deleteDate = plan.grace_period_end
    ? new Date(plan.grace_period_end).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "soon";

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await apiClient.get("/billing/download-backup", {
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `contextos-backup-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-4 text-sm flex-wrap">
      <span className="text-amber-700 dark:text-amber-700">
        Your subscription has expired. Data is read-only and will be{" "}
        <strong>permanently deleted on {deleteDate}</strong>.
        Download your backup now or renew to keep it.
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-md font-medium text-xs transition-colors disabled:opacity-60"
        >
          {downloading ? "Downloading..." : "Download My Data"}
        </button>
        <Link
          to="/pricing"
          className="px-3 py-1 border border-amber-500 text-amber-700 dark:text-amber-700 hover:bg-amber-500/20 rounded-md font-medium text-xs transition-colors"
        >
          Renew Plan
        </Link>
      </div>
    </div>
  );
}

function TrialEndedBanner() {
  const { plan } = usePlan();
  const [dismissed, setDismissed] = useState(false);

  // Only after the one-time Student trial has ended (back on free, not in grace).
  if (!plan || !plan.trial_expired || dismissed) return null;

  return (
    <div className="bg-brand-500/10 border-b border-brand-500/30 px-4 py-2 flex items-center justify-between gap-4 text-sm flex-wrap">
      <span className="text-brand-700 dark:text-brand-600">
        🎓 Your free <strong>Student trial has ended</strong>. You're now on the
        Free plan. Upgrade to keep unlimited memories and auto-inject.
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to="/pricing"
          className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-md font-medium text-xs transition-colors"
        >
          Upgrade Plan
        </Link>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="px-2 py-1 text-brand-700 dark:text-brand-600 hover:opacity-70 rounded-md font-medium text-xs transition-opacity"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <AuthProvider>
      <div className="flex h-dvh overflow-hidden bg-surface-0">
        {mobileNavOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            aria-label="Close navigation menu"
            onClick={closeMobileNav}
          />
        )}
        <Sidebar mobileOpen={mobileNavOpen} onMobileClose={closeMobileNav} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <GracePeriodBanner />
          <TrialEndedBanner />
          <BubbleExtensionPrompts />
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none touch-pan-y p-4 pb-safe-or-4 sm:p-6">
            <div className="mx-auto max-w-6xl animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <ProductTour />
    </AuthProvider>
  );
}
