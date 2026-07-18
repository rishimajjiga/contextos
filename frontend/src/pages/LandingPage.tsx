// ── LandingPage · "Your Universal Second Brain" (2026-07 repositioning) ─────
// UI, copy, and storytelling only. Every route, link, feature, and price is
// identical to before. Apple / Linear / Notion / Wispr Flow direction:
// near-white canvas, one green accent, huge type, minimal words.

import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ArrowRight, ArrowDown, Brain, FolderKanban, Users, Cpu, Zap, Key,
  MessageSquare, FileText, Globe, Code2, Chrome, Github, Search,
  MousePointerClick, Sparkles, FolderOpen, ChevronDown, Monitor,
  Smartphone, Tag, User, Layers, BookOpen, Link2, StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/SiteHeader";

const EXTENSION_URL = "https://chromewebstore.google.com/detail/lofknjnllpgmbhnipkcblgmeijmeobbl";

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

// ── Shared building blocks ───────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, sub }: { eyebrow?: string; title: React.ReactNode; sub?: string }) {
  return (
    <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="mx-auto mb-14 max-w-2xl text-center">
      {eyebrow && (
        <motion.p variants={fadeUp} className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#2F9E44]">
          {eyebrow}
        </motion.p>
      )}
      <motion.h2 variants={fadeUp} className="text-balance text-3xl font-bold tracking-tight text-[#1E293B] sm:text-[42px] sm:leading-[1.12]">
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

function Pill({ icon: Icon, children }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#64748B] transition-colors hover:border-[#2F9E44]/35 hover:text-[#1E293B]">
      {Icon && <Icon className="h-4 w-4 text-[#2F9E44]" />}
      {children}
    </span>
  );
}

// ── Hero workflow visual: anywhere → ContextOS → instantly, everywhere ──────
function FlowChip({ icon: Icon, label, delay }: { icon: React.ComponentType<{ className?: string }>; label: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 shadow-[0_1px_3px_rgba(30,41,59,0.06)]"
    >
      <Icon className="h-4 w-4 text-[#2F9E44]" />
      <span className="text-xs font-semibold text-[#1E293B]">{label}</span>
    </motion.div>
  );
}

function FlowArrow({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      className="flex justify-center py-1.5"
    >
      <ArrowDown className="h-4 w-4 text-[#37B24D]" />
    </motion.div>
  );
}

function HeroFlow() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* soft glow behind the flow */}
      <div
        className="pointer-events-none absolute inset-0 -m-8 rounded-[40px]"
        style={{ background: "radial-gradient(closest-side, rgba(55,178,77,0.12), transparent 72%)" }}
      />
      <div className="relative rounded-3xl border border-[#E5E7EB] bg-white/80 p-6 shadow-[0_2px_8px_rgba(30,41,59,0.05),0_28px_70px_-24px_rgba(30,41,59,0.18)] backdrop-blur-sm sm:p-7">
        {/* sources */}
        <div className="grid grid-cols-2 gap-2.5">
          <FlowChip icon={Globe} label="Websites" delay={0.15} />
          <FlowChip icon={Monitor} label="Desktop" delay={0.25} />
          <FlowChip icon={Smartphone} label="Mobile" delay={0.35} />
          <FlowChip icon={Sparkles} label="AI tools" delay={0.45} />
        </div>

        <FlowArrow delay={0.55} />

        {/* save action */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#2F9E44] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_26px_-8px_rgba(47,158,68,0.55)]"
        >
          <MousePointerClick className="h-4 w-4" /> Save to ContextOS
        </motion.div>

        <FlowArrow delay={0.75} />

        {/* the second brain */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.45, ease: "easeOut" }}
          className="flex items-center justify-center gap-3 rounded-2xl border border-[#2F9E44]/30 bg-[#37B24D]/8 px-4 py-4"
        >
          <motion.span
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2F9E44] text-white shadow-[0_10px_24px_-8px_rgba(47,158,68,0.6)]"
          >
            <Brain className="h-6 w-6" />
          </motion.span>
          <div>
            <p className="text-sm font-bold text-[#1E293B]">Your Second Brain</p>
            <p className="text-xs text-[#64748B]">Everything, remembered</p>
          </div>
        </motion.div>

        <FlowArrow delay={0.95} />

        {/* outcomes */}
        <div className="grid grid-cols-2 gap-2.5">
          <FlowChip icon={Search} label="Search instantly" delay={1.05} />
          <FlowChip icon={Zap} label="Reuse anywhere" delay={1.15} />
        </div>
      </div>
    </div>
  );
}

