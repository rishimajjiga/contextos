import { useLocation, useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/NotificationBell";

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard":   "Dashboard",
  "/profile":     "Profile",
  "/save-memory": "Save Memories",
  "/memories":    "Memories",
  "/search":      "Search",
  "/projects":    "Projects",
  "/settings":    "Settings",
  "/api-keys":    "API Keys",
  "/team":        "Team",
};

function getBreadcrumb(pathname: string): string {
  const base = "/" + pathname.split("/")[1];
  return ROUTE_LABELS[base] || "ContextOS";
}

interface TopbarProps {
  onOpenMobileNav?: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const label = getBreadcrumb(location.pathname);

  return (
    // h-topbar-safe + pt-safe: 56px bar grows by the status-bar inset so the
    // hamburger / search / bell / profile icons never sit under the clock.
    <header className="flex h-topbar-safe shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-1 pt-safe pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] sm:pl-[max(1.5rem,var(--safe-left))] sm:pr-[max(1.5rem,var(--safe-right))]">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground md:hidden"
          aria-label="Open navigation menu"
          onClick={onOpenMobileNav}
        >
          <Menu className="h-4 w-4" />
        </Button>
        <h1 className="truncate text-sm font-semibold text-foreground">{label}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Search"
          onClick={() => navigate("/search")}
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Was an inert <Button> with a Bell icon and no handler; the bell now
            owns its own dropdown state. Same trigger markup, same position. */}
        <NotificationBell />

        <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
      </div>
    </header>
  );
}
