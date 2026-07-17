// ── LandingPage · 2026-07 premium redesign ───────────────────────────────────
// UI/UX only. Every route, link, feature, and price is identical to before.
// Inspiration: Wispr Flow / Linear / Notion / Vercel — clean near-white canvas,
// one green accent, Inter typography, soft shadows, generous whitespace.

import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ArrowRight, Brain, FolderKanban, Users, Cpu, Zap, Key, MessageSquare,
  FileText, Globe, Code2, Chrome, Github, Search, MousePointerClick,
  Sparkles, FolderOpen, RefreshCw, ChevronDown, CloudOff, Shuffle, Tag,
  Monitor, Smartphone, Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/SiteHeader";

const EXTENSION_URL = "https://chromewebstore.google.com/detail/lofknjnllpgmbhnipkcblgmeijmeobbl";

// ── Content (features unchanged — same six capabilities, same names) ─────────
const FEATURES = [
  { icon: Brain, title: "Identity", desc: "Your role, skills, languages, and preferences — captured once, injected everywhere." },
  { icon: FolderKanban, title: "Projects", desc: "Dedicated workspaces with goals, stack, architecture, and active tasks. Full context in seconds." },
  { icon: Zap, title: "Context Injection", desc: "Your profile and projects auto-inject into ChatGPT, Claude, Gemini, Cursor, and more." },
  { icon: Key, title: "API Keys", desc: "Secure API keys for integrating ContextOS into any tool or workflow." },
  { icon: Cpu, title: "MCP Server", desc: "Native Model Context Protocol support. Drop into Claude Desktop and any MCP-compatible client." },
  { icon: Users, title: "Teams", desc: "Share context across your team. Onboard faster and keep everyone aligned." },
];

const PROBLEMS = [
  { icon: Lightbulb, title: "Good ideas get lost", desc: "You find something valuable — an idea, a link, a paragraph — and by tomorrow it's gone." },
  { icon: Shuffle, title: "Notes end up everywhere", desc: "Screenshots, chat threads, bookmarks, sticky notes — your important stuff is scattered across ten places." },
  { icon: CloudOff, title: "You can never find it again", desc: "You know you saved it somewhere. You just can't remember where. So you search, give up, and start over." },
];

const SOLUTION_STEPS = [
  { icon: MousePointerClick, title: "Save", desc: "Select anything on any website. Right-click. Save to ContextOS. That's it." },
  { icon: FolderKanban, title: "Organize", desc: "Everything is stored automatically in one searchable place — projects, folders, tags, and collections." },
  { icon: RefreshCw, title: "Reuse", desc: "Find anything in seconds and use it anywhere — websites, AI tools, desktop, and mobile." },
];

const HOW_STEPS = [
  { n: "01", icon: Globe, title: "Browse", desc: "Read, research, and work anywhere on the web — like you already do." },
  { n: "02", icon: MousePointerClick, title: "Save Context", desc: "Spot something worth keeping? Select it, right-click, save." },
  { n: "03", icon: RefreshCw, title: "Everything Synced", desc: "Your saves follow you — every browser, desktop, and mobile." },
  { n: "04", icon: Search, title: "Search Instantly", desc: "Type a few words and find exactly what you saved, in seconds." },
];

const BENEFITS = [
  { emoji: "🧠", title: "Never lose ideas", desc: "Anything worth keeping, kept for good." },
  { emoji: "🔍", title: "Find anything instantly", desc: "A quick search beats digging through tabs." },
  { emoji: "📚", title: "Everything in one place", desc: "One tidy library instead of ten scattered apps." },
  { emoji: "🌍", title: "Works everywhere", desc: "Every browser, desktop, and mobile." },
  { emoji: "⚡", title: "Supercharge your AI", desc: "Reuse your saves in ChatGPT, Claude, and more." },
];

