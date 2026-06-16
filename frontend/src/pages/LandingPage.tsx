import { Link } from "react-router-dom";
import { ArrowRight, Cpu, Brain, Layers, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOOLS = ["ChatGPT", "Claude", "Gemini", "Cursor", "VS Code", "Copilot"];

const FEATURES = [
  {
    icon: Brain,
    title: "Define once, use everywhere",
    desc: "Set your identity, skills, and preferences once. Every AI tool reads from the same source of truth.",
  },
  {
    icon: Layers,
    title: "Project-aware context",
    desc: "Store tech stack, architecture notes, goals, and active problems per project. AI tools get instant context.",
  },
  {
    icon: Zap,
    title: "Semantic knowledge search",
    desc: "Upload notes, PDFs, and code snippets. Find anything instantly with vector similarity search.",
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
          <div className="flex items-center gap-3">
            <Link to="/sign-in">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/sign-up">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[800px] rounded-full bg-brand-500/5 blur-[120px]" />
        </div>

        <div className="relative max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs text-brand-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
            The memory layer for AI tools
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Stop re-explaining yourself{" "}
            <span className="gradient-text">to every AI.</span>
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            ContextOS is a shared memory layer. Define your identity, projects, and knowledge once.
            Every AI tool reads it automatically.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/sign-up">
              <Button size="lg" className="gap-2 px-8">
                Start for free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/sign-in">
              <Button variant="outline" size="lg">Sign in</Button>
            </Link>
          </div>

          {/* Tool badges */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground mr-2">Works with</span>
            {TOOLS.map(tool => (
              <span
                key={tool}
                className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted-foreground"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-surface-1 py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight mb-4">
            Everything in one place
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
            Three layers of context that make every AI interaction smarter from the first message.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
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
      <section className="py-24 px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight mb-4">How it works</h2>
          <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
            Three steps to an AI that actually knows you.
          </p>
          <div className="relative flex flex-col gap-0">
            {/* Vertical line */}
            <div className="absolute left-6 top-8 bottom-8 w-px bg-border hidden md:block" />
            {[
              {
                n: "01",
                title: "Set up your profile",
                desc: "Add your name, role, skills, and preferences. This becomes the shared identity every AI reads before responding.",
              },
              {
                n: "02",
                title: "Save memories from any AI",
                desc: "Use the Chrome extension to capture useful context from ChatGPT, Claude, Gemini, or any AI chat — one click, saved instantly.",
              },
              {
                n: "03",
                title: "AI auto-injects your context",
                desc: "Every time you open a new chat, ContextOS automatically prepends your relevant memory. No more re-explaining your stack, preferences, or project.",
              },
            ].map(({ n, title, desc }, i) => (
              <div key={n} className={`flex gap-6 items-start ${i < 2 ? "mb-12" : ""}`}>
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

      {/* Pricing teaser */}
      <section className="border-t border-border bg-surface-1 py-24 px-6">
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
                  highlight
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-border bg-surface-2"
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
                See all plans & features <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Ready to give AI tools a memory?
          </h2>
          <p className="text-muted-foreground mb-8">
            Free to start. No credit card required.
          </p>
          <Link to="/sign-up">
            <Button size="lg" className="gap-2 px-8">
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ContextOS. Built for AI-first developers.
      </footer>
    </div>
  );
}
