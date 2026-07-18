// ── ProfileMemoryPage · your entire profile as ONE ContextOS memory ─────────
// Purely additive feature. Uses only the existing memories API:
//   • The whole profile is stored as a single memory (title "Profile Memory",
//     tag "profile-memory"). Updating any field PATCHes that same memory —
//     never creates a second one.
//   • Because it's a normal memory, it's instantly searchable everywhere and
//     available to AI tools through the existing memory/injection/MCP paths.
// No backend, API, route-behavior, or existing-feature changes.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { motion } from "framer-motion";
import {
  User, BookOpen, Wrench, Target, Contact, Users, Settings2, Plus, X,
  Search, CheckCircle2, Loader2, Sparkles, ListPlus,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { memoryService, type Memory } from "@/services/memory.service";

// ── Singleton identity of the profile memory ────────────────────────────────
const PROFILE_TITLE = "Profile Memory";
const PROFILE_TAG = "profile-memory";

// ── Field schema ─────────────────────────────────────────────────────────────
interface FieldDef {
  label: string;
  long?: boolean; // textarea
  placeholder?: string;
}
interface SectionDef {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: "personal",
    title: "Personal Information",
    icon: User,
    fields: [
      { label: "Full Name", placeholder: "Jane Doe" },
      { label: "Preferred Name", placeholder: "Jane" },
      { label: "Date of Birth", placeholder: "12 March 2002" },
      { label: "Age", placeholder: "24" },
      { label: "Gender", placeholder: "—" },
      { label: "Profession", placeholder: "Software Engineer" },
      { label: "Company / Organization", placeholder: "Acme Inc." },
      { label: "Job Title", placeholder: "Frontend Developer" },
      { label: "Education", placeholder: "B.Tech CSE, 2024" },
      { label: "Location", placeholder: "Hyderabad, India" },
      { label: "Time Zone", placeholder: "IST (UTC+5:30)" },
      { label: "Languages", placeholder: "English, Telugu, Hindi" },
    ],
  },
  {
    id: "about",
    title: "About",
    icon: BookOpen,
    fields: [
      { label: "About Me", long: true, placeholder: "A short intro in your own words…" },
      { label: "Biography", long: true },
      { label: "Interests", placeholder: "AI, product design, cricket" },
      { label: "Hobbies", placeholder: "Photography, gym, gaming" },
      { label: "Personality", placeholder: "Curious, direct, detail-oriented" },
    ],
  },
  {
    id: "skills",
    title: "Skills",
    icon: Wrench,
    fields: [
      { label: "Skills", placeholder: "React, Python, SQL" },
      { label: "Technical Skills", long: true },
      { label: "Soft Skills", placeholder: "Communication, leadership" },
      { label: "Experience", long: true, placeholder: "Roles, projects, years…" },
      { label: "Certifications", placeholder: "AWS CCP, …" },
    ],
  },
  {
    id: "goals",
    title: "Goals",
    icon: Target,
    fields: [
      { label: "Short-Term Goals", long: true },
      { label: "Long-Term Goals", long: true },
      { label: "Career Goals", long: true },
      { label: "Learning Goals", long: true },
    ],
  },
  {
    id: "details",
    title: "Personal Details",
    icon: Contact,
    fields: [
      { label: "Frequently Used Information", long: true, placeholder: "Things you retype often…" },
      { label: "Email Addresses", placeholder: "you@example.com" },
      { label: "Phone Numbers", placeholder: "+91 …" },
      { label: "Social Links", long: true, placeholder: "Twitter, LinkedIn…" },
      { label: "Website", placeholder: "https://…" },
      { label: "Portfolio", placeholder: "https://…" },
      { label: "Usernames", placeholder: "@handle on X, GitHub…" },
      { label: "Important IDs", long: true, placeholder: "Your own notes (avoid sensitive government IDs)" },
    ],
  },
  {
    id: "family",
    title: "Family & Relationships",
    icon: Users,
    fields: [
      { label: "Family Members", long: true },
      { label: "Relationships", long: true },
      { label: "Emergency Contacts", long: true },
      { label: "Important Dates", long: true, placeholder: "Birthdays, anniversaries…" },
    ],
  },
  {
    id: "preferences",
    title: "Preferences",
    icon: Settings2,
    fields: [
      { label: "Favorite Tools", placeholder: "VS Code, Figma, Notion" },
      { label: "Favorite AI Models", placeholder: "Claude, GPT, Gemini" },
      { label: "Writing Style", placeholder: "Concise, friendly, no fluff" },
      { label: "Communication Style", placeholder: "Direct, bullet points" },
      { label: "Preferred Language", placeholder: "English" },
      { label: "Default Preferences", long: true },
    ],
  },
];

