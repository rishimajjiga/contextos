import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ArrowRight, Brain, FolderKanban, Users, Cpu, Zap, Key, MessageSquare, FileText, Globe, Code2, Chrome, Github, Youtube, Newspaper } from "lucide-react";
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
  "Save highlighted text from any website.",
  "Remember conversations.",
  "Organize your knowledge.",
  "Power ChatGPT, Claude, Gemini and Cursor.",
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

// ── Hero "second brain" illustration ──────────────────────────────────────────
// A central brain connected to floating note cards and AI-tool bubbles. Purely
// decorative; all motion is CSS/Framer based and self-contained.

function HeroCard({
  style, delay, icon: Icon, title, tint,
}: {
  style: React.CSSProperties;
  delay: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tint: string;
}) {
  return (
    <motion.div
      className="absolute w-[40%] max-w-[180px] rounded-2xl border border-border bg-card/95 p-3 shadow-card backdrop-blur-sm"
      style={style}
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[11px] font-semibold text-foreground">{title}</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-1.5 w-full rounded-full bg-brand-500/15" />
        <div className="h-1.5 w-[85%] rounded-full bg-brand-500/12" />
        <div className="h-1.5 w-[60%] rounded-full bg-brand-500/10" />
      </div>
    </motion.div>
  );
}

function LogoBubble({
  style, delay, size = 56, children, ring = "border-border",
}: {
  style: React.CSSProperties;
  delay: number;
  size?: number;
  children: React.ReactNode;
  ring?: string;
}) {
  return (
    <motion.div
      className={`absolute flex items-center justify-center rounded-full border ${ring} bg-card shadow-card`}
      style={{ width: size, height: size, ...style }}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 4.5 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {children}
    </motion.div>
  );
}

