import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@clerk/clerk-react";
import { FolderKanban, User, ArrowRight, Plus, CheckCircle2, Circle, Chrome, Key, Zap, Brain, CreditCard, CalendarDays, RefreshCcw, Clock } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useProfile } from "@/hooks/useProfile";
import { usePlan } from "@/hooks/usePlan";
import { useMemories } from "@/hooks/useMemories";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { apiKeyService } from "@/services/apikey.service";
import { PageHeader } from "@/components/common/PageHeader";
import { SkeletonCard } from "@/components/common/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


function UsageCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  href: string;
}) {
  return (
    <Link to={href}>
      <div className="group rounded-xl border border-border/60 bg-surface-1/40 hover:border-brand-500/30 hover:bg-surface-1/70 transition-all cursor-pointer p-4 sm:p-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide mb-1.5">{label}</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 group-hover:bg-brand-500/18 transition-colors">
          <Icon className="h-4.5 w-4.5 text-brand-400" />
        </div>
      </div>
    </Link>
  );
}

function OnboardingChecklist({
  hasProfile,
  hasProject,
  hasKey,
}: {
  hasProfile: boolean;
  hasProject: boolean;
  hasKey: boolean;
}) {
  const steps = [
    { done: hasProfile, label: "Complete your profile", href: "/profile", hint: "Tell ContextOS who you are — role, skills, tone, and tech stack.", icon: User },
    { done: hasProject, label: "Create your first project", href: "/projects", hint: "Organize your work into dedicated project workspaces.", icon: FolderKanban },
    { done: hasKey, label: "Generate an API key", href: "/api-keys", hint: "Connect ContextOS to your tools and the browser extension.", icon: Key },
    { done: hasKey, label: "Install Chrome extension", href: "/api-keys", hint: "Inject your context into ChatGPT, Claude, Gemini, Cursor, and more.", icon: Chrome },
  ];
  const allDone = steps.every(s => s.done);
  if (allDone) return null;
  const completed = steps.filter(s => s.done).length;
  return (
    <Card className="mb-6 border-brand-500/20 bg-brand-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Get started with ContextOS</CardTitle>
          <span className="text-xs text-muted-foreground">{completed}/{steps.length} done</span>
        </div>
        <div className="mt-2 h-1 w-full rounded-full bg-surface-3">
          <div
            className="h-1 rounded-full bg-brand-500 transition-all"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {steps.map(({ done, label, href, hint }) => (
          <Link key={href + label} to={href} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-accent transition-colors group">
            {done
              ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              : <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>{label}</p>
              {!done && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
            </div>
            {!done && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

const PLAN_DISPLAY: Record<string, string> = {
  free: "Free",
  student: "Student",
  pro: "Pro",
  team: "Team",
  founder: "Founder",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function SubscriptionCard() {
  const { plan, isLoading } = usePlan();

  // Don't show for free plan or while loading
  if (isLoading || plan.plan === "free") return null;

  const isPaid = plan.plan !== "free" && !plan.is_in_grace_period;
  const planLabel = PLAN_DISPLAY[plan.plan] ?? plan.plan;

  return (
    <Card className="mb-6 border-brand-500/20 bg-brand-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-brand-400" />
            Current Plan
          </CardTitle>
          <Link to="/payment-history">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
              View history <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 mb-3">
          {isPaid ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          ) : (
            <Circle className="h-4 w-4 text-amber-500 shrink-0" />
          )}
          <span className="font-semibold text-foreground">
            {isPaid ? `✅ ${planLabel} Plan Active` : `${planLabel} Plan`}
          </span>
          {plan.is_trialing && (
            <Badge variant="outline" className="text-[10px] text-brand-600 border-brand-400/40">Trial</Badge>
          )}
          {!plan.auto_renew && isPaid && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400/40">Auto-renew OFF</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
          {plan.started_on && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3 w-3 shrink-0" />
              <span>Started: <span className="text-foreground/80">{formatDate(plan.started_on)}</span></span>
            </div>
          )}
          {plan.current_period_end && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              <span>Expires: <span className="text-foreground/80">{formatDate(plan.current_period_end)}</span></span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <RefreshCcw className="h-3 w-3 shrink-0" />
            <span>Auto Renew: <span className={`font-medium ${plan.auto_renew ? "text-green-600" : "text-amber-600"}`}>{plan.auto_renew ? "ON" : "OFF"}</span></span>
          </div>
          {plan.days_remaining !== null && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="font-medium text-brand-500">{plan.days_remaining} days remaining</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useUser();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { profile, isLoading: profileLoading } = useProfile();
  const { plan } = usePlan();
  const { memories, isLoading: memoriesLoading, fetchMemories } = useMemories();
  const [hasKey, setHasKey] = useState(false);
  const [keysLoaded, setKeysLoaded] = useState(false);

  const projectTotal = projects.length;

  useEffect(() => {
    apiKeyService.listKeys().then((keys) => {
      setHasKey(keys.length > 0);
      setKeysLoaded(true);
    }).catch(() => setKeysLoaded(true));
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const firstName = user?.firstName || user?.username || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const memLimit = plan.limits.memories;
  const projLimit = plan.limits.projects;
  const injectLimit = plan.limits.daily_inject;

  const memValue   = `${plan.usage.memories}/${memLimit >= 10000 ? "∞" : memLimit}`;
  const projValue  = `${plan.usage.projects}/${projLimit >= 1000 ? "∞" : projLimit}`;
  const injectValue = (injectLimit < 0 || injectLimit >= 10000) ? "∞/day" : `${injectLimit}/day`;

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${firstName} 👋`}
        description="Welcome back to ContextOS."
      />

      {plan.plan === "founder" && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/40 bg-brand-500/10 px-3.5 py-1.5 text-xs font-semibold text-brand-700">
          <Zap className="h-3.5 w-3.5" />
          Founder · Lifetime Access
        </div>
      )}

      {!profileLoading && keysLoaded && (
        <OnboardingChecklist
          hasProfile={!!profile}
          hasProject={projectTotal > 0}
          hasKey={hasKey}
        />
      )}

      {/* Subscription plan card — only for paid plans, only when active */}
      <SubscriptionCard />

      {/* Usage metrics */}
      <motion.div
        className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 mb-6 sm:mb-8"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      >
        {[
          { label: "Memories", value: memValue,    icon: Brain,         href: "/memories" },
          { label: "Projects", value: projValue,   icon: FolderKanban,  href: "/projects" },
          { label: "Auto-inject", value: injectValue, icon: Zap,        href: "/pricing" },
        ].map((m) => (
          <motion.div
            key={m.label}
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
          >
            <UsageCard label={m.label} value={m.value} icon={m.icon} href={m.href} />
          </motion.div>
        ))}
      </motion.div>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent projects</CardTitle>
            <Link to="/projects">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <SkeletonCard />
          ) : projects.length === 0 ? (
            <div className="py-8 text-center">
              <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No projects yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Create a workspace for your first project</p>
              <Link to="/projects">
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-3.5 w-3.5" /> Create a project
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="space-y-1">
              {projects.slice(0, 5).map(project => (
                <li key={project.id}>
                  <Link
                    to={`/projects/${project.id}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent transition-colors"
                  >
                    <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                      {project.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.description}</p>
                      )}
                    </div>
                    {project.stack?.length > 0 && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{project.stack[0]}</Badge>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recent Memories */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent memories</CardTitle>
            <Link to="/memories">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                View all memories <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {memoriesLoading ? (
            <SkeletonCard />
          ) : memories.length === 0 ? (
            <div className="py-8 text-center">
              <Brain className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No memories yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Save your first note, decision, or snippet</p>
              <Link to="/memories/new">
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-3.5 w-3.5" /> Save a memory
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="space-y-1">
              {memories.slice(0, 5).map((mem) => (
                <li key={mem.id}>
                  <Link
                    to="/memories"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent transition-colors"
                  >
                    <Brain className="h-4 w-4 text-brand-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{mem.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{truncate(mem.content, 80)}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatRelativeTime(mem.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
