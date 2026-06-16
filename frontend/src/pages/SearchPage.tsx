import { useState, useCallback, useRef } from "react";
import { Search, FileText, BookOpen, Code2, File, Loader2, Sparkles } from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import { PageHeader } from "@/components/common/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, truncate } from "@/lib/utils";

const TYPE_ICONS: Record<string, React.ElementType> = {
  note: BookOpen,
  code: Code2,
  pdf: File,
  research: FileText,
  other: FileText,
};

function ResultCard({ result }: { result: ReturnType<typeof useSearch>["results"][0] }) {
  const isTeam = result.title.startsWith("[Team] ");
  const displayTitle = isTeam ? result.title.slice(7) : result.title;
  const Icon = TYPE_ICONS[result.doc_type || "other"] || FileText;

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-brand-500/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-3 mt-0.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate mb-1">{displayTitle}</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
            {truncate(result.content, 180)}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] capitalize">
              {result.doc_type || result.type}
            </Badge>
            {isTeam && (
              <Badge className="text-[10px] bg-purple-500/15 text-purple-400 border-purple-500/30 border">
                Team
              </Badge>
            )}
            {result.project_name && (
              <Badge variant="secondary" className="text-[10px]">{result.project_name}</Badge>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {formatRelativeTime(result.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SearchPage() {
  const { results, isSearching, hasSearched, search, clearResults } = useSearch();
  const [inputValue, setInputValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      clearResults();
      return;
    }

    debounceRef.current = setTimeout(() => {
      search(val.trim());
    }, 400);
  }, [search, clearResults]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) search(inputValue.trim());
  };

  return (
    <div>
      <PageHeader
        title="Search"
        description="Search your entire knowledge base."
      />

      {/* Search input */}
      <form onSubmit={handleSubmit} className="relative mb-8">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={inputValue}
          onChange={handleChange}
          placeholder='Try "React hooks performance" or "database schema design"…'
          className="pl-10 pr-4 h-11 text-sm"
          autoFocus
        />
        {isSearching && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </form>

      {/* Results */}
      {!hasSearched && !inputValue && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/15 mb-4">
            <Sparkles className="h-6 w-6 text-brand-400" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Search your memory</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Find anything you've saved — notes, code snippets, PDFs, and research.
            Results match on title and content.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {["React state management", "database indexing", "API authentication", "TypeScript generics"].map(q => (
              <button
                key={q}
                type="button"
                onClick={() => { setInputValue(q); search(q); }}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-brand-500/40 hover:text-foreground transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasSearched && !isSearching && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-foreground mb-1">No results found</p>
          <p className="text-sm text-muted-foreground">
            Try different keywords, or{" "}
            <a href="/documents" className="text-brand-400 hover:underline">add more documents</a>{" "}
            to your knowledge base.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-4">
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </p>
          <div className="space-y-3">
            {results.map(r => (
              <ResultCard key={r.id} result={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
