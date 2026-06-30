// ── Live Session module · polls tab (polls + winner + promos + AdSense) ──────
import { useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Clock, Check, Plus, X, ImageIcon, Loader2, AlertCircle,
  Trophy, Trash2, Copy, Share2, Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLivePolls } from "../hooks/useLivePolls";
import { useLivePromotions } from "../hooks/useLivePromotions";
import { useCountdown } from "../hooks/useCountdown";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { uploadPollImage } from "../lib/storage";
import { pollShareUrl, whatsappShareUrl } from "../lib/share";
import { errMessage } from "../lib/errors";
import { isAdsenseConfigured } from "../config";
import { AdSenseSlot } from "./AdSenseSlot";
import type { LivePoll, LivePromotion, LiveSession, PollTally } from "../types";

interface Props {
  open: boolean;
  isAdmin: boolean;
  session: LiveSession | null;
}

export function PollsTab({ open, isAdmin, session }: Props) {
  const { email } = useIsAdmin();
  const { polls, tallies, myVotes, loading, vote, createPoll, deletePoll } =
    useLivePolls(open, session?.id ?? null);
  const { promos, createPromotion, deletePromotion } = useLivePromotions(open);
  const [showCreate, setShowCreate] = useState(false);
  const [showPromo, setShowPromo] = useState(false);

  // Build the between-poll fillers in the desired order:
  //   Your Promotion → AdSense (once) → Sponsored Promotion → (repeat promos)
  const feed = useMemo<ReactNode[]>(() => {
    const adAvailable = isAdsenseConfigured() || isAdmin; // admins see the slot hint

    const promoNode = (p: LivePromotion) => (
      <PromoBanner key={`promo-${p.id}`} promo={p} isAdmin={isAdmin} onDelete={() => deletePromotion(p.id)} />
    );

    // Filler order: Promotion → AdSense (once) → remaining promotions.
    const fillers: ReactNode[] = [];
    let pi = 0;
    if (promos[pi]) fillers.push(promoNode(promos[pi++]));
    if (adAvailable) fillers.push(<AdSenseSlot key="adsense" isAdmin={isAdmin} />);
    for (; pi < promos.length; pi++) fillers.push(promoNode(promos[pi]));

    // Interleave one filler between each pair of polls; leftovers after the last.
    const nodes: ReactNode[] = [];
    let f = 0;
    polls.forEach((poll, i) => {
      nodes.push(
        <PollCard
          key={poll.id}
          poll={poll}
          tally={tallies[poll.id] ?? { counts: poll.options.map(() => 0), total: 0 }}
          myVote={myVotes[poll.id]}
          isAdmin={isAdmin}
          onVote={(idx) => vote(poll.id, idx)}
          onDelete={() => deletePoll(poll.id)}
        />,
      );
      if (i < polls.length - 1 && f < fillers.length) nodes.push(fillers[f++]);
    });
    for (; f < fillers.length; f++) nodes.push(fillers[f]);
    return nodes;
  }, [polls, tallies, myVotes, promos, isAdmin, vote, deletePoll, deletePromotion]);

  return (
    <div className="flex h-full flex-col">
      {isAdmin && (
        <div className="flex items-center justify-end gap-3 border-b border-border/60 px-5 py-2">
          <button
            onClick={() => { setShowPromo(false); setShowCreate((v) => !v); }}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-600"
          >
            {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showCreate ? "Cancel" : "New poll"}
          </button>
          <button
            onClick={() => { setShowCreate(false); setShowPromo((v) => !v); }}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-600"
          >
            {showPromo ? <X className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />}
            {showPromo ? "Cancel" : "Add promotion"}
          </button>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {isAdmin && showCreate && (
          <AdminCreatePoll
            onCreate={async (q, opts, file) => {
              const imageUrl = file ? await uploadPollImage(file) : null;
              await createPoll(q, opts, imageUrl, email ?? "admin");
              setShowCreate(false);
            }}
          />
        )}

        {isAdmin && showPromo && (
          <AdminCreatePromo
            onCreate={async (file, link, durationHours) => {
              const imageUrl = await uploadPollImage(file);
              await createPromotion(imageUrl, link, durationHours, email ?? "admin");
              setShowPromo(false);
            }}
          />
        )}

        {loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Loading polls…</p>
        ) : feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No active polls</p>
            <p className="text-xs text-muted-foreground">New polls from the team appear here live.</p>
          </div>
        ) : (
          feed
        )}
      </div>
    </div>
  );
}

