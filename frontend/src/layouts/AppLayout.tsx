import { useCallback, useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/common/CommandPalette";
import { AuthProvider } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/usePlan";

function GracePeriodBanner() {
  const { plan } = usePlan();
  if (!plan.is_in_grace_period) return null;
  const daysLeft = plan.grace_period_end
    ? Math.max(0, Math.ceil(
        (new Date(plan.grace_period_end).getTime() - Date.now()) / 86_400_000
      ))
    : 0;
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-4 text-sm">
      <span className="text-amber-700 dark:text-amber-300">
        Your subscription has expired. Data is read-only.{" "}
        <strong>Renew within {daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> to avoid data deletion.
      </span>
      <Link
        to="/pricing"
        className="shrink-0 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-white rounded-md font-medium text-xs transition-colors"
      >
        Renew Now
      </Link>
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
      <div className="flex h-[100dvh] overflow-hidden bg-surface-0">
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
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
            <div className="mx-auto max-w-6xl animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </AuthProvider>
  );
}
