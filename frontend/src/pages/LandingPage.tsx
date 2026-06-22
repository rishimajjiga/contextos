import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ArrowRight, Brain, FolderKanban, Users, Cpu, Zap, Key } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Brain, title: "Identity", desc: "Your role, skills, languages, and preferences — captured once, injected everywhere." },
  { icon: FolderKanban, title: "Projects", desc: "Dedicated workspaces with goals, stack, architecture, and active tasks. Full context in seconds." },
  { icon: Zap, title: "Context Injection", desc: "Your profile and projects auto-inject into ChatGPT, Claude, Gemini, Cursor, and more." },
  { icon: Key, title: "API Keys", desc: "Secure API keys for integrating ContextOS into any tool or workflow." },
  { icon: Cpu, title: "MCP Server", desc: "Native Model Context Protocol support. Drop into Claude Desktop and any MCP-compatible client." },
  { icon: Users, title: "Teams", desc: "Share context across your team. Onboard faster and keep everyone aligned." },
];

const STEPS = [
  { n: "01", title: "Create your profile", desc: "Add your role, skills, preferred stack, and communication style. Takes under two minutes." },
  { n: "02", title: "Add your projects", desc: "Create a project for each thing you're building. Add goals, architecture notes, and active tasks." },
  { n: "03", title: "Use any AI tool", desc: "Install the extension or MCP server. Your full context is injected automatically — no copy-pasting." },
];

const ROTATING = [
  "Save ideas.",
  "Remember conversations.",
  "Organize your knowledge.",
  "Power ChatGPT, Claude and Gemini.",
];

// Shared scroll-in animation
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

