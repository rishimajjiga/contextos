import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft, Trash2, Save, Plus, X, CheckCircle2, AlertCircle,
  Upload, FileText, File, BookOpen, Code2,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useProjects } from "@/hooks/useProjects";
import { useDocuments } from "@/hooks/useDocuments";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn, formatDate, formatRelativeTime, truncate } from "@/lib/utils";
import { LimitError } from "@/services/api";
import { UpgradeModal } from "@/components/common/UpgradeModal";
import type { DocumentType } from "@/types";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  goals: z.string().default(""),
  architecture: z.string().default(""),
  coding_style: z.string().default(""),
});

type FormValues = z.infer<typeof schema>;

const docSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  doc_type: z.enum(["note", "pdf", "code", "research", "other"]),
  tags: z.string().default(""),
});
type DocFormValues = z.infer<typeof docSchema>;

const DOC_TYPE_ICON: Record<string, React.ElementType> = {
  note: BookOpen,
  code: Code2,
  pdf: File,
  research: FileText,
  other: FileText,
};

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
  icon: Icon,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  icon: React.ElementType;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    if (input.trim() && !items.includes(input.trim())) {
      onChange([...items, input.trim()]);
      setInput("");
    }
  };

  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex gap-2 mb-3">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" size="icon" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2"
          >
            <div className="flex items-center gap-2 text-sm">
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{item}</span>
            </div>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">No items yet</p>
        )}
      </ul>
    </div>
  );
}

function ProjectDropZone({ onDrop, isUploading }: { onDrop: (files: File[]) => void; isUploading: boolean }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [], "text/*": [], "application/json": [] },
    maxSize: 20 * 1024 * 1024,
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer",
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
          <Upload className="h-7 w-7 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">
            {isDragActive ? "Drop files here" : "Drop a PDF or text file"}
          </p>
          <p className="text-xs text-muted-foreground">Up to 20 MB — auto-linked to this project</p>
        </>
      )}
    </div>
  );
}

function AddDocDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (values: DocFormValues) => Promise<void>;
}) {
  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm<DocFormValues>({
    resolver: zodResolver(docSchema),
    defaultValues: { doc_type: "note", tags: "" },
  });

  const onSubmit = async (values: DocFormValues) => {
    await onAdd(values);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Add document to project</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div>
            <Label className="mb-1.5 block">Title</Label>
            <Input placeholder="Document title" {...register("title")} />
            {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div>
            <Label className="mb-1.5 block">Type</Label>
            <Select
              value={watch("doc_type")}
              onValueChange={v => setValue("doc_type", v as DocumentType)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="code">Code snippet</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Content</Label>
            <Textarea
              rows={6}
              placeholder="Paste text, code, or notes"
              className="font-mono text-xs"
              {...register("content")}
            />
            {errors.content && <p className="mt-1 text-xs text-destructive">{errors.content.message}</p>}
          </div>
          <div>
            <Label className="mb-1.5 block">Tags (comma-separated)</Label>
            <Input placeholder="react, hooks, typescript" {...register("tags")} />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoadingSpinner size="sm" /> : "Save document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedProject, isLoading, fetchProject, editProject, deleteProject } = useProjects();
  const {
    documents, isLoading: docsLoading, isUploading,
    fetchDocuments, createDocument, uploadFile, deleteDocument,
  } = useDocuments(id);
  const [showDelete, setShowDelete] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [limitError, setLimitError] = useState<LimitError | null>(null);
  const [stack, setStack] = useState<string[]>([]);
  const [activeTasks, setActiveTasks] = useState<string[]>([]);
  const [currentProblems, setCurrentProblems] = useState<string[]>([]);

  const {
    register, handleSubmit, reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (id) fetchProject(id);
  }, [id, fetchProject]);

  useEffect(() => {
    if (id) fetchDocuments();
  }, [id, fetchDocuments]);

  useEffect(() => {
    if (selectedProject) {
      reset({
        name: selectedProject.name,
        description: selectedProject.description,
        goals: selectedProject.goals,
        architecture: selectedProject.architecture,
        coding_style: selectedProject.coding_style,
      });
      setStack(selectedProject.stack);
      setActiveTasks(selectedProject.active_tasks);
      setCurrentProblems(selectedProject.current_problems);
    }
  }, [selectedProject, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!id) return;
    await editProject(id, { ...values, stack, active_tasks: activeTasks, current_problems: currentProblems });
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteProject(id);
    navigate("/projects");
  };

  const handleDrop = useCallback(async (files: File[]) => {
    for (const file of files) {
      try {
        await uploadFile(file);
      } catch (err) {
        if (err instanceof LimitError) { setLimitError(err); return; }
      }
    }
  }, [uploadFile]);

  const handleAddDoc = async (values: DocFormValues) => {
    const tags = values.tags
      ? values.tags.split(",").map(t => t.trim()).filter(Boolean)
      : [];
    try {
      await createDocument({
        title: values.title,
        content: values.content,
        doc_type: values.doc_type,
        tags,
        project_id: id,
      });
    } catch (err) {
      if (err instanceof LimitError) { setLimitError(err); return; }
      throw err;
    }
  };

  if (isLoading || !selectedProject) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Back */}
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{selectedProject.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Created {formatDate(selectedProject.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button size="sm" className="gap-2" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? <LoadingSpinner size="sm" /> : <><Save className="h-3.5 w-3.5" /> Save</>}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="stack">Tech stack</TabsTrigger>
            <TabsTrigger value="tasks">Tasks & problems</TabsTrigger>
            <TabsTrigger value="documents">
              Documents
              {documents.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{documents.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-5">
                <div>
                  <Label htmlFor="name" className="mb-1.5 block">Project name</Label>
                  <Input id="name" {...register("name")} />
                </div>
                <div>
                  <Label htmlFor="desc" className="mb-1.5 block">Description</Label>
                  <Textarea id="desc" rows={3} {...register("description")} />
                </div>
                <div>
                  <Label htmlFor="goals" className="mb-1.5 block">Goals</Label>
                  <Textarea id="goals" rows={3} placeholder="Current milestone or objective…" {...register("goals")} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Architecture notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea rows={5} placeholder="Describe the system design, patterns, or key decisions…" {...register("architecture")} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Coding style</CardTitle></CardHeader>
              <CardContent>
                <Textarea rows={3} placeholder="e.g. Short functions with comments, strict TypeScript, no external libraries…" {...register("coding_style")} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stack">
            <Card>
              <CardContent className="pt-5">
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {stack.map(s => (
                    <Badge key={s} variant="secondary" className="gap-1 pr-1">
                      {s}
                      <button type="button" onClick={() => setStack(stack.filter(x => x !== s))}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add technology (Enter to add)"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = (e.target as HTMLInputElement).value.trim();
                        if (v && !stack.includes(v)) setStack([...stack, v]);
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Active tasks</CardTitle></CardHeader>
              <CardContent>
                <ListEditor
                  label=""
                  items={activeTasks}
                  onChange={setActiveTasks}
                  placeholder="Add a task…"
                  icon={CheckCircle2}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Current problems</CardTitle></CardHeader>
              <CardContent>
                <ListEditor
                  label=""
                  items={currentProblems}
                  onChange={setCurrentProblems}
                  placeholder="Describe a problem or blocker…"
                  icon={AlertCircle}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <ProjectDropZone onDrop={handleDrop} isUploading={isUploading} />

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {documents.length === 0 ? "No documents yet" : `${documents.length} document${documents.length !== 1 ? "s" : ""}`}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => setShowAddDoc(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Add note
              </Button>
            </div>

            {docsLoading ? (
              <div className="flex h-24 items-center justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => {
                  const Icon = DOC_TYPE_ICON[doc.doc_type] || FileText;
                  return (
                    <Card key={doc.id} className="hover:border-border/80 transition-colors">
                      <CardContent className="flex items-start justify-between p-3">
                        <Link to={`/documents/${doc.id}`} className="flex items-start gap-3 min-w-0 flex-1 group">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-3 mt-0.5">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground truncate group-hover:text-brand-400 transition-colors">
                              {doc.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {truncate(doc.content, 80)}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge variant="secondary" className="text-[10px] capitalize">{doc.doc_type}</Badge>
                              <span className="text-[10px] text-muted-foreground">{formatRelativeTime(doc.created_at)}</span>
                            </div>
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={() => deleteDocument(doc.id)}
                          className="ml-3 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          aria-label="Delete document"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </form>

      {limitError && (
        <UpgradeModal
          resource={limitError.resource as "documents" | "projects"}
          limit={limitError.limit}
          plan={limitError.plan}
          onClose={() => setLimitError(null)}
        />
      )}

      {/* Delete project confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{selectedProject.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the project and all its documents. This action cannot be undone.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddDocDialog
        open={showAddDoc}
        onClose={() => setShowAddDoc(false)}
        onAdd={handleAddDoc}
      />
    </div>
  );
}
