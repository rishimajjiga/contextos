import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, FolderKanban, ArrowRight, Layers, FileText, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useProjects } from "@/hooks/useProjects";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonList } from "@/components/common/SkeletonCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { FileExtractButton, FileExtractNote } from "@/components/common/FileExtractButton";
import { memoryService } from "@/services/memory.service";
import type { ExtractedFile } from "@/lib/extractText";
import { formatRelativeTime, truncate } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().default(""),
  stack: z.string().default(""),
  goals: z.string().default(""),
});

type FormValues = z.infer<typeof schema>;

function CreateProjectDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (values: FormValues, extract: ExtractedFile | null) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Optional: text extracted from a file, saved as a memory in the new
  // project after it's created. The file itself is never uploaded or stored.
  const [pendingExtract, setPendingExtract] = useState<ExtractedFile | null>(null);

  const onSubmit = async (values: FormValues) => {
    await onCreate(values, pendingExtract);
    setPendingExtract(null);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="name" className="mb-1.5 block">Project name</Label>
            <Input id="name" placeholder="e.g. MajjigaFeed" {...register("name")} />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="desc" className="mb-1.5 block">Description</Label>
            <Textarea
              id="desc"
              placeholder="What are you building?"
              rows={3}
              {...register("description")}
            />
          </div>
          <div>
            <Label htmlFor="stack" className="mb-1.5 block">Tech stack</Label>
            <Input id="stack" placeholder="React, FastAPI, Supabase…" {...register("stack")} />
          </div>
          <div>
            <Label htmlFor="goals" className="mb-1.5 block">Current goal</Label>
            <Input id="goals" placeholder="What's the next milestone?" {...register("goals")} />
          </div>

          {/* Attach file content — becomes a memory inside this project */}
          <div className="rounded-lg border border-border bg-surface-1 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">Attach file content</span>
              <FileExtractButton onExtracted={setPendingExtract} />
            </div>
            {pendingExtract && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-brand-500/10 px-2.5 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-brand-600">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{pendingExtract.fileName}</span>
                  <span className="shrink-0 text-muted-foreground">→ saved as a memory in this project</span>
                </span>
                <button
                  type="button"
                  aria-label="Remove extracted file"
                  onClick={() => setPendingExtract(null)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <FileExtractNote />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoadingSpinner size="sm" /> : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsPage() {
  const { projects, isLoading, createProject } = useProjects();
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async (values: FormValues, extract: ExtractedFile | null) => {
    const stackArr = values.stack
      ? values.stack.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const project = await createProject({
      name: values.name,
      description: values.description,
      stack: stackArr,
      goals: values.goals,
      architecture: "",
      coding_style: "",
      active_tasks: [],
      current_problems: [],
    });
    // If file text was extracted, save it as a normal memory inside the new
    // project — raw text only, no file stored.
    if (extract && project?.id) {
      try {
        await memoryService.create({
          title: extract.title,
          content: extract.text,
          project_id: project.id,
        });
        toast.success(`"${extract.fileName}" has been converted into a memory in ${values.name}.`);
      } catch {
        toast.error("Project created, but saving the extracted text as a memory failed. You can paste it manually.");
      }
    }
  };

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Store tech stack, goals, and architecture notes per project."
        action={
          <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> New project
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonList count={3} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to give AI tools context about what you're building."
          action={
            <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" /> Create project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="h-full hover:border-brand-500/40 transition-colors cursor-pointer">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500/15">
                      <Layers className="h-4 w-4 text-brand-400" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>

                  <h3 className="font-semibold text-sm text-foreground mb-1.5">{project.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3 flex-1 leading-relaxed">
                    {truncate(project.description || "No description", 100)}
                  </p>

                  {project.stack.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {project.stack.slice(0, 4).map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                      ))}
                      {project.stack.length > 4 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{project.stack.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    Updated {formatRelativeTime(project.updated_at)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
