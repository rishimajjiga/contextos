import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { Plus, FileText, Trash2, Upload, Code2, BookOpen, File, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocuments } from "@/hooks/useDocuments";
import { documentService } from "@/services/document.service";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonList } from "@/components/common/SkeletonCard";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { LimitError } from "@/services/api";
import { UpgradeModal } from "@/components/common/UpgradeModal";
import { teamService } from "@/services/team.service";
import { billingService } from "@/services/billing.service";

const DOC_TYPE_ICON: Record<string, React.ElementType> = {
  note: BookOpen,
  code: Code2,
  pdf: File,
  research: FileText,
  other: FileText,
};


function DropZone({ onDrop, isUploading }: { onDrop: (files: File[]) => void; isUploading: boolean }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/*": [], "application/pdf": [], "application/json": [] },
    maxSize: 20 * 1024 * 1024,
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer",
        isDragActive
          ? "border-brand-500 bg-brand-500/10"
          : "border-border hover:border-brand-500/50 hover:bg-surface-2"
      )}
    >
      <input {...getInputProps()} />
      {isUploading ? (
        <LoadingSpinner size="lg" />
      ) : (
        <>
          <Upload className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">
            {isDragActive ? "Drop files here" : "Drag & drop files"}
          </p>
          <p className="text-xs text-muted-foreground">PDF, text, code up to 20 MB</p>
        </>
      )}
    </div>
  );
}

const TYPE_OPTIONS = [
  { value: "note",      label: "📝 Note",      activeClass: "border-indigo-500 bg-indigo-500/10 text-indigo-400" },
  { value: "code",      label: "💻 Code",      activeClass: "border-emerald-500 bg-emerald-500/10 text-emerald-400" },
  { value: "reference", label: "🔗 Reference", activeClass: "border-amber-500 bg-amber-500/10 text-amber-400" },
  { value: "idea",      label: "💡 Idea",      activeClass: "border-pink-500 bg-pink-500/10 text-pink-400" },
] as const;

function CreateDocDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (values: { title: string; content: string; doc_type: string; tags: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<string>("note");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const MAX = 4000;
  const charPct = content.length / MAX;

  function resetForm() {
    setTitle(""); setContent(""); setDocType("note");
    setTags([]); setTagInput(""); setError(""); setSaved(false);
  }

  function handleClose() { resetForm(); onClose(); }

  function addTag(raw: string) {
    const t = raw.trim().replace(/,$/, "");
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
  }

  function handleTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      setTagInput("");
    }
    if (e.key === "Backspace" && !tagInput) setTags(prev => prev.slice(0, -1));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (!content.trim()) { setError("Content is required."); return; }
    setError(""); setSaving(true);
    try {
      await onCreate({ title: title.trim(), content: content.trim(), doc_type: docType as any, tags: tags.join(",") });
      setSaved(true);
    } catch { /* parent handles errors */ } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        {saved ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="text-5xl">🎉</div>
            <div>
              <p className="text-lg font-bold text-foreground">Memory saved!</p>
              <p className="text-sm text-muted-foreground mt-1">
                "{title}" is now in your AI context.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" size="sm" onClick={resetForm}>+ Save another</Button>
              <Button size="sm" onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Save memory</DialogTitle>
            </DialogHeader>

            {/* Title */}
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground uppercase tracking-wide">Title</Label>
              <Input
                placeholder="Name this memory…"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={120}
              />
            </div>

            {/* Type chips */}
            <div>
              <Label className="mb-2 block text-xs text-muted-foreground uppercase tracking-wide">Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDocType(opt.value)}
                    className={cn(
                      "rounded-lg border py-2 text-xs font-semibold transition-all text-center",
                      docType === opt.value
                        ? opt.activeClass
                        : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content + char counter */}
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground uppercase tracking-wide">Content</Label>
              <div className="relative">
                <Textarea
                  rows={6}
                  placeholder="Paste text, code, a URL, or any notes…"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  maxLength={MAX}
                  className="pb-6 font-mono text-xs resize-none"
                />
                <span className={cn(
                  "absolute bottom-2 right-3 text-[10px] pointer-events-none transition-colors",
                  charPct > 0.95 ? "text-destructive" : charPct > 0.8 ? "text-amber-500" : "text-muted-foreground/50"
                )}>
                  {content.length} / {MAX}
                </span>
              </div>
            </div>

            {/* Tag pills */}
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground uppercase tracking-wide">Tags</Label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 border border-brand-500/20 px-2.5 py-0.5 text-xs font-medium text-brand-400">
                      {t}
                      <button type="button" onClick={() => setTags(prev => prev.filter((_, j) => j !== i))}
                        className="opacity-50 hover:opacity-100 transition-opacity text-sm leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}
              <Input
                placeholder="Type a tag and press Enter…"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKey}
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <LoadingSpinner size="sm" /> : "💾 Save memory"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsPage() {
  const { documents, isLoading, isUploading, fetchDocuments, createDocument, uploadFile, deleteDocument } = useDocuments();
  const [showCreate, setShowCreate] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<LimitError | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isInTeam, setIsInTeam] = useState(false);
  const [planInfo, setPlanInfo] = useState<{ used: number; limit: number; plan: string } | null>(null);

  useEffect(() => {
    billingService.getPlan().then(info => {
      setPlanInfo({
        used: info.usage.documents,
        limit: info.limits.documents,
        plan: info.plan,
      });
    }).catch(() => {});
  }, [documents]); // refresh when docs change

  const handleToggleVisibility = useCallback(async (doc: { id: string; visibility: "private" | "team" }) => {
    setTogglingId(doc.id);
    try {
      await documentService.updateDocument(doc.id, {
        visibility: doc.visibility === "team" ? "private" : "team",
      });
      await fetchDocuments();
    } finally {
      setTogglingId(null);
    }
  }, [fetchDocuments]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  useEffect(() => {
    teamService.getMyOrg().then((org) => setIsInTeam(!!org)).catch(() => setIsInTeam(false));
  }, []);

  const allTags = Array.from(new Set(documents.flatMap(d => d.tags))).sort();

  const visibleDocuments = activeTag
    ? documents.filter(d => d.tags.includes(activeTag))
    : documents;

  const handleDrop = useCallback(async (files: File[]) => {
    for (const file of files) {
      try {
        await uploadFile(file);
      } catch (err) {
        if (err instanceof LimitError) { setLimitError(err); return; }
      }
    }
  }, [uploadFile]);

  const handleCreate = async (values: { title: string; content: string; doc_type: string; tags: string }) => {
    const tags = values.tags
      ? values.tags.split(",").map(t => t.trim()).filter(Boolean)
      : [];
    try {
      await createDocument({
        title: values.title,
        content: values.content,
        doc_type: values.doc_type as import("@/types").DocumentType,
        tags,
      });
    } catch (err) {
      if (err instanceof LimitError) { setLimitError(err); return; }
      throw err;
    }
  };

  return (
    <div>
      {limitError && (
        <UpgradeModal
          resource={limitError.resource as "documents" | "projects"}
          limit={limitError.limit}
          plan={limitError.plan}
          onClose={() => setLimitError(null)}
        />
      )}
      <PageHeader
        title="Documents"
        description="Notes, PDFs, code snippets, and research."
        action={
          <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> New document
          </Button>
        }
      />

      {planInfo && planInfo.limit !== -1 && (
        <div className="mb-6 rounded-xl border border-border bg-surface-1 px-4 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Memory usage</span>
              <span className="text-xs font-semibold text-foreground">
                {planInfo.used} / {planInfo.limit}
                {planInfo.used >= planInfo.limit && (
                  <span className="ml-2 text-red-400 font-bold">Limit reached</span>
                )}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  planInfo.used >= planInfo.limit ? "bg-red-500" :
                  planInfo.used / planInfo.limit > 0.8 ? "bg-amber-400" : "bg-brand-500"
                }`}
                style={{ width: `${Math.min(100, (planInfo.used / planInfo.limit) * 100)}%` }}
              />
            </div>
          </div>
          {planInfo.used >= planInfo.limit && (
            <Link to="/pricing">
              <Button size="sm" variant="outline" className="shrink-0 text-xs border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10">
                Upgrade
              </Button>
            </Link>
          )}
        </div>
      )}

      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="upload">Upload file</TabsTrigger>
        </TabsList>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeTag === null
                  ? "border-brand-500 bg-brand-500/15 text-brand-400"
                  : "border-border text-muted-foreground hover:border-brand-500/40 hover:text-foreground"
              )}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(prev => (prev === tag ? null : tag))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  activeTag === tag
                    ? "border-brand-500 bg-brand-500/15 text-brand-400"
                    : "border-border text-muted-foreground hover:border-brand-500/40 hover:text-foreground"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <TabsContent value="all">
          {isLoading ? (
            <SkeletonList count={4} />
          ) : visibleDocuments.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Save notes, paste code snippets, or upload PDFs to build your knowledge base."
              action={
                <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add document
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {visibleDocuments.map(doc => {
                const Icon = DOC_TYPE_ICON[doc.doc_type] || FileText;
                return (
                  <Card key={doc.id} className="hover:border-border/80 transition-colors">
                    <CardContent className="flex items-start justify-between p-4">
                      <Link to={`/documents/${doc.id}`} className="flex items-start gap-3 min-w-0 flex-1 group">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-3 mt-0.5">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate group-hover:text-brand-400 transition-colors">{doc.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                            {truncate(doc.content, 120)}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-[10px] capitalize">{doc.doc_type}</Badge>
                            {doc.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                            ))}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {formatRelativeTime(doc.created_at)}
                            </span>
                          </div>
                        </div>
                      </Link>
                      <div className="ml-4 flex shrink-0 items-center gap-2">
                        {isInTeam && (
                          <button
                            onClick={() => handleToggleVisibility(doc)}
                            disabled={togglingId === doc.id}
                            className={cn(
                              "transition-colors",
                              doc.visibility === "team"
                                ? "text-brand-400 hover:text-brand-600"
                                : "text-muted-foreground hover:text-brand-400"
                            )}
                            title={doc.visibility === "team" ? "Shared with team – click to make private" : "Private – click to share with team"}
                          >
                            {doc.visibility === "team"
                              ? <Globe className="h-4 w-4" />
                              : <Lock className="h-4 w-4" />
                            }
                          </button>
                        )}
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Delete document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload">
          <DropZone onDrop={handleDrop} isUploading={isUploading} />
        </TabsContent>
      </Tabs>

      <CreateDocDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
