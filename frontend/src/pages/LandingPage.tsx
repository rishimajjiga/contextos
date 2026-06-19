import { Link } from "react-router-dom";
import { ArrowRight, Brain, FolderKanban, FileText, Search, Users, BookOpen, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: FolderKanban,
    title: "Projects",
    desc: "Dedicated workspaces for every project. Store goals, notes, stack details, and progress — all in one place.",
  },
  {
    icon: Brain,
    title: "Memories",
    desc: "Capture ideas, decisions, and insights permanently. Never lose an important thought again.",
  },
  {
    icon: BookOpen,
    title: "Knowledge Base",
    desc: "Organize everything you know. Prompts, notes, research, and references — structured and searchable.",
  },
  {
    icon: FileText,
    title: "Documents",
    desc: "Upload PDFs, notes, and files. Your knowledge stays with your projects, ready when you need it.",
  },
  {
    icon: Search,
    title: "Search",
    desc: "Find any memory, document, prompt, or note instantly. Everything you've saved, always at your fingertips.",
  },
  {
    icon: Users,
    title: "Teams",
    desc: "Share knowledge and collaborate. Give your team a shared second brain with roles and permissions.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Save everything",
    desc: "Add projects, capture memories, upload documents, and save prompts. Highlight text on any page and save it with one click.",
  },
  {
    n: "02",
    title: "Organize your knowledge",
    desc: "Structure your ideas into projects and knowledge bases. Tag, search, and connect information the way your brain works.",
  },
  {
    n: "03",
    title: "Continue anywhere",
    desc: "Pick up where you left off — on any device, in any tool. No re-explaining. No starting over. Just continue.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-0 text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-surface-0/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500">
              <Cpu className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold">ContextOS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Pricing
            </Link>
            <Link to="/sign-in">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/sign-up">
              <Button size="sm">Get started free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[800px] rounded-full bg-brand-500/5 blur-[120px]" />
        </div>

        <div className="relative max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs text-brand-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
            Your second brain for creators and developers
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Remember{" "}
            <span className="gradient-text">everything.</span>
          </h1>

          <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto leading-relaxed sm:text-lg sm:mt-6">
            Store projects, documents, prompts, memories, and knowledge in one place.
            Continue your work anywhere without losing context.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to="/sign-up">
              <Button size="lg" className="gap-2 px-8">
                Start for free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/sign-in">
              <Button variant="outline" size="lg">Sign in</Button>
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span>✓ Free to start</span>
            <span>✓ No credit card required</span>
            <span>✓ Works across all your tools</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-surface-1 py-16 px-4 sm:py-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight mb-4">
            Everything you know. Organized.
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
            One workspace for your projects, memories, documents, and knowledge.
            Built for creators and developers who can't afford to lose context.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-surface-2 p-6 hover:border-brand-500/40 transition-colors"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15">
                  <Icon className="h-5 w-5 text-brand-400" />
                </div>
                <h3 className="font-semibold text-sm mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 sm:py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight mb-4">Never lose context again</h2>
          <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
            Stop starting over. Build once, continue everywhere.
          </p>
          <div className="relative flex flex-col gap-0">
            <div className="absolute left-6 top-8 bottom-8 w-px bg-border hidden md:block" />
            {STEPS.map(({ n, title, desc }, i) => (
              <div key={n} className={`flex gap-6 items-start ${i < STEPS.length - 1 ? "mb-12" : ""}`}>
                <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-500/40 bg-brand-500/10 text-brand-400 font-bold text-sm z-10">
                  {n}
                </div>
                <div className="pt-2">
                  <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="border-t border-border bg-surface-1 py-16 px-4 sm:py-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight mb-4">
            Built for people who create
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
            Whether you're building products, writing content, or managing research — ContextOS keeps your work organized.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {[
              {
                title: "Developers",
                desc: "Store architecture decisions, tech stack notes, code snippets, and project context. Pick up any project without digging through Notion or Slack.",
              },
              {
                title: "Creators",
                desc: "Capture ideas the moment they happen. Save prompts, research, and drafts. Build a personal knowledge base that grows with you.",
              },
              {
                title: "Teams",
                desc: "Share a knowledge base that everyone can contribute to. Onboard faster, collaborate better, and never lose institutional knowledge.",
              },
            ].map(({ title, desc }) => (
              <div key={title} className="rounded-xl border border-border bg-surface-2 p-6 hover:border-brand-500/40 transition-colors">
                <h3 className="font-semibold text-sm mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-16 px-4 sm:py-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight mb-4">Simple pricing</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Start free. Upgrade when you need more.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { name: "Free", price: "₹0", note: "forever", highlight: false },
              { name: "Student", price: "₹199", note: "/ month", highlight: false },
              { name: "Pro", price: "₹499", note: "/ month", highlight: true },
              { name: "Team", price: "₹1,499", note: "/ month", highlight: false },
            ].map(({ name, price, note, highlight }) => (
              <div
                key={name}
                className={`rounded-xl border p-5 text-center ${
                  highlight ? "border-brand-500 bg-brand-500/10" : "border-border bg-surface-2"
                }`}
              >
                {highlight && (
                  <p className="text-[10px] font-semibold text-brand-400 uppercase tracking-wide mb-2">Most popular</p>
                )}
                <p className="text-sm font-semibold text-foreground mb-2">{name}</p>
                <p className="text-2xl font-bold text-foreground">{price}</p>
                <p className="text-xs text-muted-foreground mt-1">{note}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link to="/pricing">
              <Button variant="outline" size="lg" className="gap-2">
                See all plans <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-surface-1 py-16 px-4 sm:py-24 sm:px-6 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Stop starting over.
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Build your second brain today. Free to start, no credit card required.
          </p>
          <Link to="/sign-up">
            <Button size="lg" className="gap-2 px-8">
              Get started free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ContextOS. Remember everything. Continue anywhere.
      </footer>
    </div>
  );
}