const WORKS_WITH = [
  { icon: Chrome, label: "Chrome" },
  { icon: Globe, label: "Edge" },
  { icon: Globe, label: "Brave" },
  { icon: Globe, label: "Opera" },
  { icon: Monitor, label: "Desktop" },
  { icon: Smartphone, label: "Mobile" },
  { icon: MessageSquare, label: "ChatGPT" },
  { icon: Brain, label: "Claude" },
  { icon: Sparkles, label: "Gemini" },
  { icon: Cpu, label: "Cursor" },
  { icon: Search, label: "Perplexity" },
  { icon: FileText, label: "Google Docs" },
  { icon: Github, label: "GitHub" },
  { icon: Code2, label: "Stack Overflow" },
];

const PLANS = [
  { name: "Free", price: "₹0", note: "forever", highlight: false, tagline: "Start your second brain" },
  { name: "Student", price: "₹199", note: "/ month", highlight: false, tagline: "For studying & research" },
  { name: "Pro", price: "₹499", note: "/ month", highlight: true, tagline: "For daily AI power users" },
  { name: "Team", price: "₹1,499", note: "/ month", highlight: false, tagline: "Shared context for teams" },
];

const FAQS = [
  { q: "What is ContextOS?", a: "ContextOS is your personal second brain. Whenever you find something important on any website, select it, right-click, and save it. Everything goes into one searchable place you can reach from any browser, desktop, or mobile." },
  { q: "What can I save?", a: "Anything you can select: ideas, notes, links, articles, research, code snippets, AI chats, prompts, email templates, usernames, project details — any text on any website." },
  { q: "How do I save something?", a: "Select the text, right-click, and choose Save to ContextOS. You can also use the floating button on any page. Either way, it's saved and searchable in seconds." },
  { q: "Where can I use my saved information?", a: "Everywhere. Your saves sync across Chrome, Edge, Brave, and Opera, plus desktop and mobile. They also plug into AI tools like ChatGPT, Claude, Gemini, and Cursor whenever you want them there." },
  { q: "Is ContextOS free?", a: "Yes — the Free plan is free forever. Upgrade to Student, Pro, or Team when you need more." },
  { q: "Can I use it with my team?", a: "Yes. The Team plan gives everyone one shared place for important information, so knowledge stays with the team and new members get up to speed faster." },
];

// ── Motion presets ───────────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const inView = { once: true, margin: "-70px" } as const;

// ── Small building blocks ────────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="mx-auto mb-14 max-w-2xl text-center">
      {eyebrow && (
        <motion.p variants={fadeUp} className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#2F9E44]">
          {eyebrow}
        </motion.p>
      )}
      <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight text-[#1E293B] sm:text-[42px] sm:leading-[1.15]">
        {title}
      </motion.h2>
      {sub && (
        <motion.p variants={fadeUp} className="mt-4 text-lg leading-relaxed text-[#64748B]">
          {sub}
        </motion.p>
      )}
    </motion.div>
  );
}

// ── Hero "second brain" illustration (unchanged visuals, trimmed shell) ──────
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
      className="absolute w-[40%] max-w-[180px] rounded-2xl border border-[#E5E7EB] bg-white/95 p-3 shadow-card backdrop-blur-sm"
      style={style}
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[11px] font-semibold text-[#1E293B]">{title}</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-1.5 w-full rounded-full bg-[#2F9E44]/15" />
        <div className="h-1.5 w-[85%] rounded-full bg-[#2F9E44]/10" />
        <div className="h-1.5 w-[60%] rounded-full bg-[#2F9E44]/10" />
      </div>
    </motion.div>
  );
}

