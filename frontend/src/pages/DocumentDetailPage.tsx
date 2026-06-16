import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Trash2, Save, BookOpen, Code2, File, FileText, ExternalLink,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { documentService } from "@/services/document.service";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { Document, DocumentType } from "@/types";

const DOC_TYPE_ICON: Record<string, React.ElementType> = {
  note: BookOpen,
  code: Code2,
  pdf: File,
  research: FileText,
  other: FileText,
};

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  doc_type: z.enum(["note", "pdf", "code", "research", "other"]),
  tags: z.string().default(""),
});

type FormValues = z.infer<typeof schema>;

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await documentService.getDocument(id);
      setDoc(data);
      reset({
        title: data.title,
        content: data.content,
        doc_type: data.doc_type,
        tags: data.tags.join(", "),
      });
    } catch {
      toast.error("Document not found");
      navigate("/documents");
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate, reset]);

  useEffect(() => { load(); }, [load]);

  const onSubmit = async (values: FormValues) => {
    if (!id) return;
    const tags = values.tags
      ? values.tags.split(",").map(t => t.trim()).filter(Boolean)
      : [];
    try {
      const updated = await documentService.updateDocument(id, {
        title: values.title,
        content: values.content,
        doc_type: values.doc_type,
        tags,
      });
      setDoc(updated);
      toast.success("Document saved");
    } catch {
      toast.error("Failed to save document");
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await documentService.deleteDocument(id);
      toast.success("Document deleted");
      navigate("/documents");
    } catch {
      toast.error("Failed to delete document");
      setIsDeleting(false);
    }
  };

  if (isLoading || !doc) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const Icon = DOC_TYPE_ICON[doc.doc_type] || FileText;

  return (
    <div>
      {/* Back */}
      <Link
        to="/documents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Documents
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{doc.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Created {formatDate(doc.created_at)}
              {doc.updated_at !== doc.created_at && ` · Updated ${formatDate(doc.updated_at)}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {doc.file_url && (
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Open file
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting || !isDirty}
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : <><Save className="h-3.5 w-3.5" /> Save</>}
          </Button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="title" className="mb-1.5 block">Title</Label>
                <Input id="title" {...register("title")} />
              </div>
              <div className="w-40">
                <Label className="mb-1.5 block">Type</Label>
                <Select
                  value={watch("doc_type")}
                  onValueChange={v => setValue("doc_type", v as DocumentType, { shouldDirty: true })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="code">Code</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="tags" className="mb-1.5 block">Tags</Label>
              <Input
                id="tags"
                placeholder="react, hooks, typescript"
                {...register("tags")}
              />
              {doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {doc.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="content" className="mb-1.5 block">Content</Label>
              <Textarea
                id="content"
                rows={20}
                className="font-mono text-xs resize-y"
                {...register("content")}
              />
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Delete confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{doc.title}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This document will be permanently removed from your knowledge base. This cannot be undone.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <LoadingSpinner size="sm" /> : "Delete document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
