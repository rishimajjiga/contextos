import { useState } from "react";
import { Link } from "react-router-dom";
import { Brain, Tag, CheckCircle2, Plus, AlertCircle, Loader2, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemories } from "@/hooks/useMemories";
import { usePlan } from "@/hooks/usePlan";
import { useBackendStatus } from "@/hooks/useBackendStatus";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required"),
  tags: z.string().default(""),
});
type FormValues = z.infer<typeof schema>;

export function SaveMemoryPage() {
  const backend = useBackendStatus();
  const { isSaving, error, clearError, createMemory } = useMemories();
  const { plan, refetch: refetchPlan } = usePlan();
  const [saved, setSaved] = useState<{ title: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const memUsed = plan?.usage.memories ?? 0;
  const memLimit = plan?.limits.memories ?? -1;
  const atLimit = memLimit > 0 && memUsed >= memLimit;

  const onSubmit = async (values: FormValues) => {
    clearError();
    const tags = values.tags
      ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    const result = await createMemory({ title: values.title, content: values.content, tags });
    if (result) {
      setSaved({ title: result.title });
      reset();
      refetchPlan(); // update usage count
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Save Memories"
        description="Save important notes, decisions, and snippets. Your AI tools reference these automatically."
      />

      {/* Plan usage */}
      {plan && memLimit > 0 && (
        <div className={`mb-4 rounded-lg border px-4 py-3 ${atLimit ? "border-red-500/30 bg-red-500/10" : "border-border bg-surface-1"}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-foreground">
              {memUsed} / {memLimit} memories used
              <span className="ml-2 text-muted-foreground font-normal">({plan.display_name} plan)</span>
            </span>
            {atLimit && plan.plan === "free" && (
              <Link to="/plans">
                <Button size="sm" variant="default" className="gap-1 h-6 text-xs px-2">
                  <Zap className="h-2.5 w-2.5" /> Upgrade
                </Button>
              </Link>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-3">
            <div
              className={`h-1.5 rounded-full transition-all ${atLimit ? "bg-red-500" : "bg-brand-500"}`}
              style={{ width: `${Math.min((memUsed / memLimit) * 100, 100)}%` }}
            />
          </div>
          {atLimit && (
            <p className="mt-1.5 text-xs text-red-600 font-medium">
              Memory limit reached. Upgrade to save more memories.
            </p>
          )}
        </div>
      )}

      {/* Backend status */}
      {backend.checking && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Connecting to backend…
        </div>
      )}
      {!backend.checking && !backend.ok && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700">Backend not running</p>
            <p className="text-xs text-amber-700/80 mt-0.5">{backend.message}</p>
          </div>
        </div>
      )}

      {/* API error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={clearError} className="underline text-xs ml-3">Dismiss</button>
        </div>
      )}

      {/* Success state */}
      {saved ? (
        <Card className="border-brand-500/30 bg-brand-500/5">
          <CardContent className="pt-6 pb-6 flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15">
              <CheckCircle2 className="h-8 w-8 text-brand-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-base">Memory saved!</p>
              <p className="text-sm text-muted-foreground mt-1">
                "{saved.title}" is now in your second brain.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button size="sm" onClick={() => { setSaved(null); clearError(); }} className="gap-2">
                <Plus className="h-3.5 w-3.5" /> Save another
              </Button>
              <Link to="/memories">
                <Button size="sm" variant="outline">View all memories</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <Label htmlFor="title" className="mb-1.5 block font-medium">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. Auth flow decision, API rate limits, Key insight…"
                  autoFocus
                  {...register("title")}
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="content" className="mb-1.5 block font-medium">
                  Content <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="content"
                  rows={8}
                  placeholder="Paste or type anything — decisions, research, code snippets, context, notes…"
                  className="font-mono text-sm resize-y"
                  {...register("content")}
                />
                {errors.content && (
                  <p className="mt-1 text-xs text-destructive">{errors.content.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="tags" className="mb-1.5 block font-medium">
                  Tags{" "}
                  <span className="text-muted-foreground text-xs font-normal">(comma-separated, optional)</span>
                </Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input id="tags" placeholder="auth, api, research" className="pl-8" {...register("tags")} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border">
                <Link to="/memories" className="text-xs text-muted-foreground hover:text-foreground underline">
                  View saved memories →
                </Link>
                <Button
                  type="submit"
                  disabled={isSaving || !backend.ok || atLimit}
                  className="gap-2 min-w-[140px]"
                >
                  {isSaving
                    ? <LoadingSpinner size="sm" />
                    : atLimit
                    ? "Limit reached"
                    : <><Brain className="h-3.5 w-3.5" /> Save to memories</>}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 rounded-lg border border-border bg-surface-1 p-4">
        <p className="text-xs font-semibold text-foreground mb-2">What to save</p>
        <div className="flex flex-wrap gap-2">
          {["Architecture decisions", "API rate limits", "Useful prompts", "Bug fixes", "Research notes", "Code patterns", "Meeting notes"].map((tip) => (
            <Badge key={tip} variant="secondary" className="text-[10px] cursor-default">{tip}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