function LogoBubble({
  style, delay, size = 56, children,
}: {
  style: React.CSSProperties;
  delay: number;
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className="absolute flex items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-card"
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
            stroke="#2F9E44"
            strokeWidth={0.4}
            strokeLinecap="round"
            strokeDasharray="3 4"
            initial={{ opacity: 0.25 }}
            animate={{ strokeDashoffset: [14, 0], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3 + (i % 3), repeat: Infinity, ease: "linear", delay: i * 0.25 }}
          />
        ))}
      </svg>

      <div className="absolute bottom-[4%] left-1/2 h-[14%] w-[58%] -translate-x-1/2">
        <div className="absolute inset-0 rounded-[50%] bg-[#37B24D]/20 blur-2xl" />
        <div className="absolute inset-x-[8%] bottom-[28%] h-1/2 rounded-[50%] border border-[#37B24D]/35" />
        <div className="absolute inset-x-[20%] bottom-[36%] h-1/3 rounded-[50%] border border-[#37B24D]/25" />
      </div>

      <motion.div
        className="absolute left-1/2 top-1/2 w-[44%] -translate-x-1/2 -translate-y-1/2"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-[0_18px_30px_rgba(47,158,68,0.22)]">
          <defs>
            <radialGradient id="brainGrad" cx="42%" cy="34%" r="72%">
              <stop offset="0%" stopColor="#69DB7C" />
              <stop offset="48%" stopColor="#37B24D" />
              <stop offset="100%" stopColor="#2F9E44" />
            </radialGradient>
          </defs>
          <g fill="url(#brainGrad)">
            <circle cx="66" cy="74" r="26" />
            <circle cx="100" cy="62" r="30" />
            <circle cx="134" cy="74" r="26" />
            <circle cx="54" cy="104" r="24" />
            <circle cx="146" cy="104" r="24" />
            <ellipse cx="100" cy="116" rx="62" ry="46" />
            <circle cx="100" cy="150" r="18" />
          </g>
          <g fill="none" stroke="#1E7A34" strokeOpacity="0.5" strokeWidth="2.4" strokeLinecap="round">
            <path d="M100,52 C100,80 100,120 100,156" />
            <path d="M78,70 C70,86 74,104 64,118" />
            <path d="M122,70 C130,86 126,104 136,118" />
            <path d="M62,96 C76,98 84,108 80,124" />
            <path d="M138,96 C124,98 116,108 120,124" />
            <path d="M88,132 C96,138 104,138 112,132" />
          </g>
          <ellipse cx="82" cy="72" rx="20" ry="12" fill="#ffffff" opacity="0.18" />
        </svg>

        <div className="absolute left-1/2 top-1/2 flex h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white shadow-glow">
          <span className="text-2xl font-bold text-[#2F9E44]">C</span>
        </div>
      </motion.div>

      <HeroCard style={{ top: "10%", left: "0%" }} delay={0.0} icon={MessageSquare} title="AI Answers" tint="bg-[#2F9E44]/12 text-[#2F9E44]" />
      <HeroCard style={{ top: "12%", right: "0%" }} delay={0.6} icon={FileText} title="Your Notes" tint="bg-[#37B24D]/12 text-[#2F9E44]" />
      <HeroCard style={{ bottom: "16%", left: "0%" }} delay={1.0} icon={Code2} title="Code Snippets" tint="bg-[#2F9E44]/12 text-[#2F9E44]" />
      <HeroCard style={{ bottom: "10%", right: "1%" }} delay={1.4} icon={Globe} title="Web Insights" tint="bg-[#37B24D]/12 text-[#2F9E44]" />

      <LogoBubble style={{ top: "2%", left: "55%" }} delay={0.3} size={58}>
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#10A37F"><path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6 6 0 0 0 4.98 4.18a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .75 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.6 22a6.05 6.05 0 0 0 5.77-4.2 5.98 5.98 0 0 0 4-2.9 6.05 6.05 0 0 0-.74-7.08Zm-9 12.6a4.48 4.48 0 0 1-2.88-1.04l4.95-2.86a.8.8 0 0 0 .4-.7v-6.99l2.1 1.21a.07.07 0 0 1 .04.06v5.78a4.5 4.5 0 0 1-4.6 4.54ZM3.6 17.79a4.48 4.48 0 0 1-.54-3.01l4.95 2.86a.8.8 0 0 0 .8 0l6.04-3.49v2.42a.07.07 0 0 1-.03.06l-5 2.9a4.5 4.5 0 0 1-6.22-1.74ZM2.34 8.05A4.5 4.5 0 0 1 4.7 6.07v5.88a.8.8 0 0 0 .4.7l6.03 3.48-2.1 1.21a.07.07 0 0 1-.07 0l-5-2.9a4.5 4.5 0 0 1-1.62-6.4Zm17.18 4-6.04-3.5 2.1-1.2a.07.07 0 0 1 .07 0l5 2.88a4.5 4.5 0 0 1-.68 8.12v-5.88a.8.8 0 0 0-.45-.42Zm2.08-3.14-4.95-2.86a.8.8 0 0 0-.8 0L9.8 9.54V7.12a.07.07 0 0 1 .03-.06l5-2.88a4.5 4.5 0 0 1 6.68 4.66Zm-13.1 4.31-2.1-1.21a.07.07 0 0 1-.04-.06V6.47a4.5 4.5 0 0 1 7.38-3.45l-4.95 2.86a.8.8 0 0 0-.4.7l-.01 6.96Zm1.14-2.46L12 9.21l2.36 1.36v2.72L12 14.65l-2.36-1.36V10.6Z"/></svg>
      </LogoBubble>

      <LogoBubble style={{ top: "50%", left: "2%" }} delay={0.8} size={56}>
        <svg viewBox="0 0 24 24" className="h-7 w-7"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
      </LogoBubble>

      <LogoBubble style={{ bottom: "8%", left: "44%" }} delay={1.6} size={64}>
        <span className="text-[11px] font-bold tracking-tight text-[#1E293B]">Claude</span>
      </LogoBubble>

      <LogoBubble style={{ top: "48%", right: "0%" }} delay={0.5} size={52}>
        <span className="text-sm font-bold tracking-wide text-[#1E293B]">AI</span>
      </LogoBubble>
    </div>
  );
}

