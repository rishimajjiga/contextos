import { useLocation, Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { Search, Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/profile": "Profile",
  "/projects": "Projects",
  "/knowledge": "Knowledge Base",
  "/documents": "Documents",
  "/search": "Search",
  "/settings": "Settings",
};

function getBreadcrumb(pathname: string): string {
  // Handle dynamic segments like /projects/:id
  const base = "/" + pathname.split("/")[1];
  return ROUTE_LABELS[base] || "ContextOS";
}

interface TopbarProps {
  onOpenCommandPalette?: () => void;
  onOpenMobileNav?: () => void;
}

export function Topbar({ onOpenCommandPalette, onOpenMobileNav }: TopbarProps) {
  const location = useLocation();
  const label = getBreadcrumb(location.pathname);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-1 px-4 pt-[env(safe-area-inset-top)] sm:px-6">
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

      <div className="flex items-center gap-2">
        {/* Search button — opens command palette if handler provided, else navigates */}
        {onOpenCommandPalette ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Command palette (⌘K)"
            onClick={onOpenCommandPalette}
          >
            <Search className="h-4 w-4" />
          </Button>
        ) : (
          <Link to="/search">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
          </Link>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </Button>

        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-7 w-7",
            },
          }}
        />
      </div>
    </header>
  );
}
