import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { FolderKanban, User, ArrowRight, Plus, CheckCircle2, Circle, Chrome, Key, Zap } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useProfile } from "@/hooks/useProfile";
import { usePlan } from "@/hooks/usePlan";
import { apiKeyService } from "@/services/apikey.service";
import { PageHeader } from "@/components/common/PageHeader";
import { SkeletonCard } from "@/components/common/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  href: string;
}) {
  return (
    <Link to={href}>
      <Card className="hover:border-brand-500/40 transition-colors cursor-pointer">
        <CardContent className="flex items-center justify-between p-4 sm:p-5">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15">
            <Icon className="h-5 w-5 text-brand-400" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function PlanUsageCard({ plan }: { plan: NonNullable<ReturnType<typeof usePlan>["plan"]> }) {
  const isFree = plan.plan === "free";

  return (
    <Card className={`mb-6 ${isFree ? "border-brand-500/20 bg-brand-500/5" : "border-border"}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={isFree ? "secondary" : "default"} className="text-xs">
              {plan.display_name} plan
            </Badge>
            {plan.is_trialing && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Trialing</Badge>
            )}
          </div>
          {isFree && (
            <Link to="/pricing">
              <Button size="sm" variant="default" className="gap-1.5 h-7 text-xs">
                <Zap className="h-3 w-3" /> Upgrade
              </Button>
            </Link>
          )}
        </div>
        {isFree && (
          <p className="mt-2 text-xs text-muted-foreground">
            Upgrade to Pro for unlimited projects, memories, and API keys.
          </p>
        )}
      </CardContent>
    </Card>
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

export function DashboardPage() {
  const { user } = useUser();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { profile, isLoading: profileLoading } = useProfile();
  const { plan } = usePlan();
  const [hasKey, setHasKey] = useState(false);
  const [keysLoaded, setKeysLoaded] = useState(false);

  const projectTotal = projects.length;

  useEffect(() => {
    apiKeyService.listKeys().then((keys) => {
      setHasKey(keys.length > 0);
      setKeysLoaded(true);
    }).catch(() => setKeysLoaded(true));
  }, []);

  const firstName = user?.firstName || user?.username || "there";

  return (
    <div>
      <PageHeader
        title={`Hey, ${firstName} 👋`}
        description="Here's what's happening in your workspace."
      />

      {/* Plan usage bar */}
      <PlanUsageCard plan={plan} />

      {!profileLoading && keysLoaded && (
        <OnboardingChecklist
          hasProfile={!!profile}
          hasProject={projectTotal > 0}
          hasKey={hasKey}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label="Projects" value={projectTotal} icon={FolderKanban} href="/projects" />
        <StatCard
          label="Profile"
          value={profile ? "Complete" : "Incomplete"}
          icon={User}
          href="/profile"
        />
        <StatCard
          label="API Keys"
          value={hasKey ? "Active" : "None"}
          icon={Key}
          href="/api-keys"
        />
      </div>

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
    </div>
  );
}