function HeroVisual() {
  // Prefers /hero-brain.png (drop into frontend/public/); falls back to the
  // built-in SVG illustration so the page never shows a broken image.
  const [imgOk, setImgOk] = useState(true);
  if (!imgOk) return <HeroIllustration />;
  return (
    <picture>
      <source srcSet="/hero-brain.webp" type="image/webp" />
      <motion.img
        src="/hero-brain.png"
        alt="ContextOS — your second brain connected to every AI tool"
        onError={() => setImgOk(false)}
        width={864}
        height={713}
        decoding="async"
        className="mx-auto w-full max-w-[560px] drop-shadow-[0_24px_50px_rgba(47,158,68,0.16)]"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </picture>
  );
}

// ── Browser-extension mockup (decorative) ────────────────────────────────────
function BrowserMockup() {
  return (
    <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(30,41,59,0.05),0_24px_60px_-20px_rgba(30,41,59,0.18)]">
      {/* Chrome bar */}
      <div className="flex items-center gap-3 border-b border-[#E5E7EB] bg-[#FAFCFB] px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]" />
        </div>
        <div className="flex h-7 flex-1 items-center gap-2 rounded-full bg-white px-3 text-xs text-[#64748B] ring-1 ring-[#E5E7EB]">
          <Globe className="h-3 w-3" /> any-website.com/article
        </div>
      </div>

      {/* Page body */}
      <div className="relative p-6 sm:p-8">
        <div className="space-y-2.5">
          <div className="h-2.5 w-3/4 rounded-full bg-[#E5E7EB]" />
          <div className="h-2.5 w-full rounded-full bg-[#E5E7EB]/70" />
          {/* highlighted text */}
          <div className="relative inline-block w-[88%] rounded-md bg-[#37B24D]/20 px-1.5 py-1">
            <div className="h-2.5 w-full rounded-full bg-[#2F9E44]/40" />
          </div>
          <div className="h-2.5 w-[92%] rounded-full bg-[#E5E7EB]/70" />
          <div className="h-2.5 w-2/3 rounded-full bg-[#E5E7EB]/70" />
        </div>

        {/* context menu */}
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={inView}
          transition={{ delay: 0.35, duration: 0.35, ease: "easeOut" }}
          className="absolute left-[38%] top-[46%] w-56 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-[0_12px_36px_-8px_rgba(30,41,59,0.22)]"
        >
          <div className="flex items-center gap-2.5 rounded-lg bg-[#37B24D]/10 px-3 py-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#2F9E44] text-white">
              <Brain className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-semibold text-[#1E293B]">Save to ContextOS</span>
          </div>
          <div className="px-3 py-2 text-xs text-[#64748B]">Copy</div>
          <div className="px-3 py-2 text-xs text-[#64748B]">Search the web…</div>
        </motion.div>

        {/* floating capture button */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#2F9E44] text-white shadow-[0_10px_26px_-6px_rgba(47,158,68,0.55)]"
        >
          <Brain className="h-5 w-5" />
        </motion.div>
      </div>
    </div>
  );
}

// ── Dashboard mockup (decorative) ────────────────────────────────────────────
function DashboardMockup() {
  const memoryCards = [
    { title: "Article — deep work tips", tags: ["reading", "ideas"] },
    { title: "Code snippet — auth flow", tags: ["work", "code"] },
    { title: "ChatGPT answer — trip plan", tags: ["ai", "travel"] },
    { title: "Email template — outreach", tags: ["templates"] },
  ];
  return (
    <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(30,41,59,0.05),0_28px_70px_-24px_rgba(30,41,59,0.20)]">
      {/* top bar with search */}
      <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2F9E44] text-white">
          <Brain className="h-4 w-4" />
        </span>
        <div className="flex h-8 flex-1 items-center gap-2 rounded-lg bg-[#FAFCFB] px-3 text-xs text-[#64748B] ring-1 ring-[#E5E7EB]">
          <Search className="h-3.5 w-3.5" /> Search your memories…
        </div>
        <span className="hidden rounded-md bg-[#FAFCFB] px-2 py-1 text-[10px] font-medium text-[#64748B] ring-1 ring-[#E5E7EB] sm:block">⌘K</span>
      </div>

      <div className="grid grid-cols-[132px_1fr] sm:grid-cols-[180px_1fr]">
        {/* sidebar */}
        <div className="border-r border-[#E5E7EB] bg-[#FAFCFB] p-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Folders</p>
          {["Work", "Research", "Prompts", "Ideas"].map((f, i) => (
            <div key={f} className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium ${i === 0 ? "bg-[#37B24D]/12 text-[#1E293B]" : "text-[#64748B]"}`}>
              <FolderOpen className="h-3.5 w-3.5" /> {f}
            </div>
          ))}
          <p className="mb-2 mt-4 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Collections</p>
          {["Launch plan", "AI answers"].map((f) => (
            <div key={f} className="mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-[#64748B]">
              <Tag className="h-3.5 w-3.5" /> {f}
            </div>
          ))}
        </div>

        {/* memory cards */}
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          {memoryCards.map(({ title, tags }) => (
            <div key={title} className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 shadow-[0_1px_3px_rgba(30,41,59,0.05)]">
              <p className="mb-2 text-xs font-semibold text-[#1E293B]">{title}</p>
              <div className="mb-3 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-[#E5E7EB]" />
                <div className="h-1.5 w-4/5 rounded-full bg-[#E5E7EB]/70" />
              </div>
              <div className="flex gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="rounded-full bg-[#37B24D]/10 px-2 py-0.5 text-[10px] font-medium text-[#2F9E44]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── FAQ accordion ────────────────────────────────────────────────────────────
function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-2xl">
      {FAQS.map(({ q, a }, i) => {
        const open = openIdx === i;
        return (
          <div key={q} className="border-b border-[#E5E7EB]">
            <button
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span className="text-base font-semibold text-[#1E293B]">{q}</span>
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 text-[#64748B]">
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <p className="pb-5 text-base leading-relaxed text-[#64748B]">{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function LandingPage() {
  return (
    <div className="min-h-dvh bg-[#FAFCFB] font-sans text-[#1E293B]">
      <SiteHeader />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-[calc(7rem+env(safe-area-inset-top,0px))] pb-20 sm:pb-24">
        {/* single soft glow — calm, premium */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(55,178,77,0.15), transparent 70%)" }}
        />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-10">
          <motion.div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left" initial="hidden" animate="show" variants={stagger}>
            <motion.div
              variants={fadeUp}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2F9E44]/25 bg-white px-4 py-1.5 text-xs font-semibold text-[#2F9E44] shadow-[0_1px_2px_rgba(30,41,59,0.05)]"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#37B24D]" />
              ContextOS — your personal second brain
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-balance text-[44px] font-bold leading-[1.06] tracking-tight text-[#1E293B] sm:text-[64px]"
            >
              Save{" "}
              <span className="relative whitespace-nowrap text-[#2F9E44]">
                anything
                <svg className="absolute -bottom-1.5 left-0 w-full" viewBox="0 0 120 8" fill="none" preserveAspectRatio="none">
                  <path d="M2 6 C30 2, 60 2, 118 5" stroke="#69DB7C" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
              . Find it instantly.
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-6 text-lg leading-relaxed text-[#64748B] sm:text-xl">
              Ideas, notes, links, research, code snippets — save anything important from any website in one click, and find it later on any browser, desktop, or mobile.
            </motion.p>

            {/* the whole product in one line */}
            <motion.div
              variants={fadeUp}
              className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-medium text-[#1E293B] shadow-[0_1px_3px_rgba(30,41,59,0.05)] lg:justify-start"
            >
              <span className="rounded-md bg-[#37B24D]/20 px-2 py-0.5">Select text</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#64748B]" />
              <span className="inline-flex items-center gap-1.5">
                <MousePointerClick className="h-4 w-4 text-[#2F9E44]" /> Right-click
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-[#64748B]" />
              <span className="font-semibold text-[#2F9E44]">Save to ContextOS</span>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link to="/sign-up">
                  <Button size="lg" className="h-12 gap-2 px-8 text-base shadow-lg shadow-brand-500/20">
                    Start Free <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="h-12 gap-2 px-6 text-base">
                    <Chrome className="h-4 w-4" /> Add to Chrome
                  </Button>
                </a>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link to="/sign-in">
                  <Button variant="ghost" size="lg" className="h-12 px-5 text-base text-[#64748B]">
                    Sign in
                  </Button>
                </Link>
              </motion.div>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#64748B] lg:justify-start">
              <span>✓ Free to start</span>
              <span>✓ Save from any website</span>
              <span>✓ Works on desktop &amp; mobile</span>
            </motion.div>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          >
            <HeroVisual />
          </motion.div>
        </div>
      </section>

      {/* ── Trusted / works everywhere ───────────────────────────────────── */}
      <section className="border-t border-[#E5E7EB] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl text-center">
          <motion.p
            initial="hidden" whileInView="show" viewport={inView} variants={fadeUp}
            className="mb-8 text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B]"
          >
            Works everywhere you do
          </motion.p>
          <motion.div
            initial="hidden" whileInView="show" viewport={inView} variants={stagger}
            className="flex flex-wrap items-center justify-center gap-2.5"
          >
            {WORKS_WITH.map(({ icon: Icon, label }) => (
              <motion.span
                key={label}
                variants={fadeUp}
                className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#64748B] transition-colors hover:border-[#2F9E44]/35 hover:text-[#1E293B]"
              >
                <Icon className="h-4 w-4 text-[#2F9E44]" /> {label}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Problem ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="The problem"
            title="Important things keep slipping away"
            sub="The internet is full of things worth keeping — and no good place to keep them."
          />
          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="grid gap-5 md:grid-cols-3">
            {PROBLEMS.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-[0_1px_3px_rgba(30,41,59,0.05),0_12px_32px_-16px_rgba(30,41,59,0.12)]"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAFCFB] ring-1 ring-[#E5E7EB]">
                  <Icon className="h-5 w-5 text-[#64748B]" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-[#1E293B] sm:text-2xl">{title}</h3>
                <p className="text-base leading-relaxed text-[#64748B]">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Solution — Save · Organize · Reuse ───────────────────────────── */}
      <section className="border-t border-[#E5E7EB] bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="The solution"
            title="One second brain. Three steps."
            sub="ContextOS gives everything you save one home — and makes it findable in seconds."
          />
          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="relative grid gap-10 md:grid-cols-3 md:gap-6">
            {/* connecting line */}
            <div className="absolute left-[16%] right-[16%] top-7 hidden h-px bg-[#E5E7EB] md:block" />
            {SOLUTION_STEPS.map(({ icon: Icon, title, desc }, i) => (
              <motion.div key={title} variants={fadeUp} className="relative text-center">
                <div className="relative z-10 mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2F9E44] text-white shadow-[0_10px_26px_-8px_rgba(47,158,68,0.5)]">
                  <Icon className="h-6 w-6" />
                </div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#2F9E44]">Step {i + 1}</p>
                <h3 className="mb-2 text-2xl font-semibold text-[#1E293B]">{title}</h3>
                <p className="mx-auto max-w-xs text-base leading-relaxed text-[#64748B]">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Features"
            title="Everything you know. Organized."
            sub="A home for what matters — and, when you want it, a direct line into your favorite AI tools."
          />
          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="group rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-[0_1px_3px_rgba(30,41,59,0.05),0_12px_32px_-16px_rgba(30,41,59,0.12)] transition-colors hover:border-[#2F9E44]/35"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#37B24D]/10 transition-colors group-hover:bg-[#37B24D]/15">
                  <Icon className="h-5 w-5 text-[#2F9E44]" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-[#1E293B] sm:text-2xl">{title}</h3>
                <p className="text-base leading-relaxed text-[#64748B]">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Browser extension ────────────────────────────────────────────── */}
      <section className="border-t border-[#E5E7EB] bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger}>
              <motion.p variants={fadeUp} className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#2F9E44]">
                Browser extension
              </motion.p>
              <motion.h2 variants={fadeUp} className="mb-4 text-3xl font-bold tracking-tight text-[#1E293B] sm:text-[42px] sm:leading-[1.15]">
                See it. Select it. Saved.
              </motion.h2>
              <motion.p variants={fadeUp} className="mb-7 text-lg leading-relaxed text-[#64748B]">
                Articles, ideas, code snippets, email templates, login notes, AI chats — if you can select it, you can save it. From any page, in one click.
              </motion.p>
              <motion.ul variants={fadeUp} className="mb-8 space-y-3 text-base text-[#1E293B]">
                {["Select text → Right-click → Save to ContextOS", "Floating save button on every page", "Works on articles, docs, AI chats — any website"].map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#37B24D]/15 text-[10px] font-bold text-[#2F9E44]">✓</span>
                    {t}
                  </li>
                ))}
              </motion.ul>
              <motion.div variants={fadeUp} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
                <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="h-12 gap-2 px-7 text-base shadow-lg shadow-brand-500/20">
                    <Chrome className="h-4 w-4" /> Add Chrome Extension
                  </Button>
                </a>
              </motion.div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inView}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <BrowserMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Dashboard preview ────────────────────────────────────────────── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Your library"
            title="A calm home for everything you save"
            sub="Folders, tags, collections, and instant search — everything you've saved, beautifully organized and available on desktop and mobile."
          />
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={inView}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <DashboardMockup />
          </motion.div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="border-t border-[#E5E7EB] bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="How it works" title="From browsing to remembering" sub="Save in one click. Find in one search." />
          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_STEPS.map(({ n, icon: Icon, title, desc }, i) => (
              <motion.div key={n} variants={fadeUp} className="relative text-center lg:text-left">
                <div className="mb-4 flex items-center justify-center gap-3 lg:justify-start">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#FAFCFB] text-[#2F9E44]">
                    <Icon className="h-5 w-5" />
                  </span>
                  {i < HOW_STEPS.length - 1 && <ArrowRight className="hidden h-4 w-4 text-[#E5E7EB] lg:block lg:flex-1" />}
                </div>
                <p className="mb-1 text-xs font-semibold text-[#2F9E44]">{n}</p>
                <h3 className="mb-1.5 text-xl font-semibold text-[#1E293B]">{title}</h3>
                <p className="text-base leading-relaxed text-[#64748B]">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Why ContextOS" title="Remember everything. Effortlessly." />
          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {BENEFITS.map(({ emoji, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="rounded-2xl border border-[#E5E7EB] bg-white p-5 text-center shadow-[0_1px_3px_rgba(30,41,59,0.05)]"
              >
                <div className="mb-3 text-2xl">{emoji}</div>
                <h3 className="mb-1 text-sm font-semibold text-[#1E293B]">{title}</h3>
                <p className="text-xs leading-relaxed text-[#64748B]">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Pricing (same plans & prices, new layout) ────────────────────── */}
      <section className="border-t border-[#E5E7EB] bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Pricing" title="Simple pricing" sub="Start free. Upgrade when you need more." />
          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="mb-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map(({ name, price, note, highlight, tagline }) => (
              <motion.div
                key={name}
                variants={fadeUp}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={`relative rounded-2xl border p-7 text-center ${
                  highlight
                    ? "border-[#2F9E44] bg-white shadow-[0_0_0_4px_rgba(55,178,77,0.15),0_20px_50px_-16px_rgba(47,158,68,0.30)]"
                    : "border-[#E5E7EB] bg-[#FAFCFB] shadow-[0_1px_3px_rgba(30,41,59,0.05)]"
                }`}
              >
                {highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2F9E44] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                    Most popular
                  </span>
                )}
                <p className="mb-1 text-base font-semibold text-[#1E293B]">{name}</p>
                <p className="mb-4 text-xs text-[#64748B]">{tagline}</p>
                <p className="text-4xl font-bold tracking-tight text-[#1E293B]">{price}</p>
                <p className="mt-1 text-sm text-[#64748B]">{note}</p>
              </motion.div>
            ))}
          </motion.div>
          <div className="text-center">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
              <Link to="/pricing">
                <Button variant="outline" size="lg" className="h-12 gap-2 px-7 text-base">
                  See all plans <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <Faq />
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-[#E5E7EB] bg-white px-6 py-20 text-center sm:py-28">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(55,178,77,0.15), transparent 70%)" }}
        />
        <motion.div className="relative mx-auto max-w-xl" initial="hidden" whileInView="show" viewport={inView} variants={stagger}>
          <motion.h2 variants={fadeUp} className="mb-4 text-3xl font-bold tracking-tight text-[#1E293B] sm:text-[42px] sm:leading-[1.15]">
            Never lose important information again.
          </motion.h2>
          <motion.p variants={fadeUp} className="mb-9 text-lg leading-relaxed text-[#64748B]">
            Start your second brain today. Free to start, no credit card required.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link to="/sign-up">
                <Button size="lg" className="h-12 gap-2 px-8 text-base shadow-lg shadow-brand-500/20">
                  Get started free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="lg" className="h-12 gap-2 px-6 text-base">
                  <Chrome className="h-4 w-4" /> Add Chrome Extension
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#E5E7EB] bg-[#FAFCFB] px-6 py-14">
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <img src="/logo_mark.png" alt="ContextOS" className="h-9 w-9 rounded-lg" />
              <span className="text-lg font-bold text-[#1E293B]">ContextOS</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-[#64748B]">
              Your personal second brain. Save anything from any website, find it instantly, use it anywhere.
            </p>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B]">Product</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link to="/pricing" className="text-[#64748B] transition-colors hover:text-[#1E293B]">Pricing</Link>
              <Link to="/context-hub" className="text-[#64748B] transition-colors hover:text-[#1E293B]">Context Hub</Link>
              <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" className="text-[#64748B] transition-colors hover:text-[#1E293B]">
                Chrome Extension
              </a>
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B]">Company</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link to="/privacy" className="text-[#64748B] transition-colors hover:text-[#1E293B]">Privacy Policy</Link>
              <Link to="/sign-in" className="text-[#64748B] transition-colors hover:text-[#1E293B]">Sign in</Link>
              <Link to="/sign-up" className="text-[#64748B] transition-colors hover:text-[#1E293B]">Start Free</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t border-[#E5E7EB] pt-6 text-center text-xs text-[#64748B]">
          © {new Date().getFullYear()} ContextOS. Remember everything. Continue anywhere.
        </div>
      </footer>
    </div>
  );
}