function RotatingText() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % ROTATING.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="relative inline-flex h-[1.4em] items-center justify-center overflow-hidden align-bottom">
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ opacity: 0, y: "0.5em" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "-0.5em" }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="gradient-text font-semibold"
        >
          {ROTATING[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// Floating gradient blobs background
function Blobs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -top-32 left-1/4 h-[480px] w-[480px] rounded-full bg-brand-500/20 blur-[130px]"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-20 right-1/4 h-[420px] w-[420px] rounded-full bg-green-500/15 blur-[130px]"
        animate={{ x: [0, -50, 30, 0], y: [0, 30, 50, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[360px] w-[360px] rounded-full bg-green-500/15 blur-[120px]"
        animate={{ x: [0, 40, -40, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// Floating particles
function Particles() {
  const dots = Array.from({ length: 14 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((_, idx) => (
        <motion.span
          key={idx}
          className="absolute h-1 w-1 rounded-full bg-brand-400/50"
          style={{ left: `${(idx * 7 + 5) % 100}%`, top: `${(idx * 13 + 10) % 100}%` }}
          animate={{ y: [0, -24, 0], opacity: [0.1, 0.6, 0.1] }}
          transition={{ duration: 4 + (idx % 5), repeat: Infinity, ease: "easeInOut", delay: idx * 0.3 }}
        />
      ))}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-0 text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-surface-0/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <img src="/logo_mark.png" alt="ContextOS" className="h-7 w-7 rounded-md" />
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
        <Blobs />
        <Particles />

        <motion.div
          className="relative max-w-3xl"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          <motion.div
            variants={fadeUp}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs text-brand-400 backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
            Your second brain for creators and developers
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl font-bold tracking-tight text-foreground sm:text-7xl"
          >
            <span className="gradient-text">ContextOS</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-4 text-xl font-medium text-foreground sm:text-2xl"
          >
            Your Second Brain for Every AI
          </motion.p>

          <motion.p
            variants={fadeUp}
            className="mt-5 text-base text-muted-foreground sm:text-lg"
          >
            <RotatingText />
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link to="/sign-up">
                <Button size="lg" className="gap-2 px-8 shadow-lg shadow-brand-500/20">
                  Start for free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link to="/sign-in">
                <Button variant="outline" size="lg">Sign in</Button>
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground"
          >
            <span>✓ Free to start</span>
            <span>✓ No credit card required</span>
            <span>✓ Works across all your tools</span>
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative border-t border-border bg-surface-1 py-16 px-4 sm:py-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={fadeUp}
            className="text-center text-3xl font-bold tracking-tight mb-4"
          >
            Everything you know. Organized.
          </motion.h2>
          <motion.p
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
            className="text-center text-muted-foreground mb-16 max-w-xl mx-auto"
          >
            Everything you need to give any AI tool instant context about who you are and what you're building.
          </motion.p>

          <motion.div
            className="grid gap-4 sm:grid-cols-2 md:grid-cols-3"
            initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} variants={stagger}
          >
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="rounded-xl border border-border bg-surface-2/60 backdrop-blur-md p-6 transition-colors hover:border-brand-500/50"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15">
                  <Icon className="h-5 w-5 text-brand-400" />
                </div>
                <h3 className="font-semibold text-sm mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 sm:py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <motion.h2
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
            className="text-center text-3xl font-bold tracking-tight mb-4"
          >
            Never lose context again
          </motion.h2>
          <motion.p
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
            className="text-center text-muted-foreground mb-16 max-w-xl mx-auto"
          >
            Stop starting over. Build once, continue everywhere.
          </motion.p>
          <motion.div
            className="relative flex flex-col gap-0"
            initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} variants={stagger}
          >
            <div className="absolute left-6 top-8 bottom-8 w-px bg-border hidden md:block" />
            {STEPS.map(({ n, title, desc }, i) => (
              <motion.div key={n} variants={fadeUp} className={`flex gap-6 items-start ${i < STEPS.length - 1 ? "mb-12" : ""}`}>
                <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-500/40 bg-brand-500/10 text-brand-400 font-bold text-sm z-10">
                  {n}
                </div>
                <div className="pt-2">
                  <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">{desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Use cases */}
      <section className="border-t border-border bg-surface-1 py-16 px-4 sm:py-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
            className="text-center text-3xl font-bold tracking-tight mb-4"
          >
            Built for people who create
          </motion.h2>
          <motion.p
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
            className="text-center text-muted-foreground mb-16 max-w-xl mx-auto"
          >
            Whether you're building products, writing content, or managing research — ContextOS keeps your work organized.
          </motion.p>
          <motion.div
            className="grid gap-4 sm:grid-cols-2 md:grid-cols-3"
            initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} variants={stagger}
          >
            {[
              { title: "Developers", desc: "Store architecture decisions, tech stack notes, code snippets, and project context. Pick up any project without digging through Notion or Slack." },
              { title: "Creators", desc: "Capture ideas the moment they happen. Save prompts, research, and drafts. Build a personal knowledge base that grows with you." },
              { title: "Teams", desc: "Share a knowledge base that everyone can contribute to. Onboard faster, collaborate better, and never lose institutional knowledge." },
            ].map(({ title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="rounded-xl border border-border bg-surface-2/60 backdrop-blur-md p-6 transition-colors hover:border-brand-500/50"
              >
                <h3 className="font-semibold text-sm mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-16 px-4 sm:py-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
            className="text-center text-3xl font-bold tracking-tight mb-4"
          >
            Simple pricing
          </motion.h2>
          <motion.p
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
            className="text-center text-muted-foreground mb-12 max-w-xl mx-auto"
          >
            Start free. Upgrade when you need more.
          </motion.p>
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
            initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} variants={stagger}
          >
            {[
              { name: "Free", price: "₹0", note: "forever", highlight: false },
              { name: "Student", price: "₹199", note: "/ month", highlight: false },
              { name: "Pro", price: "₹499", note: "/ month", highlight: true },
              { name: "Team", price: "₹1,499", note: "/ month", highlight: false },
            ].map(({ name, price, note, highlight }) => (
              <motion.div
                key={name}
                variants={fadeUp}
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`rounded-xl border p-5 text-center backdrop-blur-md ${
                  highlight ? "border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/20" : "border-border bg-surface-2/60"
                }`}
              >
                {highlight && (
                  <p className="text-[10px] font-semibold text-brand-400 uppercase tracking-wide mb-2">Most popular</p>
                )}
                <p className="text-sm font-semibold text-foreground mb-2">{name}</p>
                <p className="text-2xl font-bold text-foreground">{price}</p>
                <p className="text-xs text-muted-foreground mt-1">{note}</p>
              </motion.div>
            ))}
          </motion.div>
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
      <section className="relative overflow-hidden border-t border-border bg-surface-1 py-16 px-4 sm:py-24 sm:px-6 text-center">
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/10 blur-[120px]"
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="relative mx-auto max-w-xl"
          initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
        >
          <h2 className="text-3xl font-bold tracking-tight mb-4">Stop starting over.</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Build your second brain today. Free to start, no credit card required.
          </p>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
            <Link to="/sign-up">
              <Button size="lg" className="gap-2 px-8 shadow-lg shadow-brand-500/20">
                Get started free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} ContextOS. Remember everything. Continue anywhere.</p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
        </div>
      </footer>
    </div>
  );
}
