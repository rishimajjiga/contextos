import { useLocation, useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { Search, Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    // Header height grows by the status-bar inset instead of clipping the 56px content row
    <header className="flex h-[calc(3.5rem+env(safe-area-inset-top,0px))] shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-1 pt-[env(safe-area-inset-top,0px)] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:pl-[max(1.5rem,env(safe-area-inset-left,0px))] sm:pr-[max(1.5rem,env(safe-area-inset-right,0px))]">
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

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </Button>

        <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
      </div>
    </header>
  );
}
