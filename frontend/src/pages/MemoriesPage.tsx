import { useEffect, useState, useRef } from "react";
import { Brain, Trash2, Tag, ChevronDown, ChevronUp, Search, X, Plus, Zap, Lock, Users, Copy, Check, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemories } from "@/hooks/useMemories";
import type { Memory } from "@/services/memory.service";
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
  const { memories, isLoading, error, clearError, fetchMemories, updateMemory, deleteMemory } = useMemories();
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
          {visibleMemories.map((mem) => (
            <MemoryCardItem
              key={mem.id}
              mem={mem}
              isOpen={expanded === mem.id}
              onToggle={() => setExpanded(expanded === mem.id ? null : mem.id)}
              onDelete={() => deleteMemory(mem.id)}
              onUpdate={updateMemory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single memory card — adds Copy + Edit actions beside each memory. ──────────
// Edit opens an in-place editor and saves through PATCH (same row, no duplicate).
interface MemoryCardItemProps {
  mem: Memory;
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (id: string, payload: { title?: string; content?: string; tags?: string[] }) => Promise<Memory | null>;
}

function MemoryCardItem({ mem, isOpen, onToggle, onDelete, onUpdate }: MemoryCardItemProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [title, setTitle] = useState(mem.title);
  const [content, setContent] = useState(mem.content);
  const [tags, setTags] = useState(mem.tags.join(", "));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mem.content);
    } catch {
      // Fallback for older/permission-restricted browsers
      const ta = document.createElement("textarea");
      ta.value = mem.content;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const startEdit = () => {
    setTitle(mem.title);
    setContent(mem.content);
    setTags(mem.tags.join(", "));
    setEditErr(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditErr(null);
  };

  const saveEdit = async () => {
    if (!title.trim() || !content.trim()) {
      setEditErr("Title and content are required.");
      return;
    }
    setSaving(true);
    setEditErr(null);
    const result = await onUpdate(mem.id, {
      title: title.trim(),
      content: content.trim(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setSaving(false);
    if (result) setEditing(false);
    else setEditErr("Failed to save changes.");
  };

  return (
    <Card className="hover:border-border/80 transition-colors">
      <CardContent className="p-4">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                placeholder="Title"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="mt-1 w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground font-mono resize-y focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                placeholder="Content"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tags <span className="font-normal normal-case">(comma-separated)</span></label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                placeholder="auth, api, research"
              />
            </div>
            {editErr && <p className="text-xs text-destructive">{editErr}</p>}
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={saveEdit} disabled={saving} className="gap-1.5">
                <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="flex-1 text-left min-w-0"
                onClick={onToggle}
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

              {/* Per-memory actions: Copy · Edit · Delete */}
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-muted-foreground hover:text-brand-400 transition-colors p-1"
                  aria-label="Copy memory"
                  title="Copy content"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-brand-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={startEdit}
                  className="text-muted-foreground hover:text-brand-400 transition-colors p-1"
                  aria-label="Edit memory"
                  title="Edit memory"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  aria-label="Delete memory"
                  title="Delete memory"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