const KNOWN_LABELS = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.label)));
const CUSTOM_SECTION = "Custom Fields";

// ── Serialization: one readable, searchable memory body ─────────────────────
type Values = Record<string, string>;
interface CustomField { label: string; value: string }

function serialize(values: Values, custom: CustomField[]): string {
  const parts: string[] = [];
  for (const section of SECTIONS) {
    const lines = section.fields
      .filter((f) => (values[f.label] ?? "").trim() !== "")
      .map((f) => `${f.label}: ${values[f.label].trim()}`);
    if (lines.length) parts.push(`## ${section.title}\n${lines.join("\n")}`);
  }
  const customLines = custom
    .filter((c) => c.label.trim() && c.value.trim())
    .map((c) => `${c.label.replace(/:/g, " ").trim()}: ${c.value.trim()}`);
  if (customLines.length) parts.push(`## ${CUSTOM_SECTION}\n${customLines.join("\n")}`);
  return parts.join("\n\n");
}

function parse(content: string): { values: Values; custom: CustomField[] } {
  const values: Values = {};
  const custom: CustomField[] = [];
  let inCustom = false;
  let currentKey: string | null = null;
  let currentIsCustom = false;

  for (const raw of content.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("## ")) {
      inCustom = line.slice(3).trim() === CUSTOM_SECTION;
      currentKey = null;
      continue;
    }
    const m = line.match(/^([^:\n]{1,80}):\s?(.*)$/);
    const key = m?.[1]?.trim();
    if (m && key && (inCustom || KNOWN_LABELS.has(key))) {
      currentKey = key;
      currentIsCustom = inCustom;
      if (inCustom) custom.push({ label: key, value: m[2] });
      else values[key] = m[2];
    } else if (currentKey !== null && line.trim() !== "") {
      // continuation line of a multiline value
      if (currentIsCustom) custom[custom.length - 1].value += `\n${line}`;
      else values[currentKey] += `\n${line}`;
    }
  }
  return { values, custom };
}

// ── Page ─────────────────────────────────────────────────────────────────────
type SaveState = "idle" | "loading" | "dirty" | "saving" | "saved" | "error";

