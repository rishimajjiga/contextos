import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, FileText, Code2, File, ArrowRight, Plus } from "lucide-react";
import { useDocuments } from "@/hooks/useDocuments";
import { PageHeader } from "@/components/common/PageHeader";
import { SkeletonList } from "@/components/common/SkeletonCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime, truncate } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  note: "text-blue-400",
  code: "text-emerald-400",
  pdf: "text-orange-400",
  research: "text-purple-400",
  other: "text-muted-foreground",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  note: BookOpen,
  code: Code2,
  pdf: File,
  research: FileText,
  other: FileText,
};

const STATS = [
  { type: "note", label: "Notes" },
  { type: "code", label: "Code snippets" },
  { type: "pdf", label: "PDFs" },
  { type: "research", label: "Research" },
];

export function KnowledgePage() {
  const { documents, isLoading, fetchDocuments, total } = useDocuments();

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const countByType = (type: string) =>
    documents.filter(d => d.doc_type === type).length;

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="Everything you've stored — searchable by AI using semantic similarity."
        action={
          <Link to="/documents">
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" /> Add knowledge
            </Button>
          </Link>
        }
      />

      {/* Type breakdown */}
      {!isLoading && documents.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
          {STATS.map(({ type, label }) => {
            const Icon = TYPE_ICONS[type];
            const count = countByType(type);
            return (
              <div
                key={type}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
                <Icon className={`h-5 w-5 shrink-0 ${TYPE_COLORS[type]}`} />
                <div>
                  <p className="text-lg font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <SkeletonList count={5} />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Your knowledge base is empty"
          description="Add notes, upload PDFs, paste code snippets. AI tools will use this context automatically."
          action={
            <Link to="/documents">
              <Button size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" /> Add your first document
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {documents.map(doc => {
            const Icon = TYPE_ICONS[doc.doc_type] || FileText;
            const color = TYPE_COLORS[doc.doc_type] || "text-muted-foreground";
            return (
              <Card key={doc.id} className="hover:border-border/80 transition-colors">
                <CardContent className="flex items-center gap-4 p-4">
                  <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{doc.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {truncate(doc.content, 100)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px] capitalize">{doc.doc_type}</Badge>
                    <span className="text-[10px] text-muted-foreground hidden sm:block">
                      {formatRelativeTime(doc.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Search CTA */}
      {!isLoading && documents.length > 0 && (
        <Link to="/search">
          <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-surface-2 px-5 py-4 hover:border-brand-500/40 transition-colors">
            <p className="text-sm text-muted-foreground">
              Search across all {total} documents using AI
            </p>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
      )}
    </div>
  );
}
