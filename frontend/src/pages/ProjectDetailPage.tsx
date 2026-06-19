import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft, Trash2, Save, Plus, X, CheckCircle2, AlertCircle,
  FolderOpen, GitCommit,
} from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useThreadEvents } from "@/hooks/useThreadEvents";
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
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { LimitError } from "@/services/api";
import { UpgradeModal } from "@/components/common/UpgradeModal";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  goals: z.string().default(""),
  architecture: z.string().default(""),
  coding_style: z.string().default(""),
});

type FormValues = z.infer<typeof schema>;

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

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedProject, isLoading, fetchProject, editProject, deleteProject } = useProjects();
  const { events: threadEvents, isLoading: threadLoading, fetchThread } = useThreadEvents(id);
  const [showDelete, setShowDelete] = useState(false);
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
    if (id) fetchThread();
  }, [id, fetchThread]);

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
    try {
      await editProject(id, { ...values, stack, active_tasks: activeTasks, current_problems: currentProblems });
    } catch (err) {
      if (err instanceof LimitError) setLimitError(err);
      else throw err;
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteProject(id);
    navigate("/projects");
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
        <div className="flex gap-2 flex-wrap">
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
          <TabsList className="mb-6 w-full overflow-x-auto flex-nowrap justify-start sm:justify-start gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="stack">Tech stack</TabsTrigger>
            <TabsTrigger value="tasks">Tasks & problems</TabsTrigger>
            <TabsTrigger value="thread" onClick={() => fetchThread()}>
              Thread
              {threadEvents.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{threadEvents.length}</Badge>
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
                <div className="flex gap-2 flex-wrap">
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

          {/* ── Context Thread ────────────────────────────────────────────── */}
          <TabsContent value="thread">
            {threadLoading ? (
              <div className="flex h-32 items-center justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : threadEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
                <GitCommit className="h-8 w-8 opacity-30" />
                <p className="text-sm">No events yet</p>
                <p className="text-xs opacity-60">Events are logged automatically as you update the project.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {threadEvents.map((ev) => {
                  const Icon =
                    ev.event_type === "project_updated" ? FolderOpen
                    : GitCommit;
                  return (
                    <div key={ev.id} className="flex gap-3 items-start">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{ev.title}</p>
                        {ev.detail && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ev.detail}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatRelativeTime(ev.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </form>

      {/* Delete confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">
            This will permanently delete <strong>{selectedProject.name}</strong>. This cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan limit upgrade modal */}
      {limitError && (
        <UpgradeModal
          onClose={() => setLimitError(null)}
          resource="projects"
          limit={limitError.limit}
          plan={limitError.plan}
        />
      )}
    </div>
  );
}
