import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FolderKanban, ArrowRight, Layers } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useProjects } from "@/hooks/useProjects";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonList } from "@/components/common/SkeletonCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
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
  onCreate: (values: FormValues) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    await onCreate(values);
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
            <Input id="desc" placeholder="What are you building?" {...register("description")} />
          </div>
          <div>
            <Label htmlFor="stack" className="mb-1.5 block">Tech stack</Label>
            <Input id="stack" placeholder="React, FastAPI, Supabase…" {...register("stack")} />
          </div>
          <div>
            <Label htmlFor="goals" className="mb-1.5 block">Current goal</Label>
            <Input id="goals" placeholder="What's the next milestone?" {...register("goals")} />
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

  const handleCreate = async (values: FormValues) => {
    const stackArr = values.stack
      ? values.stack.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    await createProject({
      name: values.name,
      description: values.description,
      stack: stackArr,
      goals: values.goals,
      architecture: "",
      coding_style: "",
      active_tasks: [],
      current_problems: [],
    });
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
          {projects.map(project => (
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
                      {project.stack.slice(0, 4).map(s => (
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
