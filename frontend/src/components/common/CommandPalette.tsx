import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  LayoutDashboard, User, Brain, FolderKanban, Search,
  Settings, X, Key, Users,
} from "lucide-react";

const PAGES = [
  { label: "Dashboard",     href: "/dashboard",   icon: LayoutDashboard },
  { label: "Profile",       href: "/profile",     icon: User },
  { label: "Save Memories", href: "/save-memory", icon: Brain },
  { label: "Memories",      href: "/memories",    icon: Brain },
  { label: "Search",        href: "/search",      icon: Search },
  { label: "Projects",      href: "/projects",    icon: FolderKanban },
  { label: "Team",          href: "/team",        icon: Users },
  { label: "API Keys",      href: "/api-keys",    icon: Key },
  { label: "Settings",      href: "/settings",    icon: Settings },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const go = useCallback(
    (href: string) => { navigate(href); onClose(); },
    [navigate, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[max(20dvh,calc(var(--safe-top)+1rem))]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface-1 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <Command className="flex flex-col" shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Go to page…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoFocus
            />
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Pages" className="px-1 pb-1">
              {PAGES.filter(p =>
                !search.trim() ||
                p.label.toLowerCase().includes(search.toLowerCase())
              ).map(({ label, href, icon: Icon }) => (
                <Command.Item
                  key={href}
                  value={label}
                  onSelect={() => go(href)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-3 transition-colors"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>

          <div className="border-t border-border px-4 py-2 flex gap-3 text-[10px] text-muted-foreground">
            <span><kbd className="font-mono">up down</kbd> navigate</span>
            <span><kbd className="font-mono">enter</kbd> open</span>
            <span><kbd className="font-mono">esc</kbd> close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
