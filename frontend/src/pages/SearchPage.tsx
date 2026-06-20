import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, FolderKanban, Brain, Tag, ArrowRight, Loader2 } from "lucide-react";
import { apiClient } from "@/services/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchProject {
  id: string;
  name: string;
  description: string | null;
  stack: string[];
  kind: "project";
}

interface SearchMemory {
  id: string;
  title: string;
  content: string;
  tags: string[];
  kind: "memory";
}

interface SearchResults {
  projects: SearchProject[];
  memories: SearchMemory[];
  total: number;
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const debouncedQ = useDebounce(query, 350);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!debouncedQ.trim()) {
      setResults(null);
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ q: debouncedQ.trim() }, { replace: true });

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<SearchResults>(`/search?q=${encodeURIComponent(debouncedQ.trim())}&limit=30`)
      .then((res) => {
        if (!cancelled) setResults(res.data);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || "Search failed.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQ, setSearchParams]);

  const hasResults = results && (results.projects.length > 0 || results.memories.length > 0);

  return (
    <div>
      <PageHeader
        title="Search"
        description="Search across your projects and memories."
      />

      {/* Search input */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects and memories…"
          className="w-full rounded-xl border border-border bg-surface-1 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
        />
        {isLoading && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mb-4 text-sm text-red-300 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">{error}</p>
      )}

      {/* Empty prompt */}
      {!query && !results && (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
          <Search className="h-10 w-10 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Type to search projects and memories</p>
        </div>
      )}

      {/* No results */}
      {debouncedQ && results && !hasResults && !isLoading && (
        <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
          <p className="text-sm font-medium text-foreground">No results for "{debouncedQ}"</p>
          <p className="text-xs text-muted-foreground">Try a different keyword</p>
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <div className="space-y-6">
          {/* Projects */}
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
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 px-4 py-3 hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors group"
                  >
                    <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
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

          {/* Memories */}
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
                    className="block rounded-lg border border-border bg-surface-1 px-4 py-3 hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Brain className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{m.title}</p>
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
