import { useEffect, useState, useRef } from "react";
import { Brain, Trash2, Tag, ChevronDown, ChevronUp, Search, X, Plus, Zap, Lock, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemories } from "@/hooks/useMemories";
import { usePlan } from "@/hooks/usePlan";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

export function MemoriesPage() {
  const { memories, isLoading, error, clearError, fetchMemories, deleteMemory } = useMemories();
  const { plan } = usePlan();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQ = useDebounce(searchQuery, 350);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMemories({ scope: "personal", ...(debouncedQ.trim() ? { q: debouncedQ.trim() } : {}) });
  }, [debouncedQ, fetchMemories]);

  const handleClearSearch = () => {
    setSearchQuery("");
    searchRef.current?.focus();
  };

  // Free plan has a positive memory limit; Pro/Student are unlimited (-1).
  // We never delete anything — older memories stay stored and simply aren't
  // shown until the user upgrades again.
  const memLimit = plan?.limits.memories ?? -1;
  const limited = memLimit > 0;
  const visibleMemories = limited ? memories.slice(0, memLimit) : memories;
  const hiddenCount = limited ? Math.max(0, memories.length - memLimit) : 0;
  const showLimitBanner = hiddenCount > 0 && !searchQuery.trim();

  return (
    <div>
      <PageHeader
        title="Memories"
        description="Notes and snippets saved from the Chrome extension. Your AI tools reference these automatically."
        action={
          <Link to="/memories/new">
            <Button className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" /> New memory
            </Button>
          </Link>
        }
      />

      {/* Error banner */}
      {error && (
        <div className="mb-4">
          <ErrorAlert
            message={error}
            onRetry={() => {
              clearError();
              fetchMemories({ scope: "personal", ...(debouncedQ.trim() ? { q: debouncedQ.trim() } : {}) });
            }}
            onDismiss={clearError}
          />
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search memories…"
          className="w-full rounded-lg border border-border bg-surface-1 py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Plan limit notice — older memories stay stored, just hidden on Free */}
      {showLimitBanner && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            Showing your latest {memLimit} memories.{" "}
            <span className="text-muted-foreground">Upgrade to access all your memories.</span>
          </p>
          <Link to="/plans" className="shrink-0">
            <Button size="sm" className="gap-1.5 w-full sm:w-auto">
              <Zap className="h-3.5 w-3.5" /> Upgrade
            </Button>
          </Link>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : memories.length === 0 ? (
        searchQuery ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-foreground">No memories match "{searchQuery}"</p>
            <button onClick={handleClearSearch} className="text-xs text-brand-400 hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          <EmptyState
            icon={Brain}
            title="No memories yet"
            description="Save text from any page using the Chrome extension — right-click selected text and choose 'Save to ContextOS'."
          />
        )
      ) : (
        <div className="space-y-3">
          {visibleMemories.map((mem) => {
            const isOpen = expanded === mem.id;
            return (
              <Card key={mem.id} className="hover:border-border/80 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="flex-1 text-left min-w-0"
                      onClick={() => setExpanded(isOpen ? null : mem.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                        <p className="font-semibold text-sm text-foreground leading-snug">
                          {mem.title}
                        </p>
                        {isOpen
                          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
                          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
                        }
                      </div>
                      {!isOpen && (
                        <p className="text-xs text-muted-foreground mt-1 ml-6 line-clamp-1">
                          {truncate(mem.content, 120)}
                        </p>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteMemory(mem.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                      aria-label="Delete memory"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="mt-3 ml-6">
                      <pre className="whitespace-pre-wrap text-sm text-foreground font-mono bg-surface-2 rounded-lg p-4 border border-border overflow-x-auto">
                        {mem.content}
                      </pre>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3 ml-6 flex-wrap">
                    {mem.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] gap-1">
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </Badge>
                    ))}
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                      {mem.visibility === "team"
                        ? <><Users className="h-2.5 w-2.5" /> Team</>
                        : <><Lock className="h-2.5 w-2.5" /> Private</>}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(mem.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
