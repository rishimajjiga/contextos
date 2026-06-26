import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brain, Search, X, Users, Plus, ChevronDown, ChevronUp, Tag } from "lucide-react";
import { memoryService, type Memory } from "@/services/memory.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useDebounce } from "@/hooks/useDebounce";
import { formatRelativeTime, truncate } from "@/lib/utils";

/**
 * Team Memories workspace — shows ONLY memories shared with the team
 * (visibility="team"). The backend derives team membership + active plan from
 * the caller, so this never exposes another team's data. Personal/private
 * memories are not included here (they live on the Memories page).
 */
export function TeamMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const debounced = useDebounce(search, 350);

  useEffect(() => {
    let active = true;
    setLoading(true);
    memoryService
      .list({ scope: "team", q: debounced.trim() || undefined })
      .then((data) => { if (active) { setMemories(data); setError(null); } })
      .catch((e: any) => { if (active) setError(e?.message || "Failed to load team memories."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debounced]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-brand-500" /> Team Memories
            </CardTitle>
            <CardDescription>Memories shared with everyone in your team.</CardDescription>
          </div>
          <Link to="/memories/new">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team memories…"
            className="w-full rounded-lg border border-border bg-surface-1 py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex h-24 items-center justify-center"><LoadingSpinner /></div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : memories.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
            <Brain className="h-5 w-5" />
            {search
              ? `No team memories match "${search}"`
              : "No team memories yet. Create one and check “Share with team.”"}
          </div>
        ) : (
          memories.map((mem) => {
            const open = expanded === mem.id;
            const who = mem.creator_name || mem.creator_email || "Teammate";
            return (
              <div key={mem.id} className="rounded-lg border border-surface-2 bg-surface-1 p-3">
                <button type="button" onClick={() => setExpanded(open ? null : mem.id)} className="w-full text-left">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-brand-400 shrink-0" />
                    <p className="font-medium text-sm text-foreground leading-snug">{mem.title}</p>
                    {open
                      ? <ChevronUp className="h-3.5 w-3.5 ml-auto text-muted-foreground shrink-0" />
                      : <ChevronDown className="h-3.5 w-3.5 ml-auto text-muted-foreground shrink-0" />}
                  </div>
                  {!open && (
                    <p className="text-xs text-muted-foreground mt-1 ml-6 line-clamp-1">{truncate(mem.content, 120)}</p>
                  )}
                </button>
                {open && (
                  <pre className="mt-2 ml-6 whitespace-pre-wrap text-sm text-foreground font-mono bg-surface-2 rounded-lg p-3 border border-border overflow-x-auto">
                    {mem.content}
                  </pre>
                )}
                <div className="flex items-center gap-2 mt-2 ml-6 flex-wrap">
                  {mem.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] gap-1">
                      <Tag className="h-2.5 w-2.5" />{t}
                    </Badge>
                  ))}
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground ml-auto">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-100 text-brand-600 text-[8px] font-semibold">
                      {who.slice(0, 1).toUpperCase()}
                    </span>
                    {who}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{formatRelativeTime(mem.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