export function ProfileMemoryPage() {
  const { user } = useUser();
  const [values, setValues] = useState<Values>({});
  const [custom, setCustom] = useState<CustomField[]>([]);
  const [memoryId, setMemoryId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>("loading");
  const [filter, setFilter] = useState("");
  const saveTimer = useRef<number | null>(null);
  const inFlight = useRef(false);
  const pendingContent = useRef<string | null>(null);

  // ── Load (or discover) the single profile memory ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    memoryService
      .list()
      .then((all) => {
        if (cancelled) return;
        // Singleton: prefer the tag, fall back to the title; newest wins.
        const candidates = all
          .filter((m) => m.tags?.includes(PROFILE_TAG) || m.title === PROFILE_TITLE)
          .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
        const existing = candidates[0];
        if (existing) {
          const parsed = parse(existing.content || "");
          setValues(parsed.values);
          setCustom(parsed.custom);
          setMemoryId(existing.id);
          setUpdatedAt(existing.updated_at);
        }
        setState("idle");
      })
      .catch(() => !cancelled && setState("idle"));
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Auto-save (debounced); always updates the SAME memory ─────────────────
  const persist = useCallback(
    async (content: string) => {
      if (inFlight.current) {
        pendingContent.current = content; // coalesce while a save is running
        return;
      }
      inFlight.current = true;
      setState("saving");
      try {
        let saved: Memory;
        if (memoryId) {
          saved = await memoryService.update(memoryId, {
            title: PROFILE_TITLE,
            content,
            tags: [PROFILE_TAG, "profile"],
          });
        } else {
          saved = await memoryService.create({
            title: PROFILE_TITLE,
            content,
            tags: [PROFILE_TAG, "profile"],
          });
          setMemoryId(saved.id);
        }
        setUpdatedAt(saved.updated_at);
        setState("saved");
      } catch {
        setState("error");
      } finally {
        inFlight.current = false;
        if (pendingContent.current !== null) {
          const next = pendingContent.current;
          pendingContent.current = null;
          void persist(next);
        }
      }
    },
    [memoryId],
  );

  const queueSave = useCallback(
    (nextValues: Values, nextCustom: CustomField[]) => {
      setState("dirty");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void persist(serialize(nextValues, nextCustom));
      }, 1200);
    },
    [persist],
  );

  const setField = (label: string, v: string) => {
    const next = { ...values, [label]: v };
    setValues(next);
    queueSave(next, custom);
  };
  const setCustomField = (i: number, patch: Partial<CustomField>) => {
    const next = custom.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    setCustom(next);
    queueSave(values, next);
  };
  const addCustomField = () => setCustom((c) => [...c, { label: "", value: "" }]);
  const removeCustomField = (i: number) => {
    const next = custom.filter((_, idx) => idx !== i);
    setCustom(next);
    queueSave(values, next);
  };

  // ── Completion & search filtering ─────────────────────────────────────────
  const totalFields = useMemo(() => SECTIONS.reduce((n, s) => n + s.fields.length, 0), []);
  const filledFields = useMemo(
    () => SECTIONS.reduce((n, s) => n + s.fields.filter((f) => (values[f.label] ?? "").trim() !== "").length, 0),
    [values],
  );
  const completion = Math.round((filledFields / totalFields) * 100);

  const q = filter.trim().toLowerCase();
  const matches = (label: string, value: string) =>
    !q || label.toLowerCase().includes(q) || value.toLowerCase().includes(q);

  const displayName =
    (values["Preferred Name"] || values["Full Name"] || user?.fullName || user?.username || "Your profile").trim();

  const statusUi = {
    loading: { icon: Loader2, text: "Loading…", spin: true },
    idle: { icon: CheckCircle2, text: "Up to date", spin: false },
    dirty: { icon: Loader2, text: "Waiting to save…", spin: true },
    saving: { icon: Loader2, text: "Saving…", spin: true },
    saved: { icon: CheckCircle2, text: "Saved", spin: false },
    error: { icon: X, text: "Save failed — edit any field to retry", spin: false },
  }[state];
  const StatusIcon = statusUi.icon;

  return (
    <div>
      <PageHeader
        title="Profile Memory"
        description="Everything about you, stored as one searchable memory."
      />

      {/* ── Profile header card ─────────────────────────────────────────── */}
      <Card className="mb-6 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 text-2xl font-bold text-white">
                {displayName[0]?.toUpperCase() || "U"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold text-foreground">{displayName}</h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {[values["Profession"], values["Location"]].filter(Boolean).join(" · ") ||
                  "Fill in your profile below — it auto-saves as you type."}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    className="h-full rounded-full bg-brand-500"
                    animate={{ width: `${completion}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
                <span className="whitespace-nowrap text-xs font-semibold text-brand-600">{completion}% complete</span>
              </div>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:justify-end">
                <StatusIcon className={`h-3.5 w-3.5 ${statusUi.spin ? "animate-spin" : "text-brand-500"}`} />
                {statusUi.text}
              </p>
              {updatedAt && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Last updated {new Date(updatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── One-memory explainer + search within profile ─────────────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-brand-500" />
          Stored as one memory — searchable everywhere, and usable as your identity in AI tools.
        </p>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search within profile…"
            className="pl-9"
          />
        </div>
      </div>

      {/* ── Section cards ─────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {SECTIONS.map((section) => {
          const visible = section.fields.filter((f) => matches(f.label, values[f.label] ?? ""));
          if (q && visible.length === 0) return null;
          const Icon = section.icon;
          return (
            <Card key={section.id}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/12">
                    <Icon className="h-4 w-4 text-brand-600" />
                  </span>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {visible.map((f) => (
                  <div key={f.label}>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{f.label}</Label>
                    {f.long ? (
                      <Textarea
                        value={values[f.label] ?? ""}
                        onChange={(e) => setField(f.label, e.target.value)}
                        placeholder={f.placeholder}
                        rows={3}
                      />
                    ) : (
                      <Input
                        value={values[f.label] ?? ""}
                        onChange={(e) => setField(f.label, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        {/* ── Custom fields ──────────────────────────────────────────────── */}
        {(!q || custom.some((c) => matches(c.label, c.value))) && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/12">
                    <ListPlus className="h-4 w-4 text-brand-600" />
                  </span>
                  Custom Fields
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={addCustomField}>
                  <Plus className="h-3.5 w-3.5" /> Add field
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {custom.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  Add anything else worth remembering — favorite quotes, gym PRs, Wi-Fi names, whatever helps.
                </p>
              ) : (
                <div className="space-y-3">
                  {custom.map((c, i) =>
                    q && !matches(c.label, c.value) ? null : (
                      <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <Input
                          value={c.label}
                          onChange={(e) => setCustomField(i, { label: e.target.value })}
                          placeholder="Field name"
                          className="sm:w-56"
                        />
                        <Textarea
                          value={c.value}
                          onChange={(e) => setCustomField(i, { value: e.target.value })}
                          placeholder="Value"
                          rows={1}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove field"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => removeCustomField(i)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ),
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