// ── Promotion banner (16:4) ──────────────────────────────────────────────────
function PromoBanner({ promo, isAdmin, onDelete }: { promo: LivePromotion; isAdmin: boolean; onDelete: () => void }) {
  const label = "Sponsored";
  const { label: timeLeft, ended } = useCountdown(promo.expiresAt);
  const img = (
    <img src={promo.imageUrl} alt={label} loading="lazy"
      className="aspect-[16/4] w-full rounded-xl object-cover" />
  );
  return (
    <div className="relative overflow-hidden rounded-xl border border-border shadow-soft">
      <span className="absolute left-2 top-2 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
        {label}
      </span>

      {/* Countdown until the sponsored promo auto-deletes — admin only */}
      {isAdmin && promo.expiresAt && (
        <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white">
          <Clock className="h-3 w-3" />
          {ended ? "Ending…" : `${timeLeft} left`}
        </span>
      )}

      {isAdmin && (
        <button
          onClick={() => { if (window.confirm("Remove this promotion?")) onDelete(); }}
          className="absolute right-2 top-2 z-10 rounded-full bg-black/55 p-1 text-white hover:bg-black/75"
          aria-label="Remove promotion"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {promo.linkUrl
        ? <a href={promo.linkUrl} target="_blank" rel="noopener noreferrer">{img}</a>
        : img}
    </div>
  );
}

interface Winner { indices: number[]; pct: number; tie: boolean }

function computeWinner(tally: PollTally): Winner | null {
  if (tally.total === 0) return null;
  const max = Math.max(...tally.counts);
  if (max === 0) return null;
  const indices = tally.counts.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);
  return { indices, pct: Math.round((max / tally.total) * 100), tie: indices.length > 1 };
}

function PollCard({
  poll, tally, myVote, isAdmin, onVote, onDelete,
}: {
  poll: LivePoll;
  tally: PollTally;
  myVote?: number;
  isAdmin: boolean;
  onVote: (i: number) => void;
  onDelete: () => void;
}) {
  const { label, ended } = useCountdown(poll.expiresAt);
  const voted = myVote !== undefined;
  const locked = voted || ended;
  const winner = useMemo(() => (ended ? computeWinner(tally) : null), [ended, tally]);

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4 shadow-soft">
      {poll.imageUrl && (
        <img src={poll.imageUrl} alt="" loading="lazy"
          className="mb-3 max-h-48 w-full rounded-xl object-cover" />
      )}

      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-snug">{poll.question}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums ${
            ended ? "bg-muted text-muted-foreground" : "bg-brand-500/10 text-brand-700"
          }`}>
            <Clock className="h-3 w-3" />
            {ended ? "Closed" : label}
          </span>
          {isAdmin && (
            <button
              onClick={() => { if (window.confirm("Delete this poll permanently?")) onDelete(); }}
              className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete poll"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {winner && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-700">
          <Trophy className="h-4 w-4 shrink-0" />
          {winner.tie ? (
            <span>Tie: {winner.indices.map((i) => poll.options[i]).join(", ")} — {winner.pct}%</span>
          ) : (
            <span>Winner: “{poll.options[winner.indices[0]]}” — {winner.pct}% of {tally.total} votes</span>
          )}
        </div>
      )}

      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const count = tally.counts[i] ?? 0;
          const pct = tally.total ? Math.round((count / tally.total) * 100) : 0;
          const chosen = myVote === i;
          const isWinner = !!winner && winner.indices.includes(i);
          return (
            <button
              key={i}
              disabled={locked}
              onClick={() => onVote(i)}
              className={`relative w-full overflow-hidden rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                isWinner ? "border-brand-500" : chosen ? "border-brand-500" : "border-border"
              } ${locked ? "cursor-default" : "hover:border-brand-400"}`}
            >
              {locked && (
                <motion.div
                  className={`absolute inset-y-0 left-0 ${isWinner ? "bg-brand-500/25" : chosen ? "bg-brand-500/20" : "bg-surface-3/70"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  {isWinner && <Trophy className="h-3.5 w-3.5 text-brand-600" />}
                  {chosen && !isWinner && <Check className="h-3.5 w-3.5 text-brand-600" />}
                  {opt}
                </span>
                {locked && <span className="tabular-nums text-xs text-muted-foreground">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {tally.total} {tally.total === 1 ? "vote" : "votes"}
          {ended ? " · final results" : voted ? " · you voted" : ""}
        </p>
        <ShareRow poll={poll} winner={winner} total={tally.total} />
      </div>
    </div>
  );
}