function HeroIllustration() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[540px]">
      {/* Connecting lines (data flowing into the brain) */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {[
          "M50,50 C40,40 30,34 24,28",
          "M50,50 C62,42 70,34 76,28",
          "M50,50 C58,38 60,28 60,20",
          "M50,50 C36,52 26,56 18,58",
          "M50,50 C40,60 32,66 26,72",
          "M50,50 C49,64 48,74 47,82",
          "M50,50 C62,58 70,62 76,64",
          "M50,50 C66,50 78,50 88,50",
        ].map((d, i) => (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={0.4}
            strokeLinecap="round"
            strokeDasharray="3 4"
            initial={{ opacity: 0.25 }}
            animate={{ strokeDashoffset: [14, 0], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3 + (i % 3), repeat: Infinity, ease: "linear", delay: i * 0.25 }}
          />
        ))}
      </svg>

      {/* Glow podium */}
      <div className="absolute bottom-[4%] left-1/2 h-[14%] w-[58%] -translate-x-1/2">
        <div className="absolute inset-0 rounded-[50%] bg-brand-500/25 blur-2xl" />
        <div className="absolute inset-x-[8%] bottom-[28%] h-1/2 rounded-[50%] border border-brand-500/40" />
        <div className="absolute inset-x-[20%] bottom-[36%] h-1/3 rounded-[50%] border border-brand-500/30" />
      </div>

      {/* Central brain */}
      <motion.div
        className="absolute left-1/2 top-1/2 w-[44%] -translate-x-1/2 -translate-y-1/2"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-[0_18px_30px_rgba(45,90,35,0.25)]">
          <defs>
            <radialGradient id="brainGrad" cx="42%" cy="34%" r="72%">
              <stop offset="0%" stopColor="#9ed47a" />
              <stop offset="48%" stopColor="#5fa83f" />
              <stop offset="100%" stopColor="#2f6b34" />
            </radialGradient>
          </defs>
          {/* lumpy crown */}
          <g fill="url(#brainGrad)">
            <circle cx="66" cy="74" r="26" />
            <circle cx="100" cy="62" r="30" />
            <circle cx="134" cy="74" r="26" />
            <circle cx="54" cy="104" r="24" />
            <circle cx="146" cy="104" r="24" />
            <ellipse cx="100" cy="116" rx="62" ry="46" />
            <circle cx="100" cy="150" r="18" />
          </g>
          {/* gyri folds */}
          <g fill="none" stroke="#2f6b34" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round">
            <path d="M100,52 C100,80 100,120 100,156" />
            <path d="M78,70 C70,86 74,104 64,118" />
            <path d="M122,70 C130,86 126,104 136,118" />
            <path d="M62,96 C76,98 84,108 80,124" />
            <path d="M138,96 C124,98 116,108 120,124" />
            <path d="M88,132 C96,138 104,138 112,132" />
          </g>
          {/* highlight */}
          <ellipse cx="82" cy="72" rx="20" ry="12" fill="#ffffff" opacity="0.18" />
        </svg>

        {/* Center "C" chip */}
        <div className="absolute left-1/2 top-1/2 flex h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-border bg-card shadow-glow">
          <span className="font-display text-2xl font-bold text-brand-600">C</span>
        </div>
      </motion.div>

      {/* Floating cards */}
      <HeroCard style={{ top: "10%", left: "0%" }}   delay={0.0} icon={MessageSquare} title="AI Answers"   tint="bg-brand-500/15 text-brand-600" />
      <HeroCard style={{ top: "12%", right: "0%" }}  delay={0.6} icon={FileText}      title="Your Notes"   tint="bg-emerald-500/15 text-emerald-700" />
      <HeroCard style={{ bottom: "16%", left: "0%" }} delay={1.0} icon={Code2}        title="Code Snippets" tint="bg-brand-500/15 text-brand-700" />
      <HeroCard style={{ bottom: "10%", right: "1%" }} delay={1.4} icon={Globe}       title="Web Insights" tint="bg-emerald-500/15 text-emerald-700" />

      {/* AI-tool logo bubbles */}
      <LogoBubble style={{ top: "2%", left: "55%" }} delay={0.3} size={58} ring="border-brand-500/30">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#10A37F"><path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6 6 0 0 0 4.98 4.18a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .75 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.6 22a6.05 6.05 0 0 0 5.77-4.2 5.98 5.98 0 0 0 4-2.9 6.05 6.05 0 0 0-.74-7.08Zm-9 12.6a4.48 4.48 0 0 1-2.88-1.04l4.95-2.86a.8.8 0 0 0 .4-.7v-6.99l2.1 1.21a.07.07 0 0 1 .04.06v5.78a4.5 4.5 0 0 1-4.6 4.54ZM3.6 17.79a4.48 4.48 0 0 1-.54-3.01l4.95 2.86a.8.8 0 0 0 .8 0l6.04-3.49v2.42a.07.07 0 0 1-.03.06l-5 2.9a4.5 4.5 0 0 1-6.22-1.74ZM2.34 8.05A4.5 4.5 0 0 1 4.7 6.07v5.88a.8.8 0 0 0 .4.7l6.03 3.48-2.1 1.21a.07.07 0 0 1-.07 0l-5-2.9a4.5 4.5 0 0 1-1.62-6.4Zm17.18 4-6.04-3.5 2.1-1.2a.07.07 0 0 1 .07 0l5 2.88a4.5 4.5 0 0 1-.68 8.12v-5.88a.8.8 0 0 0-.45-.42Zm2.08-3.14-4.95-2.86a.8.8 0 0 0-.8 0L9.8 9.54V7.12a.07.07 0 0 1 .03-.06l5-2.88a4.5 4.5 0 0 1 6.68 4.66Zm-13.1 4.31-2.1-1.21a.07.07 0 0 1-.04-.06V6.47a4.5 4.5 0 0 1 7.38-3.45l-4.95 2.86a.8.8 0 0 0-.4.7l-.01 6.96Zm1.14-2.46L12 9.21l2.36 1.36v2.72L12 14.65l-2.36-1.36V10.6Z"/></svg>
      </LogoBubble>

      <LogoBubble style={{ top: "12%", right: "16%" }} delay={1.1} size={34} ring="border-border">
        <span className="text-base">⚙️</span>
      </LogoBubble>

      <LogoBubble style={{ top: "50%", left: "2%" }} delay={0.8} size={56} ring="border-border">
        <svg viewBox="0 0 24 24" className="h-7 w-7"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
      </LogoBubble>

      <LogoBubble style={{ bottom: "8%", left: "44%" }} delay={1.6} size={64} ring="border-border">
        <span className="font-display text-[11px] font-bold tracking-tight text-foreground">Claude</span>
      </LogoBubble>

      <LogoBubble style={{ top: "48%", right: "0%" }} delay={0.5} size={52} ring="border-brand-500/30">
        <span className="text-sm font-bold tracking-wide text-[#8a6d52]">AI</span>
      </LogoBubble>
    </div>
  );
}

