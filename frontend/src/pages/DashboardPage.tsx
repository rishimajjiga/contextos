import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { FolderKanban, FileText, Search, User, ArrowRight, Plus, CheckCircle2, Circle, Chrome, Brain } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useProfile } from "@/hooks/useProfile";
import { useDocuments } from "@/hooks/useDocuments";
import { apiKeyService } from "@/services/apikey.service";
import { PageHeader } from "@/components/common/PageHeader";
import { SkeletonCard } from "@/components/common/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";

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
        <CardContent className="flex items-center justify-between p-5">
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
    { done: hasProfile, label: "Complete your profile", href: "/profile", hint: "Tell ContextOS who you are so your knowledge stays organized.", icon: User },
    { done: hasProject, label: "Create your first project", href: "/projects", hint: "Organize your work into dedicated project workspaces.", icon: FolderKanban },
    { done: hasKey, label: "Generate an API key", href: "/api-keys", hint: "Connect ContextOS to your tools and the browser extension.", icon: FileText },
    { done: hasKey, label: "Install Chrome extension", href: "/api-keys", hint: "Save memories and capture knowledge from anywhere on the web.", icon: Chrome },
  ];
  const allDone = steps.every(s => s.done);
  if (allDone) return null;

  const completed = steps.filter(s => s.done).length;

  return (
    <Card className="mb-6 border-brand-500/20 bg-brand-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Set up your second brain</CardTitle>
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
              : <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            }
            <div className="min-w-0">
              <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {label}
              </p>
              {!done && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
            </div>
            {!done && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useUser();
  const { profile, isLoading: profileLoading } = useProfile();
  const { projects, isLoading: projectsLoading, total: projectTotal } = useProjects();
  const { documents, isLoading: docsLoading, total: docTotal, fetchDocuments } = useDocuments();
  const [hasKey, setHasKey] = useState(false);
  const [keysLoaded, setKeysLoaded] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    apiKeyService.listKeys().then(keys => {
      setHasKey(keys.length > 0);
      setKeysLoaded(true);
    }).catch(() => setKeysLoaded(true));
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${user?.firstName || "there"}`}
        description="Your knowledge, organized."
        action={
          <Link to="/projects">
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" /> New project
            </Button>
          </Link>
        }
      />

      {!profileLoading && keysLoaded && (
        <OnboardingChecklist
          hasProfile={!!profile}
          hasProject={projectTotal > 0}
          hasKey={hasKey}
        />
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-8">
        <StatCard label="Memories" value={docTotal} icon={Brain} href="/documents" />
        <StatCard label="Projects" value={projectTotal} icon={FolderKanban} href="/projects" />
        <StatCard label="Search" value="→" icon={Search} href="/search" />
        <StatCard
          label="Profile"
          value={profile ? "Complete" : "Incomplete"}
          icon={User}
          href="/profile"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
                  <Button variant="outline" size="sm">Create a project</Button>
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {projects.slice(0, 4).map(project => (
                  <li key={project.id}>
                    <Link
                      to="/projects"
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
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {project.stack[0]}
                        </Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent Memories */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent memories</CardTitle>
              <Link to="/documents">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <SkeletonCard />
            ) : documents.length === 0 ? (
              <div className="py-8 text-center">
                <Brain className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">No memories saved yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Capture ideas, notes, and knowledge here</p>
                <Link to="/documents">
                  <Button variant="outline" size="sm">Save your first memory</Button>
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {documents.slice(0, 4).map(doc => (
                  <li key={doc.id}>
                    <Link
                      to="/documents"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent transition-colors"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatRelativeTime(doc.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                        {doc.doc_type}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
