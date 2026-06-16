import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  LayoutDashboard, User, FolderKanban, BookOpen,
  FileText, Search, Settings, X, Key, Brain, Loader2,
} from "lucide-react";
import { searchService } from "@/services/search.service";
import type { SearchResult } from "@/types";

const PAGES = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard },
  { label: "Profile",    href: "/profile",    icon: User },
  { label: "Projects",   href: "/projects",   icon: FolderKanban },
  { label: "Knowledge",  href: "/knowledge",  icon: BookOpen },
  { label: "Documents",  href: "/documents",  icon: FileText },
  { label: "Search",     href: "/search",     icon: Search },
  { label: "API Keys",   href: "/api-keys",   icon: Key },
  { label: "Settings",   href: "/settings",   icon: Settings },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [memResults, setMemResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) { setSearch(""); setMemResults([]); }
  }, [open]);

  // Search memories when query is long enough
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim() || search.length < 2) { setMemResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchService.search({ query: search, limit: 5 });
        setMemResults(results);
      } catch { setMemResults([]); }
      finally { setSearching(false); }
    }, 350);
  }, [search]);

  const go = useCallback(
    (href: string) => { navigate(href); onClose(); },
    [navigate, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface-1 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <Command className="flex flex-col" shouldFilter={false}>
          {/* Input */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search memories or go to page…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoFocus
            />
            {searching
              ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
              : <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
            }
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Memory results */}
            {memResults.length > 0 && (
              <Command.Group heading="Memories" className="px-1 pb-1">
                {memResults.map(r => (
                  <Command.Item
                    key={r.id}
                    value={r.id}
                    onSelect={() => go(`/documents/${r.id}`)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-3 transition-colors"
                  >
                    <Brain className="h-4 w-4 shrink-0 text-brand-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(r.content || "").slice(0, 60)}…
                      </p>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Page navigation */}
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
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
            <span><kbd className="font-mono">esc</kbd> close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