function HeroVisual() {
  // Prefers the real hero image at /hero-brain.png (drop a PNG with that name
  // into frontend/public/). Falls back to the built-in SVG illustration so the
  // page never shows a broken image.
  const [imgOk, setImgOk] = useState(true);
  if (!imgOk) return <HeroIllustration />;
  return (
    <picture>
      {/* WebP (26KB) for modern browsers; PNG fallback keeps 100% compatibility.
          width/height set the intrinsic aspect ratio to avoid layout shift. */}
      <source srcSet="/hero-brain.webp" type="image/webp" />
      <motion.img
        src="/hero-brain.png"
        alt="ContextOS — your second brain connected to every AI tool"
        onError={() => setImgOk(false)}
        width={864}
        height={713}
        decoding="async"
        className="mx-auto w-full max-w-[560px] drop-shadow-[0_24px_50px_rgba(45,90,35,0.18)]"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </picture>
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
      <section className="relative flex min-h-screen items-center px-6 pt-24 pb-16 overflow-hidden">
        <Blobs />
        <Particles />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-8">
          {/* Left — copy (unchanged content & animations) */}
          <motion.div
            className="relative mx-auto max-w-2xl text-center lg:mx-0 lg:text-left"
            initial="hidden"
            animate="show"
            variants={stagger}
          >
            <motion.div
              variants={fadeUp}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs text-brand-600 backdrop-blur-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
              Your second brain for the entire browser
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
              Your Second Brain for the Entire Browser
            </motion.p>

            <motion.p
              variants={fadeUp}
              className="mt-5 text-base text-muted-foreground sm:text-lg"
            >
              <RotatingText />
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
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
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <a
                  href="https://chromewebstore.google.com/detail/lofknjnllpgmbhnipkcblgmeijmeobbl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="lg" className="gap-2">
                    <Chrome className="h-4 w-4" />
                    Add Chrome Extension
                  </Button>
                </a>
              </motion.div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground lg:justify-start"
            >
              <span>✓ Free to start</span>
              <span>✓ Works on any website</span>
              <span>✓ ChatGPT, Claude, Gemini, Cursor &amp; more</span>
            </motion.div>
          </motion.div>

          {/* Right — second-brain illustration */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          >
            <HeroVisual />
          </motion.div>
        </div>
      </section>

      {/* Works Everywhere */}
      <section className="relative border-t border-border bg-surface-0 py-16 px-4 sm:py-24 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <motion.h2
            initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={fadeUp}
            className="text-3xl font-bold tracking-tight mb-4"
          >
            Works Everywhere
          </motion.h2>
          <motion.p
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
            className="text-muted-foreground max-w-2xl mx-auto mb-10 text-base sm:text-lg"
          >
            Highlight any text on the web, save it to ContextOS, and access it whenever you need it —
            from documentation and GitHub to articles, videos, and your favorite AI tools.
          </motion.p>

          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-2 gap-3 sm:grid-cols-5"
          >
            {[
              { icon: Chrome,        label: "Chrome" },
              { icon: FileText,      label: "Documentation" },
              { icon: Github,        label: "GitHub" },
              { icon: Code2,         label: "Stack Overflow" },
              { icon: Youtube,       label: "YouTube" },
              { icon: Newspaper,     label: "News sites" },
              { icon: MessageSquare, label: "ChatGPT" },
              { icon: Brain,         label: "Claude" },
              { icon: Zap,           label: "Gemini" },
              { icon: Cpu,           label: "Cursor" },
            ].map(({ icon: Icon, label }) => (
              <motion.div
                key={label}
                variants={fadeUp}
                className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-surface-1/50 px-3 py-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10">
                  <Icon className="h-5 w-5 text-brand-400" />
                </div>
                <span className="text-xs font-medium text-foreground/80">{label}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
          >
            <span>✓ Works across the entire browser</span>
            <span>✓ Save highlighted text from any webpage</span>
            <span>✓ Personal &amp; Team memories</span>
            <span>✓ Sync across devices</span>
            <span>✓ Secure cloud storage</span>
          </motion.div>
        </div>
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
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link to="/sign-up">
                <Button size="lg" className="gap-2 px-8 shadow-lg shadow-brand-500/20">
                  Get started free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <a
                href="https://chromewebstore.google.com/detail/lofknjnllpgmbhnipkcblgmeijmeobbl"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="lg" className="gap-2">
                  <Chrome className="h-4 w-4" />
                  Add Chrome Extension
                </Button>
              </a>
            </motion.div>
          </div>
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
