// ── Context Hub · community & resources page ─────────────────────────────────
// Public marketing page that replaces the Live Session entry point. Reuses the
// existing design system (SiteHeader, Button, landing-page section patterns)
// and the compliant AdSenseSlot from the live-session module — no existing
// component is modified.
//
// Ad placements (per spec): after the Telegram/community section, and after
// the About ContextOS section (which is directly before the Mobile App
// "Coming Soon" banner, satisfying both remaining placements without stacking
// two ad units back-to-back — an AdSense policy concern).

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Send,
  Bell,
  Sparkles,
  BookOpen,
  FileText,
  GraduationCap,
  Puzzle,
  Megaphone,
  Smartphone,
  Download,
  Save,
  FolderTree,
  Search,
} from "lucide-react";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { AdSenseSlot } from "@/modules/live-session/components/AdSenseSlot";
import { useIsAdmin } from "@/modules/live-session/hooks/useIsAdmin";

const TELEGRAM_URL = "https://t.me/usecontextos";

/* Motion presets — identical feel to the landing page */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const hubFeatures = [
  { icon: Bell, label: "ContextOS product updates" },
  { icon: Sparkles, label: "AI updates, insights, and important announcements" },
  { icon: BookOpen, label: "AI tool guides and tutorials" },
  { icon: FileText, label: "PDF resources and detailed notes" },
  { icon: GraduationCap, label: "Useful learning materials and references" },
  { icon: Puzzle, label: "Extension tips and improvements" },
  { icon: Megaphone, label: "New feature announcements" },
  { icon: Smartphone, label: "Mobile app launch updates" },
];

const howItWorks = [
  {
    icon: Download,
    title: "Install the Extension",
    desc: "Add the ContextOS browser extension and start saving useful information.",
  },
  {
    icon: Save,
    title: "Save Your Context",
    desc: "Save important content, ideas, notes, and information from websites.",
  },
  {
    icon: FolderTree,
    title: "Organize Everything",
    desc: "Keep your saved context structured and easy to find.",
  },
  {
    icon: Search,
    title: "Access Anytime",
    desc: "Quickly search and reuse your saved information whenever you need.",
  },
];

export function ContextHubPage() {
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    const prev = document.title;
    document.title = "Context Hub · ContextOS";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-surface-0 text-foreground">
      <SiteHeader />

      {/* ── Hero / community section ──────────────────────────────────────── */}
      <section className="relative px-4 pt-[calc(7rem+env(safe-area-inset-top,0px))] pb-16 sm:px-6 sm:pb-20">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          <motion.div
            variants={fadeUp}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs text-brand-600 backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
            Community &amp; resources
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl"
          >
            <span className="gradient-text">Context Hub</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg"
          >
            Stay connected with ContextOS updates, resources, and announcements
            in one place.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="gap-2 px-8 shadow-lg shadow-brand-500/20">
                <Send className="h-4 w-4" />
                Join Context Hub
              </Button>
            </a>
            <p className="mt-3 text-xs text-muted-foreground">
              Free Telegram community — t.me/usecontextos
            </p>
          </motion.div>
        </motion.div>

        {/* What you get inside the hub */}
        <motion.div
          className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          {hubFeatures.map(({ icon: Icon, label }) => (
            <motion.div
              key={label}
              variants={fadeUp}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/60 backdrop-blur-md p-4 transition-colors hover:border-brand-500/50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-brand-500/40 bg-brand-500/10 text-brand-600">
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-sm text-foreground">{label}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Ad placement 1 — after the Telegram/community section */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <AdSenseSlot isAdmin={isAdmin} />
      </div>

      {/* ── About ContextOS ───────────────────────────────────────────────── */}
      <section className="border-t border-border bg-surface-1 py-16 px-4 sm:py-24 sm:px-6">
        <motion.div
          className="mx-auto max-w-4xl"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Your personal second brain for the web.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
              ContextOS helps you save and organize important information while
              browsing, so you never lose valuable ideas, notes, or knowledge.
            </p>
          </motion.div>

          {/* How it works */}
          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                variants={fadeUp}
                className="rounded-xl border border-border bg-surface-2/60 backdrop-blur-md p-6 transition-colors hover:border-brand-500/50"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-brand-500/40 bg-brand-500/10 text-brand-600 font-bold text-sm">
                    {i + 1}
                  </span>
                  <Icon className="h-5 w-5 text-brand-600" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Ad placement 2 — after About ContextOS, before the Coming Soon banner */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <AdSenseSlot isAdmin={isAdmin} />
      </div>

      {/* ── Mobile App — Coming Soon ──────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-border bg-surface-1 py-16 px-4 sm:py-20 sm:px-6 text-center">
        <motion.div
          className="mx-auto max-w-2xl"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          <motion.div
            variants={fadeUp}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs text-brand-600"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Coming Soon
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            Mobile App Coming Soon 🚀
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-3 text-sm text-muted-foreground">
            Join the Context Hub to be the first to know when it launches.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-6">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" className="gap-2">
                <Send className="h-4 w-4" />
                Get launch updates
              </Button>
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer — same as landing */}
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
