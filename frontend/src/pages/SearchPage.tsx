import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search, FolderKanban, Brain, Tag, ArrowRight, Loader2, Clock, X,
} from "lucide-react";
import axios from "axios";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchSuggestions } from "@/hooks/useSearch";
import { fetchResults, type Suggestion } from "@/services/search.service";
import type { SearchResults } from "@/services/search.service";

// -- Text highlight ------------------------------------------------------------
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-brand-500/20 text-brand-400 rounded-[2px] font-semibold not-italic">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

// -- SearchPage ----------------------------------------------------------------

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";

  const [query, setQuery]           = useState(initialQ);
  const [results, setResults]       = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const debouncedQ = useDebounce(query, 200);

  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    suggestions,
    loadingSuggestions,
    selectedIndex,
    setSelectedIndex,
    recentSearches,
    saveSearch,
    removeSearch,
    clearSearches,
  } = useSearchSuggestions(query);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (!debouncedQ.trim()) {
      setResults(null);
      setIsLoading(false);
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ q: debouncedQ.trim() }, { replace: true });
    setIsLoading(true);
    setError(null);

    const controller = new AbortController();

    fetchResults(debouncedQ.trim(), 30, controller.signal)
      .then(data => setResults(data))
      .catch(err => {
        if (!axios.isCancel(err)) {
          setError(err?.message || "Search failed.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQ, setSearchParams]);

  type DropdownItem =
    | { type: "recent";     label: string }
    | { type: "suggestion"; label: string; kind: "project" | "memory"; id: string };

  const dropdownItems: DropdownItem[] = query.trim()
    ? suggestions.map(s => ({ type: "suggestion" as const, ...s }))
    : recentSearches.slice(0, 6).map(r => ({ type: "recent" as const, label: r }));

  const dropdownVisible = showDropdown && (dropdownItems.length > 0 || loadingSuggestions);

  const navigateToSuggestion = useCallback((item: Suggestion) => {
    saveSearch(item.label);
    setShowDropdown(false);
    if (item.kind === "project") navigate(`/projects/${item.id}`);
    else navigate("/memories", { state: { highlight: item.id } });
  }, [navigate, saveSearch]);

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    saveSearch(q.trim());
    setQuery(q.trim());
    setShowDropdown(false);
    inputRef.current?.blur();
  }, [saveSearch]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownVisible) {
      if (e.key === "Enter" && query.trim()) runSearch(query);
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(Math.min(selectedIndex + 1, dropdownItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(Math.max(selectedIndex - 1, -1));
        break;
      case "Enter": {
        e.preventDefault();
        if (selectedIndex >= 0) {
          const item = dropdownItems[selectedIndex];
          if (item.type === "recent") runSearch(item.label);
          else navigateToSuggestion(item as Suggestion);
        } else {
          runSearch(query);
        }
        break;
      }
      case "Escape":
        e.preventDefault();
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  }

  const hasResults = results && (results.projects.length > 0 || results.memories.length > 0);

  return (
    <div>
      <PageHeader title="Search" description="Search across your projects and memories." />

      <div className="relative mb-6" ref={containerRef}>
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={onKeyDown}
          placeholder="Search projects and memories…"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-border bg-surface-1 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
        />
        {isLoading && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}

        {dropdownVisible && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-border bg-surface-1 shadow-xl overflow-hidden">
            {loadingSuggestions && dropdownItems.length === 0 && (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Looking up suggestions…
              </div>
            )}

            {dropdownItems.map((item, idx) => {
              const isActive = idx === selectedIndex;
              const base = "flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors cursor-pointer select-none";
              const activeClass = "bg-brand-500/10 text-foreground";
              const idleClass   = "text-foreground hover:bg-surface-2";

              if (item.type === "recent") {
                return (
                  <button
                    key={`recent-${item.label}`}
                    onMouseDown={e => { e.preventDefault(); runSearch(item.label); }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`${base} ${isActive ? activeClass : idleClass} group`}
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span
                      role="button"
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); removeSearch(item.label); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5 rounded"
                      aria-label="Remove from recent searches"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                );
              }

              const Icon = item.kind === "project" ? FolderKanban : Brain;
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  onMouseDown={e => { e.preventDefault(); navigateToSuggestion(item as Suggestion); }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`${base} ${isActive ? activeClass : idleClass}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    <HighlightMatch text={item.label} query={query} />
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 capitalize">{item.kind}</span>
                </button>
              );
            })}

            {!query.trim() && recentSearches.length > 0 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-2">
                <span className="text-[10px] text-muted-foreground">Recent</span>
                <button
                  onMouseDown={e => { e.preventDefault(); clearSearches(); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}

            {dropdownItems.length > 0 && (
              <div className="border-t border-border px-4 py-2 flex gap-3 text-[10px] text-muted-foreground">
                <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                <span><kbd className="font-mono">↵</kbd> open</span>
                <span><kbd className="font-mono">esc</kbd> close</span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-300 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          {error}
        </p>
      )}

      {!query && !results && (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
          <Search className="h-10 w-10 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Type to search projects and memories</p>
        </div>
      )}

      {debouncedQ && results && !hasResults && !isLoading && (
        <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
          <p className="text-sm font-medium text-foreground">No results for "{debouncedQ}"</p>
          <p className="text-xs text-muted-foreground">Try a different keyword</p>
        </div>
      )}

      {hasResults && (
        <div className="space-y-6">
          {results.projects.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <FolderKanban className="h-3.5 w-3.5" /> Projects ({results.projects.length})
              </h2>
              <div className="space-y-2">
                {results.projects.map((p) => (
                  <Link
                    key={p.id}
                    to={`/projects/${p.id}`}
                    onClick={() => saveSearch(debouncedQ)}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 px-4 py-3 hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors group"
                  >
                    <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        <HighlightMatch text={p.name} query={debouncedQ} />
                      </p>
                      {p.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</p>
                      )}
                    </div>
                    {p.stack.slice(0, 2).map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px] shrink-0">{s}</Badge>
                    ))}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.memories.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Brain className="h-3.5 w-3.5" /> Memories ({results.memories.length})
              </h2>
              <div className="space-y-2">
                {results.memories.map((m) => (
                  <Link
                    key={m.id}
                    to="/memories"
                    state={{ highlight: m.id }}
                    onClick={() => saveSearch(debouncedQ)}
                    className="block rounded-lg border border-border bg-surface-1 px-4 py-3 hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Brain className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          <HighlightMatch text={m.title} query={debouncedQ} />
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.content}</p>
                        {m.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {m.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] gap-1">
                                <Tag className="h-2.5 w-2.5" />{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