function ShareRow({ poll, winner, total }: { poll: LivePoll; winner: Winner | null; total: number }) {
  const [copied, setCopied] = useState(false);
  const url = pollShareUrl(poll.id);
  const message = winner
    ? (winner.tie
        ? `📊 Poll result — “${poll.question}”: tie between ${winner.indices.map((i) => poll.options[i]).join(", ")} (${winner.pct}%). ${url}`
        : `🏆 Poll result — “${poll.question}”: “${poll.options[winner.indices[0]]}” won with ${winner.pct}% of ${total} votes. ${url}`)
    : `📊 Vote in the poll “${poll.question}”: ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={copy}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-medium hover:border-brand-400"
        aria-label="Copy poll link"
      >
        {copied ? <Check className="h-3 w-3 text-brand-600" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : (winner ? "Result link" : "Poll link")}
      </button>
      <a
        href={whatsappShareUrl(message)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-full bg-[#25D366] px-2 py-1 text-[11px] font-medium text-white hover:opacity-90"
        aria-label="Share to WhatsApp"
      >
        <Share2 className="h-3 w-3" /> Share
      </a>
    </div>
  );
}

// Admin-only: create a 24h poll with an optional uploaded image (JPG/PNG/WEBP).
function AdminCreatePoll({
  onCreate,
}: {
  onCreate: (question: string, options: string[], imageFile: File | null) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const clean = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim() && clean.length >= 2;

  const pickFile = (f: File | null) => {
    setErr(null);
    if (!f) { setFile(null); setPreview(null); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setErr("Only JPG, PNG or WEBP images are allowed."); return;
    }
    if (f.size > 5 * 1024 * 1024) { setErr("Image must be under 5 MB."); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  return (
    <div className="space-y-2 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4">
      <p className="text-xs font-medium text-brand-700">Admin · new poll (runs 24 hours)</p>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Poll question…"
        className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-brand-400"
      />
      {options.map((o, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={o}
            onChange={(e) => setOptions((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={`Option ${i + 1}`}
            className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-brand-400"
          />
          {options.length > 2 && (
            <button onClick={() => setOptions((p) => p.filter((_, j) => j !== i))}
              className="rounded-lg px-2 text-muted-foreground hover:text-destructive" aria-label="Remove option">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {options.length < 6 && (
        <button onClick={() => setOptions((p) => [...p, ""])}
          className="text-xs font-medium text-brand-700 hover:text-brand-600">+ Add option</button>
      )}

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="preview" className="max-h-40 w-full rounded-lg object-cover" />
          <button onClick={() => pickFile(null)}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80" aria-label="Remove image">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card py-3 text-xs text-muted-foreground hover:border-brand-400 hover:text-brand-700">
          <ImageIcon className="h-4 w-4" /> Upload image (JPG, PNG, WEBP)
        </button>
      )}

      {err && <p className="flex items-center gap-1 text-[11px] text-destructive"><AlertCircle className="h-3 w-3" /> {err}</p>}

      <Button size="sm" className="w-full" disabled={!valid || busy}
        onClick={async () => {
          setBusy(true); setErr(null);
          try { await onCreate(question.trim(), clean, file); }
          catch (e: unknown) { setErr(errMessage(e, "Could not publish poll.")); }
          finally { setBusy(false); }
        }}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        {busy ? "Publishing…" : "Publish poll"}
      </Button>
    </div>
  );
}

// Admin-only: add a 16:4 promotion banner (own or paid-sponsored).
function AdminCreatePromo({
  onCreate,
}: {
  onCreate: (imageFile: File, linkUrl: string | null, durationHours: number | null) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [hours, setHours] = useState("24");   // display duration; blank = no expiry
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => {
    setErr(null);
    if (!f) { setFile(null); setPreview(null); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setErr("Only JPG, PNG or WEBP images are allowed."); return;
    }
    if (f.size > 5 * 1024 * 1024) { setErr("Image must be under 5 MB."); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  return (
    <div className="space-y-2 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-brand-700">
        <Megaphone className="h-3.5 w-3.5" /> Admin · promotion banner (16:4, e.g. 1600×400)
      </p>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="preview" className="aspect-[16/4] w-full rounded-lg object-cover" />
          <button onClick={() => pickFile(null)}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80" aria-label="Remove image">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()}
          className="flex aspect-[16/4] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-card text-xs text-muted-foreground hover:border-brand-400 hover:text-brand-700">
          <ImageIcon className="h-5 w-5" /> Upload 16:4 banner (JPG, PNG, WEBP)
        </button>
      )}

      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Click-through link (optional, https://…)"
        className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-brand-400"
      />

      <label className="block text-[11px] text-muted-foreground">
        Display duration (hours) — after this, it stops showing to users. Leave blank to keep until removed.
        <input
          type="number" min="1" step="1" value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="e.g. 24"
          className="mt-0.5 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-brand-400"
        />
      </label>

      {err && <p className="flex items-center gap-1 text-[11px] text-destructive"><AlertCircle className="h-3 w-3" /> {err}</p>}

      <Button size="sm" className="w-full" disabled={!file || busy}
        onClick={async () => {
          if (!file) return;
          setBusy(true); setErr(null);
          try { await onCreate(file, link.trim() || null, hours.trim() ? Math.max(0, parseInt(hours, 10) || 0) : null); }
          catch (e: unknown) { setErr(errMessage(e, "Could not add promotion.")); }
          finally { setBusy(false); }
        }}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />}
        {busy ? "Uploading…" : "Publish promotion"}
      </