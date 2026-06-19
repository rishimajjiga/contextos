import { Link, useLocation } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  User,
  FolderKanban,
  BookOpen,
  FileText,
  Search,
  Settings,
  Cpu,
  Key,
  Users,
  Zap,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { billingService, type PlanInfo } from "@/services/billing.service";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/search", label: "Search", icon: Search },
  { href: "/team", label: "Team", icon: Users },
];

const bottomItems = [
  { href: "/api-keys", label: "API Keys", icon: Key },
  { href: "/settings", label: "Settings", icon: Settings },
];

const PLAN_COLORS = {
  free: "bg-surface-3 text-muted-foreground",
  pro: "bg-brand-500/15 text-brand-400",
  student: "bg-blue-500/15 text-blue-400",
  team: "bg-purple-500/15 text-purple-400",
};

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useUser();
  const [plan, setPlan] = useState<PlanInfo | null>(null);

  useEffect(() => {
    billingService.getPlan().then(setPlan).catch(() => {});
  }, []);

  useEffect(() => {
    onMobileClose?.();
  }, [location.pathname, onMobileClose]);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? location.pathname === href
      : location.pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface-1",
        "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out md:relative md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500">
          <Cpu className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">ContextOS</p>
          <p className="text-[10px] text-muted-foreground">Memory layer for AI</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Navigation
        </p>
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className={cn(
              "nav-item",
              isActive(href) && "active"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Upgrade banner (free plan only) */}
      {plan && plan.plan === "free" && (
        <div className="mx-3 mb-2 rounded-lg border border-brand-500/20 bg-brand-500/5 p-3">
          <p className="text-xs font-medium text-foreground mb-0.5">Free plan</p>
          <p className="text-[10px] text-muted-foreground mb-2">
            {plan.usage.documents}/{plan.limits.documents} memories used
          </p>
          <Link
            to="/pricing"
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-400 transition-colors"
          >
            <Zap className="h-3 w-3" /> Upgrade
          </Link>
        </div>
      )}

      {/* Bottom */}
      <div className="border-t border-border p-3 space-y-0.5">
        {bottomItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className={cn("nav-item", isActive(href) && "active")}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}

        {/* Plan badge for paid users */}
        {plan && plan.plan !== "free" && (
          <Link
            to="/pricing"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors hover:bg-accent",
              PLAN_COLORS[plan.plan]
            )}
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            {plan.display_name} plan
          </Link>
        )}

        {/* User */}
        {user && (
          <div className="mt-2 flex items-center gap-2.5 rounded-md px-3 py-2">
            {user.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName || ""}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">
                {getInitials(user.fullName || user.primaryEmailAddress?.emailAddress || "U")}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {user.fullName || "User"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {user.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
