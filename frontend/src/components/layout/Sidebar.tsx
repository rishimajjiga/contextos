import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, User, Brain, FolderKanban, Users, Zap, Key, Settings, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/usePlan";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile",   label: "Profile",   icon: User },
  { href: "/memories",  label: "Memories",  icon: Brain },
  { href: "/search",    label: "Search",    icon: Search },
  { href: "/projects",  label: "Projects",  icon: FolderKanban },
  { href: "/team",      label: "Team",      icon: Users },
  { href: "/pricing",   label: "Upgrade",   icon: Zap },
  { href: "/api-keys",  label: "API Keys",  icon: Key },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose, onClose }: SidebarProps) {
  const { pathname } = useLocation();
  const close = onMobileClose ?? onClose;

  return (
    <>
      <nav className="hidden md:flex h-full w-56 shrink-0 flex-col bg-surface-1 border-r border-border">
        <SidebarContent pathname={pathname} onClose={close} />
      </nav>
      {mobileOpen && (
        <nav className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface-1 border-r border-border shadow-2xl md:hidden">
          <SidebarContent pathname={pathname} onClose={close} />
        </nav>
      )}
    </>
  );
}

function SidebarContent({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  const { plan } = usePlan();
  // Founder accounts already have everything — no upgrade path to show.
  const items = plan.plan === "founder"
    ? navItems.filter((i) => i.href !== "/pricing")
    : navItems;
  return (
    <>
      <div className="flex h-14 items-center justify-between px-4 border-b border-border shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <img src="/logo_mark.png" alt="ContextOS" className="h-7 w-7 rounded-lg" />
          <span className="font-semibold text-sm text-foreground">ContextOS</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 md:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <ul className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
          return (
            <li key={href}>
              <Link
                to={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-500/15 text-brand-400"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <p className="text-[10px] text-muted-foreground">ContextOS — Universal Memory Layer</p>
      </div>
    </>
  );
}