// ── Memory Library mockup ────────────────────────────────────────────────────
const LIBRARY_ITEMS = [
  { icon: Sparkles, title: "Startup idea — voice journal", tags: ["ideas"] },
  { icon: StickyNote, title: "Meeting notes — Q3 roadmap", tags: ["work", "notes"] },
  { icon: MessageSquare, title: "ChatGPT prompt — code review", tags: ["prompts"] },
  { icon: Code2, title: "API documentation — payments", tags: ["code", "docs"] },
  { icon: BookOpen, title: "Favorite recipe — dal makhani", tags: ["recipes"] },
  { icon: Globe, title: "Travel plan — Bali itinerary", tags: ["travel"] },
  { icon: Link2, title: "Research article — sleep & focus", tags: ["research"] },
  { icon: BookOpen, title: "Book summary — Deep Work", tags: ["learning"] },
  { icon: FileText, title: "Email template — client outreach", tags: ["templates"] },
];

function MemoryLibrary() {
  return (
    <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(30,41,59,0.05),0_28px_70px_-24px_rgba(30,41,59,0.20)]">
      <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2F9E44] text-white">
          <Brain className="h-4 w-4" />
        </span>
        <div className="flex h-8 flex-1 items-center gap-2 rounded-lg bg-[#FAFCFB] px-3 text-xs text-[#64748B] ring-1 ring-[#E5E7EB]">
          <Search className="h-3.5 w-3.5" /> Search everything you've ever saved…
        </div>
        <span className="hidden rounded-md bg-[#FAFCFB] px-2 py-1 text-[10px] font-medium text-[#64748B] ring-1 ring-[#E5E7EB] sm:block">⌘K</span>
      </div>

      <div className="grid grid-cols-[128px_1fr] sm:grid-cols-[176px_1fr]">
        <div className="border-r border-[#E5E7EB] bg-[#FAFCFB] p-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Folders</p>
          {["Work", "Ideas", "Learning", "Personal"].map((f, i) => (
            <div key={f} className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium ${i === 0 ? "bg-[#37B24D]/12 text-[#1E293B]" : "text-[#64748B]"}`}>
              <FolderOpen className="h-3.5 w-3.5" /> {f}
            </div>
          ))}
          <p className="mb-2 mt-4 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Projects</p>
          {["App launch", "Thesis"].map((f) => (
            <div key={f} className="mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-[#64748B]">
              <FolderKanban className="h-3.5 w-3.5" /> {f}
            </div>
          ))}
          <p className="mb-2 mt-4 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Collections</p>
          {["AI answers", "Reading list"].map((f) => (
            <div key={f} className="mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-[#64748B]">
              <Tag className="h-3.5 w-3.5" /> {f}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          {LIBRARY_ITEMS.map(({ icon: Icon, title, tags }) => (
            <div key={title} className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-[0_1px_3px_rgba(30,41,59,0.05)] transition-shadow hover:shadow-[0_8px_20px_-8px_rgba(30,41,59,0.18)]">
              <Icon className="mb-2 h-4 w-4 text-[#2F9E44]" />
              <p className="mb-2 text-xs font-semibold leading-snug text-[#1E293B]">{title}</p>
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span key={t} className="rounded-full bg-[#37B24D]/10 px-2 py-0.5 text-[10px] font-medium text-[#2F9E44]">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Profile identity mockup ──────────────────────────────────────────────────
function ProfileIdentityCard() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_2px_8px_rgba(30,41,59,0.05),0_24px_60px_-20px_rgba(30,41,59,0.18)]">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2F9E44] text-lg font-bold text-white">R</div>
        <div>
          <p className="text-sm font-bold text-[#1E293B]">Your Profile Memory</p>
          <p className="text-xs text-[#64748B]">Saved once · reused everywhere</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {[
          ["Profession", "Product designer"],
          ["Skills", "Figma, React, writing"],
          ["Goals", "Launch my own app this year"],
          ["Preferences", "Concise answers, no fluff"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3 rounded-lg bg-[#FAFCFB] px-3 py-2 ring-1 ring-[#E5E7EB]">
            <span className="text-xs font-semibold text-[#64748B]">{k}</span>
            <span className="text-right text-xs font-medium text-[#1E293B]">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────────
const FAQS = [
  { q: "What is ContextOS?", a: "ContextOS is your universal second brain — one place where everything important lives. Save anything from anywhere, and find it instantly whenever you need it." },
  { q: "What can I save?", a: "Anything: ideas, notes, research, links, articles, prompts, AI conversations, code, documents, recipes, goals, templates, usernames — if you can select it or share it, you can save it." },
  { q: "Where can I save information from?", a: "From any website with the browser extension, from your desktop, from your phone, and from AI tools like ChatGPT, Claude, Gemini, and Cursor. Everything lands in the same library." },
  { q: "How does saving work?", a: "On the web: select text → right-click → Save to ContextOS. On mobile: share to ContextOS. Either way, it's saved and searchable in seconds." },
  { q: "Why not just use bookmarks?", a: "Bookmarks save a link — not the actual content. ContextOS saves the exact text, idea, or snippet you cared about, keeps it organized, and makes every word searchable." },
  { q: "Does it work on mobile?", a: "Yes. Your library syncs across devices, so anything you save on your computer is on your phone — and vice versa." },
  { q: "Can I use it with AI tools?", a: "Yes. Your saved context works with ChatGPT, Claude, Gemini, Cursor, and any MCP-compatible tool — plus an API for custom workflows." },
  { q: "Is my data private?", a: "Your memories are private to your account by default. You choose what to share — nothing is shared unless you put it in a team space." },
];

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

// ── Content data ─────────────────────────────────────────────────────────────
const PAINS = [
  "Important tabs disappear",
  "Bookmarks become messy",
  "Screenshots pile up",
  "Notes are scattered",
  "Research gets lost",
  "Great ideas disappear",
  "AI conversations are forgotten",
];

const SAVE_METHODS = [
  {
    icon: Chrome,
    title: "Browser Extension",
    desc: "Save from every website.",
    flow: ["Select", "Right-click", "Save to ContextOS"],
    examples: ["Articles", "Recipes", "GitHub", "Google Docs", "Emails", "AI chats"],
  },
  {
    icon: Monitor,
    title: "Desktop",
    desc: "Save important information while you work at your computer.",
    flow: null,
    examples: ["Code editors", "Documents", "Research tools", "Applications"],
  },
  {
    icon: Smartphone,
    title: "Mobile",
    desc: "Save on the go — share anything into ContextOS from your phone.",
    flow: null,
    examples: ["Messages", "Social apps", "Mobile browsers", "Documents"],
  },
];

const ECOSYSTEM: { group: string; items: { icon: React.ComponentType<{ className?: string }>; label: string }[] }[] = [
  {
    group: "Browsers",
    items: [
      { icon: Chrome, label: "Chrome" },
      { icon: Globe, label: "Edge" },
      { icon: Globe, label: "Brave" },
      { icon: Globe, label: "Opera" },
    ],
  },
  {
    group: "Devices",
    items: [
      { icon: Monitor, label: "Desktop" },
      { icon: Smartphone, label: "Mobile" },
    ],
  },
  {
    group: "AI",
    items: [
      { icon: MessageSquare, label: "ChatGPT" },
      { icon: Brain, label: "Claude" },
      { icon: Sparkles, label: "Gemini" },
      { icon: Cpu, label: "Cursor" },
      { icon: Search, label: "Perplexity" },
    ],
  },
  {
    group: "Tools",
    items: [
      { icon: FileText, label: "Google Docs" },
      { icon: Github, label: "GitHub" },
      { icon: Code2, label: "Stack Overflow" },
      { icon: FileText, label: "Documents & PDFs" },
    ],
  },
];

const BENEFITS = [
  { icon: User, title: "Personal Profile", desc: "Save your identity, skills, goals, and preferences once." },
  { icon: FolderKanban, title: "Projects", desc: "Keep everything related to each project together." },
  { icon: MousePointerClick, title: "Universal Save", desc: "Save anything from anywhere." },
  { icon: Search, title: "Instant Search", desc: "Find anything in seconds." },
  { icon: Layers, title: "Collections", desc: "Organize knowledge beautifully." },
  { icon: Sparkles, title: "AI Integration", desc: "Use your saved context inside AI tools." },
  { icon: Users, title: "Teams", desc: "Share knowledge with your team." },
  { icon: Key, title: "API", desc: "Connect ContextOS with your workflows." },
  { icon: Cpu, title: "MCP", desc: "Use saved context with compatible AI tools." },
];

const OUTCOMES = [
  "Never lose ideas.",
  "Find anything instantly.",
  "Save once. Use forever.",
  "Everything connected.",
  "Your knowledge grows with you.",
];

const BUILT_FOR = ["Students", "Developers", "Creators", "Researchers", "Professionals", "Founders"];

const PLANS = [
  { name: "Free", price: "₹0", note: "forever", highlight: false, tagline: "Start your second brain" },
  { name: "Student", price: "₹199", note: "/ month", highlight: false, tagline: "For studying & research" },
  { name: "Pro", price: "₹499", note: "/ month", highlight: true, tagline: "For serious knowledge builders" },
  { name: "Team", price: "₹1,499", note: "/ month", highlight: false, tagline: "Shared memory for teams" },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export function LandingPage() {
  return (
    <div className="min-h-dvh bg-[#FAFCFB] font-sans text-[#1E293B]">
      <SiteHeader />

      {/* ════ HERO ═══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden px-6 pt-[calc(7rem+env(safe-area-inset-top,0px))] pb-20 sm:pb-28">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(55,178,77,0.14), transparent 70%)" }}
        />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <motion.div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left" initial="hidden" animate="show" variants={stagger}>
            <motion.div
              variants={fadeUp}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2F9E44]/25 bg-white px-4 py-1.5 text-xs font-semibold text-[#2F9E44] shadow-[0_1px_2px_rgba(30,41,59,0.05)]"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#37B24D]" />
              ContextOS
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-balance text-[44px] font-bold leading-[1.05] tracking-tight text-[#1E293B] sm:text-[68px]"
            >
              Your Universal{" "}
              <span className="relative whitespace-nowrap text-[#2F9E44]">
                Second Brain
                <svg className="absolute -bottom-1.5 left-0 w-full" viewBox="0 0 120 8" fill="none" preserveAspectRatio="none">
                  <path d="M2 6 C30 2, 60 2, 118 5" stroke="#69DB7C" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
              .
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-6 text-lg leading-relaxed text-[#64748B] sm:text-xl">
              <span className="font-semibold text-[#1E293B]">Save anything from anywhere.</span> Ideas, notes, research,
              AI chats, code, documents — across your browser, desktop, mobile, and AI tools. Find it instantly whenever
              you need it.
            </motion.p>

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
                    <Chrome className="h-4 w-4" /> Add Chrome Extension
                  </Button>
                </a>
              </motion.div>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#64748B] lg:justify-start">
              <span>✓ Free forever</span>
              <span>✓ Save from anywhere</span>
              <span>✓ Works across all devices</span>
              <span>✓ No credit card required</span>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          >
            <HeroFlow />
          </motion.div>
        </div>
      </section>

      {/* ════ FIRST IMPRESSION — the pain ════════════════════════════════ */}
      <section className="border-t border-[#E5E7EB] bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <SectionHeading
            eyebrow="Sound familiar?"
            title="Everything Important. One Place."
            sub="You found something useful yesterday. But today… you can't find it."
          />
          <motion.div
            initial="hidden" whileInView="show" viewport={inView} variants={stagger}
            className="flex flex-wrap items-center justify-center gap-2.5"
          >
            {PAINS.map((p) => (
              <motion.span
                key={p}
                variants={fadeUp}
                className="rounded-full border border-[#E5E7EB] bg-[#FAFCFB] px-4 py-2 text-sm font-medium text-[#64748B]"
              >
                {p}
              </motion.span>
            ))}
          </motion.div>
          <motion.p
            initial="hidden" whileInView="show" viewport={inView} variants={fadeUp}
            className="mx-auto mt-10 max-w-xl text-lg font-semibold text-[#1E293B]"
          >
            ContextOS ends this. One place. Everything remembered.
          </motion.p>
        </div>
      </section>

      {/* ════ HOW IT WORKS — 3 steps ═════════════════════════════════════ */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <SectionHeading eyebrow="How it works" title="Three steps. That's it." />
          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="relative grid gap-10 md:grid-cols-3 md:gap-6">
            <div className="absolute left-[16%] right-[16%] top-7 hidden h-px bg-[#E5E7EB] md:block" />
            {[
              { icon: Sparkles, title: "Find something valuable", desc: "An idea, an answer, an article — anywhere." },
              { icon: MousePointerClick, title: "Save it to ContextOS", desc: "One click. From browser, desktop, or phone." },
              { icon: Search, title: "Find and reuse it anytime", desc: "Search once — it's there, on every device." },
            ].map(({ icon: Icon, title, desc }, i) => (
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

      {/* ════ SAVE FROM ANYWHERE ═════════════════════════════════════════ */}
      <section className="border-t border-[#E5E7EB] bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Not just a browser thing"
            title="Save From Anywhere."
            sub="If you can select it or share it, you can save it."
          />
          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="grid gap-5 md:grid-cols-3">
            {SAVE_METHODS.map(({ icon: Icon, title, desc, flow, examples }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-[0_1px_3px_rgba(30,41,59,0.05),0_12px_32px_-16px_rgba(30,41,59,0.12)]"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#37B24D]/10">
                  <Icon className="h-5 w-5 text-[#2F9E44]" />
                </div>
                <h3 className="mb-1.5 text-xl font-semibold text-[#1E293B]">{title}</h3>
                <p className="mb-4 text-base leading-relaxed text-[#64748B]">{desc}</p>
                {flow && (
                  <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#1E293B]">
                    {flow.map((step, i) => (
                      <span key={step} className="flex items-center gap-1.5">
                        <span className={`rounded-md px-2 py-1 ${i === flow.length - 1 ? "bg-[#2F9E44] text-white" : "bg-[#37B24D]/12"}`}>{step}</span>
                        {i < flow.length - 1 && <ArrowRight className="h-3 w-3 text-[#64748B]" />}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {examples.map((e) => (
                    <span key={e} className="rounded-full bg-[#FAFCFB] px-2.5 py-1 text-[11px] font-medium text-[#64748B] ring-1 ring-[#E5E7EB]">{e}</span>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════ WORKS EVERYWHERE — ecosystem ═══════════════════════════════ */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="Works everywhere"
            title={<>One Memory.<br />Available Everywhere.</>}
            sub="Save once. Access everywhere."
          />
          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="space-y-6">
            {ECOSYSTEM.map(({ group, items }) => (
              <motion.div key={group} variants={fadeUp} className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <span className="w-24 shrink-0 pt-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B] sm:text-left">
                  {group}
                </span>
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  {items.map(({ icon, label }) => (
                    <Pill key={label} icon={icon}>{label}</Pill>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════ MEMORY LIBRARY ═════════════════════════════════════════════ */}
      <section className="border-t border-[#E5E7EB] bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Your library"
            title="Everything You Save Lives Here."
            sub="Folders, projects, collections, tags, and instant search — a knowledge library that stays beautiful as it grows."
          />
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={inView}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <MemoryLibrary />
          </motion.div>
        </div>
      </section>

      {/* ════ PROFILE MEMORY ═════════════════════════════════════════════ */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger}>
              <motion.p variants={fadeUp} className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#2F9E44]">
                Profile Memory
              </motion.p>
              <motion.h2 variants={fadeUp} className="mb-4 text-3xl font-bold tracking-tight text-[#1E293B] sm:text-[42px] sm:leading-[1.12]">
                Your Digital Identity.
              </motion.h2>
              <motion.p variants={fadeUp} className="mb-6 text-lg leading-relaxed text-[#64748B]">
                Save your name, profession, skills, goals, and preferences once — as a single living memory. Then reuse
                it anywhere, so every tool already knows your context.
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
                {["Name", "Profession", "Skills", "Goals", "Preferences", "Personal context"].map((t) => (
                  <span key={t} className="rounded-full bg-[#37B24D]/10 px-3 py-1.5 text-xs font-semibold text-[#2F9E44]">{t}</span>
                ))}
              </motion.div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inView}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <ProfileIdentityCard />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════ BENEFIT CARDS ══════════════════════════════════════════════ */}
      <section className="border-t border-[#E5E7EB] bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="What you get" title="Simple on the surface. Powerful underneath." />
          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="group rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_1px_3px_rgba(30,41,59,0.05)] transition-colors hover:border-[#2F9E44]/35"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#37B24D]/10 transition-colors group-hover:bg-[#37B24D]/16">
                  <Icon className="h-5 w-5 text-[#2F9E44]" />
                </div>
                <h3 className="mb-1 text-base font-semibold text-[#1E293B]">{title}</h3>
                <p className="text-sm leading-relaxed text-[#64748B]">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════ WHY CONTEXTOS — outcomes ═══════════════════════════════════ */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading eyebrow="Why ContextOS" title="Built for one outcome: you never lose anything again." />
          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="space-y-3">
            {OUTCOMES.map((o) => (
              <motion.p key={o} variants={fadeUp} className="text-xl font-semibold text-[#1E293B] sm:text-2xl">
                {o}
              </motion.p>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════ BUILT FOR — honest social proof ════════════════════════════ */}
      <section className="border-t border-[#E5E7EB] bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <motion.p
            initial="hidden" whileInView="show" viewport={inView} variants={fadeUp}
            className="mb-6 text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B]"
          >
            Built for
          </motion.p>
          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="mb-8 flex flex-wrap items-center justify-center gap-2.5">
            {BUILT_FOR.map((b) => (
              <motion.span key={b} variants={fadeUp}>
                <Pill>{b}</Pill>
              </motion.span>
            ))}
          </motion.div>
          <motion.p initial="hidden" whileInView="show" viewport={inView} variants={fadeUp} className="text-sm text-[#64748B]">
            Trusted by early users building their digital second brain.
          </motion.p>
        </div>
      </section>

      {/* ════ PRICING (unchanged plans) + LAUNCH OFFER ═══════════════════ */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Pricing" title="Simple pricing" sub="Start free. Upgrade when you need more." />

          <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger} className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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

          {/* Launch offer */}
          <motion.div
            initial="hidden" whileInView="show" viewport={inView} variants={fadeUp}
            className="mx-auto mb-10 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl border border-[#2F9E44]/30 bg-[#37B24D]/8 px-6 py-5 sm:flex-row"
          >
            <div className="text-center sm:text-left">
              <p className="text-sm font-bold text-[#1E293B]">🎉 Launch Offer — first 3 months of Pro free</p>
              <p className="mt-0.5 text-xs text-[#64748B]">₹499/month after. Claim it on the pricing page.</p>
            </div>
            <Link to="/pricing" className="shrink-0">
              <Button className="gap-2">
                Claim Offer <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>

          <div className="text-center">
            <Link to="/pricing">
              <Button variant="outline" size="lg" className="h-12 gap-2 px-7 text-base">
                See all plans <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ════ FAQ ════════════════════════════════════════════════════════ */}
      <section className="border-t border-[#E5E7EB] bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <Faq />
        </div>
      </section>

      {/* ════ FINAL CTA ══════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden px-6 py-20 text-center sm:py-28">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(55,178,77,0.15), transparent 70%)" }}
        />
        <motion.div className="relative mx-auto max-w-2xl" initial="hidden" whileInView="show" viewport={inView} variants={stagger}>
          <motion.h2 variants={fadeUp} className="mb-4 text-balance text-3xl font-bold tracking-tight text-[#1E293B] sm:text-[44px] sm:leading-[1.1]">
            Start Building Your Universal Second Brain Today.
          </motion.h2>
          <motion.p variants={fadeUp} className="mb-9 text-lg leading-relaxed text-[#64748B]">
            Save anything from anywhere. Find it instantly everywhere.
            <br className="hidden sm:block" />
            Available across browsers, desktop, mobile, and AI tools.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col items-center justify-center gap-3 sm:flex-row">
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
                  <Chrome className="h-4 w-4" /> Add Chrome Extension
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ════ FOOTER ═════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#E5E7EB] bg-[#FAFCFB] px-6 py-14">
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <img src="/logo_mark.png" alt="ContextOS" className="h-9 w-9 rounded-lg" />
              <span className="text-lg font-bold text-[#1E293B]">ContextOS</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-[#64748B]">
              Your universal second brain. Save anything from anywhere — find it instantly everywhere.
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
